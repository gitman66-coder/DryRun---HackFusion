import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight, CircleHelp, Github, ShieldCheck, TerminalSquare } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { isUsingMocks } from '../../services/api'
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const onRun = location.pathname.includes('/run/')
  const progressRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${scrollable > 0 ? window.scrollY / scrollable : 0})`
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [location.pathname])
  useEffect(() => {
    const nodes = document.querySelectorAll<HTMLElement>('.reveal-on-scroll:not(.is-visible)')
    if (!('IntersectionObserver' in window)) { nodes.forEach(node => node.classList.add('is-visible')); return }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target) }
    }), { threshold: 0.12, rootMargin: '0px 0px -36px 0px' })
    nodes.forEach(node => observer.observe(node))
    return () => observer.disconnect()
  }, [location.pathname])
  return <div className="app-frame"><div className="scroll-progress" aria-hidden="true"><span ref={progressRef}/></div><aside className="sidebar"><Link to="/" className="brand"><span className="brand-mark"><TerminalSquare size={20} /></span><span>dryrun<small>README FEASIBILITY REVIEW</small></span></Link><div className="side-label">WORKSPACE</div><Link to="/" className={`side-link ${!onRun ? 'side-current' : ''}`}><span className="side-mark" />New review</Link>{onRun && <div className="side-run"><span className="side-mark side-mark-active" />Active review</div>}<div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={16} /><div><b>Sandbox inspection</b><small>All checks stay in the disposable container.</small></div></div><a className="side-link" href="https://github.com" target="_blank" rel="noreferrer"><Github size={16} />GitHub<ArrowUpRight size={13} /></a><a className="side-help" href="/#how-it-works"><CircleHelp size={15} />How Dryrun works</a><span className="side-version">AGENTIC AI HACKATHON <i>·</i> v0.1</span></div></aside><main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>DRYRUN</span><b>/</b><strong>{onRun ? 'FEASIBILITY REVIEW' : 'README REALITY CHECK'}</strong></div><div className="connection"><span className="connection-dot" />{isUsingMocks ? 'Demo mode' : 'Backend connected'}</div></header>{children}</main></div>
}
