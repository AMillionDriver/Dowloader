# Social Media Video Downloader

A fullstack web application for downloading videos from TikTok, Instagram, and Facebook with a hardened, hashed, and integrity-checked pipeline.

## Features

- Support for TikTok, Instagram, and Facebook videos
- Simple and clean user interface
- Progress tracking for downloads
- Error handling and validation

## Project Structure

```
video-downloader/
├── frontend/           # React.js frontend
│   ├── src/
│   │   ├── App.jsx    # Main application component
│   │   ├── App.css    # Styles
│   │   └── main.jsx   # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── backend/           # Node.js + Express backend
    ├── server.js     # Express server setup
    ├── utils.js      # Helper functions
    └── package.json
```

## Setup and Installation

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template and configure a strong secret (minimum 16 characters):
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on http://localhost:5000 by default. You can adjust the `PORT` and allowed `CORS_ORIGINS` inside `.env`.

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Configure the backend API base URL:
   ```bash
   cp .env.example .env
   ```
   Update `VITE_API_BASE_URL` if your backend runs on a different host or port.

4. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on http://localhost:3000.

## Security Hardening

- Strict domain validation ensures only TikTok, Instagram, or Facebook URLs are processed.
- Every request must include a SHA-256 fingerprint of the submitted URL. The backend recomputes the hash to detect tampering.
- Download URLs are signed with an HMAC integrity token using a configurable secret stored only on the server.
- Responses expose hashed identifiers so clients can verify downloads and audit their activity.
- Helmet, CORS, logging, and request rate limiting harden the API surface.

## Downloader Engine

The backend integrates [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) through the `yt-dlp-exec` wrapper to extract secure, temporary stream URLs without storing any media on the server. This supports TikTok, Instagram, and Facebook out of the box.

## License

MIT
