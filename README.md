---
title: CampaignAudienceSizingTool
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# 🎯 Marketing Audience Segmentation Tool

A web app that lets marketing teams compare two large audience CSVs (millions of rows) and instantly see the **intersection**, **union (merger)**, or **exclusion** between them — then export the result, optionally split into A/B segments for campaign testing.

Built to replace painful Excel/Sheets workflows where joining two 100MB+ files either crashes the spreadsheet or takes hours.

**Live:** [campaign-audience-sizing-tool.vercel.app](https://campaign-audience-sizing-tool.vercel.app)
**Backend:** Google Cloud Run · **Frontend:** Vercel · **Storage:** Google Cloud Storage

---

## What it does

| Operation | What you get | SQL equivalent |
|---|---|---|
| **Audience Intersection** | Users present in **both** files | `INNER JOIN` |
| **Audience Merger** | All unique users from both files combined | `FULL OUTER JOIN` |
| **Audience Exclusion** | Users in one file but **not** the other (direction switchable) | `LEFT ANTI JOIN` |

For each operation you can:

- Pick the **primary key column** per file (no more "must be first column" rule — works with mismatched schemas)
- Preview the result in an **Excel-style grid** with global search, per-column filter, sortable headers, and pagination — all server-paginated so it's instant even on 1.7M-row results
- **Export** the result as CSV, or randomly **split** into segments (50/50, 80/20, 70/30, or custom) packaged as a ZIP
- Choose which **columns** to include in the export

---

## Architecture

```
┌──────────────┐    HTTPS    ┌─────────────────┐
│   Vercel     │ ──────────► │   Cloud Run     │
│  (Next.js)   │ ◄────────── │   (FastAPI +    │
└──────┬───────┘             │    Polars)      │
       │                     └────────┬────────┘
       │ direct upload via            │ read/write
       │  signed URL                  │
       ▼                              ▼
   ┌─────────────────────────────────────────┐
   │   Google Cloud Storage (cast-uploads-…) │
   │   ├ uploads/   (user CSVs, 1-day TTL)   │
   │   ├ dummy/     (sample data, kept)      │
   │   └ results/   (job outputs)            │
   └─────────────────────────────────────────┘
```

### Why this architecture

- **Cloud Run** has a 32 MB HTTP/1 body limit, which would block any real-world audience file. We solve it by having the browser upload **directly to Cloud Storage** via signed URLs (bypassing Cloud Run entirely for the bytes), then calling the API with just the GCS paths.
- **Result downloads** go the same way in reverse: backend writes result to GCS, returns a 302 redirect to a signed download URL. This also fixes Cloud Run's 32 MB *response* cap and means downloads work across any container instance even when the service autoscales.
- **Polars** does the heavy CSV joins — lazy + streaming, multi-threaded. A 3M × 1.72M-row intersection runs in ~4 seconds on a 2 vCPU Cloud Run instance.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS (with dark mode), Zustand for state, Papa Parse for client-side header detection |
| Backend | FastAPI, Polars (CSV joins), google-cloud-storage (signed URLs) |
| Infra | Vercel (frontend hosting), Google Cloud Run (backend), Google Cloud Storage (uploads + results), Docker |

---

## Project structure

```
.
├── pages/
│   ├── _app.tsx              # App wrapper + theme init script (avoids flash of light)
│   ├── _document.tsx
│   └── index.tsx             # Main page: layout, analyze handler, GCS upload logic
├── components/
│   ├── FileUpload.tsx        # CSV upload + dummy picker + primary-key dropdowns
│   ├── VennDiagram.tsx       # Tabs (Intersection/Merger/Exclusion) + SVG diagrams
│   ├── ResultsTable.tsx      # Summary card with record counts
│   ├── ResultsPreview.tsx    # Excel-style paginated grid with search/filter/sort
│   └── FilterPanel.tsx       # Export modal: columns, random split, download
├── lib/
│   ├── store.ts              # Zustand global state
│   ├── backend.ts            # API URL builders
│   └── theme.ts              # Light/dark mode hook + localStorage persistence
├── backend/
│   ├── main.py               # FastAPI: /process, /process-gcs, /upload-url,
│   │                         #          /dummy-files, /preview, /downloads
│   └── requirements.txt
├── styles/globals.css
├── Dockerfile                # Single image: serves on $PORT (Cloud Run) or 7860 (HF Spaces)
├── .gcloudignore             # Keeps Cloud Build uploads small
└── .github/workflows/sync-to-hub.yml   # Auto-sync to Hugging Face Spaces on main push
```

---

## API

All endpoints return JSON unless noted.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/dummy-files` | List pre-uploaded sample CSVs in GCS with their column headers |
| POST | `/upload-url` | Generate a V4 signed PUT URL for direct browser → GCS upload |
| POST | `/process` | Multipart upload + join (used for files < 25 MB) |
| POST | `/process-gcs` | JSON body with `gcsPathA` / `gcsPathB` + operation params; runs the join on files already in GCS |
| GET | `/preview/{job_id}` | Server-paginated preview with `?page`, `?page_size`, `?search`, `?sort_column`, `?sort_direction`, `?filters` (JSON) |
| GET | `/downloads/{job_id}` | Returns a 302 redirect to a signed GCS download URL. Accepts `?columns=` (subset) and `?split=` (e.g. `50,50`) to filter/partition the output |

---

## Local development

### Prerequisites
- Node.js 18+
- Python 3.10+

### Setup

```bash
# 1. Frontend
npm install
cp .env.example .env       # then point NEXT_PUBLIC_BACKEND_URL at your local backend

# 2. Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 3. Frontend (separate terminal)
npm run dev
```

Open http://localhost:3000.

Local dev skips the GCS upload path automatically for files under 25 MB and uses the multipart `/process` endpoint instead, so you don't need GCS configured locally for small test files.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Frontend (`.env` locally, Vercel project settings in prod) | Where the React app talks to FastAPI |
| `GCS_BUCKET` | Backend (set on Cloud Run) | Name of the Cloud Storage bucket used for uploads, dummies, and results. If unset, GCS features are disabled and only the multipart `/process` path works |

---

## Deployment

### Backend → Google Cloud Run

```bash
gcloud run deploy cast-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi --cpu 2 \
  --timeout 300 --max-instances 3 \
  --port 7860 --cpu-boost \
  --set-env-vars GCS_BUCKET=<your-bucket-name>
```

The Cloud Run service account needs:
- `roles/storage.objectAdmin` on the bucket
- `roles/iam.serviceAccountTokenCreator` on itself (so it can sign URLs without a private key file)

### Cloud Storage bucket setup

```bash
BUCKET="cast-uploads-<your-project-number>"

# Create bucket
gcloud storage buckets create gs://$BUCKET --location=us-central1 --uniform-bucket-level-access

# CORS so the browser can PUT directly
echo '[{"origin":["*"],"method":["PUT","GET","HEAD"],"responseHeader":["Content-Type"],"maxAgeSeconds":3600}]' > cors.json
gcloud storage buckets update gs://$BUCKET --cors-file=cors.json

# Lifecycle: auto-delete uploaded files after 1 day (keeps dummy/ forever)
echo '{"lifecycle":{"rule":[{"action":{"type":"Delete"},"condition":{"age":1,"matchesPrefix":["uploads/"]}}]}}' > lifecycle.json
gcloud storage buckets update gs://$BUCKET --lifecycle-file=lifecycle.json

# Upload sample data (optional)
gcloud storage cp public/dummy_data/eligible_base_users.csv gs://$BUCKET/dummy/eligible_base_users.csv
gcloud storage cp public/dummy_data/targeting_list.csv     gs://$BUCKET/dummy/targeting_list.csv
```

### Frontend → Vercel

1. Import the repo at vercel.com/new
2. Project settings → Environment Variables → add `NEXT_PUBLIC_BACKEND_URL` = your Cloud Run service URL
3. Deploy

### Alternate backend host: Hugging Face Spaces

The repo includes `.github/workflows/sync-to-hub.yml` which auto-syncs `main` to a Hugging Face Space (Docker SDK). The Dockerfile listens on `$PORT` if set (Cloud Run) and falls back to 7860 (HF Spaces default).

---

## Performance notes

| Operation | Local (laptop, 8 cores) | Cloud Run (2 vCPU + CPU boost) |
|---|---|---|
| Intersection on 3M × 1.72M rows | ~5 s | ~4 s |
| Merger on same | ~9 s | ~10 s |
| Exclusion on same | ~5 s | ~7 s |
| Preview page (search across 3M rows) | ~1.5 s | ~1.7 s |
| Download 86MB result | instant (file already local) | streamed via signed GCS URL |

The main bottleneck on the deployed app is the **browser → GCS upload** for large files — bounded by the user's residential upload bandwidth. Uploads run in parallel for both files to roughly halve wall time.

---

## Credits

Built by [Chaw Thinn](https://chawthinn.github.io/) · 2026

MIT licensed.
