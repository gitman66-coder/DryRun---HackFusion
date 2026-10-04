export function normalizeRepositoryUrl(value: string): string | undefined {
  let parsed: URL
  try { parsed = new URL(value.trim()) } catch { return undefined }
  const parts = parsed.pathname.split('/').filter(Boolean)
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'github.com' || parts.length < 2) return undefined
  const [owner, rawName] = parts
  const name = rawName.replace(/\.git$/, '')
  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(name) || owner === '.' || owner === '..' || name === '.' || name === '..') return undefined
  return `https://github.com/${owner}/${name}`
}

export function parsePreferredPort(value: string): number | undefined {
  const port = Number(value)
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
}

export function isSafeWorkspaceName(value: string): boolean {
  const name = value.trim()
  return !name || (/^[\w.-]+$/.test(name) && name !== '.' && name !== '..')
}
