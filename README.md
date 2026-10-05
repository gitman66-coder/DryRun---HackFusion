# Dryrun

**Check whether a GitHub project's documented setup works in a disposable Docker sandbox.** Dryrun reads the repository README and setup manifests, asks an AI planner for bounded checks, runs those checks in Docker, and reports the results with a heuristic risk estimate.

Dryrun ends with the sandbox report. It does not request approval, modify your host, or claim that a passing container guarantees compatibility with your computer.

## The problem

A repository can look ready but still fail at installation or startup because its instructions are incomplete, its dependencies are stale, or an expected file is missing. Finding out by trying it directly can waste time and leave partial setup changes behind.

Dryrun gives you an isolated first run. It uses repository documentation as evidence, executes supported setup checks inside a disposable container, and shows the command output and failure point.

## How a run works

1. **Inspect** - Clone a public GitHub repository into a Docker container and collect a bounded inventory of README and setup files.
2. **Plan** - Ask the model for up to eight evidence-based setup or smoke-check commands.
3. **Check** - Run those commands from the cloned repository directory in that same container. Each step has a timeout; total execution is capped at ten minutes, and later steps stop after a failure.
4. **Report** - Return the exit codes and output, a pass/fail/inconclusive feasibility result, and a heuristic risk level.
5. **Clean up** - Remove the disposable Docker container after the report is saved.

The container has memory, CPU, and process limits and no project folder mounted from the host. Dependencies may need network access during installation. Commands execute project code inside Docker, so run Dryrun only on repositories you trust.

## What the result means

- **Passed:** all planned checks returned exit code zero in the Dryrun Docker image.
- **Failed:** at least one planned check returned a non-zero exit code or could not run.
- **Inconclusive:** the repository evidence did not support a safe, specific check.
- **Risk:** a transparent heuristic based on command patterns, not a security audit.
- **Machine compatibility:** not directly measured. The sandbox uses Dryrun's Linux image, so its result is evidence about that container, not a guarantee for your host OS or hardware.

The planner follows repository files as data, not instructions. Its proposed commands are still AI-generated. The Docker container is the execution boundary; review the output and risk estimate as advisory information.

## Architecture

```text
React + Vite interface
        │ POST /runs, GET /runs/{id}
        ▼
FastAPI ── LangGraph workflow ── Groq model via LangChain
        │                            │
        └──── sandbox MCP tools ◄────┘
                 │
                 ▼
      disposable Docker container
      clone → inspect → run checks → destroy
                 │
                 ▼
      evidence + outputs + risk report
```

The connected application exposes only the sandbox MCP server. There is no approval endpoint or host-apply route in the run workflow. Run records are kept in memory and are cleared when the API process restarts.

## Technology stack

| Area | Technology |
| --- | --- |
| Backend API | Python 3.12, FastAPI, Uvicorn |
| Workflow | LangGraph and LangChain |
| Model | Groq through LangChain |
| Tool integration | MCP Python SDK and `langchain-mcp-adapters` |
| Isolated execution | Docker, Docker SDK for Python |
| Plan validation | Pydantic |
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |

## Run locally

Prerequisites: Python, Node.js/npm, Docker Desktop, and a Groq API key.

1. Install backend dependencies from the repository root:

   ```powershell
   py -m pip install -r requirements.txt
   ```

2. Build the sandbox image from the repository root:

   ```powershell
   docker build -t dryrun-base -f backend/sandbox/Dockerfile .
   ```

3. Put your Groq key in the repository-root `.env` file as `GROQ_API_KEY=...`. Keep `.env` out of Git.
4. Start the backend from the repository root:

   ```powershell
   py -m uvicorn backend.app:app --reload
   ```

5. In a second terminal, install and start the frontend:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

Open the Vite URL printed in the terminal. The frontend uses `/api` and proxies it to the local FastAPI service.

## Demo mode

Set `VITE_USE_MOCKS=true` in `frontend/.env.local` and restart Vite to preview simulated sandbox pass and failure reports. Mock mode does not run repository commands.

## Known limitations

- Only public GitHub repositories are accepted.
- The planner can only use files selected by the repository inspector and the Docker base image's installed tools.
- A generated check can be incomplete or unsuitable for a particular project. In that case, the report should be treated as inconclusive or reviewed carefully.
- The risk rating is heuristic and does not guarantee a command is harmless.
- A sandbox pass does not prove compatibility with a developer's host machine.
- Run history is stored in memory and is lost when the backend restarts.

## License

No license has been selected yet. Until one is added, all rights are reserved by the project owner.
