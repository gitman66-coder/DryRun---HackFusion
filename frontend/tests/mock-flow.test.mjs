import assert from 'node:assert/strict'
import test from 'node:test'
import { mockBackend } from '../src/mocks/mockBackend.ts'

function untilRun(id, predicate, realTimeout) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {}
    const timer = realTimeout(() => { unsubscribe(); reject(new Error('Timed out waiting for mock run state')) }, 10_000)
    unsubscribe = mockBackend.subscribe(id, run => {
      if (predicate(run)) { clearTimeout(timer); unsubscribe(); resolve(run) }
    })
  })
}

test('mock streams rehearsal, approval, rejection, and rollback outcomes', async () => {
  const realTimeout = globalThis.setTimeout
  globalThis.setTimeout = (callback, _delay, ...args) => realTimeout(callback, 1, ...args)
  try {
    const start = async outcome => {
      const run = await mockBackend.createRun({ repositoryUrl: 'https://github.com/acme/widget', workspaceName: 'demo', preferredPort: 8123, environmentMode: 'development', outcome })
      const waiting = await untilRun(run.id, value => value.status === 'waiting', realTimeout)
      assert.ok(waiting.events.some(event => event.message.includes('failed to start')))
      assert.ok(waiting.events.some(event => event.stage === 'diagnose'))
      assert.ok(waiting.events.some(event => event.message.includes('Clean-room replay passed')))
      assert.ok(waiting.actions.every(action => action.status === 'planned' || action.status === 'manual_required'))
      return run.id
    }

    const successId = await start('success')
    await mockBackend.decideApproval(successId, true)
    const success = await untilRun(successId, value => value.status === 'success', realTimeout)
    assert.equal(success.result?.port, 8123)
    assert.ok(success.actions.some(action => action.kind === 'pip_install' && action.status === 'completed'))
    assert.ok(success.actions.some(action => action.kind === 'system_package' && action.status === 'manual_required'))

    const rejectedId = await start('success')
    await mockBackend.decideApproval(rejectedId, false)
    const rejected = await untilRun(rejectedId, value => value.status === 'failure', realTimeout)
    assert.equal(rejected.result?.rollbackStatus, 'not_needed')
    assert.ok(rejected.actions.filter(action => action.status !== 'manual_required').every(action => action.status === 'rejected'))

    const rollbackId = await start('rollback_failure')
    await mockBackend.decideApproval(rollbackId, true)
    const rollback = await untilRun(rollbackId, value => value.status === 'failure', realTimeout)
    assert.equal(rollback.result?.rollbackStatus, 'attention_required')
    assert.ok(rollback.actions.some(action => action.status === 'completed'))
  } finally {
    globalThis.setTimeout = realTimeout
  }
})
