import { useEffect, useState } from 'react'
import { api } from '../services/api'
import { subscribeToRun } from '../services/events'
import type { Run } from '../types'

export function useRun(id: string | undefined) {
  const [run, setRun] = useState<Run>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!id) return
    let active = true
    const unsubscribe = subscribeToRun(id, value => { if (active) setRun(value) }, reason => { if (active) setError(reason.message) })
    void api.getRun(id).then(value => { if (active) setRun(current => current ?? value) }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load run') })
    return () => { active = false; unsubscribe() }
  }, [id])
  return { run, error }
}
