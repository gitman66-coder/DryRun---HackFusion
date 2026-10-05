import { mockBackend } from '../mocks/mockBackend'
import type { Feasibility, RehearsalResult, RiskAssessment, Run, Stage, StageProgress, TimelineEvent } from '../types'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'
const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

type BackendRun = {
  run_id: string; status: string; error?: string | null; repo_url: string; created_at?: string
  repository_facts?: { files?: string[]; key_files?: Record<string, string> }
  plan?: { summary: string; detected_stack: string[]; rehearsal_steps: Array<{ description: string; command: string; timeout_seconds?: number }> }
  rehearsal_results?: RehearsalResult[]; risk_assessment?: RiskAssessment; feasibility?: Feasibility
  cleanup_warning?: string
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

const stageLabels: Record<Stage, string> = { investigate: 'Inspect repository', plan: 'Plan sandbox checks', rehearse: 'Run checks in Docker', done: 'Feasibility report' }

function fromBackend(dto: BackendRun): Run {
  const failed = dto.status === 'failed'
  const finished = dto.status === 'completed' || failed
  const parsed = new URL(dto.repo_url)
  const [, owner = 'unknown', rawName = 'repository'] = parsed.pathname.split('/')
  const name = rawName.replace(/\.git$/, '')
  const plan = dto.plan
  const rehearsalResults = dto.rehearsal_results ?? []
  const feasibility = dto.feasibility ?? { status: failed ? 'failed' : 'inconclusive', reason: dto.error ?? 'The sandbox check did not return a feasibility result.' } as Feasibility
  const status: Run['status'] = failed || feasibility.status === 'failed' ? 'failure' : finished ? 'success' : 'running'
  const stages: StageProgress[] = (Object.keys(stageLabels) as Stage[]).map(stage => {
    let state: StageProgress['state'] = 'pending'
    if (dto.repository_facts && stage === 'investigate') state = 'success'
    if (plan && stage === 'plan') state = 'success'
    if (stage === 'rehearse' && rehearsalResults.length) state = rehearsalResults.some(item => item.status === 'failed') ? 'failed' : rehearsalResults.every(item => item.status === 'passed') ? 'success' : 'warning'
    if (stage === 'rehearse' && finished && !rehearsalResults.length) state = 'warning'
    if (stage === 'done' && finished) state = status === 'failure' ? 'failed' : feasibility.status === 'inconclusive' ? 'warning' : 'success'
    if (failed && !plan && stage === 'plan') state = 'failed'
    return { stage, label: stageLabels[stage], state }
  })
  const currentStage: Stage = finished ? 'done' : plan ? 'rehearse' : dto.repository_facts ? 'plan' : 'investigate'
  const now = dto.created_at ?? new Date().toISOString()
  const events: TimelineEvent[] = []
  if (dto.repository_facts) events.push({ id: `${dto.run_id}-inspect`, timestamp: now, type: 'discovery', stage: 'investigate', status: 'success', message: `Cloned and inspected the repository in Docker; found ${dto.repository_facts.files?.length ?? 0} files and read ${Object.keys(dto.repository_facts.key_files ?? {}).length} setup files.` })
  if (plan) events.push({ id: `${dto.run_id}-plan`, timestamp: now, type: 'stage', stage: 'plan', status: 'success', message: plan.summary })
  for (const check of rehearsalResults) events.push({ id: `${dto.run_id}-check-${check.index}`, timestamp: now, type: check.status === 'failed' ? 'diagnostic' : 'action', stage: 'rehearse', status: check.status === 'passed' ? 'success' : check.status === 'failed' ? 'failed' : 'warning', message: `${check.description}: ${check.status}${check.exit_code === null ? '' : ` (exit ${check.exit_code})`}` })
  if (finished) events.push({ id: `${dto.run_id}-done`, timestamp: now, type: 'result', stage: 'done', status: feasibility.status === 'failed' ? 'failed' : feasibility.status === 'inconclusive' ? 'warning' : 'success', message: dto.cleanup_warning ? `Sandbox checks finished. Cleanup warning: ${dto.cleanup_warning}` : feasibility.reason })
  const result: Run['result'] = finished ? {
    status: failed ? 'failure' : feasibility.status === 'passed' ? 'success' : feasibility.status === 'failed' ? 'failure' : 'inconclusive',
    reason: dto.error ?? feasibility.reason,
    diagnostics: rehearsalResults.filter(item => item.stderr).map(item => `${item.description}: ${item.stderr}`),
  } : undefined
  return {
    id: dto.run_id, repository: { url: dto.repo_url, owner, name }, isBackendRun: true,
    currentStage, status, stages, rehearsalSteps: plan?.rehearsal_steps ?? [], rehearsalResults,
    sandboxStatus: rehearsalResults.some(item => item.status === 'failed') ? 'failed' : rehearsalResults.length && rehearsalResults.every(item => item.status === 'passed') ? 'passed' : 'pending',
    riskAssessment: dto.risk_assessment, feasibility, cleanupWarning: dto.cleanup_warning, events, result,
    summary: plan?.summary ?? dto.error ?? '', detectedStack: plan?.detected_stack ?? [],
    repositoryFiles: dto.repository_facts?.files ?? [], createdAt: now,
  }
}

export const api = {
  async createRun(repositoryUrl: string, demoOutcome: 'success' | 'failure' = 'success'): Promise<Run> {
    if (useMocks) return mockBackend.createRun({ repositoryUrl, outcome: demoOutcome })
    const dto = await request<BackendRun>('/runs', { method: 'POST', body: JSON.stringify({
      repo_url: repositoryUrl,
      user_request: 'Use README and manifest evidence to run bounded setup and smoke checks only inside the disposable Docker sandbox. Return test outcomes and a risk estimate. Do not propose or run host actions.',
    }) })
    return fromBackend(dto)
  },
  async getRun(id: string): Promise<Run> {
    return useMocks ? mockBackend.getRun(id) : fromBackend(await request<BackendRun>(`/runs/${encodeURIComponent(id)}`))
  },
}
export const isUsingMocks = useMocks
