# Phase 0

The repository now keeps the Vite app in `frontend` and the Node API in `backend`.

## Local Development

Frontend:

```bash
cd frontend
npm run dev
```

Backend:

```bash
cd backend
npm run dev
```

The frontend reads the backend URL from:

```env
VITE_API_URL=http://localhost:4000
```

The backend runs on port `4000` by default and exposes:

```text
GET /health
GET /api/health
```
