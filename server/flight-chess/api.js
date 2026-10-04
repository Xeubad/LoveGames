/**
 * 飞行棋 API 路由
 *
 * 所有按访客保存的状态（内容尺度、AI 任务池）都走 session-store 隔离，
 * 不再是模块级全局变量 —— 否则任一路人都能改掉其他所有人的内容尺度。
 */
import { Router } from 'express'
import { createSessionStore, readSessionId } from '../shared/session-store.js'
import { generateTasks, isConfigured } from '../shared/ai-client.js'
import { TIERS, pickRandom, query } from '../shared/content-library.js'

const router = Router()

const CONTENT_LEVELS = Object.keys(TIERS)
const levelTitles = { basic: '💕 温馨任务', couple: '🔥 情侣任务' }

/** 温馨档 AI 生成的风格约束 */
const basicStyleGuide = `1. 必须与样例风格一致，简短直接
2. 每个任务 15-25 字
3. 包含具体动作和时长（如"30秒"、"1分钟"）
4. 温馨、有趣、不尴尬
5. 适合室内完成
6. 可以包含：拥抱、牵手、对视、唱歌、按摩、亲吻额头/手背等
7. 不要包含过于亲密的内容`

// 户外/公共场合类条目默认被 query() 排除，飞行棋不需要它们
const sampleTexts = (tier) => query({ tier }).map((item) => item.text)

/**
 * 从本地库抽一条，并记住已抽过的 —— 有放回随机在一局 22 次抽取里
 * 按生日悖论会重复约 4 次，抽完一轮再重置即可彻底避免。
 */
function pickLocalItem(state) {
  let pool = query({ tier: state.level, excludeIds: state.usedIds })
  if (pool.length === 0) {
    state.usedIds = []
    pool = query({ tier: state.level })
  }
  const item = pickRandom(pool, 1)[0]
  state.usedIds.push(item.id)
  return item
}

/**
 * 只有温馨档接 AI。亲密档的请求会被主流供应商的内容审核拒绝，
 * 与其让用户看到莫名失败，不如在设计上就不发起。
 */
const AI_LEVELS = new Set(['basic'])

const POOL_SIZE = 10
const REFILL_THRESHOLD = 3
const REFILL_SIZE = 5
/** AI 连续失败后的冷却，避免每次掷骰子都卡满超时 */
const FILL_BACKOFF_MS = 60 * 1000

const sessions = createSessionStore({
  create: () => ({
    level: 'basic',
    useAI: false,
    pool: [],
    poolIndex: 0,
    refilling: false,
    blockedUntil: 0,
    usedIds: []
  })
})

async function fillPool(state, count) {
  const tasks = await generateTasks(count, sampleTexts(state.level), basicStyleGuide)
  state.pool = [...state.pool, ...tasks]
}

/**
 * AI 能否服务当前档位 —— 只看能力，不看用户有没有打开开关。
 * 返回 null 表示可用，否则返回可直接展示给用户的原因。
 */
function aiBlockReason(state) {
  if (!AI_LEVELS.has(state.level)) {
    return '亲密档内容由本地精编题库提供，AI 不生成该类内容'
  }
  if (!isConfigured()) return '服务端未配置 AI_API_KEY，已使用本地题库'
  if (Date.now() < state.blockedUntil) return 'AI 近期调用失败，暂时使用本地题库'
  return null
}

async function takeTask(state) {
  // 用户主动选了本地题库时不必报警，只有「想用 AI 但用不上」才需要说明
  const reason = state.useAI ? aiBlockReason(state) : null
  if (!state.useAI || reason) {
    return { task: pickLocalItem(state).text, source: 'local', notice: reason || undefined }
  }

  if (state.pool.length === 0) {
    try {
      await fillPool(state, POOL_SIZE)
    } catch (error) {
      state.blockedUntil = Date.now() + FILL_BACKOFF_MS
      return {
        task: pickLocalItem(state).text,
        source: 'local',
        notice: `AI 生成失败（${error.code || 'unknown'}），已使用本地题库`
      }
    }
  }

  if (state.pool.length === 0) {
    return { task: pickLocalItem(state).text, source: 'local', notice: 'AI 未返回可用任务，已使用本地题库' }
  }

  const task = state.pool[state.poolIndex]
  state.poolIndex = (state.poolIndex + 1) % state.pool.length

  const remaining = state.pool.length - state.poolIndex
  if (remaining <= REFILL_THRESHOLD && !state.refilling) {
    state.refilling = true
    fillPool(state, REFILL_SIZE)
      .catch((error) => {
        state.blockedUntil = Date.now() + FILL_BACKOFF_MS
        console.error(`[飞行棋] 任务池扩充失败 (${error.code}): ${error.message}`)
      })
      .finally(() => {
        state.refilling = false
      })
  }

  return { task, source: 'ai' }
}

function requireSession(req, res) {
  const id = readSessionId(req)
  if (!id) {
    res.status(400).json({ success: false, message: '缺少会话标识（X-Session-Id）' })
    return null
  }
  return sessions.ensure(id)
}

router.post('/set-content-level', (req, res) => {
  const state = requireSession(req, res)
  if (!state) return

  const { level, useAI } = req.body || {}
  if (!CONTENT_LEVELS.includes(level)) {
    res.status(400).json({ success: false, message: `无效的内容尺度，可选: ${CONTENT_LEVELS.join(' / ')}` })
    return
  }

  const levelChanged = state.level !== level
  state.level = level
  state.useAI = useAI === true
  if (levelChanged) {
    // 任务池与不重复记录都是按尺度积累的，切档必须一并作废
    state.pool = []
    state.poolIndex = 0
    state.blockedUntil = 0
    state.usedIds = []
  }

  const reason = aiBlockReason(state)
  res.json({
    success: true,
    level: state.level,
    useAI: state.useAI,
    aiEligible: AI_LEVELS.has(state.level),
    aiAvailable: !reason,
    aiNotice: reason,
    aiConfigured: isConfigured()
  })
})

router.get('/content-level', (req, res) => {
  const state = requireSession(req, res)
  if (!state) return

  const reason = aiBlockReason(state)
  res.json({
    level: state.level,
    useAI: state.useAI,
    aiEligible: AI_LEVELS.has(state.level),
    aiAvailable: !reason,
    aiNotice: reason,
    aiConfigured: isConfigured(),
    poolSize: state.pool.length
  })
})

router.post('/generate-task', async (req, res) => {
  const state = requireSession(req, res)
  if (!state) return

  const { cellNumber, player } = req.body || {}

  try {
    const { task, source, notice } = await takeTask(state)
    res.json({
      title: levelTitles[state.level],
      task,
      cellNumber,
      player,
      contentLevel: state.level,
      source,
      notice
    })
  } catch (error) {
    console.error('[飞行棋] 生成任务失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/dice', (req, res) => {
  res.json({ result: Math.floor(Math.random() * 6) + 1 })
})

export default router
