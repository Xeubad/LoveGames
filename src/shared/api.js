/**
 * 前端统一 API 客户端
 *
 * 每个浏览器自动获得一个稳定的会话 ID，随请求发给后端，
 * 后端据此隔离「内容尺度」「AI 任务池」等按访客保存的状态。
 */

const STORAGE_KEY = 'lovegames.sessionId'
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

// localStorage 不可用（隐私模式等）时的内存态兜底，必须缓存，
// 否则每次请求都换新 ID，服务端的会话状态永远命中不了
let memorySessionId = null

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID().replaceAll('-', '')
  }
  let id = ''
  while (id.length < 32) {
    id += Math.random().toString(36).slice(2, 12)
  }
  return id.slice(0, 32)
}

export function getSessionId() {
  if (memorySessionId) return memorySessionId

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && ID_PATTERN.test(stored)) return stored
    const fresh = generateId()
    localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  } catch {
    memorySessionId = generateId()
    return memorySessionId
  }
}

/**
 * 带会话头的 fetch。用法与 fetch 一致，路径以 / 开头。
 * 非 2xx 会抛出带 status 的 Error，调用方按需降级。
 */
export async function api(path, options = {}) {
  const { headers = {}, ...rest } = options
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...headers,
      'X-Session-Id': getSessionId()
    }
  })

  if (!response.ok) {
    const error = new Error(`请求失败 (${response.status})`)
    error.status = response.status
    error.body = await response.text().catch(() => '')
    throw error
  }

  return response
}

export async function apiJSON(path, options) {
  return (await api(path, options)).json()
}

export function postJSON(path, body) {
  return apiJSON(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export function putJSON(path, body) {
  return apiJSON(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}
