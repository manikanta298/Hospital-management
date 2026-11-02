# ICTHospital – PERN edition

The Laravel hospital management system, rebuilt on **PostgreSQL · Express · React · Node.js**.

| Layer | Was (Laravel) | Now |
|---|---|---|
| API | Laravel 12 controllers, Blade views | Express 4 routers (`backend/src/routes`), JSON API under `/api` |
| UI | ~134 Blade templates | React 18 + React Router (`frontend/src/pages`), Vite |
| DB | MySQL / SQLite, 111 migrations | PostgreSQL 14+, `backend/db/schema.sql` (generated from the migrations) |
| Auth | Laravel sessions, Passport | `express-session` (stored in PostgreSQL), bcrypt (Laravel `$2y$` hashes still work) |
| Permissions | `checkPermission:` middleware + `permission` table | same table, `can('patient_view')` middleware, same 96 permissions × 7 roles |
| Activity log | jeremykenedy/laravel-logger | `middleware/activity.js` → same `activity_log` table |

## Run it

```bash
npm run install:all
cp backend/.env.example backend/.env      # set DATABASE_URL and SESSION_SECRET
createdb icthospital
npm run db:setup                          # schema + admin user + permissions
npm run seed:demo --prefix backend        # optional demo doctors/patients/beds/services
npm run dev:api                           # http://localhost:8000
npm run dev:web                           # http://localhost:5173  (proxies /api)
```
Sign in with **admin / 123456** and change the password under *My settings*.

Production: `npm run build`, then `npm start` – Express serves the built React app and the API on one port.
Docker: `docker compose up --build`. The Dockerfile builds the React frontend inside the image.

## Docker deployment

Use the repository root as the build context and `Dockerfile` as the Dockerfile path.
Leave the service root directory empty and leave the Docker command override empty.
The image installs dependencies, builds the frontend, and serves the frontend and API together.

Set runtime environment variables before deploying:

- `DATABASE_URL`: connection URL for your PostgreSQL database.
- `SESSION_SECRET`: a long random secret.
- `COOKIE_SECURE=true` when serving over HTTPS.

The container uses the platform-provided `PORT` (default: `8000`). At startup it runs
the database migration and initial seed, then starts Express. Use `/api/health` for
the health check. Change the initial admin password after the first login.

For Render, use the Docker runtime, branch `main`, Dockerfile Path `./Dockerfile`,
and Docker Build Context Directory `.`. Deploy the latest commit after saving.

## Tests
`npm test --prefix backend` starts a throw-away PostgreSQL (embedded) and exercises the API end to end
(login, permissions, patients, OPD/appointments, consultations, lab/radiology, pharmacy stock, beds,
invoices, payments, doctor shares, cash close, day book, settlement, accounting, staff logins).
`node backend/test/ui-smoke.js` mounts the built React app in jsdom and visits every screen against that API.

## Layout
```
backend/db        schema.sql (generated), migrate.js, seed.js, seed-demo.js, sync-permissions.js
backend/src       app.js, server.js, db.js, middleware/, routes/ (one file per Laravel controller), support/ (ports of app/Support), jobs/
frontend/src      pages/ (one file per module), components/ (Layout, Crud, ui), api.js, hooks.js
tools/gen-schema.js   regenerates backend/db/schema.sql from the Laravel migrations
```
See `CONVERSION.md` for the controller-by-controller mapping and the list of known differences.
