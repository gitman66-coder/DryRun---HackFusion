# Dryrun frontend

React, TypeScript, Vite, Tailwind CSS, and React Router UI for the sandbox-only repository feasibility workflow.

## Run the connected application

Start the FastAPI backend from the repository root:

```powershell
py -m uvicorn backend.app:app --reload
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:8000`. The Groq key belongs in the repository-root `.env`; never place it in a frontend environment file.

The backend clones a public repository into a disposable Docker sandbox, reads README and setup manifests, generates a bounded plan, executes the planned commands in the container, and returns command output, estimated risk, and a feasibility result. It destroys the container after the run. It has no approval endpoint or host-apply stage. A pass describes the Dryrun container, not guaranteed compatibility with your machine.

Build the `dryrun-base` image from the repository root before starting a real run:

```powershell
docker build -t dryrun-base -f backend/sandbox/Dockerfile .
```

## Demo mode

Set `VITE_USE_MOCKS=true` in `frontend/.env.local` and restart Vite to see simulated pass and failure reports. Mock mode does not execute setup commands.
