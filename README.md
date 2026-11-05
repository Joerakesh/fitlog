# FitLog — Personal Workout Tracker

A simple Express + MongoDB Atlas workout tracker with a single-page `index.html` frontend.

## Features
- Default PULL / LEGS / PUSH workout plans seeded into MongoDB on first server start.
- Start a workout and log each set's reps and weight.
- Add extra sets during a session.
- Rest timer after saving a set.
- Finish or cancel a session.
- Workout history and basic progress summary (completed workouts, sets, reps, total volume and best weight per exercise).
- Edit target sets and reps for future sessions.
- Start-sleep and wake-up buttons with sleep duration history.
- Express API and static frontend served from the same server.

## Requirements
- Node.js 18+
- MongoDB Atlas cluster and database user

## Setup
1. Download/clone this repository.
2. Install packages:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env`.
4. Replace `MONGODB_URI` with your MongoDB Atlas connection string. URL-encode special characters in the database password.
5. In MongoDB Atlas, allow your current IP address in Network Access. For local development, avoid `0.0.0.0/0` unless you understand the security implications.
6. Start the server:
   ```bash
   npm start
   ```
7. Open http://localhost:3000

For automatic restart while developing:
```bash
npm run dev
```

## API
- `GET /api/health`
- `GET /api/plans`
- `POST /api/plans`
- `PATCH /api/plans/:name`
- `POST /api/workouts`
- `PATCH /api/workouts/:id`
- `GET /api/workouts`
- `GET /api/analytics/summary`
- `POST /api/sleep/start`
- `POST /api/sleep/wake`
- `GET /api/sleep`

## Important notes
- The app does not include authentication yet. Keep it on your own machine or a trusted private network; do not expose it publicly with personal data until authentication and authorization are added.
- Configure a dedicated, least-privilege Atlas database user.
- Historical workout entries are stored as session snapshots. Updating a plan affects future workouts, not already saved sessions.
- This is an initial working foundation, not a production-hardened deployment. Add authentication, request validation, offline sync and stronger error handling before public hosting.
