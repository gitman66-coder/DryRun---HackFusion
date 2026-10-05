import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowRight, ArrowUpRight, Box, Check, CircleAlert, CircleCheck, Github, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { api, isUsingMocks } from '../../services/api'
import { normalizeRepositoryUrl } from '../../lib/validation'

const steps = ['GitHub repository', 'Docker sandbox', 'Read README & manifests', 'Run setup checks', 'Estimate risk', 'Feasibility report']

export function HomePage() {
  const navigate = useNavigate()
  const [url, setUrl] = useState('')
  const [demoOutcome, setDemoOutcome] = useState<'success' | 'failure'>('success')
  const [showDemo, setShowDemo] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const repositoryUrl = normalizeRepositoryUrl(url)
    if (!repositoryUrl) { setError('Use a secure GitHub URL in the format github.com/owner/repository.'); return }
    setSubmitting(true)
    try {
      const run = await api.createRun(repositoryUrl, demoOutcome)
      navigate(`/run/${run.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not start the sandbox check.') }
    finally { setSubmitting(false) }
  }
  return <div className="page home-page">
    <div className="home-topline"><div className="crumb-muted">README REALITY CHECK <span>/</span> NEW RUN</div><Badge tone="green" dot>DISPOSABLE DOCKER SANDBOX</Badge></div>
    <section className="hero-grid reveal-on-scroll"><div className="hero-copy"><div className="hero-kicker"><span className="kicker-line" /> README TO REALITY</div><h1>Will the setup<br /><em>actually work?</em></h1><p className="hero-description">Dryrun reads a repository’s README and setup files, then tries supported setup and smoke checks inside an isolated Docker sandbox. See what passed, what failed, and the estimated risk.</p><div className="hero-proof"><span><Box size={15} /> Disposable container, no host mounts</span><span><ShieldCheck size={15} /> No approval or host apply stage</span></div><a className="hero-scroll-link" href="#how-it-works"><span className="scroll-icon"><ArrowDown size={14}/></span> See how the sandbox check works</a></div>
      <Card className="run-form-card"><div className="form-card-head"><div><div className="eyebrow">START WITH A PUBLIC REPOSITORY</div><h2>{isUsingMocks ? 'Try the interactive demo' : 'Test the documented setup'}</h2></div><div className="form-head-icon"><Sparkles size={17} /></div></div><form onSubmit={submit} noValidate><label className="field-label" htmlFor="repository">GitHub repository URL</label><div className={`input-wrap ${error ? 'input-error' : ''}`}><Github size={17} /><input id="repository" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://github.com/owner/project" autoComplete="url"/><span className="input-suffix">PUBLIC</span></div><div className="input-hint"><LockKeyhole size={12} />Repository files are treated as untrusted input</div>{error && <p className="form-error" role="alert">{error}</p>}
      {isUsingMocks && <><button type="button" className="advanced-toggle" aria-expanded={showDemo} onClick={() => setShowDemo(value => !value)}>{showDemo ? 'Hide' : 'Show'} demo outcome <ArrowDown size={13} className={showDemo ? 'rotate-up' : ''}/></button>{showDemo && <div className="advanced-fields"><label className="field-label" htmlFor="demo-outcome">Sandbox result to preview</label><select className="text-input" id="demo-outcome" value={demoOutcome} onChange={event => setDemoOutcome(event.target.value as 'success' | 'failure')}><option value="success">All setup checks pass</option><option value="failure">A sandbox check fails</option></select><small className="field-help">Demo only. Live mode runs checks against the repository you enter.</small></div>}</>}
      <Button className="submit-run" type="submit" loading={submitting} icon={!submitting && <ArrowRight size={16} />}>{isUsingMocks ? 'Run demo' : 'Test in sandbox'}</Button><div className="form-foot"><span>Repository setup checks</span><span>·</span><span>Results before host changes</span></div></form></Card></section>
    <section className="reality-strip reveal-on-scroll" aria-label="What Dryrun checks"><div><span className="reality-icon"><CircleCheck size={17}/></span><div><b>Inspects project evidence</b><small>README, dependency manifests, and setup files</small></div></div><div><span className="reality-icon"><Box size={17}/></span><div><b>Runs supported checks</b><small>Setup commands execute only in Docker</small></div></div><div><span className="reality-icon reality-icon-muted"><CircleAlert size={17}/></span><div><b>Reports a risk estimate</b><small>Based on planned command patterns and results</small></div></div></section>
    <section className="flow-section reveal-on-scroll" id="how-it-works"><div className="flow-heading"><div><div className="eyebrow">FROM PROJECT DOCS TO A SANDBOX REPORT</div><h2>Inspect. Run. Understand.</h2></div><span className="flow-caption"><Sparkles size={14} /> Every run ends at the report.</span></div><div className="flow-track flow-track-live">{steps.map((step, i) => <div className={`flow-node ${i > 0 && i < 4 ? 'flow-sandbox' : ''} ${i === 5 ? 'flow-report' : ''}`} key={step}><span className="flow-number">{String(i + 1).padStart(2, '0')}</span><span>{step}</span>{i < steps.length - 1 && <ArrowRight size={13} className="flow-arrow" />}</div>)}</div><div className="flow-note"><CircleCheck size={14} /><span>Repository code and setup commands are untrusted. Docker runs with resource limits and no project folder mounted from your machine.</span><a href="#safety">Safety details <ArrowUpRight size={12}/></a></div></section>
    <section className="safety-feature reveal-on-scroll" id="safety"><div className="safety-feature-icon"><ShieldCheck size={21}/></div><div><div className="eyebrow">A SANDBOX RESULT, NOT A PROMISE ABOUT YOUR HOST</div><h2>See how the documented setup behaves in Docker.</h2><p>A passing sandbox check is useful evidence, but it cannot guarantee compatibility with every local machine. Dryrun never applies the repository setup to your host.</p></div><div className="safety-feature-badge"><Check size={14}/> Ends at sandbox report</div></section>
    <section className="home-footer"><div><ShieldCheck size={16}/><span><b>Sandbox-only by design.</b> No approval screen, host workspace, or apply step.</span></div><span>THE WOLF OF SILICON VALLEY <i>·</i> AGENTIC AI HACKATHON</span></section>
  </div>
}
