import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, ExternalLink, Fingerprint, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { api } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card, SectionHeading } from '../../components/ui/Card'
import { ActionCard } from '../../components/actions/ActionCard'
import { HealthStatus } from '../../components/status/HealthStatus'
import { LoadingState } from '../../components/ui/States'

export function ApprovalPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, error } = useRun(runId)
  const [busy, setBusy] = useState(false)
  const [decisionError, setDecisionError] = useState('')
  const [secretValues, setSecretValues] = useState<Record<string, string>>({})

  if (error) return <div className="page"><LoadingState title="Run unavailable" detail={error} action={<Button onClick={() => navigate('/')}>Start a new run</Button>} /></div>
  if (!run) return <div className="page"><LoadingState title="Preparing review" detail="Loading the typed action plan…" /></div>

  const approvedRunId = run.id
  const secretActions = run.actions.filter(action => action.kind === 'write_secret')
  const manualActions = run.actions.filter(action => action.kind === 'system_package' || action.status === 'manual_required')
  const canApprove = run.isBackendRun ? run.status === 'waiting' : run.cleanRoomStatus === 'passed' && run.approvalStatus === 'pending'
  const secretsReady = secretActions.every(action => {
    const key = String(action.args.secret_key ?? '')
    return Boolean(key && secretValues[key]?.trim())
  })

  async function decide(approved: boolean) {
    setBusy(true)
    setDecisionError('')
    try {
      await api.decideApproval(approvedRunId, approved, secretValues)
      navigate(`/run/${approvedRunId}`)
    } catch (reason) {
      setDecisionError(reason instanceof Error ? reason.message : 'Could not record decision')
    } finally { setBusy(false) }
  }

  return <div className="page approval-page">
    <div className="run-breadcrumb"><Link to={`/run/${run.id}`}><ArrowLeft size={13}/> Run timeline</Link><span>/</span><b>APPROVAL CHECKPOINT</b></div>
    <div className="approval-hero">
      <div className="approval-emblem"><ShieldCheck size={25}/><span/></div>
      <div className="eyebrow">HUMAN APPROVAL REQUIRED</div>
      <h1>Review the plan<br/><em>before applying.</em></h1>
      <p>{run.isBackendRun
        ? 'Dryrun inspected the public repository in Docker and generated this plan. Setup commands have not been rehearsed yet. Approval clones the repository into an isolated run workspace and applies the listed host actions.'
        : 'Dryrun reproduced the setup in a fresh, clean sandbox. Review the typed actions below before anything touches your workspace.'}</p>
      <div className="approval-security"><LockKeyhole size={14}/>Host changes are paused until you choose.</div>
    </div>

    {run.isBackendRun ? <Card className="review-card">
      <SectionHeading eyebrow="MODEL PLAN" title="What the inspection found"/>
      <p>{run.summary || 'No summary was returned.'}</p>
      {run.detectedStack?.length ? <p><b>Detected stack:</b> {run.detectedStack.join(', ')}</p> : null}
      <p><b>Repository files:</b> {run.repositoryFiles?.length ?? 0} discovered; {run.events.find(event => event.stage === 'investigate')?.message}</p>
      <div className="approval-security"><CircleAlert size={14}/>Repository contents are untrusted input. Review every action before approval.</div>
    </Card> : <>
      {run.cleanRoomStatus !== 'passed' && <div className="approval-waiting"><div><b>Clean-room replay is still running</b><span>Approval unlocks after a fresh-container replay passes.</span></div><Badge tone="blue" dot>{run.cleanRoomStatus}</Badge></div>}
      <Card className="review-card"><SectionHeading eyebrow="REHEARSAL VERIFIED" title="What Dryrun confirmed"/><div className="verified-line"><CheckCircle2/><div><b>Clean-room replay passed</b><span>Setup reproduced from scratch in a completely fresh container.</span></div><Badge tone="green">PASSED</Badge></div><div className="verified-facts"><div><span>REHEARSAL ATTEMPTS</span><b>{run.attempt} <small>/ {run.maxAttempts}</small></b></div><div><span>SANDBOX</span><b>{run.sandboxStatus === 'passed' ? 'Passed' : run.sandboxStatus}</b></div><div><span>REPOSITORY</span><b>{run.repository.owner}/{run.repository.name}</b></div></div></Card>
    </>}

    <div className="approval-grid">
      <div className="approval-main">
        <Card className="review-card">
          <div className="action-heading"><SectionHeading eyebrow="PROPOSED OPERATIONS" title="Review each action"/><Badge tone="neutral">{run.actions.length} typed actions</Badge></div>
          <p className="panel-description">The repository is cloned to the run workspace only after approval. System package installs stay manual.</p>
          <div className="action-list approval-action-list">{run.actions.map(action => <ActionCard key={action.id} action={action} approval/> )}</div>
          {secretActions.map(action => {
            const key = String(action.args.secret_key ?? '')
            return <label className="field-label" key={action.id}>
              Secret value for {key}
              <input className="text-input" type="password" autoComplete="off" value={secretValues[key] ?? ''}
                onChange={event => setSecretValues(current => ({ ...current, [key]: event.target.value }))}/>
            </label>
          })}
          {manualActions.length > 0 && <div className="manual-note"><div className="manual-note-icon"><CircleAlert size={16}/></div><div><b>{manualActions.length} manual action{manualActions.length === 1 ? '' : 's'} required</b><p>Operating-system package installation is never automated.</p></div><Badge tone="amber">MANUAL</Badge></div>}
        </Card>
        {!run.isBackendRun && <Card className="review-card"><SectionHeading eyebrow="EXPECTED AFTER APPLY" title="Service & health check"/><div className="expected-grid"><div><span>EXPECTED SERVICE</span><b>FastAPI application</b></div><div><span>EXPECTED PORT</span><b>{run.preferredPort}</b></div><div><span>HEALTH CHECK</span><HealthStatus health={run.healthCheck}/></div></div></Card>}
      </div>

      <aside className="approval-aside">
        <Card className="target-card"><SectionHeading eyebrow="APPLY TARGET" title="Workspace"/><div className="target-repo"><div className="repo-avatar"><Fingerprint size={18}/></div><div><b>{run.repository.name}</b><a href={run.repository.url} target="_blank" rel="noreferrer">{run.repository.owner}/{run.repository.name} <ExternalLink size={11}/></a></div></div><div className="target-location"><span>DEDICATED WORKSPACE</span><code>{run.workspace}</code></div><div className="target-location"><span>ENVIRONMENT MODE</span><b>{run.environmentMode}</b></div><div className="target-location"><span>PORT</span><b>{run.preferredPort}</b></div>{run.isBackendRun ? <div className="target-clean"><LockKeyhole size={15}/><span>Created only after approval</span></div> : <div className="target-clean"><CheckCircle2 size={15}/><span>Verified in clean room</span></div>}</Card>
        <Card className="decision-card"><div className="decision-icon"><ShieldCheck size={18}/></div><h3>Your decision</h3><p>{run.isBackendRun ? 'Approval clones the repository and runs only these typed actions in its dedicated workspace. Review any service-start action carefully.' : 'Approving applies only the reviewed workspace actions. Manual system setup remains yours to perform.'}</p>{decisionError && <p className="form-error" role="alert">{decisionError}</p>}<Button className="decision-approve" loading={busy} disabled={busy || !canApprove || !secretsReady} icon={<ArrowRight size={15}/>} onClick={() => void decide(true)}>Approve &amp; Apply</Button><Button className="decision-reject" variant="secondary" disabled={busy || run.approvalStatus !== 'pending'} onClick={() => void decide(false)}>Reject this plan</Button><div className="decision-fine"><LockKeyhole size={12}/>Explicit click required · no background apply</div></Card>
      </aside>
    </div>
    <div className="approval-footer"><Link to={`/run/${run.id}`}><ArrowLeft size={13}/> Back to timeline</Link><span>Dryrun · explicit approval boundary</span></div>
  </div>
}
