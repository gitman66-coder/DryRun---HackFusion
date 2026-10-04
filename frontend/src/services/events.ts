import { mockBackend } from '../mocks/mockBackend'
import type { Run } from '../types'

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false'
const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export function subscribeToRun(id: string, onRun: (run: Run) => void, onError?: (error: Error) => void): () => void {
  if (useMocks) return mockBackend.subscribe(id, onRun)
  const source = new EventSource(`${apiBase}/runs/${encodeURIComponent(id)}/events`)
  source.onmessage = event => {
    try { onRun(JSON.parse(event.data) as Run) } catch { onError?.(new Error('Received an invalid run event')) }
  }
  source.onerror = () => onError?.(new Error('The live event connection was interrupted'))
  return () => source.close()
}
