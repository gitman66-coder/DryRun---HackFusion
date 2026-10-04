import { ArrowUpRight, CircleHelp, Github, ShieldCheck, TerminalSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { isUsingMocks } from '../../services/api'
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const onRun = location.pathname.includes('/run/')
  return <div className="app-frame"><aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark"><TerminalSquare size={20} /></span><span>dryrun<small>SAFE EXECUTION SYSTEM</small></span></Link><div className="side-label">WORKSPACE</div><Link to="/" className={`side-link ${!onRun ? 'side-current' : ''}`}><span className="side-mark" />New rehearsal</Link>{onRun && <div className="side-run"><span className="side-mark side-mark-active" />Active run</div>}<div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={16} /><div><b>Sandbox first</b><small>Your machine stays untouched until approval.</small></div></div><a className="side-link" href="https://github.com" target="_blank" rel="noreferrer"><Github size={16} />GitHub<ArrowUpRight size={13} /></a><button className="side-help"><CircleHelp size={15} />How Dryrun works</button><span className="side-version">AGENTIC AI HACKATHON <i>·</i> v0.1</span></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>DRYRUN</span><b>/</b><strong>{onRun ? 'RUN CONSOLE' : 'OVERVIEW'}</strong></div><div className="connection"><span className="connection-dot" />{isUsingMocks ? 'Mock event stream' : 'Backend connected'}</div></header>{children}</main></div>
}
