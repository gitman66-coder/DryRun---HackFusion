import { mockBackend } from '../mocks/mockBackend'
import type { CreateRunInput, Run } from '../types'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(`Dryrun API error (${response.status})`)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const api = {
  async createRun(input: CreateRunInput): Promise<Run> {
    if (useMocks) return mockBackend.createRun(input)
    const payload = { repositoryUrl: input.repositoryUrl, workspaceName: input.workspaceName, preferredPort: input.preferredPort, environmentMode: input.environmentMode }
    return request<Run>('/runs', { method: 'POST', body: JSON.stringify(payload) })
  },
  async getRun(id: string): Promise<Run> {
    return useMocks ? mockBackend.getRun(id) : request<Run>(`/runs/${encodeURIComponent(id)}`)
  },
  async decideApproval(id: string, approved: boolean): Promise<void> {
    if (useMocks) return mockBackend.decideApproval(id, approved)
    await request(`/runs/${encodeURIComponent(id)}/approval`, { method: 'POST', body: JSON.stringify({ decision: approved ? 'approve' : 'reject' }) })
  },
  async openWorkspace(id: string): Promise<string | void> {
    if (useMocks) return (await mockBackend.getRun(id)).workspace
    await request(`/runs/${encodeURIComponent(id)}/workspace/open`, { method: 'POST' })
  },
}
export const isUsingMocks = useMocks
