import { approvalEvents, createMockRun, investigationEvents, rejectedEvents, rollbackFailureEvents } from './scenario.ts'
import type { CreateRunInput, Run, TimelineEvent } from '../types'
import type { MockEventSpec } from './scenario'

type Listener = (run: Run) => void
const runs = new Map<string, Run>()
const listeners = new Map<string, Set<Listener>>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function notify(run: Run) { listeners.get(run.id)?.forEach(listener => listener(structuredClone(run))) }
function update(run: Run, spec: MockEventSpec) {
  run.currentStage = spec.stage
  run.stages = run.stages.map(item => {
    if (item.stage === spec.stage) return { ...item, state: spec.status }
    if (run.stages.findIndex(stage => stage.stage === item.stage) < run.stages.findIndex(stage => stage.stage === spec.stage) && item.state !== 'pending' && item.state !== 'failed') return { ...item, state: 'success' }
    return item
  })
  const event: TimelineEvent = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: spec.type, stage: spec.stage, message: spec.message, status: spec.status }
  run.events = [...run.events, event]
  if (spec.patch) run = Object.assign(run, spec.patch)
  if (spec.stage === 'apply' && spec.status === 'success') {
    run.actions = run.actions.map(action => action.status === 'approved' ? { ...action, status: 'completed' } : action)
  }
  notify(run)
}
async function play(run: Run, specs: MockEventSpec[]) {
  for (const spec of specs) {
    await sleep(spec.delay)
    if (!runs.has(run.id)) return
    update(run, spec)
  }
}

export const mockBackend = {
  async createRun(input: CreateRunInput): Promise<Run> {
    const run = createMockRun(input)
    runs.set(run.id, run)
    void play(run, investigationEvents)
    return structuredClone(run)
  },
  async getRun(id: string): Promise<Run> {
    const run = runs.get(id)
    if (!run) throw new Error('Run not found. Start a new repository rehearsal.')
    return structuredClone(run)
  },
  subscribe(id: string, listener: Listener) {
    const set = listeners.get(id) ?? new Set<Listener>()
    set.add(listener)
    listeners.set(id, set)
    const run = runs.get(id)
    if (run) listener(structuredClone(run))
    return () => { set.delete(listener); if (!set.size) listeners.delete(id) }
  },
  async decideApproval(id: string, approved: boolean): Promise<void> {
    const run = runs.get(id)
    if (!run) throw new Error('Run not found')
    if (run.approvalStatus !== 'pending') throw new Error('This run already has an approval decision')
    run.approvalStatus = approved ? 'approved' : 'rejected'
    run.status = 'running'
    run.actions = run.actions.map(action => action.status === 'planned' ? { ...action, status: approved ? 'approved' : 'rejected' } : action)
    notify(run)
    const specs = !approved ? rejectedEvents : run.outcome === 'rollback_failure' ? rollbackFailureEvents : approvalEvents(run.preferredPort, run.workspace)
    void play(run, specs)
  },
  stop(id: string) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  },
}
