# Dryrun frontend

React, TypeScript, Vite, Tailwind CSS, and React Router UI for the Dryrun repository rehearsal demo. The app is frontend-only; backend execution and enforcement are not implemented here.

## Run locally

```sh
npm install
npm run dev
```

The mock-flow tests use Node's built-in test runner and TypeScript type stripping (`npm test`, Node 22.6+).

Copy `.env.example` to `.env` to adjust the local settings. `VITE_USE_MOCKS=true` is the default and runs the complete demo without a backend. Set it to `false` and set `VITE_API_BASE_URL` to connect to a backend implementing the contract below.

## Mock demo

The mock progressively emits structured run snapshots and events. It demonstrates repository investigation, a failed first rehearsal, diagnosis and correction, a successful rehearsal, clean-room replay, approval, apply, and health check. Approval rejection ends before host changes. The advanced demo outcome selector can instead show an apply/health failure and a rollback that needs attention.

The UI shows typed actions and flags `system_package` as manual. It does not execute commands or install system packages. The mock's workspace action only reports the sample workspace path.

## Backend integration contract

The boundary is in `src/services/api.ts` and `src/services/events.ts`; components consume `Run`, `Action`, and `TimelineEvent` from `src/types/index.ts`.

Expected endpoints when mocks are disabled:

- `POST /runs` with `{ repositoryUrl, workspaceName, preferredPort, environmentMode }` returns a `Run`.
- `GET /runs/{id}` returns a `Run` snapshot.
- `GET /runs/{id}/events` streams Server-Sent Events whose `data` is a complete `Run` snapshot as JSON. This can be changed to event deltas inside `events.ts` without changing page components.
- `POST /runs/{id}/approval` with `{ decision: "approve" | "reject" }` returns a successful JSON response.
- `POST /runs/{id}/workspace/open` requests the platform-specific workspace open action.

`Run` contains repository, stage, state, attempt counters, sandbox and clean-room states, approval status, stage progress, typed actions, events, health check, and an optional result. Every action carries `kind`, structured `args`, `purpose`, `risk`, and `status`; `system_package` remains a manual action. See `src/types/index.ts` for the TypeScript model.
