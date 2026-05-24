---
title: CampaignAudienceSizingTool
emoji: 📊
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---
# 🎯 Campaign Audience Sizing Tool

A web-based campaign segment sizing tool for marketing teams to estimate eligible audience counts from large datasets in real time. This tool enables users to upload and instantly view the intersection count between two large CSV files (3M+ rows), replacing slow Excel workflows.

## Features

✅ **Real-Time Intersection Analysis** - Process millions of records instantly
✅ **Interactive Venn Diagram** - Visual representation of set intersections
✅ **Simple Export Flow** - Generate and download the intersected CSV directly
✅ **Responsive Design** - One-page layout optimized for minimal scrolling
✅ **Progress Tracking** - Real-time processing status

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS + custom components
- **State Management**: Zustand
- **Backend**: FastAPI + Polars for CSV processing
- **Visualization**: Custom SVG (Venn diagram)

## Project Structure

```
├── pages/
│   ├── _app.tsx              # Next.js app wrapper
│   ├── _document.tsx         # HTML document setup
│   ├── index.tsx             # Main one-page interface
│   └── api/                  # API routes (for future backend)
├── components/
│   ├── FileUpload.tsx        # CSV file upload component
│   ├── VennDiagram.tsx       # Venn diagram visualization
│   ├── FilterPanel.tsx       # Filtering & export controls
│   └── ResultsTable.tsx      # Paginated results display
├── lib/
│   ├── firebase.ts           # Firebase configuration
│   ├── backend.ts            # Backend URL helpers
│   └── store.ts              # Zustand state management
├── backend/
│   ├── main.py               # FastAPI + Polars service
│   └── requirements.txt      # Python dependencies
├── utils/
│   └── csvProcessor.ts       # CSV processing utilities
├── styles/
│   └── globals.css           # Global styles
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Getting Started

### Prerequisites
- Node.js 16+ and npm/yarn
- Python 3.10+ for the FastAPI backend

### Installation

1. **Clone and install dependencies**
```bash
cd "Campaign Audience Sizing Tool"
npm install
```

2. **Configure the backend URL**
```bash
set NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

3. **Install and run the Python backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

4. **Run development server**
```bash
npm run dev
```

5. **Open browser**
Navigate to `http://localhost:3000`

## Usage

1. **Upload Files**
   - Drag & drop or click to upload two CSV files
   - Each file must have a unique ID in the first column

2. **Analyze Intersection**
   - Click "Analyze Intersection" button
   - The FastAPI backend writes the result CSV and returns a download link

3. **Download Data**
   - Click "Download CSV"
   - The browser downloads the generated intersection file

## Performance

- **3M+ row files**: handled by the Python backend
- **Polars execution**: streaming-friendly and multi-threaded
- **Separated frontend/backend**: Next.js stays focused on UI

## Future Enhancements

- [ ] Queue-based processing for very large jobs
- [ ] Firebase authentication
- [ ] Cloud storage for file history
- [ ] Advanced analytics (statistics, charts)
- [ ] Duplicate detection
- [ ] Data quality checks
- [ ] Multi-file intersection

## Building for Production

```bash
npm run build
npm run start
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Yes for Python split | FastAPI base URL, for example `http://localhost:8000` |

## Troubleshooting

**"CSV not found" error**: Ensure first column contains unique IDs

**Processing is slow**: Large files (3M+ rows) are processed client-side. Consider Express backend for very large datasets.

**Download not working**: Check browser console for errors. CSV export requires write permissions.

## License

MIT

## Support

For issues or feature requests, create a GitHub issue.
