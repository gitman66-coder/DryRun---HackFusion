Dryrun

**Get a GitHub project running with more confidence.** Dryrun investigates a repository, rehearses its setup in a disposable Docker sandbox, verifies the successful steps from a clean environment, and shows you what it plans to change before applying anything to your machine.

> Dryrun is a project in development. Treat it as experimental software and only try it with repositories you trust.

## The problem

A promising repository can be surprisingly hard to run. The README may be out of date, a runtime version may not match, or an install may fail because of a missing dependency. Debugging can take hours and leave a machine cluttered with partial installs.

Dryrun aims to make that process safer and easier to understand by testing setup steps before they reach your host machine.

## How it works

1. **Investigate** - Clone the repository into a sandbox and inspect its README, source files, dependency manifests, Docker configuration, and CI workflows.
2. **Plan** - Turn the evidence into an ordered, typed list of setup actions.
3. **Rehearse** - Run the plan in a disposable Docker container. If a step fails, diagnose the error and revise the plan, with a limit on retry attempts.
4. **Verify** - Replay the successful plan in a fresh container to catch hidden dependencies on the earlier rehearsal.
5. **Review** - Present the proposed changes, ports, and risk levels for human approval.
6. **Apply and check** - Apply approved actions inside an isolated workspace, start the app, and check that it responds.
7. **Roll back** - Clean up the workspace and processes if applying the plan or checking the app fails.

A live event timeline is intended to show what Dryrun is doing, including failures and recoveries.

## Safety principles

- **Rehearse before applying.** Exploratory setup runs in a disposable container.
- **Keep host changes inside a workspace.** Repositories, environments, and generated files should stay within a run-specific directory.
- **Enforce policy in code.** A policy engine validates typed actions independently of the language model. Unrecognized actions and paths outside the workspace are rejected by default.
- **Require approval.** The user reviews the verified plan before host changes begin.
- **Keep rollback available.** Track processes and workspace files so a run can be cleaned up.
- **Treat repository content as untrusted input.** A README or source file may inform the plan, but cannot override the policy engine.

These safeguards are design goals; they are not a claim that the current project implementation is complete or secure.

## Planned architecture

```text
React dashboard
      │ REST + Server-Sent Events
      ▼
FastAPI service
      │
      ▼
LangGraph workflow ── MCP tools
      │                 ├─ Docker sandbox
      │                 ├─ Read-only host inspection
      │                 └─ Policy-gated host actions
      ▼
Investigate → Plan → Rehearse → Clean-room replay
                              → Human approval → Apply → Health check
```

LangGraph is intended to manage the workflow and its checkpointed state. Custom MCP servers provide tool access to the sandbox and host operations. SQLite is planned for run checkpoints, while FastAPI streams run events to the React dashboard.

## Planned technology

| Area | Technology |
| --- | --- |
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Agent workflow | LangChain and LangGraph |
| Tool interface | MCP Python SDK and `langchain-mcp-adapters` |
| Sandbox | Docker and Docker SDK for Python |
| State and validation | SQLite, Pydantic |
| Host inspection | `psutil`, `platform`, `shutil` |
| Frontend | React, Vite, Tailwind CSS |
| Event streaming | Server-Sent Events |
| Model provider | Groq (`openai/gpt-oss-20b`) via LangChain |

Library APIs and model names change over time. Check the current official documentation when implementing integrations.

## Intended repository layout

```text
dryrun/
├── backend/
│   ├── agent/          # State, workflow nodes, policy, and model setup
│   ├── mcp_servers/    # Sandbox, host inspection, and gated host tools
│   ├── sandbox/        # Docker image for rehearsals
│   ├── api.py          # FastAPI endpoints and event streaming
│   └── events.py       # Per-run event handling
├── frontend/           # React dashboard
└── demo/               # Vetted demo repositories and demo notes
```

The implementation may change as the project develops.

## Project status

Dryrun is at the project-planning / early development stage. The architecture and workflow described here are intended behavior; implemented features, supported operating systems, and installation steps will be documented as they become available.

## Development setup

Setup instructions will be added once the repository structure and dependencies are in place. The planned development environment uses Python 3.11+, Node.js/npm, and Docker. An LLM provider API key will be needed for agent runs.

Keep provider credentials in a local `.env` file, add `.env` to `.gitignore`, and never commit real secrets. Do not run Dryrun against repositories you have not reviewed.

## Demo goals

The planned demo covers three cases:

1. A small Python app that installs and starts successfully.
2. A Node app that fails initially and recovers after a plan adjustment.
3. A repository that cannot be run and exits cleanly with rollback.

## Roadmap

- [ ] Build the Docker rehearsal image and sandbox tools.
- [ ] Analyze repositories and generate typed setup plans.
- [ ] Add bounded diagnose-and-retry behavior.
- [ ] Replay successful plans in a clean sandbox.
- [ ] Implement the host policy engine, approval pause, and rollback.
- [ ] Add the API and live event stream.
- [ ] Build the dashboard and demo workflow.

## License

No license has been selected yet. Until a license is added, all rights are reserved by the project owner.
