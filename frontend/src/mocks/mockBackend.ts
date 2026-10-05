import { createMockRun, mockEvents } from './scenario'
import type { CreateRunInput, Run, TimelineEvent } from '../types'
import type { MockEventSpec } from './scenario'

type Listener = (run: Run) => void
const runs = new Map<string, Run>()
const listeners = new Map<string, Set<Listener>>()
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
function notify(run: Run) { listeners.get(run.id)?.forEach(listener => listener(structuredClone(run))) }
function update(run: Run, spec: MockEventSpec) {
  run.currentStage = spec.stage
  run.stages = spec.patch?.stages ?? run.stages.map(item => {
    if (item.stage === spec.stage) return { ...item, state: spec.status }
    return item
  })
  const event: TimelineEvent = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), type: spec.type, stage: spec.stage, message: spec.message, status: spec.status }
  run.events = [...run.events, event]
  if (spec.patch) Object.assign(run, spec.patch)
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
    void play(run, mockEvents(input.outcome === 'failure'))
    return structuredClone(run)
  },
  async getRun(id: string): Promise<Run> {
    const run = runs.get(id)
    if (!run) throw new Error('Run not found. Start a new sandbox check.')
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
}
