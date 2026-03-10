# crm-project

## Structure

- `backend/`: Node.js backend service and admin app source
- `frontend/`: ocean frontend static build output
- `admin/`: legacy standalone admin static build output at the repository root

## Backend

Run the backend from `backend/`:

```bash
cd backend
npm install
npm start
```

Run the backend self-check:

```bash
cd backend
npm run selfcheck
```

Run the backend smoke test:

```bash
cd backend
npm run smoke
```

Run the backend integration test:

```bash
cd backend
npm run integration
```

Run the backend persistence test:

```bash
cd backend
npm run persistence
```

Run the backend archive test:

```bash
cd backend
npm run archive
```

Required environment variables:

- `ADMIN_PASSWORD`: admin login password
- `DISCORD_WEBHOOK_URL`: optional Discord webhook for home-enter notifications

Environment template:

- `backend/.env.example`
- `DATA_FILE`: optional path for persisted backend records JSON; if omitted, backend runs in memory only
- `DATA_ARCHIVE_FILE`: optional archive file for aged-out records; used only when `DATA_FILE` is set
- `DATA_RETENTION_DAYS`: keep offline records in primary JSON for this many days
- `DATA_MAX_ACTIVE_RECORDS`: cap how many records remain in primary JSON before older offline records are archived

## Deployment

### Railway

This repository is prepared for a root-level Railway deployment via the included `Dockerfile`.

Railway service responsibilities:

- backend API and Socket.IO
- admin dashboard at `/admin`

Required Railway environment variables:

- `ADMIN_PASSWORD`
- `CORS_ORIGINS=https://your-ocean-app.vercel.app`

Optional Railway environment variables:

- `DISCORD_WEBHOOK_URL`
- `DATA_FILE`
- `DATA_ARCHIVE_FILE`
- `DATA_RETENTION_DAYS`
- `DATA_MAX_ACTIVE_RECORDS`

Health check path:

- `/healthz`

### Vercel

`ocean` should be deployed separately to Vercel and point at the Railway backend domain.

If the ocean frontend uses backend APIs or socket connections, configure its Vercel environment variables to use your Railway service URL.
