from __future__ import annotations

import json
import os
import uuid
import time
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

import polars as pl
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


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


def _build_intersection(file_a: Path, file_b: Path) -> tuple[pl.LazyFrame, int, int, list[str]]:
    headers_a = pl.read_csv(str(file_a), n_rows=0, encoding='utf8-lossy').columns
    headers_b = pl.read_csv(str(file_b), n_rows=0, encoding='utf8-lossy').columns

    if not headers_a or not headers_b:
        raise ValueError('Both files must contain at least one column')

    key_a = headers_a[0]
    key_b = headers_b[0]

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
    file_a: Path, file_b: Path, direction: str
) -> tuple[pl.LazyFrame, int, int, int, list[str]]:
    """Left anti join: records in one set but not the other.

    direction='a_minus_b': rows in A whose key is not in B (returns A's columns)
    direction='b_minus_a': rows in B whose key is not in A (returns B's columns)
    """
    headers_a = pl.read_csv(str(file_a), n_rows=0, encoding='utf8-lossy').columns
    headers_b = pl.read_csv(str(file_b), n_rows=0, encoding='utf8-lossy').columns

    if not headers_a or not headers_b:
        raise ValueError('Both files must contain at least one column')

    key_a = headers_a[0]
    key_b = headers_b[0]

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


def _build_merger(file_a: Path, file_b: Path) -> tuple[pl.LazyFrame, int, int, int, list[str]]:
    """Full outer join: all unique records from both sets."""
    headers_a = pl.read_csv(str(file_a), n_rows=0, encoding='utf8-lossy').columns
    headers_b = pl.read_csv(str(file_b), n_rows=0, encoding='utf8-lossy').columns

    if not headers_a or not headers_b:
        raise ValueError('Both files must contain at least one column')

    key_a = headers_a[0]
    key_b = headers_b[0]

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
) -> dict[str, Any]:
    if action not in ('intersection', 'merger', 'exclusion'):
        raise HTTPException(status_code=400, detail='action must be intersection, merger, or exclusion')

    job_id = uuid.uuid4().hex
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    file_a_path = job_dir / 'fileA.csv'
    file_b_path = job_dir / 'fileB.csv'
    await _save_upload_to(file_a, file_a_path)
    await _save_upload_to(file_b, file_b_path)
    action_label = f'{action}_{direction}' if action == 'exclusion' else action
    (job_dir / 'action.txt').write_text(action_label)

    try:
        started_at = time.perf_counter()

        if action == 'intersection':
            result_lf, set_a_count, set_b_count, headers = _build_intersection(file_a_path, file_b_path)
            result_df = result_lf.collect()
            intersection_count = len(result_df)
            result_count = intersection_count
        elif action == 'merger':
            result_lf, set_a_count, set_b_count, intersection_count, headers = _build_merger(file_a_path, file_b_path)
            result_df = result_lf.collect()
            result_count = len(result_df)
        else:  # exclusion
            result_lf, set_a_count, set_b_count, intersection_count, headers = _build_exclusion(
                file_a_path, file_b_path, direction
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
async def download_file(job_id: str) -> FileResponse:
    job_dir = JOBS_DIR / job_id
    result_path = job_dir / 'result.csv'

    if not result_path.exists():
        raise HTTPException(status_code=404, detail='Result not found. Please reprocess the files.')

    action_txt = job_dir / 'action.txt'
    action = action_txt.read_text().strip() if action_txt.exists() else 'intersection'

    created_at = datetime.fromtimestamp(result_path.stat().st_mtime)
    stamp = created_at.strftime('%Y%m%d_%H%M%S')

    return FileResponse(
        path=str(result_path),
        filename=f'{action}_{stamp}.csv',
        media_type='text/csv',
    )
