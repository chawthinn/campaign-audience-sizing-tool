from __future__ import annotations

import hashlib
import json
import os
import uuid
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated, Any

import polars as pl
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Optional GCS support — only loaded in deployments that set GCS_BUCKET
GCS_BUCKET = os.environ.get('GCS_BUCKET', '').strip()
try:
    from google.cloud import storage as _gcs_storage
    from google.auth import default as _google_auth_default
    from google.auth.transport import requests as _google_auth_requests
    _GCS_AVAILABLE = True
except ImportError:
    _GCS_AVAILABLE = False


BASE_DIR = Path(__file__).resolve().parent
TMP_DIR = BASE_DIR / 'tmp'
TMP_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR = TMP_DIR / 'jobs'
JOBS_DIR.mkdir(parents=True, exist_ok=True)


app = FastAPI(title='Campaign Audience Sizing API')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


async def _save_upload_to(upload: UploadFile, target_path: Path) -> None:
    with target_path.open('wb') as fh:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            fh.write(chunk)
    await upload.close()


def _count_rows_fast(file_path: Path) -> int:
    if not file_path.exists() or file_path.stat().st_size == 0:
        return 0

    newline_count = 0
    last_byte = b''

    with file_path.open('rb') as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            newline_count += chunk.count(b'\n')
            last_byte = chunk[-1:]

    line_count = newline_count if last_byte == b'\n' else newline_count + 1
    return max(0, line_count - 1)


def _resolve_keys(file_a: Path, file_b: Path, key_a: str, key_b: str) -> tuple[str, str, list[str], list[str]]:
    """Detect headers and validate the chosen join keys.

    Falls back to the first column of each file when a key is empty.
    """
    headers_a = pl.read_csv(str(file_a), n_rows=0, encoding='utf8-lossy').columns
    headers_b = pl.read_csv(str(file_b), n_rows=0, encoding='utf8-lossy').columns

    if not headers_a or not headers_b:
        raise ValueError('Both files must contain at least one column')

    resolved_a = key_a or headers_a[0]
    resolved_b = key_b or headers_b[0]

    if resolved_a not in headers_a:
        raise ValueError(f"Set A has no column named '{resolved_a}'. Available: {', '.join(headers_a)}")
    if resolved_b not in headers_b:
        raise ValueError(f"Set B has no column named '{resolved_b}'. Available: {', '.join(headers_b)}")

    return resolved_a, resolved_b, headers_a, headers_b


def _build_intersection(file_a: Path, file_b: Path, key_a: str = '', key_b: str = '') -> tuple[pl.LazyFrame, int, int, list[str]]:
    key_a, key_b, _, headers_b = _resolve_keys(file_a, file_b, key_a, key_b)

    ids_a = (
        pl.scan_csv(str(file_a), encoding='utf8-lossy')
        .select(pl.col(key_a).cast(pl.Utf8).str.strip_chars().alias(key_a))
        .filter(pl.col(key_a).is_not_null())
        .unique()
    )

    intersection = (
        pl.scan_csv(str(file_b), encoding='utf8-lossy')
        .with_columns(pl.col(key_b).cast(pl.Utf8).str.strip_chars().alias(key_b))
        .join(ids_a, left_on=key_b, right_on=key_a, how='inner')
    )

    return intersection, _count_rows_fast(file_a), _count_rows_fast(file_b), headers_b


def _build_exclusion(
    file_a: Path, file_b: Path, direction: str, key_a: str = '', key_b: str = ''
) -> tuple[pl.LazyFrame, int, int, int, list[str]]:
    """Left anti join: records in one set but not the other.

    direction='a_minus_b': rows in A whose key is not in B (returns A's columns)
    direction='b_minus_a': rows in B whose key is not in A (returns B's columns)
    """
    key_a, key_b, headers_a, headers_b = _resolve_keys(file_a, file_b, key_a, key_b)

    if direction not in ('a_minus_b', 'b_minus_a'):
        raise ValueError("direction must be 'a_minus_b' or 'b_minus_a'")

    ids_a = (
        pl.scan_csv(str(file_a), encoding='utf8-lossy')
        .select(pl.col(key_a).cast(pl.Utf8).str.strip_chars().alias(key_a))
        .filter(pl.col(key_a).is_not_null())
        .unique()
    )
    df_b_keyed = (
        pl.scan_csv(str(file_b), encoding='utf8-lossy')
        .with_columns(pl.col(key_b).cast(pl.Utf8).str.strip_chars().alias(key_b))
    )

    # Intersection count (for stats sidebar)
    intersection_count = int(
        df_b_keyed.join(ids_a, left_on=key_b, right_on=key_a, how='inner')
        .select(pl.len()).collect().item()
    )

    if direction == 'a_minus_b':
        ids_b = df_b_keyed.select(pl.col(key_b).alias(key_b)).filter(pl.col(key_b).is_not_null()).unique()
        excluded = (
            pl.scan_csv(str(file_a), encoding='utf8-lossy')
            .with_columns(pl.col(key_a).cast(pl.Utf8).str.strip_chars().alias(key_a))
            .join(ids_b, left_on=key_a, right_on=key_b, how='anti')
        )
        result_headers = headers_a
    else:
        excluded = df_b_keyed.join(ids_a, left_on=key_b, right_on=key_a, how='anti')
        result_headers = headers_b

    return excluded, _count_rows_fast(file_a), _count_rows_fast(file_b), intersection_count, result_headers


def _build_merger(file_a: Path, file_b: Path, key_a: str = '', key_b: str = '') -> tuple[pl.LazyFrame, int, int, int, list[str]]:
    """Full outer join: all unique records from both sets."""
    key_a, key_b, _, headers_b = _resolve_keys(file_a, file_b, key_a, key_b)

    ids_a = (
        pl.scan_csv(str(file_a), encoding='utf8-lossy')
        .select(pl.col(key_a).cast(pl.Utf8).str.strip_chars().alias(key_a))
        .filter(pl.col(key_a).is_not_null())
        .unique()
    )

    df_b = (
        pl.scan_csv(str(file_b), encoding='utf8-lossy')
        .with_columns(pl.col(key_b).cast(pl.Utf8).str.strip_chars().alias(key_b))
        .filter(pl.col(key_b).is_not_null())
    )

    # Count records that exist in both sets (for stats display)
    intersection_count = int(
        df_b.join(ids_a, left_on=key_b, right_on=key_a, how='inner')
        .select(pl.len()).collect().item()
    )

    # IDs from A that are not present in B
    b_keys = df_b.select(pl.col(key_b).alias(key_a)).unique()
    a_only = ids_a.join(b_keys, on=key_a, how='anti').rename({key_a: key_b})

    # Union: all rows from B + A-only rows (missing columns filled with null)
    merged = pl.concat([df_b, a_only], how='diagonal_relaxed')

    return merged, _count_rows_fast(file_a), _count_rows_fast(file_b), intersection_count, headers_b


@app.get('/health')
async def health() -> dict[str, str]:
    return {'status': 'ok'}


def _run_join(
    request: Request,
    file_a_path: Path,
    file_b_path: Path,
    job_id: str,
    job_dir: Path,
    action: str,
    direction: str,
    key_a: str,
    key_b: str,
) -> dict[str, Any]:
    """Shared post-upload processing: runs the join, writes result.csv, returns the response dict."""
    if action not in ('intersection', 'merger', 'exclusion'):
        raise HTTPException(status_code=400, detail='action must be intersection, merger, or exclusion')

    action_label = f'{action}_{direction}' if action == 'exclusion' else action
    (job_dir / 'action.txt').write_text(action_label)

    try:
        started_at = time.perf_counter()

        if action == 'intersection':
            result_lf, set_a_count, set_b_count, headers = _build_intersection(
                file_a_path, file_b_path, key_a, key_b
            )
            result_df = result_lf.collect()
            intersection_count = len(result_df)
            result_count = intersection_count
        elif action == 'merger':
            result_lf, set_a_count, set_b_count, intersection_count, headers = _build_merger(
                file_a_path, file_b_path, key_a, key_b
            )
            result_df = result_lf.collect()
            result_count = len(result_df)
        else:  # exclusion
            result_lf, set_a_count, set_b_count, intersection_count, headers = _build_exclusion(
                file_a_path, file_b_path, direction, key_a, key_b
            )
            result_df = result_lf.collect()
            result_count = len(result_df)

        result_path = job_dir / 'result.csv'
        result_df.write_csv(str(result_path))
        processing_seconds = round(time.perf_counter() - started_at, 2)

        return {
            'success': True,
            'action': action,
            'direction': direction if action == 'exclusion' else None,
            'jobId': job_id,
            'resultCount': result_count,
            'intersectionCount': intersection_count,
            'setACount': set_a_count,
            'setBCount': set_b_count,
            'headers': headers,
            'processingSeconds': processing_seconds,
            'downloadUrl': str(request.url_for('download_file', job_id=job_id)),
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post(
    '/process',
    responses={
        400: {'description': 'Bad request'},
        500: {'description': 'Processing failed'},
    },
)
async def process(
    request: Request,
    file_a: Annotated[UploadFile, File(..., alias='fileA')],
    file_b: Annotated[UploadFile, File(..., alias='fileB')],
    action: Annotated[str, Form()] = 'intersection',
    direction: Annotated[str, Form()] = 'a_minus_b',
    key_a: Annotated[str, Form()] = '',
    key_b: Annotated[str, Form()] = '',
) -> dict[str, Any]:
    """Multipart upload path — fine for small files (<32 MB on Cloud Run)."""
    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    file_a_path = job_dir / 'fileA.csv'
    file_b_path = job_dir / 'fileB.csv'
    await _save_upload_to(file_a, file_a_path)
    await _save_upload_to(file_b, file_b_path)

    return _run_join(request, file_a_path, file_b_path, job_id, job_dir, action, direction, key_a, key_b)


# ---------------------------------------------------------------------------
# GCS-backed upload path (bypasses Cloud Run's 32 MB body limit)
# ---------------------------------------------------------------------------

def _require_gcs() -> 'type':
    """Return the storage Client class, raising 503 if GCS isn't configured."""
    if not _GCS_AVAILABLE:
        raise HTTPException(status_code=503, detail='google-cloud-storage package not installed in this build')
    if not GCS_BUCKET:
        raise HTTPException(status_code=503, detail='Direct upload not configured: GCS_BUCKET env var not set')
    return _gcs_storage.Client


@app.post('/upload-url')
async def upload_url(request: Request) -> dict[str, str]:
    """Generate a V4 signed PUT URL so the browser can upload a CSV straight to GCS."""
    storage_client_cls = _require_gcs()

    body = await request.json()
    filename = str(body.get('filename', 'upload.csv'))
    content_type = str(body.get('contentType', 'text/csv'))

    safe_name = filename.replace('..', '_').replace('/', '_').replace('\\', '_')
    upload_id = uuid.uuid4().hex
    object_name = f'uploads/{upload_id}/{safe_name}'

    credentials, _ = _google_auth_default()
    credentials.refresh(_google_auth_requests.Request())

    client = storage_client_cls()
    bucket = client.bucket(GCS_BUCKET)
    blob = bucket.blob(object_name)

    url = blob.generate_signed_url(
        version='v4',
        expiration=timedelta(minutes=15),
        method='PUT',
        content_type=content_type,
        service_account_email=getattr(credentials, 'service_account_email', None),
        access_token=getattr(credentials, 'token', None),
    )

    return {'uploadUrl': url, 'gcsPath': object_name, 'contentType': content_type}


@app.post('/process-gcs')
async def process_gcs(request: Request) -> dict[str, Any]:
    """Process two CSVs that the client uploaded directly to GCS via signed URL."""
    storage_client_cls = _require_gcs()

    body = await request.json()
    gcs_path_a = str(body.get('gcsPathA', '')).strip()
    gcs_path_b = str(body.get('gcsPathB', '')).strip()
    if not gcs_path_a or not gcs_path_b:
        raise HTTPException(status_code=400, detail='gcsPathA and gcsPathB are required')

    action = str(body.get('action', 'intersection'))
    direction = str(body.get('direction', 'a_minus_b'))
    key_a = str(body.get('keyA', ''))
    key_b = str(body.get('keyB', ''))

    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    file_a_path = job_dir / 'fileA.csv'
    file_b_path = job_dir / 'fileB.csv'

    client = storage_client_cls()
    bucket = client.bucket(GCS_BUCKET)
    try:
        bucket.blob(gcs_path_a).download_to_filename(str(file_a_path))
        bucket.blob(gcs_path_b).download_to_filename(str(file_b_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Failed to fetch uploaded files from GCS: {exc}') from exc

    return _run_join(request, file_a_path, file_b_path, job_id, job_dir, action, direction, key_a, key_b)


@app.get(
    '/preview/{job_id}',
    responses={
        404: {'description': 'Result not found'},
    },
)
async def preview(
    job_id: str,
    page: int = 1,
    page_size: int = 50,
    search: str = '',
    sort_column: str = '',
    sort_direction: str = 'asc',
    filters: str = '',
) -> dict[str, Any]:
    """Paginated preview of the result CSV with search/sort/per-column filter."""
    result_path = JOBS_DIR / job_id / 'result.csv'
    if not result_path.exists():
        raise HTTPException(status_code=404, detail='Result not found')

    page = max(1, page)
    page_size = max(1, min(200, page_size))

    filter_dict: dict[str, str] = {}
    if filters:
        try:
            parsed = json.loads(filters)
            if isinstance(parsed, dict):
                filter_dict = {str(k): str(v) for k, v in parsed.items() if v}
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail='filters must be valid JSON')

    lf = pl.scan_csv(str(result_path), encoding='utf8-lossy')
    schema_names = lf.collect_schema().names()

    # Per-column substring filter (case-insensitive)
    for col, raw_val in filter_dict.items():
        if col not in schema_names:
            continue
        needle = raw_val.lower()
        lf = lf.filter(
            pl.col(col).cast(pl.Utf8).str.to_lowercase().str.contains(needle, literal=True)
        )

    # Global search across all columns (case-insensitive)
    if search:
        needle = search.lower()
        conditions = [
            pl.col(c).cast(pl.Utf8).str.to_lowercase().str.contains(needle, literal=True)
            for c in schema_names
        ]
        combined = conditions[0]
        for cond in conditions[1:]:
            combined = combined | cond
        lf = lf.filter(combined)

    total = int(lf.select(pl.len()).collect().item())

    if sort_column and sort_column in schema_names:
        descending = sort_direction.lower() == 'desc'
        lf = lf.sort(sort_column, descending=descending, nulls_last=True)

    offset = (page - 1) * page_size
    rows_df = lf.slice(offset, page_size).collect()

    return {
        'rows': rows_df.to_dicts(),
        'headers': schema_names,
        'totalRows': total,
        'page': page,
        'pageSize': page_size,
    }


@app.get(
    '/downloads/{job_id}',
    name='download_file',
    responses={
        404: {'description': 'Result not found'},
    },
)
async def download_file(job_id: str, columns: str = '', split: str = '') -> FileResponse:
    job_dir = JOBS_DIR / job_id
    base_result_path = job_dir / 'result.csv'

    if not base_result_path.exists():
        raise HTTPException(status_code=404, detail='Result not found. Please reprocess the files.')

    action_txt = job_dir / 'action.txt'
    action = action_txt.read_text().strip() if action_txt.exists() else 'intersection'
    created_at = datetime.fromtimestamp(base_result_path.stat().st_mtime)
    stamp = created_at.strftime('%Y%m%d_%H%M%S')

    all_headers = pl.read_csv(str(base_result_path), n_rows=0, encoding='utf8-lossy').columns

    # Parse columns param
    use_columns: list[str] | None = None
    if columns:
        col_list = [c.strip() for c in columns.split(',') if c.strip()]
        if not col_list:
            raise HTTPException(status_code=400, detail='columns must contain at least one column')
        invalid = [c for c in col_list if c not in all_headers]
        if invalid:
            raise HTTPException(status_code=400, detail=f'Unknown columns: {", ".join(invalid)}')
        if col_list != all_headers:
            use_columns = col_list

    # Parse split param
    split_parts: list[int] = []
    if split:
        try:
            split_parts = [int(x.strip()) for x in split.split(',') if x.strip()]
        except ValueError:
            raise HTTPException(status_code=400, detail='split must be comma-separated integers, e.g. "50,50"')
        if not split_parts or any(p <= 0 for p in split_parts) or sum(split_parts) != 100:
            raise HTTPException(status_code=400, detail='split percentages must be positive and sum to 100')

    # --- No split → serve a CSV (full or column-filtered) ---
    if not split_parts:
        serve_path = base_result_path
        if use_columns is not None:
            col_hash = hashlib.md5(','.join(use_columns).encode('utf-8')).hexdigest()[:10]
            filtered_path = job_dir / f'result_{col_hash}.csv'
            if not filtered_path.exists():
                (pl.scan_csv(str(base_result_path), encoding='utf8-lossy')
                    .select(use_columns)
                    .collect()
                    .write_csv(str(filtered_path)))
            serve_path = filtered_path
        return FileResponse(
            path=str(serve_path),
            filename=f'{action}_{stamp}.csv',
            media_type='text/csv',
        )

    # --- Split → build a ZIP with one CSV per group ---
    # Bumped v2: changed inner filename scheme to semantic names
    cache_key = f"v2|split={'-'.join(map(str, split_parts))}|cols={','.join(use_columns) if use_columns else 'all'}"
    cache_hash = hashlib.md5(cache_key.encode('utf-8')).hexdigest()[:10]
    zip_path = job_dir / f'split_{cache_hash}.zip'

    if not zip_path.exists():
        lf = pl.scan_csv(str(base_result_path), encoding='utf8-lossy')
        if use_columns is not None:
            lf = lf.select(use_columns)
        df = lf.collect()

        # Deterministic shuffle: same job + same params -> same split on every re-download
        seed = int(cache_hash, 16) % (2**31 - 1)
        df = df.sample(fraction=1.0, shuffle=True, seed=seed)

        inner_names = _split_filenames(split_parts)
        total = len(df)
        offset = 0
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for i, pct in enumerate(split_parts):
                if i == len(split_parts) - 1:
                    chunk = df.slice(offset)  # last group absorbs rounding remainder
                else:
                    size = (total * pct) // 100
                    chunk = df.slice(offset, size)
                    offset += size
                csv_bytes = chunk.write_csv()
                zf.writestr(inner_names[i], csv_bytes)

    return FileResponse(
        path=str(zip_path),
        filename=f'{action}_{stamp}.zip',
        media_type='application/zip',
    )


def _split_filenames(parts: list[int]) -> list[str]:
    """Map a split spec to semantic CSV filenames inside the ZIP."""
    if parts == [50, 50]:
        return ['segment_a.csv', 'segment_b.csv']
    if parts == [80, 20]:
        return ['target_group.csv', 'control_group.csv']
    if parts == [70, 30]:
        return ['segment_a.csv', 'segment_b.csv']
    # Fallback: segment_a.csv, segment_b.csv, segment_c.csv, ...
    return [f'segment_{chr(ord("a") + i)}.csv' for i in range(len(parts))]
