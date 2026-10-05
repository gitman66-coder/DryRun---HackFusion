import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Box, CheckCircle2, CircleDot, Clock3, ExternalLink, GitBranch, RotateCcw, Shield, TerminalSquare } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { Card, SectionHeading } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { StageIndicator } from '../../components/timeline/StageIndicator'
import { TimelineEventCard } from '../../components/timeline/TimelineEventCard'
import { ActionCard } from '../../components/actions/ActionCard'
import { MetricCard } from '../../components/status/MetricCard'
import { Button } from '../../components/ui/Button'
import { LoadingState } from '../../components/ui/States'
import { prettyStage } from '../../lib/format'

export function RunPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, error } = useRun(runId)
  if (error) return <div className="page"><LoadingState title="Run unavailable" detail={error} action={<Button onClick={() => navigate('/')}>Start a new run</Button>} /></div>
  if (!run) return <div className="page"><LoadingState title="Connecting to run" detail="Loading repository inspection and plan…" /></div>

  const waiting = run.status === 'waiting'
  const failed = run.status === 'failure'
  const statusTone = run.status === 'success' ? 'green' : waiting ? 'amber' : failed ? 'red' : 'blue'
  return <div className="page run-page">
    <div className="run-breadcrumb"><Link to="/">Runs</Link><span>/</span><b>{run.id}</b></div>
    <div className="run-header"><div><div className="run-title-row"><div className="run-mark"><TerminalSquare size={18}/></div><h1>{run.repository.name}</h1><Badge tone={statusTone} dot>{run.isBackendRun ? (waiting ? 'PLAN READY' : run.status === 'success' ? 'ACTIONS APPLIED' : failed ? 'RUN FAILED' : 'ANALYZING') : run.status === 'running' ? 'AGENT ACTIVE' : run.status.toUpperCase()}</Badge></div><div className="repo-line"><a href={run.repository.url} target="_blank" rel="noreferrer">{run.repository.owner}/{run.repository.name}<ExternalLink size={12}/></a><span>·</span><span><GitBranch size={13}/> default branch</span><span>·</span><span>Created {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div><div className="run-header-id"><span>RUN ID</span><code>{run.id}</code></div></div>

    {waiting && <div className="approval-callout"><div className="callout-icon"><Shield size={19}/></div><div><b>{run.isBackendRun ? 'Repository inspection and plan are ready.' : 'Clean-room replay passed. Your review is next.'}</b><p>{run.isBackendRun ? 'No host actions have run. Review each typed operation before approving.' : 'The agent has not touched your machine. Review each typed action before anything is applied.'}</p></div><Button onClick={() => navigate(`/run/${run.id}/approval`)} icon={<ArrowRight size={15}/>}>Review action plan</Button></div>}
    {run.status === 'success' && <div className="approval-callout success-callout"><div className="callout-icon"><CheckCircle2 size={19}/></div><div><b>{run.isBackendRun ? 'Approved actions completed in the run workspace.' : 'Repository is healthy in your workspace.'}</b><p>{run.isBackendRun ? 'The current backend reports approved action results; it does not yet run a service health check.' : 'Rehearsal and clean-room replay completed before apply.'}</p></div><Button onClick={() => navigate(`/run/${run.id}/result`)}>View result <ArrowRight size={15}/></Button></div>}
    {failed && <div className="approval-callout failure-callout"><div className="callout-icon"><RotateCcw size={19}/></div><div><b>{run.isBackendRun ? 'Run ended with an error.' : 'Run ended · review the outcome and rollback status.'}</b><p>{run.result?.reason ?? run.summary}</p></div><Button variant="secondary" onClick={() => navigate(`/run/${run.id}/result`)}>View result <ArrowRight size={15}/></Button></div>}

    <div className="run-stat-grid">
      <MetricCard label="CURRENT STAGE" value={prettyStage(run.currentStage)} detail={run.isBackendRun ? 'Backend workflow progress' : 'Pipeline progress'} icon={<CircleDot size={15}/>} tone="metric-blue"/>
      {!run.isBackendRun && <MetricCard label="ATTEMPT" value={`${run.attempt} / ${run.maxAttempts}`} detail="Maximum 6 attempts" icon={<RotateCcw size={15}/>} />}
      <MetricCard label={run.isBackendRun ? 'DOCKER INSPECTION' : 'SANDBOX'} value={run.sandboxStatus === 'passed' ? (run.isBackendRun ? 'Complete' : 'Passed') : run.sandboxStatus === 'running' ? 'Running' : 'Pending'} detail={run.isBackendRun ? 'Repository inspection; setup not rehearsed' : 'Isolated · disposable'} icon={<Box size={15}/>} tone={run.sandboxStatus === 'passed' ? 'metric-green' : ''}/>
      {!run.isBackendRun && <MetricCard label="CLEAN ROOM" value={run.cleanRoomStatus === 'passed' ? 'Passed' : run.cleanRoomStatus === 'running' ? 'Running' : 'Pending'} detail="Fresh container replay" icon={<Shield size={15}/>} tone={run.cleanRoomStatus === 'passed' ? 'metric-green' : ''}/>}
      <MetricCard label="APPROVAL" value={run.approvalStatus === 'approved' ? 'Approved' : run.approvalStatus === 'rejected' ? 'Rejected' : run.approvalStatus === 'not_required' ? 'Not required' : 'Pending'} detail="Human decision" icon={<Clock3 size={15}/>} tone={run.approvalStatus === 'approved' ? 'metric-green' : ''}/>
    </div>

    {run.isBackendRun && <Card className="feasibility-panel"><div className="feasibility-heading"><div><SectionHeading eyebrow="README FEASIBILITY SNAPSHOT" title="Evidence and estimated risk"/><p className="panel-description">A planning estimate from repository files and proposed operations. No README setup commands have been executed.</p></div><Badge tone="amber" dot>ESTIMATE ONLY</Badge></div><div className="feasibility-grid"><div className="feasibility-cell"><span className="feasibility-symbol"><Box size={16}/></span><div><small>REPOSITORY EVIDENCE</small><b>{run.repositoryFiles?.length ?? 0} files inspected</b><em>{run.detectedStack?.length ? run.detectedStack.join(' · ') : 'Stack not identified'}</em></div></div><div className="feasibility-cell"><span className="feasibility-symbol risk-symbol"><Shield size={16}/></span><div><small>PROPOSED ACTION RISK</small><b>{run.actions.length ? `${run.actions.filter(action => action.risk === 'high').length ? 'High' : run.actions.some(action => action.risk === 'medium') ? 'Moderate' : 'Low'} estimated risk` : 'Not available yet'}</b><em>Based on action types; not runtime-tested</em></div></div><div className="feasibility-cell"><span className="feasibility-symbol unknown-symbol"><CircleDot size={16}/></span><div><small>YOUR MACHINE FIT</small><b>Not checked</b><em>Local compatibility is not measured</em></div></div></div></Card>}

    <div className="run-content-grid"><div className="run-left-column">
      <Card className="timeline-panel"><div className="panel-title-row"><SectionHeading eyebrow={run.isBackendRun ? 'INSPECTION AND PLAN' : 'LIVE AGENT TRACE'} title="Run timeline"/><span className="live-indicator"><i/>{run.isBackendRun ? 'SNAPSHOT' : run.status === 'running' ? 'LIVE' : 'STREAM'}</span></div><div className="timeline-layout"><div className="stage-list">{run.stages.map((stage, index) => <StageIndicator key={stage.stage} stage={stage} index={index} last={index === run.stages.length - 1}/>)}</div><div className="event-list" aria-live="polite">{run.events.length ? run.events.map(event => <TimelineEventCard key={event.id} event={event}/>) : <div className="event-empty"><span className="event-empty-icon"><Clock3 size={16}/></span><div><b>Investigation starting</b><p>Structured events will appear here when the inspection completes.</p></div></div>}</div></div></Card>
      <Card className="actions-panel"><SectionHeading eyebrow="TYPED ACTIONS" title="Execution plan" action={<Badge tone="neutral">{run.actions.length} actions</Badge>}/><p className="panel-description">Structured operations with a visible purpose and risk rating. No raw shell commands.</p>{run.summary && <p className="panel-description">{run.summary}</p>}<div className="action-list">{run.actions.map(action => <ActionCard key={action.id} action={action}/>)}</div></Card>
    </div><div className="run-right-column">
      <Card className="repo-card"><SectionHeading eyebrow="TARGET REPOSITORY" title="Repository"/><div className="repo-card-main"><div className="repo-avatar"><GithubIcon/></div><div><b>{run.repository.owner}/{run.repository.name}</b><a href={run.repository.url} target="_blank" rel="noreferrer">Open on GitHub <ExternalLink size={12}/></a></div></div><div className="repo-detail"><span>Workspace {run.workspaceReady ? '(created)' : '(after approval)'}</span><code>{run.workspace}</code></div><div className="repo-detail"><span>Environment</span><b>{run.environmentMode}</b></div><div className="repo-detail"><span>Preferred port</span><b>{run.preferredPort}</b></div>{run.detectedStack?.length ? <div className="repo-detail"><span>Detected stack</span><b>{run.detectedStack.join(', ')}</b></div> : null}</Card>
      <Card className="guardrails-card"><div className="guardrail-head"><Shield size={17}/><b>Safety guardrails</b></div><ul><li><CheckCircle2/>Repository is inspected in Docker</li><li><CheckCircle2/>No host changes before approval</li>{run.isBackendRun ? <li><CheckCircle2/>System packages remain manual</li> : <><li><CheckCircle2/>Clean-room replay before approval</li><li><CheckCircle2/>System packages remain manual</li></>}</ul><div className="guardrail-foot"><span className="connection-dot"/>Sandbox isolated</div></Card>
      {!run.isBackendRun && <Card className="attempt-card"><div className="attempt-top"><span>FIX LOOP</span><span>{run.attempt} <i>/</i> {run.maxAttempts}</span></div><div className="attempt-bars">{Array.from({ length: run.maxAttempts }, (_, i) => <span key={i} className={i < run.attempt ? i === 0 ? 'attempt-warn' : 'attempt-done' : ''}/>)}</div><small>Each correction is rehearsed before it is accepted.</small></Card>}
    </div></div>
    <div className="run-bottom"><span><Shield size={13}/>{run.isBackendRun ? 'Host actions run only after your explicit approval.' : 'Sandbox work is disposable. Host apply always waits for your explicit approval.'}</span><Link to="/">Start another run <ArrowRight size={13}/></Link></div>
  </div>
}
function GithubIcon(){return <GitBranch size={18}/>}
