from __future__ import annotations

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


def _make_temp_name(prefix: str = 'intersection') -> str:
    now = datetime.now()
    return f"{prefix}_{now.strftime('%Y%m%d')}_{now.strftime('%H%M%S')}_{now.microsecond // 1000:03d}.csv"


async def _save_upload(upload: UploadFile, target_dir: Path) -> Path:
    suffix = Path(upload.filename or 'upload.csv').suffix or '.csv'
    temp_path = target_dir / f"{datetime.now().timestamp():.0f}_{os.urandom(4).hex()}{suffix}"

    with temp_path.open('wb') as output_file:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            output_file.write(chunk)

    await upload.close()
    return temp_path


def _count_rows_fast(file_path: Path) -> int:
    if not file_path.exists() or file_path.stat().st_size == 0:
        return 0

    newline_count = 0
    last_byte = b''

    with file_path.open('rb') as file_handle:
        while True:
            chunk = file_handle.read(1024 * 1024)
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


def _job_paths(job_id: str) -> tuple[Path, Path, Path]:
    job_dir = JOBS_DIR / job_id
    file_a_path = job_dir / 'fileA.csv'
    file_b_path = job_dir / 'fileB.csv'
    return job_dir, file_a_path, file_b_path


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
) -> dict[str, Any]:
    if action != 'intersection':
        raise HTTPException(status_code=400, detail='Only intersection is supported right now')

    job_id = uuid.uuid4().hex
    job_dir, file_a_path, file_b_path = _job_paths(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    file_a_path = await _save_upload(file_a, job_dir)
    file_b_path = await _save_upload(file_b, job_dir)

    try:
        started_at = time.perf_counter()
        intersection, set_a_count, set_b_count, headers = _build_intersection(file_a_path, file_b_path)
        intersection_count = int(intersection.select(pl.len()).collect(streaming=True).item())
        processing_seconds = round(time.perf_counter() - started_at, 2)

        return {
            'success': True,
            'action': action,
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
    '/downloads/{job_id}',
    name='download_file',
    responses={
        404: {'description': 'File not found'},
    },
)
async def download_file(job_id: str) -> FileResponse:
    job_dir, file_a_path, file_b_path = _job_paths(job_id)
    if not file_a_path.exists() or not file_b_path.exists():
        raise HTTPException(status_code=404, detail='File not found')

    result_path = job_dir / 'result.csv'
    if not result_path.exists():
        intersection, _, _, _ = _build_intersection(file_a_path, file_b_path)
        intersection.sink_csv(str(result_path))

    return FileResponse(
        path=str(result_path),
        filename='intersection.csv',
        media_type='text/csv',
    )