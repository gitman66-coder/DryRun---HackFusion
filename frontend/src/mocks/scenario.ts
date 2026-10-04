import type { Action, CreateRunInput, Run, Stage, StageProgress, TimelineEvent } from '../types'

const stageLabels: Record<Stage, string> = {
  investigate: 'Investigate', plan: 'Plan', rehearse: 'Rehearse', diagnose: 'Diagnose / Fix',
  clean_room: 'Clean-room replay', approval: 'Human approval', apply: 'Apply', health_check: 'Health check', done: 'Done',
}
const stageOrder = Object.keys(stageLabels) as Stage[]
const makeStages = (): StageProgress[] => stageOrder.map(stage => ({ stage, label: stageLabels[stage], state: 'pending' }))
const actions: Action[] = [
  { id: 'a-venv', kind: 'create_venv', args: { path: '.venv' }, purpose: 'Create an isolated Python environment', risk: 'low', status: 'planned', affectedPath: '.venv/' },
  { id: 'a-pip', kind: 'pip_install', args: { source: 'requirements.txt' }, purpose: 'Install Python dependencies from requirements.txt', risk: 'low', status: 'planned', affectedPath: 'requirements.txt' },
  { id: 'a-fix', kind: 'write_file', args: { path: 'app/config.py' }, purpose: 'Add a safe default for the missing application setting', risk: 'medium', status: 'planned', affectedPath: 'app/config.py' },
  { id: 'a-service', kind: 'run_service', args: { port: 8000 }, purpose: 'Start the FastAPI service and verify its health endpoint', risk: 'medium', status: 'planned', affectedPath: 'workspace process' },
  { id: 'a-system', kind: 'system_package', args: { package: 'libpq-dev' }, purpose: 'Install a missing system dependency', risk: 'high', status: 'manual_required', affectedPath: 'host system' },
]

export const createMockRun = (input: CreateRunInput): Run => {
  const parsed = new URL(input.repositoryUrl)
  const parts = parsed.pathname.split('/').filter(Boolean)
  const repository = { url: input.repositoryUrl, owner: parts[0], name: parts[1].replace(/\.git$/, '') }
  const workspaceName = input.workspaceName.trim() || `${repository.name}-demo`
  return {
    id: `DR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    repository, workspace: `dryrun-workspaces/${workspaceName}`, currentStage: 'investigate', status: 'running',
    attempt: 1, maxAttempts: 6, sandboxStatus: 'pending', cleanRoomStatus: 'pending', approvalStatus: 'pending',
    stages: makeStages(), actions: actions.map(action => ({ ...action, args: { ...action.args } })), events: [],
    healthCheck: { status: 'pending' }, outcome: input.outcome, preferredPort: input.preferredPort,
    environmentMode: input.environmentMode, createdAt: new Date().toISOString(),
  }
}

export interface MockEventSpec { stage: Stage; message: string; type: TimelineEvent['type']; status: TimelineEvent['status']; delay: number; patch?: Partial<Run> }
export const investigationEvents: MockEventSpec[] = [
  { stage: 'investigate', message: 'Repository discovered', type: 'discovery', status: 'success', delay: 600 },
  { stage: 'investigate', message: 'Detected Python project · requirements.txt · FastAPI application', type: 'discovery', status: 'success', delay: 1100 },
  { stage: 'investigate', message: 'Detected required environment variables', type: 'discovery', status: 'warning', delay: 850 },
  { stage: 'plan', message: 'Generated typed execution plan', type: 'stage', status: 'success', delay: 1050 },
  { stage: 'rehearse', message: 'Created isolated sandbox · 2 CPU · 2 GB memory', type: 'stage', status: 'success', delay: 900, patch: { sandboxStatus: 'running' } },
  { stage: 'rehearse', message: 'Installing dependencies from requirements.txt…', type: 'action', status: 'running', delay: 1350 },
  { stage: 'rehearse', message: 'Application failed to start · missing APP_SECRET', type: 'diagnostic', status: 'warning', delay: 1150, patch: { attempt: 1 } },
  { stage: 'diagnose', message: 'Diagnosing failure from structured logs', type: 'diagnostic', status: 'running', delay: 1150 },
  { stage: 'diagnose', message: 'Detected missing configuration · generated safe corrective action', type: 'action', status: 'success', delay: 1250 },
  { stage: 'rehearse', message: 'Rehearsal succeeded on attempt 2 / 6', type: 'stage', status: 'success', delay: 1350, patch: { attempt: 2, sandboxStatus: 'passed' } },
  { stage: 'clean_room', message: 'Starting clean-room replay in a fresh container', type: 'stage', status: 'running', delay: 950, patch: { cleanRoomStatus: 'running' } },
  { stage: 'clean_room', message: 'Clean-room replay passed · no state carried over', type: 'stage', status: 'success', delay: 1500, patch: { cleanRoomStatus: 'passed' } },
  { stage: 'approval', message: 'Waiting for human approval', type: 'approval', status: 'waiting', delay: 450, patch: { status: 'waiting' } },
]

export const approvalEvents = (port: number, workspace: string): MockEventSpec[] => [
  { stage: 'apply', message: 'Approval recorded · applying actions to the isolated workspace', type: 'stage', status: 'running', delay: 500 },
  { stage: 'apply', message: 'Workspace created · service process started', type: 'action', status: 'success', delay: 1300 },
  { stage: 'health_check', message: `Health endpoint returned 200 on port ${port}`, type: 'result', status: 'success', delay: 1200, patch: { healthCheck: { status: 'healthy', service: 'FastAPI', port, url: `http://localhost:${port}`, checkedAt: new Date().toISOString() } } },
  { stage: 'done', message: 'Repository is running and healthy', type: 'result', status: 'success', delay: 750, patch: { status: 'success', result: { status: 'success', rollbackStatus: 'not_needed', workspace, service: 'FastAPI', port, totalAttempts: 2, cleanRoomPassed: true } } },
]

export const rejectedEvents: MockEventSpec[] = [
  { stage: 'apply', message: 'Approval rejected · host apply cancelled', type: 'approval', status: 'warning', delay: 450 },
  { stage: 'done', message: 'Run ended before host changes · no rollback required', type: 'result', status: 'failed', delay: 500, patch: { status: 'failure', result: { status: 'failure', failedStage: 'approval', reason: 'Approval was rejected. No changes were applied to the host.', diagnostics: ['All rehearsal and clean-room work remained inside disposable sandbox containers.'], rollbackStatus: 'not_needed', totalAttempts: 2, cleanRoomPassed: true } } },
]

export const rollbackFailureEvents: MockEventSpec[] = [
  { stage: 'apply', message: 'Approval recorded · applying actions to the isolated workspace', type: 'stage', status: 'running', delay: 500 },
  { stage: 'apply', message: 'Workspace created · approved actions applied', type: 'action', status: 'success', delay: 1000 },
  { stage: 'health_check', message: 'Health check timed out · starting rollback', type: 'diagnostic', status: 'warning', delay: 1100 },
  { stage: 'done', message: 'Rollback attempted · process stopped, workspace cleanup needs attention', type: 'result', status: 'failed', delay: 1000, patch: { status: 'failure', healthCheck: { status: 'unhealthy', service: 'FastAPI', port: 8000 }, result: { status: 'failure', failedStage: 'health_check', reason: 'The service did not respond to its health check after apply.', diagnostics: ['Health endpoint timed out after 30 seconds.', 'Workspace deletion was blocked by an active file handle.'], rollbackStatus: 'attention_required', totalAttempts: 2, cleanRoomPassed: true } } },
]
