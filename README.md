# Social Media Video Downloader

A fullstack web application for downloading videos from TikTok, Instagram, and Facebook.

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
└── backend/           # Secure Node.js + Express backend
    ├── src/
    │   ├── server.js               # Express server setup
    │   ├── routes/                 # API route definitions
    │   ├── controllers/            # Request handlers
    │   ├── services/               # Download & security services
    │   └── utils/security.js       # Hashing / encryption helpers
    └── package.json
```

## Setup and Installation

### Backend

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies (installs yt-dlp automatically):
   ```bash
   npm install
   ```

3. (Optional) Set environment variables in `.env`:
   ```bash
   APP_SECRET=super-strong-secret
   CLIENT_ORIGIN=http://localhost:3000
   PUBLIC_BASE_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on http://localhost:5000

### Backend Security Features

- `yt-dlp` integration ensures TikTok, Instagram, and Facebook videos are actually downloaded server-side.
- Each client must obtain a cryptographically signed session via `/api/security/handshake` before accessing download endpoints.
- Downloaded files are encrypted at rest and exposed through short-lived, HMAC-signed URLs, preventing tampering.
- Security middleware (Helmet, HPP, rate limiting, strict CORS) hardens the API.

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Optionally configure the backend URL:
   ```bash
   echo "VITE_API_BASE_URL=http://localhost:5000" > .env.local
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on http://localhost:3000

## Important Note

The backend downloads media through the bundled `yt-dlp` binary. Make sure the host machine can reach the social platforms so that `yt-dlp` can resolve the video streams successfully.

## Optional: Adding MongoDB

To add MongoDB support for storing download history:

1. Install additional dependencies in the backend:
   ```bash
   npm install mongoose
   ```

2. Create a `models` directory in the backend and add your schema
3. Update the download endpoint to store download history

## License

MIT
