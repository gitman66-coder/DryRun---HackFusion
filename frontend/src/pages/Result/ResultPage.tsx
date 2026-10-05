import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleAlert, ExternalLink, FileSearch, Shield, TerminalSquare, X } from 'lucide-react'
import { useRun } from '../../hooks/useRun'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { LoadingState } from '../../components/ui/States'

export function ResultPage() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { run, error } = useRun(runId)
  if (error) return <div className="page"><LoadingState title="Report unavailable" detail={error}/></div>
  if (!run) return <div className="page"><LoadingState title="Loading sandbox report" detail="Collecting repository evidence and check output…"/></div>
  if (!run.result) return <div className="page"><LoadingState title="Sandbox run is still in progress" detail="The report appears when Docker checks finish." action={<Button onClick={() => navigate(`/run/${run.id}`)}>Return to run</Button>}/></div>

  const verdict = run.result.status
  const passed = verdict === 'success'
  const inconclusive = verdict === 'inconclusive'
  const tone = passed ? 'green' : inconclusive ? 'amber' : 'red'
  return <div className={`page result-page ${passed ? 'result-success' : 'result-failure'}`}>
    <div className="run-breadcrumb"><Link to={`/run/${run.id}`}><ArrowLeft size={13}/> Run overview</Link><span>/</span><b>FEASIBILITY REPORT</b></div>
    <div className="result-hero"><div className="result-symbol">{passed ? <Check size={28}/> : <X size={28}/>}</div><Badge tone={tone} dot>{inconclusive ? 'INCONCLUSIVE' : passed ? 'SANDBOX CHECKS PASSED' : 'SANDBOX CHECK FAILED'}</Badge><h1>{passed ? <>Setup checks passed<br/><em>inside Docker.</em></> : inconclusive ? <>No safe setup check<br/><em>could be confirmed.</em></> : <>The sandbox check<br/><em>needs attention.</em></>}</h1><p>{run.result.reason}. This result describes the disposable Docker environment and does not guarantee your local machine can run the project.</p></div>
    <Card className="result-summary"><div className="result-summary-head"><div><div className="eyebrow">REPOSITORY SUMMARY</div><h2>{run.repository.owner}/{run.repository.name}</h2><a href={run.repository.url} target="_blank" rel="noreferrer">View repository <ExternalLink size={12}/></a></div><Badge tone={tone}>{inconclusive ? 'NO VERDICT' : passed ? 'PASSED' : 'FAILED'}</Badge></div><div className="result-metrics"><div className="result-metric"><span>FILES INSPECTED</span><b>{run.repositoryFiles?.length ?? 0}</b></div><div className="result-metric"><span>CHECKS PASSED</span><b>{run.rehearsalResults.filter(check => check.status === 'passed').length} / {run.rehearsalResults.length}</b></div><div className="result-metric"><span>ESTIMATED RISK</span><b>{run.riskAssessment?.level ?? 'Unavailable'}</b></div><div className="result-metric"><span>DETECTED STACK</span><b>{run.detectedStack?.join(', ') || 'Not identified'}</b></div><div className="result-metric"><span>RUN ENVIRONMENT</span><b>Disposable Docker container</b></div><div className="result-metric"><span>HOST COMPATIBILITY</span><b>Not measured</b></div></div></Card>
    {run.riskAssessment && <Card className="result-risk"><div className="result-risk-heading"><Shield size={17}/><div><div className="eyebrow">RISK ESTIMATE · {run.riskAssessment.level.toUpperCase()}</div><p>{run.riskAssessment.reason}</p></div></div></Card>}
    {run.cleanupWarning && <Card className="rollback-card"><div className="rollback-result rollback-warn"><CircleAlert size={16}/>Docker cleanup could not be confirmed: {run.cleanupWarning}</div></Card>}
    <Card className="result-actions"><div className="section-heading"><div><div className="eyebrow">SANDBOX EXECUTION LOG</div><h2>Setup checks</h2></div><Badge tone="neutral">{run.rehearsalResults.length} executed</Badge></div>{run.rehearsalResults.length ? <div className="sandbox-check-list">{run.rehearsalResults.map(check => <article className={`sandbox-check sandbox-check-${check.status}`} key={check.index}><div className="sandbox-check-head"><span className="sandbox-check-index">{String(check.index).padStart(2,'0')}</span><b>{check.description}</b><Badge tone={check.status==='passed'?'green':check.status==='failed'?'red':'amber'}>{check.status}{check.exit_code===null?'':` · exit ${check.exit_code}`}</Badge></div><code className="sandbox-command">{check.command}</code>{check.stdout && <div className="sandbox-output"><small>OUTPUT</small><pre>{check.stdout}</pre></div>}{check.stderr && <div className="sandbox-output sandbox-stderr"><small>ERROR OUTPUT</small><pre>{check.stderr}</pre></div>}</article>)}</div> : <div className="event-empty"><span className="event-empty-icon"><FileSearch size={16}/></span><div><b>No commands were run</b><p>{run.summary}</p></div></div>}</Card>
    {run.result.diagnostics?.length ? <Card className="rollback-card"><div className="rollback-heading"><div className="rollback-icon"><CircleAlert size={17}/></div><div><div className="eyebrow">CHECK DIAGNOSTICS</div><h2>What needs attention</h2></div></div><ul className="diagnostics">{run.result.diagnostics.map(item => <li key={item}>{item}</li>)}</ul></Card> : null}
    <div className="result-buttons"><Button variant="secondary" icon={<ArrowLeft size={15}/>} onClick={() => navigate(`/run/${run.id}`)}>View timeline</Button><Button variant="primary" icon={<ArrowRight size={15}/>} onClick={() => navigate('/')}>Check another repository</Button></div>
    <div className="result-foot"><TerminalSquare size={14}/>The Docker container was removed after the checks. Nothing was applied to your machine.</div>
  </div>
}
