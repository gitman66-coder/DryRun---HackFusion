import { Check, Circle, LoaderCircle, OctagonAlert, Clock3 } from 'lucide-react'
import type { StageState } from '../../types'
export function StatusIndicator({ state, small = false }: { state: StageState | string; small?: boolean }) {
  const Icon = state === 'success' ? Check : state === 'running' ? LoaderCircle : state === 'warning' || state === 'failed' ? OctagonAlert : state === 'waiting' ? Clock3 : Circle
  return <span className={`state-icon state-${state} ${small ? 'state-small' : ''}`} aria-label={state}>{state === 'running' && <Icon size={small ? 13 : 16} className="spin" />}{state !== 'running' && <Icon size={small ? 13 : 16} />}</span>
}
