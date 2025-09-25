# Social Media Video Downloader

A fullstack web application for downloading videos from TikTok, Instagram, and Facebook.

The upgraded backend now generates encrypted, hashed download URLs backed by `yt-dlp` so the downloader really works against the vast majority of public video links supported by yt-dlp. Each generated URL is short-lived and signed with AES-256-GCM + HMAC-SHA256 to keep both the frontend and backend interactions hardened.

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
    ├── src/
    │   ├── server.js            # Express server setup & security middleware
    │   ├── controllers/         # Business logic for encrypted downloads
    │   ├── utils/               # yt-dlp integration & crypto helpers
    │   └── middleware/          # Error handling & guards
    ├── .env.example             # Example environment configuration
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

3. Copy the environment file and adjust secrets as needed:
   ```bash
   cp .env.example .env
   # edit .env to update DOWNLOAD_TOKEN_SECRET, PUBLIC_BASE_URL, dll.
   ```

4. Start the development server:
    ```bash
    npm run dev
    ```

The backend server will run on http://localhost:5000

### Keamanan backend

- Set `DOWNLOAD_TOKEN_SECRET` ke nilai rahasia minimal 32 karakter untuk menghasilkan token HMAC yang kuat.
- `DOWNLOAD_TOKEN_TTL` mengontrol durasi (dalam milidetik) tautan unduhan terenkripsi sebelum kadaluarsa (default 5 menit).
- `PUBLIC_BASE_URL` harus menunjuk ke domain backend Anda jika frontend disajikan dari host lain.
- Semua endpoint dilindungi helmet, rate limiting, dan token terenkripsi, sehingga URL asli tidak pernah diekspos langsung ke browser.

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on http://localhost:3000

#### Konfigurasi keamanan frontend

- Buat file `.env` di direktori `frontend` (atau gunakan variabel environment) dan set `VITE_API_BASE_URL` ke URL backend (`http://localhost:5000` saat pengembangan).
- Frontend hanya menerima URL valid dan menampilkan metadata video yang diambil secara aman dari backend.

## Teknologi downloader

Download video kini ditangani langsung oleh backend melalui `yt-dlp`, sehingga mendukung puluhan platform populer termasuk TikTok, Instagram, dan Facebook tanpa perlu menulis parser manual.

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
