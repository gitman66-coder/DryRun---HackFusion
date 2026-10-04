import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, CircleAlert, ExternalLink, FolderOpen, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { api } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { HealthStatus } from '../../components/status/HealthStatus'
import { ActionCard } from '../../components/actions/ActionCard'
import { LoadingState } from '../../components/ui/States'

export function ResultPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, error } = useRun(runId)
  const [workspaceMessage, setWorkspaceMessage] = useState('')
  if (error) return <div className="page"><LoadingState title="Run unavailable" detail={error}/></div>
  if (!run) return <div className="page"><LoadingState title="Loading result" detail="Collecting action results…"/></div>
  if (!run.result) return <div className="page"><LoadingState title="Run is still in progress" detail="The result will appear after the current operation finishes." action={<Button onClick={() => navigate(`/run/${run.id}`)}>Return to timeline</Button>}/></div>

  const result = run.result
  const resultRunId = run.id
  const isBackendRun = run.isBackendRun
  const success = result.status === 'success'
  const appliedCount = run.actions.filter(action => action.status === 'completed' || action.status === 'approved').length
  async function openWorkspace() {
    try {
      const location = await api.openWorkspace(resultRunId)
      if (!location) return
      if (!isBackendRun) {
        setWorkspaceMessage(`Mock workspace is ready at ${location}.`)
        return
      }
      await navigator.clipboard?.writeText(location)
      setWorkspaceMessage(`Workspace path copied: ${location}. Open it in File Explorer.`)
    } catch (reason) {
      setWorkspaceMessage(reason instanceof Error ? reason.message : 'Unable to copy the workspace path.')
    }
  }

  return <div className={`page result-page ${success ? 'result-success' : 'result-failure'}`}>
    <div className="run-breadcrumb"><Link to={`/run/${run.id}`}><ArrowLeft size={13}/> Run timeline</Link><span>/</span><b>FINAL RESULT</b></div>
    <div className="result-hero"><div className="result-symbol">{success ? <Check size={28}/> : <X size={28}/>}</div><Badge tone={success ? 'green' : 'red'} dot>{run.isBackendRun ? success ? 'ACTIONS APPLIED' : 'RUN FAILED' : success ? 'SETUP VERIFIED' : 'RUN STOPPED'}</Badge><h1>{run.isBackendRun ? success ? <>Approved actions<br/><em>were applied.</em></> : <>Dryrun could not<br/><em>complete the plan.</em></> : success ? <>Your repository<br/><em>is running.</em></> : <>Dryrun couldn't safely<br/><em>complete the setup.</em></>}</h1><p>{run.isBackendRun ? success ? 'The approved operations completed in the dedicated workspace. Service startup and health checks are not part of the current backend flow.' : result.reason ?? 'Review the action results. Some earlier approved actions may have completed before the failure.' : success ? 'The setup passed rehearsal, clean-room replay, and an explicit approval. Your service is healthy.' : result.reason}</p></div>
    <Card className="result-summary"><div className="result-summary-head"><div><div className="eyebrow">RUN SUMMARY</div><h2>{run.repository.owner}/{run.repository.name}</h2><a href={run.repository.url} target="_blank" rel="noreferrer">View repository <ExternalLink size={12}/></a></div><Badge tone={success ? 'green' : 'red'}>{run.isBackendRun ? success ? 'COMPLETED' : 'FAILED' : success ? 'HEALTHY' : 'FAILED'}</Badge></div>
      {run.isBackendRun ? <div className="result-metrics"><div className="result-metric"><span>STATUS</span><b className={success ? 'text-green' : 'text-red'}>{success ? 'Actions completed' : 'Action error'}</b></div><div className="result-metric"><span>ACTIONS</span><b>{appliedCount} / {run.actions.length} completed</b></div><div className="result-metric"><span>WORKSPACE</span><b className="result-workspace">{run.workspace}</b></div></div> : <div className="result-metrics"><div className="result-metric"><span>STATUS</span><b className={success ? 'text-green' : 'text-red'}>{success ? 'Healthy' : 'Failed'}</b></div><div className="result-metric"><span>SERVICE</span><b>{result.service ?? 'FastAPI'}</b></div><div className="result-metric"><span>PORT</span><b>{result.port ?? run.preferredPort}</b></div><div className="result-metric"><span>WORKSPACE</span><b className="result-workspace">{result.workspace ?? run.workspace}</b></div><div className="result-metric"><span>REHEARSAL</span><b>{result.totalAttempts} attempts</b></div><div className="result-metric"><span>CLEAN ROOM</span><b className={result.cleanRoomPassed ? 'text-green' : 'text-red'}>{result.cleanRoomPassed ? 'Passed' : 'Failed'}</b></div></div>}
      {!run.isBackendRun && <div className={`result-health ${success ? '' : 'result-health-bad'}`}><HealthStatus health={run.healthCheck}/>{success ? <span>Health endpoint verified after apply.</span> : <span>Failed at <b>{result.failedStage?.replace(/_/g, ' ')}</b></span>}</div>}
    </Card>
    {!run.isBackendRun && !success && <Card className="rollback-card"><div className="rollback-heading"><div className="rollback-icon"><RotateCcw size={17}/></div><div><div className="eyebrow">CLEANUP RESULT</div><h2>Rollback {result.rollbackStatus === 'complete' ? 'complete' : result.rollbackStatus === 'attention_required' ? 'needs attention' : 'not required'}</h2></div><Badge tone={result.rollbackStatus === 'complete' || result.rollbackStatus === 'not_needed' ? 'green' : 'amber'}>{result.rollbackStatus === 'complete' ? 'ROLLED BACK' : result.rollbackStatus === 'attention_required' ? 'ATTENTION REQUIRED' : 'NO HOST CHANGES'}</Badge></div>{result.rollbackStatus === 'complete' ? <div className="rollback-result rollback-ok"><CheckCircle2 size={16}/>Workspace rolled back successfully.</div> : result.rollbackStatus === 'attention_required' ? <div className="rollback-result rollback-warn"><CircleAlert size={16}/>Rollback requires attention. Review the diagnostics below.</div> : <div className="rollback-result"><ShieldCheck size={16}/>No workspace changes were applied, so rollback was not needed.</div>}{result.diagnostics?.length ? <ul className="diagnostics">{result.diagnostics.map(item => <li key={item}>{item}</li>)}</ul> : null}</Card>}
    {run.isBackendRun && !success && <Card className="rollback-card"><div className={`rollback-result ${run.approvalStatus === 'approved' ? 'rollback-warn' : ''}`}><CircleAlert size={16}/>{run.approvalStatus === 'approved' ? 'Automatic rollback is not implemented. Review the action record; earlier operations may have succeeded.' : run.approvalStatus === 'rejected' ? 'The plan was rejected. No host actions were run.' : 'No host actions were applied because the plan did not reach approval.'}</div>{result.diagnostics?.length ? <ul className="diagnostics">{result.diagnostics.map(item => <li key={item}>{item}</li>)}</ul> : null}</Card>}
    <Card className="result-actions"><div className="section-heading"><div><div className="eyebrow">ACTION RECORD</div><h2>{run.isBackendRun ? 'Approved operations' : 'Applied operations'}</h2></div><Badge tone="neutral">{appliedCount} completed</Badge></div><div className="action-list">{run.actions.map(action => <ActionCard key={action.id} action={action}/>)}</div></Card>
    <div className="result-buttons">{success && <Button icon={<FolderOpen size={15}/>} onClick={() => void openWorkspace()}>{run.isBackendRun ? 'Copy workspace path' : 'Open workspace'}</Button>}<Button variant="secondary" icon={<ArrowLeft size={15}/>} onClick={() => navigate(`/run/${run.id}`)}>View timeline</Button><Button variant={success ? 'ghost' : 'primary'} icon={<ArrowRight size={15}/>} onClick={() => navigate('/')}>Run another repository</Button></div>{workspaceMessage && <div className="workspace-message" role="status">{workspaceMessage}</div>}<div className="result-foot"><ShieldCheck size={14}/>{run.isBackendRun ? 'Workspace files were cloned after approval; use the path above to inspect them.' : <>The sandbox was disposable. Your workspace remains isolated at <code>{run.workspace}</code>.</>}</div>
  </div>
}
