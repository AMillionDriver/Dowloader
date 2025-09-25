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

3. (Optional) Configure environment variables:
   ```bash
   # Port the backend should listen on (default: 5000)
   export PORT=5000

   # Origin that is allowed to access the API (default: http://localhost:5173)
   export CLIENT_ORIGIN=http://localhost:5173
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will run on http://localhost:5000.

### Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file in `frontend/` to configure the backend API URL:
   ```bash
   VITE_API_BASE_URL=http://localhost:5000
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on http://localhost:5173 by default when using Vite.

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
