import assert from 'node:assert/strict'
import test from 'node:test'
import { isSafeWorkspaceName, normalizeRepositoryUrl, parsePreferredPort } from '../src/lib/validation.ts'

test('repository URLs are restricted to secure GitHub repository paths', () => {
  assert.equal(normalizeRepositoryUrl(' https://github.com/acme/widget.git '), 'https://github.com/acme/widget')
  assert.equal(normalizeRepositoryUrl('http://github.com/acme/widget'), undefined)
  assert.equal(normalizeRepositoryUrl('https://github.com.evil.test/acme/widget'), undefined)
  assert.equal(normalizeRepositoryUrl('https://github.com/acme'), undefined)
})

test('port and workspace fields reject invalid or traversing values', () => {
  assert.equal(parsePreferredPort('65535'), 65535)
  assert.equal(parsePreferredPort('0'), undefined)
  assert.equal(parsePreferredPort('8000x'), undefined)
  assert.equal(isSafeWorkspaceName('demo-app_1'), true)
  assert.equal(isSafeWorkspaceName('../outside'), false)
})
