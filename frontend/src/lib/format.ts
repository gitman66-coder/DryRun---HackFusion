import type { Stage, StageState } from '../types'
export const prettyStage: Record<Stage, string> = { investigate: 'Inspect repository', plan: 'Plan checks', rehearse: 'Sandbox checks', done: 'Feasibility report' }
export const prettyState = (state: StageState | string) => state.replace(/_/g, ' ')
export const repoSlug = (url: string) => url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')
