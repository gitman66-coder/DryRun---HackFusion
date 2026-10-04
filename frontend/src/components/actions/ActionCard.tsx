import { ArrowUpRight, Check, CircleAlert, LockKeyhole, PackageCheck, TerminalSquare } from 'lucide-react'
import type { Action } from '../../types'
import { RiskBadge } from './RiskBadge'
import { Badge } from '../ui/Badge'

const statusLabel = (status: Action['status']) => ({ planned: 'Planned', approved: 'Approved', completed: 'Completed', manual_required: 'Manual action required', rejected: 'Rejected', failed: 'Failed' })[status]
export function ActionCard({ action, approval = false }: { action: Action; approval?: boolean }) {
  const manual = action.kind === 'system_package' || action.status === 'manual_required'
  const detail = action.args.source ? String(action.args.source) : Array.isArray(action.args.packages) ? `Packages: ${(action.args.packages as string[]).join(', ')}` : action.args.path ? String(action.args.path) : action.affectedPath
  const Icon = action.kind === 'pip_install' || action.kind === 'npm_install' ? PackageCheck : action.kind === 'run_service' ? TerminalSquare : manual ? LockKeyhole : Check
  return <article className={`action-card ${manual ? 'action-manual' : ''}`}>
    <div className="action-icon"><Icon size={17} /></div><div className="action-main">
      <div className="action-title-row"><code>{action.kind}</code><RiskBadge risk={action.risk} /></div>
      <p>{action.purpose}</p>
      {approval && <div className="action-meta"><span><ArrowUpRight size={13} /> Affected path</span><code>{action.affectedPath ?? 'workspace'}</code></div>}
      {!approval && <div className="action-meta"><span><CircleAlert size={13} /> {detail ?? 'No additional arguments'}</span></div>}
    </div><div className="action-status"><Badge tone={manual ? 'amber' : action.status === 'completed' || action.status === 'approved' ? 'green' : 'neutral'}>{statusLabel(action.status)}</Badge></div>
  </article>
}
