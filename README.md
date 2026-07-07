# Social Media Video Downloader

A stateless fullstack downloader for TikTok, Instagram, and Facebook links.

The backend resolves metadata and direct media URLs with `yt-dlp`. The browser downloads media in chunks through a stateless server proxy, joins the chunks locally, and saves the file on the user's device. The server streams byte ranges but does not store download files, progress, history, jobs, or temporary media.

## Features

- TikTok, Instagram, and Facebook URL lookup
- Single-file video and audio format listing
- Server-proxied chunk downloads with client-side progress
- File System Access API support for large files in Chrome and Edge
- Blob download fallback for browsers without direct disk streaming support
- Direct subtitle links when a platform exposes them

## Architecture

```text
frontend/
  src/
    components/              React UI
    hooks/useDownloader.js   Client-side download state machine
    services/                API client and browser download runtime

backend/
  src/
    controllers/             Request validation and API handlers
    routes/                  Express API routes
    services/                yt-dlp metadata and manifest resolver
```

## API

### `POST /api/info`

Request:

```json
{ "url": "https://example.com/video" }
```

Returns video metadata, single-file formats, and direct subtitle entries when available.

### `POST /api/download-manifest`

Request:

```json
{ "url": "https://example.com/video", "formatId": "18" }
```

Returns a proxied client download manifest with file metadata, chunk size, byte ranges, a signed stateless token, and the chunk endpoint.

### `POST /api/download-chunk`

Request:

```json
{ "token": "signed-token", "start": 0, "end": 8388607 }
```

Streams the requested byte range from the platform CDN through the backend without saving it to disk.

## Setup

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend defaults to `http://localhost:5000`. Set `PORT` or `CLIENT_ORIGIN` in `backend/.env` when needed.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite defaults to `http://localhost:5173`. Set `VITE_API_BASE_URL` in `frontend/.env` if the backend runs elsewhere.

## Notes

- V1.1 uses stateless server proxy downloads by default to avoid browser CDN CORS failures.
- V1.1 only shows single-file formats. Separate audio/video muxing is intentionally out of scope.
- Download tokens expire after 15 minutes; the frontend refreshes the manifest once if a token or upstream media URL expires mid-download.

## License

MIT
