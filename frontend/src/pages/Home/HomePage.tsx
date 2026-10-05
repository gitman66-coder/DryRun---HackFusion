import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, CircleAlert, CircleCheck, Github, LockKeyhole, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { api, isUsingMocks } from '../../services/api'
import type { Outcome } from '../../types'
import { repoSlug } from '../../lib/format'
import { isSafeWorkspaceName, normalizeRepositoryUrl, parsePreferredPort } from '../../lib/validation'

const flow = isUsingMocks
  ? ['Repository', 'Inspect', 'Build plan', 'Sandbox', 'Fix', 'Clean room', 'Approval', 'Apply', 'Health check', 'Result']
  : ['GitHub repo', 'Docker inspection', 'Read project evidence', 'Estimate setup risk', 'Review actions', 'Approve']

export function HomePage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [port, setPort] = useState('8000')
  const [environment, setEnvironment] = useState('development')
  const [outcome, setOutcome] = useState<Outcome>('success')
  const [advanced, setAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    const repositoryUrl = normalizeRepositoryUrl(url)
    if (!repositoryUrl) { setError('Use a secure GitHub URL in the format github.com/owner/repository.'); return }
    const preferredPort = parsePreferredPort(port)
    if (!preferredPort) { setError('Port must be a number between 1 and 65535.'); return }
    if (!isSafeWorkspaceName(workspace)) { setError('Workspace name may contain letters, numbers, dots, underscores, and hyphens.'); return }
    setSubmitting(true)
    try {
      const run = await api.createRun({ repositoryUrl, workspaceName: workspace, preferredPort, environmentMode: environment, outcome })
      navigate(`/run/${run.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start repository review.') } finally { setSubmitting(false) }
  }
  return <div className="page home-page">
    <div className="home-topline"><div className="crumb-muted">README REALITY CHECK <span>/</span> NEW REVIEW</div><Badge tone="green" dot>ISOLATED INSPECTION</Badge></div>
    <section className="hero-grid reveal-on-scroll"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-line" /> README TO REALITY</div><h1>Can this project<br /><em>actually run?</em></h1><p className="hero-description">Dryrun inspects a public GitHub repository in a disposable sandbox, reads its setup evidence, and prepares a risk-aware feasibility review before you decide what to do next.</p><div className="hero-proof"><span><Box size={15} /> Repository inspection in Docker</span><span><ShieldCheck size={15} /> Human approval before host actions</span></div><a className="hero-scroll-link" href="#how-it-works"><span className="scroll-icon"><ArrowDown size={14}/></span> Scroll to see how it works</a></div>
      <Card className="run-form-card"><div className="form-card-head"><div><div className="eyebrow">START WITH A PUBLIC REPOSITORY</div><h2>{isUsingMocks ? 'Try the interactive demo' : 'Review project feasibility'}</h2></div><div className="form-head-icon"><Sparkles size={17} /></div></div><form onSubmit={submit} noValidate><label className="field-label" htmlFor="repository">GitHub repository URL</label><div className={`input-wrap ${error ? 'input-error' : ''}`}><Github size={17} /><input id="repository" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/owner/project" autoComplete="url"/><span className="input-suffix">PUBLIC</span></div><div className="input-hint"><LockKeyhole size={12} />Repository files are treated as untrusted input</div>{error && <p className="form-error" role="alert">{error}</p>}
      {isUsingMocks && <button type="button" className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>{advanced ? 'Hide' : 'Show'} demo configuration <ArrowDown size={13} className={advanced ? 'rotate-up' : ''}/></button>}{advanced && isUsingMocks && <div className="advanced-fields"><div><label className="field-label" htmlFor="workspace">Workspace name</label><input className="text-input" id="workspace" placeholder={url ? `${repoSlug(url).split('/').pop()}-demo` : 'my-project-demo'} value={workspace} onChange={event => setWorkspace(event.target.value)} /></div><div className="field-pair"><div><label className="field-label" htmlFor="port">Preferred port</label><input className="text-input" id="port" inputMode="numeric" value={port} onChange={event => setPort(event.target.value)} /></div><div><label className="field-label" htmlFor="environment">Environment</label><select className="text-input" id="environment" value={environment} onChange={event => setEnvironment(event.target.value)}><option value="development">Development</option><option value="test">Test</option><option value="production">Production</option></select></div></div><div><label className="field-label" htmlFor="outcome">Demo outcome</label><select className="text-input" id="outcome" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}><option value="success">Healthy after apply</option><option value="rollback_failure">Health check fails · rollback review</option></select><small className="field-help">Lets you preview both result states in the local demo.</small></div></div>}
      <Button className="submit-run" type="submit" loading={submitting} icon={!submitting && <ArrowRight size={16} />}>{isUsingMocks ? 'Explore the demo' : 'Analyze repository'}</Button><div className="form-foot"><span>Sandbox inspection</span><span>·</span><span>Evidence-based plan</span></div></form></Card></section>
    <section className="reality-strip reveal-on-scroll" aria-label="What Dryrun checks"><div><span className="reality-icon"><CircleCheck size={17}/></span><div><b>What it reviews</b><small>README and setup files found in the repository</small></div></div><div><span className="reality-icon"><ShieldCheck size={17}/></span><div><b>What it estimates</b><small>Risks in the proposed setup operations</small></div></div><div><span className="reality-icon reality-icon-muted"><CircleAlert size={17}/></span><div><b>What stays unknown</b><small>Whether setup truly runs on your machine</small></div></div></section>
    <section className="flow-section reveal-on-scroll" id="how-it-works"><div className="flow-heading"><div><div className="eyebrow">A CLEAR PATH FROM README TO REVIEW</div><h2>{isUsingMocks ? 'Inspect. Rehearse. Review.' : 'Inspect first. Make an informed call.'}</h2></div><span className="flow-caption"><Sparkles size={14} /> Evidence in. A plan to review.</span></div><div className={`flow-track ${isUsingMocks ? 'flow-track-demo' : 'flow-track-live'}`}>{flow.map((step, i) => <div className={`flow-node ${i === 1 || i === 2 ? 'flow-sandbox' : ''} ${i === 4 ? 'flow-approval' : ''}`} key={step}><span className="flow-number">{String(i + 1).padStart(2, '0')}</span><span>{step}</span>{i < flow.length - 1 && <ArrowRight size={13} className="flow-arrow" />}</div>)}</div><div className="flow-note"><CircleCheck size={14} /><span>{isUsingMocks ? 'Demo mode displays a simulated end-to-end flow.' : 'The current backend inspects files and generates a plan; it does not run the README commands or verify compatibility with your machine.'}</span><a href="#safety">Safety details <ArrowUpRight size={12}/></a></div></section>
    <section className="safety-feature reveal-on-scroll" id="safety"><div className="safety-feature-icon"><ShieldCheck size={21}/></div><div><div className="eyebrow">BUILT FOR A SAFER FIRST LOOK</div><h2>Understand the setup before you take action.</h2><p>Dryrun separates repository inspection from applying proposed operations. You can review the plan and its estimated risk before approving anything that changes your workspace.</p></div><div className="safety-feature-badge"><Check size={14}/> Approval stays with you</div></section>
    <section className="home-footer"><div><ShieldCheck size={16}/><span><b>Transparent by design.</b> Estimates are clearly separated from verified machine compatibility.</span></div><span>THE WOLF OF SILICON VALLEY <i>·</i> AGENTIC AI HACKATHON</span></section>
  </div>
}
