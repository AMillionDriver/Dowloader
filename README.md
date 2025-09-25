# Social Media Video Downloader

A fullstack web application for downloading videos from TikTok, Instagram, and Facebook.

## Features

- Support for TikTok, Instagram, and Facebook URLs
- Express backend with validation and unified `/api/download` endpoint
- React frontend with progress feedback and download link handoff
- Environment-based configuration so the frontend can talk to different backend deployments

## Project Structure

```
Dowloader/
├── backend/               # Node.js + Express backend
│   ├── server.js          # Express server setup
│   ├── utils.js           # Helper utilities and placeholder extraction logic
│   ├── package.json
│   └── package-lock.json
│
└── frontend/              # React + Vite frontend
    ├── src/
    │   ├── App.jsx        # Main application component
    │   ├── App.css        # Styles
    │   └── main.jsx       # Entry point
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── .env.example
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

   The backend server will run on `http://localhost:5000` by default. The `/api/download` endpoint validates the incoming URL and returns a placeholder download link. Replace the logic inside `backend/utils.js` with your own extraction workflow when you are ready to integrate with a real provider.

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

   The frontend will run on `http://localhost:3000`. During local development, API requests to `/api/...` are proxied to the backend server running on port `5000`.

### Environment Variables

The frontend reads the `VITE_API_BASE_URL` environment variable to determine where API requests should be sent.

- When running locally you can omit it, and the app will automatically talk to the local backend via the `/api` proxy.
- For production deployments, create an `.env` file based on `.env.example` and set the value to the public URL of your backend, e.g. `https://your-domain.com/api`.

## Important Note

The video extraction logic inside `backend/utils.js` currently returns a placeholder link. Implement proper download handling that satisfies the terms of service of each platform (TikTok, Instagram, and Facebook) before going to production.

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
