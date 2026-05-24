# 🎯 Campaign Audience Sizing Tool

A web-based campaign segment sizing tool for marketing teams to estimate eligible audience counts from large datasets in real time. This tool enables users to upload and instantly view the intersection count between two large CSV files (3M+ rows), replacing slow Excel workflows.

## Features

✅ **Real-Time Intersection Analysis** - Process millions of records instantly
✅ **Interactive Venn Diagram** - Visual representation of set intersections
✅ **Smart Filtering** - Segment results by column values
✅ **Paginated Results** - Browse large datasets without loading everything
✅ **CSV Export** - Download filtered subsets (works around Excel 1M row limit)
✅ **Responsive Design** - One-page layout optimized for minimal scrolling
✅ **Progress Tracking** - Real-time processing status

## Tech Stack

- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Styling**: Tailwind CSS + custom components
- **State Management**: Zustand
- **Data Processing**: PapaParse (CSV streaming)
- **Visualization**: Custom SVG (Venn diagram)
- **Backend Ready**: Express.js integration for heavy lifting

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
│   └── store.ts              # Zustand state management
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
- Firebase project (for auth & storage)

### Installation

1. **Clone and install dependencies**
```bash
cd "Campaign Audience Sizing Tool"
npm install
```

2. **Configure Firebase** (optional for now)
```bash
cp .env.example .env.local
# Add your Firebase credentials to .env.local
```

3. **Run development server**
```bash
npm run dev
```

4. **Open browser**
Navigate to `http://localhost:3000`

## Usage

1. **Upload Files**
   - Drag & drop or click to upload two CSV files
   - Each file must have a unique ID in the first column

2. **Analyze Intersection**
   - Click "Analyze Intersection" button
   - See real-time progress and Venn diagram

3. **Filter Results**
   - Select a column from dropdown
   - Click a value to filter matching records
   - Results update instantly

4. **Export Data**
   - Click "Export as CSV"
   - Download filtered subset for external analysis

5. **Navigate Results**
   - Use pagination buttons to browse records
   - Change "per page" to adjust table size

## Performance

- **3M row files**: ~10-30 seconds processing
- **Streaming approach**: Minimal memory usage
- **Client-side processing**: No server needed for MVP

## Future Enhancements

- [ ] Express backend for server-side processing
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
| `NEXT_PUBLIC_FIREBASE_API_KEY` | No (for future use) | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | No (for future use) | Firebase project ID |
| `NEXT_PUBLIC_API_URL` | No | Backend API base URL |

## Troubleshooting

**"CSV not found" error**: Ensure first column contains unique IDs

**Processing is slow**: Large files (3M+ rows) are processed client-side. Consider Express backend for very large datasets.

**Download not working**: Check browser console for errors. CSV export requires write permissions.

## License

MIT

## Support

For issues or feature requests, create a GitHub issue.
