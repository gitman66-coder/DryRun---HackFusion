import { AlertTriangle, Check, CircleDot, FileSearch, Wrench } from 'lucide-react'
import type { TimelineEvent } from '../../types'
import { prettyStage } from '../../lib/format'
const icons = { stage: CircleDot, discovery: FileSearch, action: Wrench, diagnostic: AlertTriangle, result: Check }
export function TimelineEventCard({ event }: { event: TimelineEvent }) { const Icon = icons[event.type]; return <article className={`event-card event-${event.status}`}><div className="event-icon"><Icon size={15} /></div><div className="event-content"><div className="event-head"><span>{prettyStage(event.stage)}</span><time>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div><p>{event.message}</p></div></article> }
