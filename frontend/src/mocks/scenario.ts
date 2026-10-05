import type { CreateRunInput, Feasibility, RehearsalResult, RiskAssessment, Run, Stage, StageProgress, TimelineEvent } from '../types'

const labels: Record<Stage, string> = { investigate: 'Inspect repository', plan: 'Plan sandbox checks', rehearse: 'Run checks in Docker', done: 'Feasibility report' }
const stages = (): StageProgress[] => (Object.keys(labels) as Stage[]).map(stage => ({ stage, label: labels[stage], state: 'pending' }))

export const createMockRun = (input: CreateRunInput): Run => {
  const parsed = new URL(input.repositoryUrl)
  const parts = parsed.pathname.split('/').filter(Boolean)
  const name = (parts[1] ?? 'demo-repository').replace(/\.git$/, '')
  return {
    id: `DR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    repository: { url: input.repositoryUrl, owner: parts[0] ?? 'demo', name },
    currentStage: 'investigate', status: 'running', sandboxStatus: 'running', stages: stages(),
    rehearsalSteps: [
      { description: 'Install project dependencies', command: 'python -m pip install -r requirements.txt', timeout_seconds: 120 },
      { description: 'Run the project smoke check', command: 'python -m compileall -q .', timeout_seconds: 30 },
    ],
    rehearsalResults: [], events: [], createdAt: new Date().toISOString(), detectedStack: [], repositoryFiles: [],
  }
}

export interface MockEventSpec { stage: Stage; message: string; type: TimelineEvent['type']; status: TimelineEvent['status']; delay: number; patch?: Partial<Run> }
const check = (index: number, description: string, command: string, status: RehearsalResult['status'], exit_code: number): RehearsalResult => ({ index, description, command, status, exit_code, stdout: status === 'passed' ? 'Successfully completed in the disposable container.' : '', stderr: status === 'failed' ? 'One required dependency or setup step did not complete.' : '' })

export const mockEvents = (shouldFail: boolean): MockEventSpec[] => {
  const results: RehearsalResult[] = [
    check(1, 'Install project dependencies', 'python -m pip install -r requirements.txt', 'passed', 0),
    ...(shouldFail ? [check(2, 'Run the project smoke check', 'python -m compileall -q .', 'failed', 1)] : [check(2, 'Run the project smoke check', 'python -m compileall -q .', 'passed', 0)]),
  ]
  const risk: RiskAssessment = { level: 'medium', reason: 'The checks install dependencies and execute project tooling inside the disposable Docker container.' }
  const feasibility: Feasibility = shouldFail
    ? { status: 'failed', reason: 'The dependency step passed, but the smoke check returned a non-zero exit code.' }
    : { status: 'passed', reason: 'All planned setup checks passed inside the disposable Docker container.' }
  return [
    { stage: 'investigate', message: 'Repository cloned inside an isolated Docker sandbox', type: 'discovery', status: 'success', delay: 550, patch: { repositoryFiles: ['README.md', 'requirements.txt', 'app.py'], detectedStack: ['Python', 'FastAPI'] } },
    { stage: 'plan', message: 'Read README and dependency manifest; created two bounded checks', type: 'stage', status: 'success', delay: 650, patch: { summary: 'The repository documents a Python setup. Dependencies and a compile smoke check are selected for the sandbox.', stages: stages().map(item => item.stage === 'investigate' || item.stage === 'plan' ? { ...item, state: 'success' } : item) } },
    { stage: 'rehearse', message: 'Docker container ready · no host folders mounted', type: 'stage', status: 'running', delay: 500, patch: { sandboxStatus: 'running' } },
    { stage: 'rehearse', message: 'Install project dependencies: passed (exit 0)', type: 'action', status: 'success', delay: 850, patch: { rehearsalResults: results.slice(0,1), riskAssessment: risk } },
    { stage: 'rehearse', message: `Run project smoke check: ${shouldFail ? 'failed' : 'passed'} (exit ${shouldFail ? 1 : 0})`, type: shouldFail ? 'diagnostic' : 'action', status: shouldFail ? 'failed' : 'success', delay: 850, patch: { rehearsalResults: results } },
    { stage: 'done', message: feasibility.reason, type: 'result', status: shouldFail ? 'failed' : 'success', delay: 450, patch: { status: shouldFail ? 'failure' : 'success', currentStage: 'done', sandboxStatus: shouldFail ? 'failed' : 'passed', riskAssessment: risk, feasibility, result: { status: shouldFail ? 'failure' : 'success', reason: feasibility.reason, diagnostics: shouldFail ? ['The smoke check exited with code 1.'] : [] }, stages: stages().map(item => ({ ...item, state: item.stage === 'done' ? shouldFail ? 'failed' : 'success' : item.stage === 'rehearse' ? shouldFail ? 'failed' : 'success' : 'success' })) } },
  ]
}
