import { mockBackend } from '../mocks/mockBackend'
import type { Action, CreateRunInput, Run, Stage, StageProgress, TimelineEvent } from '../types'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

type BackendAction = { action_id: string; kind: Action['kind']; description: string; packages?: string[]; relative_path?: string; file_content?: string; service_script?: string; port?: number; secret_key?: string }
type BackendRun = {
  run_id: string; status: string; error?: string | null; repo_url: string; workspace?: string; workspace_name?: string; workspace_ready?: boolean
  preferred_port?: number; environment_mode?: string; created_at?: string
  repository_facts?: { files?: string[]; key_files?: Record<string, string> }
  plan?: { summary: string; detected_stack: string[]; rehearsal_steps: unknown[]; host_actions: BackendAction[] }
  approval?: 'approved' | 'rejected' | null
  action_results?: Array<{ action_id: string; ok: boolean; manual_required?: boolean; error?: string; message?: string; [key: string]: unknown }>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    let message = `Dryrun API error (${response.status})`
    try { const body = await response.json() as { detail?: unknown }; if (typeof body.detail === 'string') message = body.detail; else if (body.detail) message = JSON.stringify(body.detail) } catch { /* Keep HTTP status text. */ }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

const stageLabels: Record<Stage, string> = {
  investigate: 'Inspect repository', plan: 'Generate setup plan', rehearse: 'Sandbox rehearsal', diagnose: 'Diagnose / fix',
  clean_room: 'Clean-room replay', approval: 'Human approval', apply: 'Apply approved actions', health_check: 'Health check', done: 'Done',
}

function fromBackend(dto: BackendRun): Run {
  const planned = dto.status === 'planned'
  const completed = dto.status === 'completed'
  const rejected = dto.status === 'rejected'
  const failed = dto.status === 'failed'
  const parsed = new URL(dto.repo_url)
  const [, owner = 'unknown', rawName = 'repository'] = parsed.pathname.split('/')
  const name = rawName.replace(/\.git$/, '')
  const actions: Action[] = (dto.plan?.host_actions ?? []).map(action => {
    const outcome = dto.action_results?.find(item => item.action_id === action.action_id)
    const manual = action.kind === 'system_package' || outcome?.manual_required
    const status: Action['status'] = manual ? 'manual_required' : outcome ? outcome.ok ? 'completed' : 'failed' : dto.approval === 'rejected' ? 'rejected' : dto.approval === 'approved' ? 'approved' : 'planned'
    const args: Record<string, unknown> = {}
    if (action.packages?.length) args.packages = action.packages
    if (action.relative_path) args.path = action.relative_path
    if (action.service_script) args.script = action.service_script
    if (action.port) args.port = action.port
    if (action.secret_key) args.secret_key = action.secret_key
    return { id: action.action_id, kind: action.kind, args, purpose: action.description,
      risk: action.kind === 'system_package' ? 'high' : ['run_service', 'write_secret'].includes(action.kind) ? 'medium' : 'low', status,
      affectedPath: action.relative_path ?? action.service_script ?? (action.kind === 'create_venv' ? '.venv/' : undefined) }
  })

  const currentStage: Stage = planned ? 'approval' : completed || rejected ? 'done' : failed ? 'plan' : 'investigate'
  const visibleStages = (Object.keys(stageLabels) as Stage[]).filter(stage => !['rehearse', 'diagnose', 'clean_room', 'health_check'].includes(stage))
  const stages: StageProgress[] = visibleStages.map(stage => {
    let state: StageProgress['state'] = 'pending'
    if (dto.repository_facts && stage === 'investigate') state = 'success'
    if (dto.plan && stage === 'plan') state = 'success'
    if (stage === 'approval' && planned) state = 'waiting'
    if (stage === 'approval' && (completed || rejected)) state = rejected ? 'warning' : 'success'
    if (stage === 'apply' && completed) state = 'success'
    if (stage === 'done' && (completed || rejected || failed)) state = failed ? 'failed' : 'success'
    if (failed && stage === 'plan') state = 'failed'
    return { stage, label: stageLabels[stage], state }
  })

  const now = dto.created_at ?? new Date().toISOString()
  const events: TimelineEvent[] = []
  if (dto.repository_facts) events.push({ id: `${dto.run_id}-inspect`, timestamp: now, type: 'discovery', stage: 'investigate', status: 'success', message: `Inspected repository in Docker; found ${dto.repository_facts.files?.length ?? 0} files and read ${Object.keys(dto.repository_facts.key_files ?? {}).length} setup files.` })
  if (dto.plan) events.push({ id: `${dto.run_id}-plan`, timestamp: now, type: 'stage', stage: 'plan', status: 'success', message: dto.plan.summary })
  for (const outcome of dto.action_results ?? []) events.push({ id: `${dto.run_id}-${outcome.action_id}`, timestamp: now, type: 'action', stage: 'apply', status: outcome.manual_required ? 'warning' : outcome.ok ? 'success' : 'failed', message: outcome.message ?? outcome.error ?? `${outcome.action_id}: ${outcome.ok ? 'completed' : 'failed'}` })
  if (rejected) events.push({ id: `${dto.run_id}-rejected`, timestamp: now, type: 'approval', stage: 'approval', status: 'warning', message: 'Plan rejected; no host actions were run.' })

  const result: Run['result'] = completed || rejected || failed ? {
    status: completed ? 'success' : 'failure', failedStage: rejected ? 'approval' : failed ? dto.plan ? 'apply' : 'plan' : undefined,
    reason: dto.error ?? (rejected ? 'Plan rejected. No approved actions were applied.' : undefined),
    diagnostics: dto.action_results?.flatMap(item => item.error ? [item.error] : item.message ? [item.message] : []),
    rollbackStatus: rejected ? 'not_needed' : failed ? 'attention_required' : 'not_needed', workspace: dto.workspace, totalAttempts: 0, cleanRoomPassed: false,
  } : undefined

  return {
    id: dto.run_id, repository: { url: dto.repo_url, owner, name }, workspace: dto.workspace ?? 'Created after approval',
    workspaceReady: dto.workspace_ready ?? completed, currentStage,
    status: planned ? 'waiting' : completed ? 'success' : rejected || failed ? 'failure' : 'running',
    attempt: 0, maxAttempts: 0, sandboxStatus: dto.repository_facts ? 'passed' : 'pending', cleanRoomStatus: 'pending',
    approvalStatus: dto.approval === 'approved' || completed ? 'approved' : dto.approval === 'rejected' || rejected ? 'rejected' : 'pending',
    stages, actions, events, healthCheck: { status: 'pending' }, result, outcome: 'success',
    preferredPort: dto.preferred_port ?? 8000, environmentMode: dto.environment_mode ?? 'development', createdAt: now,
    isBackendRun: true, summary: dto.plan?.summary ?? dto.error ?? '', detectedStack: dto.plan?.detected_stack ?? [], repositoryFiles: dto.repository_facts?.files ?? [],
  }
}

export const api = {
  async createRun(input: CreateRunInput): Promise<Run> {
    if (useMocks) return mockBackend.createRun(input)
    const dto = await request<BackendRun>('/runs', { method: 'POST', body: JSON.stringify({
      repo_url: input.repositoryUrl,
      user_request: 'Inspect this repository and propose a minimal, evidence-based setup plan. Do not guess when repository evidence is missing.',
      workspace_name: input.workspaceName, preferred_port: input.preferredPort, environment_mode: input.environmentMode,
    }) })
    return fromBackend(dto)
  },
  async getRun(id: string): Promise<Run> {
    return useMocks ? mockBackend.getRun(id) : fromBackend(await request<BackendRun>(`/runs/${encodeURIComponent(id)}`))
  },
  async decideApproval(id: string, approved: boolean, secrets: Record<string, string> = {}): Promise<void> {
    if (useMocks) return mockBackend.decideApproval(id, approved)
    const run = await api.getRun(id)
    await request(`/runs/${encodeURIComponent(id)}/approval`, { method: 'POST', body: JSON.stringify({
      approved, action_ids: approved ? run.actions.map(action => action.id) : [], secrets: approved ? secrets : {},
    }) })
  },
  async openWorkspace(id: string): Promise<string | void> {
    if (useMocks) return (await mockBackend.getRun(id)).workspace
    return (await api.getRun(id)).workspace
  },
}
export const isUsingMocks = useMocks
