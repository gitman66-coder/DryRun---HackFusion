# Dryrun frontend

React, TypeScript, Vite, Tailwind CSS, and React Router UI for Dryrun.

## Run the connected application

Start the FastAPI backend from the repository root:

```powershell
py -m uvicorn backend.app:app --reload
```

In a second terminal, start the frontend:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:8000`; no separate CORS setup is needed for the local UI. The app connects to the backend by default. Copy `.env.example` to `.env.local` only if you want to change the defaults. Never put the Gemini key in a frontend environment file; it belongs in the repository-root `.env` used by FastAPI.

The real backend currently inspects public GitHub repositories in Docker, asks Gemini for a structured setup plan, waits for explicit approval, clones the repository into a per-run host workspace after approval, and executes the approved typed host actions. Repository files are untrusted input. API run records are in-memory and are cleared when the backend restarts.

The backend does not yet execute the plan's sandbox rehearsal commands, replay in a clean room, launch a health-checked service, or roll back partially completed host actions. The UI reports those states only in mock mode and does not claim they occurred in backend mode.

## Mock walkthrough

To use the self-contained animated UI demo instead, set `VITE_USE_MOCKS=true` in `frontend/.env.local` and restart Vite. The mock demonstrates rehearsal, diagnosis, clean-room replay, approval, apply, and rollback states without running project commands.

## Tests

With dependencies installed, `npm test` runs the frontend validation and mock-flow tests. `npm run build` checks TypeScript and produces the Vite production bundle.
