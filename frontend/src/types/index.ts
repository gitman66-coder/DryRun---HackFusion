export type Stage = 'investigate' | 'plan' | 'rehearse' | 'diagnose' | 'clean_room' | 'approval' | 'apply' | 'health_check' | 'done'
export type RunStatus = 'queued' | 'running' | 'waiting' | 'success' | 'failure'
export type StageState = 'pending' | 'running' | 'success' | 'warning' | 'failed' | 'waiting'
export type Risk = 'low' | 'medium' | 'high'
export type ActionStatus = 'planned' | 'approved' | 'completed' | 'manual_required' | 'rejected' | 'failed'
export type Outcome = 'success' | 'rollback_failure'

export interface Repository { url: string; owner: string; name: string; branch?: string }
export interface Action { id: string; kind: 'create_venv' | 'pip_install' | 'npm_install' | 'write_file' | 'run_service' | 'system_package'; args: Record<string, unknown>; purpose: string; risk: Risk; status: ActionStatus; affectedPath?: string }
export interface TimelineEvent { id: string; timestamp: string; type: 'stage' | 'discovery' | 'action' | 'diagnostic' | 'approval' | 'result'; stage: Stage; message: string; status: StageState; metadata?: Record<string, unknown> }
export interface Approval { required: boolean; status: 'pending' | 'approved' | 'rejected' | 'not_required'; requestedAt?: string; decidedAt?: string }
export interface HealthCheck { status: 'pending' | 'healthy' | 'unhealthy'; service?: string; port?: number; url?: string; checkedAt?: string }
export interface Result { status: 'success' | 'failure'; failedStage?: Stage; reason?: string; diagnostics?: string[]; rollbackStatus?: 'not_needed' | 'complete' | 'attention_required'; workspace?: string; service?: string; port?: number; totalAttempts: number; cleanRoomPassed: boolean }
export interface StageProgress { stage: Stage; state: StageState; label: string }
export interface Run { id: string; repository: Repository; workspace: string; currentStage: Stage; status: RunStatus; attempt: number; maxAttempts: number; sandboxStatus: 'pending' | 'running' | 'passed' | 'failed'; cleanRoomStatus: 'pending' | 'running' | 'passed' | 'failed'; approvalStatus: Approval['status']; stages: StageProgress[]; actions: Action[]; events: TimelineEvent[]; healthCheck: HealthCheck; result?: Result; outcome: Outcome; preferredPort: number; environmentMode: string; createdAt: string }
export interface CreateRunInput { repositoryUrl: string; workspaceName: string; preferredPort: number; environmentMode: string; outcome: Outcome }
