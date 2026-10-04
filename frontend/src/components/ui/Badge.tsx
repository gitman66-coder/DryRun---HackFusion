import type { ReactNode } from 'react'
export function Badge({ tone = 'neutral', children, dot = false }: { tone?: string; children: ReactNode; dot?: boolean }) { return <span className={`badge badge-${tone}`}>{dot && <i className="badge-dot" />}{children}</span> }
