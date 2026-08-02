# AI Learning Assistant (MERN)

A full-stack MERN app that converts uploaded PDFs into interactive AI learning tools. The app includes AI chat, summaries, flashcards, quizzes, and progress tracking, with a React frontend and an Express/MongoDB backend.

## Repository Structure

- `Backend/` - Node.js Express API, authentication, file uploads, and Google Gemini AI integration
- `Frontend/` - React + Vite single-page app
- `.gitignore` - ignored files and folders

## Prerequisites

- Node.js 18+ installed
- MongoDB Atlas or MongoDB connection URL
- Google Gemini API key

## Setup

1. Install backend dependencies:

```bash
cd Backend
npm install
```

2. Install frontend dependencies:

```bash
cd ../Frontend
npm install
```

## Environment Variables

Create a `.env` file inside `Backend/` and add the following values:

```env
MONGODB_URI=<your-mongodb-connection-string>
PORT=5000
JWT_SECRET=<your-jwt-secret>
JWT_EXPIRE=7d
NODE_ENV=development
MAX_FILE_SIZE=10485760
GEMINI_API_KEY=<your-google-gemini-api-key>
```

## Run Locally

### Start backend

```bash
cd Backend
npm start
```

### Start frontend

```bash
cd Frontend
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Notes

- Uploaded PDFs are stored in `Backend/uploads/` and are excluded from git via `.gitignore`
- The backend entrypoint is `Backend/server.js`
- The frontend uses Vite and React Router
