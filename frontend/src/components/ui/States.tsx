import { CircleDashed, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
export function LoadingState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) { return <div className="state-page"><div className="state-page-icon"><CircleDashed size={24}/></div><h2>{title}</h2><p>{detail}</p>{action}</div> }
export function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="state-page"><div className="state-page-icon state-page-warning"><ShieldAlert size={24}/></div><h2>{title}</h2><p>{detail}</p></div> }
