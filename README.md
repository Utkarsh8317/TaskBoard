# Task Assignment Board

A full-stack web app for managing projects and tasks with role-based access.

## Features

- Authentication (Signup/Login) with JWT
- Role-based access (`Admin`, `Member`)
- Project creation and team member assignment
- Task creation, assignment, and status updates
- Dashboard with task summary:
  - Total
  - Done
  - In Progress
  - Pending
  - Overdue
- Validation for user input, role checks, and relationships

## Tech Stack

- Frontend: React + Vite + Axios
- Backend: Flask + Flask-JWT-Extended + Flask-SQLAlchemy
- Database: SQLite

## Project Structure

- `backend/` - Flask API and database models
- `frontend/` - React UI

## Backend Setup

1. Open terminal in `backend/`
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Start backend server:

```bash
python app.py
```

Backend runs on `http://127.0.0.1:5000`.

## Frontend Setup

1. Open terminal in `frontend/`
2. Install dependencies:

```bash
npm install
```

3. Start frontend:

```bash
npm run dev
```

Frontend runs on `http://localhost:5173` (or next available port).

## API Base URL

Frontend uses:

- `VITE_API_URL` if defined
- otherwise defaults to `http://localhost:5000`

Optional `.env` in `frontend/`:

```env
VITE_API_URL=http://127.0.0.1:5000
```

## User Flow

### Admin

1. Signup/Login as `Admin`
2. Create project
3. Add users to project (optional)
4. Create task and assign to user
5. Track progress in dashboard

### Member

1. Signup/Login as `Member`
2. View assigned projects
3. View project tasks
4. Update task status

## Main API Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `GET /users`
- `GET /projects`
- `POST /projects`
- `POST /projects/<project_id>/members`
- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/<task_id>`
- `GET /dashboard`

## Notes

- SQLite database file is created automatically in backend instance folder.
- If port `5173` is busy, Vite selects another port (for example `5174`).
