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
├── frontend/           # React.js frontend (Vite)
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
    ├── package.json
    └── .env.example  # Environment variable template
```

## Setup and Installation

### Backend

1. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Copy the environment template and update values as needed:
   ```bash
   cp .env.example .env
   # (optional) edit .env to set PORT or CLIENT_ORIGIN
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on the configured `PORT` (defaults to `5000`).

### Frontend

1. Navigate to the frontend directory and install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. (Optional) Copy the provided environment example and adjust if necessary:
   ```bash
   cp .env.example .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

By default Vite serves the frontend on http://localhost:5173. Ensure the backend's `CLIENT_ORIGIN` matches this value.

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
