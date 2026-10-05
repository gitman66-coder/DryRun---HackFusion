export type Stage = 'investigate' | 'plan' | 'rehearse' | 'done'
export type RunStatus = 'queued' | 'running' | 'success' | 'failure'
export type StageState = 'pending' | 'running' | 'success' | 'warning' | 'failed'
export type Risk = 'low' | 'medium' | 'high'
export type CheckStatus = 'passed' | 'failed' | 'skipped'
export type Outcome = 'success' | 'failure'

export interface Repository { url: string; owner: string; name: string }
export interface RehearsalStep { description: string; command: string; timeout_seconds?: number }
export interface RehearsalResult { index: number; description: string; command: string; status: CheckStatus; exit_code: number | null; stdout: string; stderr: string }
export interface RiskAssessment { level: Risk; reason: string }
export interface Feasibility { status: 'passed' | 'failed' | 'inconclusive'; reason: string }
export interface TimelineEvent { id: string; timestamp: string; type: 'stage' | 'discovery' | 'action' | 'diagnostic' | 'result'; stage: Stage; message: string; status: StageState }
export interface Result { status: 'success' | 'failure' | 'inconclusive'; reason?: string; diagnostics?: string[] }
export interface StageProgress { stage: Stage; state: StageState; label: string }
export interface Run {
  id: string; repository: Repository; isBackendRun?: boolean; summary?: string
  detectedStack?: string[]; repositoryFiles?: string[]; currentStage: Stage; status: RunStatus
  sandboxStatus: 'pending' | 'running' | 'passed' | 'failed'; stages: StageProgress[]
  rehearsalSteps: RehearsalStep[]; rehearsalResults: RehearsalResult[]; riskAssessment?: RiskAssessment
  feasibility?: Feasibility; cleanupWarning?: string; events: TimelineEvent[]; result?: Result; createdAt: string
}
export interface CreateRunInput { repositoryUrl: string; outcome?: Outcome }
