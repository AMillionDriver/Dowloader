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
└── backend/           # Node.js + Express backend
    ├── server.js     # Express server setup & routing
    ├── utils.js      # Helper functions for URL validation
    ├── package.json
    └── package-lock.json
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

3. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on http://localhost:5000. A `/health` endpoint is
available for quick status checks.

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

The frontend will run on http://localhost:3000. During development the Vite
proxy forwards `/api` requests to the backend automatically.

### Environment Variables

For deployments where the frontend is hosted separately from the backend, set
the API base URL via an environment variable in `frontend/.env`:

```
VITE_API_BASE_URL=https://your-backend-domain.com
```

If the variable is omitted the frontend will fall back to relative `/api`
requests, which works with the built-in development proxy.

## Important Note

The video extraction functions in `backend/utils.js` are currently placeholder implementations. You'll need to implement proper video extraction logic using appropriate APIs or third-party services for each platform (TikTok, Instagram, and Facebook).

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
