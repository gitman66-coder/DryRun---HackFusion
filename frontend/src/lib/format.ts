import type { Stage, StageState } from '../types'
export const prettyStage = (stage: Stage) => ({ investigate: 'Investigate', plan: 'Plan', rehearse: 'Rehearse', diagnose: 'Diagnose / Fix', clean_room: 'Clean-room replay', approval: 'Human approval', apply: 'Apply', health_check: 'Health check', done: 'Done' })[stage]
export const prettyState = (state: StageState | string) => state.replace(/_/g, ' ')
export const repoSlug = (url: string) => url.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '')
