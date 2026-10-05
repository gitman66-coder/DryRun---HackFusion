import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Box, CheckCircle2, CircleAlert, CircleDot, ExternalLink, FileSearch, Github, Shield, TerminalSquare } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { Card, SectionHeading } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { StageIndicator } from '../../components/timeline/StageIndicator'
import { TimelineEventCard } from '../../components/timeline/TimelineEventCard'
import { MetricCard } from '../../components/status/MetricCard'
import { Button } from '../../components/ui/Button'
import { LoadingState } from '../../components/ui/States'

export function RunPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, error } = useRun(runId)
  if (error) return <div className="page"><LoadingState title="Run unavailable" detail={error} action={<Button onClick={() => navigate('/')}>Start a new check</Button>} /></div>
  if (!run) return <div className="page"><LoadingState title="Checking repository" detail="Cloning into Docker, reviewing project files, and preparing bounded sandbox checks…" /></div>

  const failed = run.result?.status === 'failure'
  const inconclusive = run.result?.status === 'inconclusive'
  const statusTone = failed ? 'red' : inconclusive ? 'amber' : run.result ? 'green' : 'blue'
  const passedCount = run.rehearsalResults.filter(check => check.status === 'passed').length
  const statusLabel = failed ? 'CHECK FAILED' : inconclusive ? 'INCONCLUSIVE' : run.result ? 'SANDBOX CHECKED' : 'ANALYZING'
  return <div className="page run-page">
    <div className="run-breadcrumb"><Link to="/">New check</Link><span>/</span><b>{run.id}</b></div>
    <div className="run-header"><div><div className="run-title-row"><div className="run-mark"><TerminalSquare size={18}/></div><h1>{run.repository.name}</h1><Badge tone={statusTone} dot>{statusLabel}</Badge></div><div className="repo-line"><a href={run.repository.url} target="_blank" rel="noreferrer">{run.repository.owner}/{run.repository.name}<ExternalLink size={12}/></a><span>·</span><span><Box size={13}/> Disposable Docker run</span><span>·</span><span>Created {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div><div className="run-header-id"><span>RUN ID</span><code>{run.id}</code></div></div>

    {run.result && <div className={`approval-callout ${failed ? 'failure-callout' : 'success-callout'}`}><div className="callout-icon">{failed ? <CircleAlert size={19}/> : <CheckCircle2 size={19}/>}</div><div><b>{failed ? 'A sandbox check did not pass.' : inconclusive ? 'The run finished without a conclusive setup check.' : 'Sandbox checks are complete.'}</b><p>{run.result.reason}</p></div><Button onClick={() => navigate(`/run/${run.id}/result`)}>View full report <ArrowRight size={15}/></Button></div>}

    <div className="run-stat-grid">
      <MetricCard label="REPOSITORY FILES" value={String(run.repositoryFiles?.length ?? 0)} detail="Inspected inside Docker" icon={<FileSearch size={15}/>} tone="metric-blue"/>
      <MetricCard label="CHECKS PASSED" value={`${passedCount} / ${run.rehearsalResults.length}`} detail={run.rehearsalResults.length ? 'Commands executed in sandbox' : 'No safe checks generated'} icon={<CheckCircle2 size={15}/>} tone={passedCount ? 'metric-green' : ''}/>
      <MetricCard label="ESTIMATED RISK" value={run.riskAssessment?.level?.toUpperCase() ?? 'UNKNOWN'} detail="Heuristic based on commands" icon={<Shield size={15}/>} tone={run.riskAssessment?.level === 'low' ? 'metric-green' : ''}/>
    </div>

    <Card className="feasibility-panel"><div className="feasibility-heading"><div><SectionHeading eyebrow="SANDBOX FEASIBILITY" title={run.feasibility?.status === 'passed' ? 'Documented checks passed' : run.feasibility?.status === 'failed' ? 'One or more checks failed' : 'Not enough evidence to decide'}/><p className="panel-description">{run.feasibility?.reason ?? 'The verification report is being prepared.'}</p></div><Badge tone={statusTone} dot>{run.feasibility?.status ?? 'RUNNING'}</Badge></div><div className="feasibility-grid"><div className="feasibility-cell"><span className="feasibility-symbol"><Box size={16}/></span><div><small>TEST ENVIRONMENT</small><b>Disposable Docker sandbox</b><em>Container is removed after the check</em></div></div><div className="feasibility-cell"><span className="feasibility-symbol risk-symbol"><Shield size={16}/></span><div><small>COMMAND RISK</small><b>{run.riskAssessment?.level ? `${run.riskAssessment.level} estimate` : 'Not available'}</b><em>{run.riskAssessment?.reason ?? 'No command risk assessment returned.'}</em></div></div><div className="feasibility-cell"><span className="feasibility-symbol unknown-symbol"><CircleAlert size={16}/></span><div><small>YOUR MACHINE</small><b>Not directly tested</b><em>Docker results are evidence, not a guarantee for the host.</em></div></div></div></Card>

    <div className="run-content-grid"><div className="run-left-column">
      <Card className="timeline-panel"><div className="panel-title-row"><SectionHeading eyebrow="INSPECTION → SANDBOX → REPORT" title="Run timeline"/><span className="live-indicator"><i/>{run.result ? 'COMPLETE' : 'RUNNING'}</span></div><div className="timeline-layout"><div className="stage-list">{run.stages.map((stage, index) => <StageIndicator key={stage.stage} stage={stage} index={index} last={index === run.stages.length - 1}/>)}</div><div className="event-list" aria-live="polite">{run.events.length ? run.events.map(event => <TimelineEventCard key={event.id} event={event}/>) : <div className="event-empty"><span className="event-empty-icon"><CircleDot size={16}/></span><div><b>Inspection starting</b><p>Repository evidence and sandbox results will appear here.</p></div></div>}</div></div></Card>
      <Card className="actions-panel"><SectionHeading eyebrow="EXECUTED IN DOCKER" title="Sandbox checks" action={<Badge tone="neutral">{run.rehearsalResults.length} completed</Badge>}/><p className="panel-description">Commands run in the disposable container from the cloned repository root. The first failure stops later checks.</p>{run.rehearsalSteps.length ? <div className="sandbox-check-list">{run.rehearsalSteps.map((step,index) => { const result=run.rehearsalResults.find(item=>item.index===index+1); return <article className="sandbox-check" key={`${index}-${step.command}`}><div className="sandbox-check-head"><span className="sandbox-check-index">{String(index+1).padStart(2,'0')}</span><b>{step.description}</b><Badge tone={result?.status==='passed'?'green':result?.status==='failed'?'red':result?.status==='skipped'?'amber':'neutral'}>{result?.status ?? 'pending'}</Badge></div><code className="sandbox-command">{step.command}</code>{result?.exit_code !== null && result?.exit_code !== undefined && <small className="sandbox-exit">exit code {result.exit_code}</small>}</article> })}</div> : <div className="event-empty"><span className="event-empty-icon"><CircleAlert size={16}/></span><div><b>No executable check was generated</b><p>{run.summary || 'The report will explain which setup evidence was missing.'}</p></div></div>}</Card>
    </div><div className="run-right-column">
      <Card className="repo-card"><SectionHeading eyebrow="SOURCE REPOSITORY" title="Repository"/><div className="repo-card-main"><div className="repo-avatar"><Github size={18}/></div><div><b>{run.repository.owner}/{run.repository.name}</b><a href={run.repository.url} target="_blank" rel="noreferrer">Open on GitHub <ExternalLink size={12}/></a></div></div><div className="repo-detail"><span>Files discovered</span><b>{run.repositoryFiles?.length ?? 0}</b></div><div className="repo-detail"><span>Setup files read</span><b>{run.events.find(event => event.stage === 'investigate')?.message.match(/read (\d+) setup files/)?.[1] ?? '0'}</b></div>{run.detectedStack?.length ? <div className="repo-detail"><span>Detected stack</span><b>{run.detectedStack.join(', ')}</b></div> : null}</Card>
      <Card className="guardrails-card"><div className="guardrail-head"><Shield size={17}/><b>Sandbox boundaries</b></div><ul><li><CheckCircle2/>No host folders mounted</li><li><CheckCircle2/>CPU, memory, process and time limits</li><li><CheckCircle2/>Container removed after verification</li><li><CheckCircle2/>No approval or host apply endpoint</li></ul><div className="guardrail-foot"><span className="connection-dot"/>Checks stay in Docker</div></Card>
    </div></div>
    <div className="run-bottom"><span><Shield size={13}/>This report describes sandbox results; it does not certify compatibility with your host machine.</span><Link to="/">Check another repository <ArrowRight size={13}/></Link></div>
  </div>
}
