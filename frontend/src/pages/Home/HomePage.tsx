import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Box, CircleCheck, Github, LockKeyhole, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { api } from '../../services/api'
import type { Outcome } from '../../types'
import { repoSlug } from '../../lib/format'
import { isSafeWorkspaceName, normalizeRepositoryUrl, parsePreferredPort } from '../../lib/validation'

const flow = ['Repository', 'Investigate', 'Plan', 'Sandbox', 'Fix', 'Clean room', 'Approval', 'Apply', 'Health', 'Done']
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start rehearsal.') } finally { setSubmitting(false) }
  }
  return <div className="page home-page">
    <div className="home-topline"><div className="crumb-muted">SAFE SETUP REHEARSAL <span>/</span> NEW RUN</div><Badge tone="green" dot>ISOLATED BY DEFAULT</Badge></div>
    <section className="hero-grid"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-line" /> REPOSITORY SETUP, REHEARSED</div><h1>Rehearse first.<br /><em>Run safely.</em></h1><p className="hero-description">An agent that gets GitHub repositories running by testing every setup step inside an isolated sandbox before touching your machine.</p><div className="hero-proof"><span><ShieldCheck size={15} /> No host changes before approval</span><span><Box size={15} /> Disposable sandbox rehearsal</span></div></div>
      <Card className="run-form-card"><div className="form-card-head"><div><div className="eyebrow">START A REHEARSAL</div><h2>Run a repository</h2></div><div className="form-head-icon"><Plus size={17} /></div></div><form onSubmit={submit} noValidate><label className="field-label" htmlFor="repository">GitHub repository URL</label><div className={`input-wrap ${error ? 'input-error' : ''}`}><Github size={17} /><input id="repository" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/user/project" autoComplete="url"/><span className="input-suffix">PUBLIC REPO</span></div><div className="input-hint"><LockKeyhole size={12} />Repository contents are inspected as untrusted input</div>{error && <p className="form-error" role="alert">{error}</p>}
      <button type="button" className="advanced-toggle" aria-expanded={advanced} onClick={() => setAdvanced(value => !value)}>{advanced ? 'Hide' : 'Show'} advanced configuration <ArrowDown size={13} className={advanced ? 'rotate-up' : ''}/></button>{advanced && <div className="advanced-fields"><div><label className="field-label" htmlFor="workspace">Workspace name</label><input className="text-input" id="workspace" placeholder={url ? `${repoSlug(url).split('/').pop()}-demo` : 'my-project-demo'} value={workspace} onChange={event => setWorkspace(event.target.value)} /></div><div className="field-pair"><div><label className="field-label" htmlFor="port">Preferred port</label><input className="text-input" id="port" inputMode="numeric" value={port} onChange={event => setPort(event.target.value)} /></div><div><label className="field-label" htmlFor="environment">Environment</label><select className="text-input" id="environment" value={environment} onChange={event => setEnvironment(event.target.value)}><option value="development">Development</option><option value="test">Test</option><option value="production">Production</option></select></div></div><div><label className="field-label" htmlFor="outcome">Demo outcome</label><select className="text-input" id="outcome" value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}><option value="success">Healthy after apply</option><option value="rollback_failure">Health check fails · rollback review</option></select><small className="field-help">Lets you preview both result states in the local demo.</small></div></div>}
      <Button className="submit-run" type="submit" loading={submitting} icon={!submitting && <ArrowRight size={16} />}>Run a repository</Button><div className="form-foot"><span>Powered by a disposable Docker sandbox</span><span>·</span><span>6 attempt limit</span></div></form></Card></section>
    <section className="flow-section"><div className="flow-heading"><div><div className="eyebrow">THE SAFETY PATH</div><h2>Prove it in isolation. Then make it real.</h2></div><span className="flow-caption"><Sparkles size={14} /> An agent-led setup, with a human at the boundary</span></div><div className="flow-track">{flow.map((step, i) => <div className={`flow-node ${i === 3 || i === 5 ? 'flow-sandbox' : ''} ${i === 6 ? 'flow-approval' : ''}`} key={step}><span className="flow-number">{String(i + 1).padStart(2, '0')}</span><span>{step}</span>{i < flow.length - 1 && <ArrowRight size={13} className="flow-arrow" />}</div>)}</div><div className="flow-note"><CircleCheck size={14} /><span>Nothing is applied to your workspace until the rehearsal passes and you approve the action plan.</span><a href="#safety">How safety works <ArrowUpRight size={12}/></a></div></section>
    <section className="home-footer" id="safety"><div><ShieldCheck size={16}/><span><b>Built around a clear trust boundary.</b> Repository setup is rehearsed in a disposable sandbox first.</span></div><span>THE WOLF OF SILICON VALLEY <i>·</i> AGENTIC AI HACKATHON</span></section>
  </div>
}
