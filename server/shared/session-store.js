/**
 * 会话隔离存储
 *
 * 平台级共享模块：任何需要「按访客保存状态」的游戏都用它，
 * 不要再在路由文件里写模块级 let 变量（那会让所有访客共用一份状态）。
 */

const DEFAULT_TTL_MS = 30 * 60 * 1000
const SWEEP_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_MAX_SESSIONS = 500
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export function isValidSessionId(id) {
  return typeof id === 'string' && SESSION_ID_PATTERN.test(id)
}

/**
 * @param {object} options
 * @param {() => any} options.create 新会话的初始状态工厂
 * @param {number} [options.ttl] 空闲多久后过期
 * @param {number} [options.max] 会话数上限，超出后淘汰最久未使用的
 */
export function createSessionStore({ create, ttl = DEFAULT_TTL_MS, max = DEFAULT_MAX_SESSIONS }) {
  const sessions = new Map()

  const isExpired = (entry, now) => now - entry.touched > ttl

  function sweep() {
    const now = Date.now()
    for (const [id, entry] of sessions) {
      if (isExpired(entry, now)) sessions.delete(id)
    }
  }

  const timer = setInterval(sweep, SWEEP_INTERVAL_MS)
  timer.unref?.()

  function peek(id) {
    if (!isValidSessionId(id)) return null
    const entry = sessions.get(id)
    if (!entry) return null
    if (isExpired(entry, Date.now())) {
      sessions.delete(id)
      return null
    }
    return entry
  }

  /** 读取已有会话状态；不存在或已过期返回 null，不会创建 */
  function get(id) {
    const entry = peek(id)
    if (!entry) return null
    touch(id, entry)
    return entry.data
  }

  /** 读取会话状态，不存在则用 create() 建一个 */
  function ensure(id) {
    const existing = peek(id)
    if (existing) {
      touch(id, existing)
      return existing.data
    }

    if (sessions.size >= max) {
      // Map 保持插入顺序，配合 touch 的重排，首个即最久未使用
      sessions.delete(sessions.keys().next().value)
    }

    const data = create()
    sessions.set(id, { data, touched: Date.now() })
    return data
  }

  function touch(id, entry) {
    entry.touched = Date.now()
    sessions.delete(id)
    sessions.set(id, entry)
  }

  return {
    get,
    ensure,
    sweep,
    get size() {
      return sessions.size
    }
  }
}

/** 从请求中取会话 ID（统一走 X-Session-Id 头） */
export function readSessionId(req) {
  return req.get('X-Session-Id') || req.query?.sid || null
}
