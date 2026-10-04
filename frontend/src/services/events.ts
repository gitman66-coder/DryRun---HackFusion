import { mockBackend } from '../mocks/mockBackend'
import type { Run } from '../types'

const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'

// The current FastAPI API returns completed snapshots and has no SSE endpoint.
export function subscribeToRun(id: string, onRun: (run: Run) => void, onError?: (error: Error) => void): () => void {
  if (useMocks) return mockBackend.subscribe(id, onRun)
  void id
  void onRun
  void onError
  return () => {}
}
