/**
 * 情侣互动类游戏（默契解锁 / 升温阶梯 / 身体地图）共享后端
 *
 * 内容全部来自 server/shared/content-library.js，
 * 长期资产全部走 server/shared/store.js（两人共享，不按访客隔离）。
 */
import { Router } from 'express'
import { DIMENSIONS, ITEM_COUNT, TIERS, getById, pickRandom, query, stats } from '../shared/content-library.js'
import { PLAYERS, readStore, updateStore } from '../shared/store.js'
import { isValidSessionId } from '../shared/session-store.js'

const router = Router()

/**
 * Express 4 不会把 async handler 的 rejection 交给错误中间件，
 * 一个未捕获的 rejection 会直接掀掉整个进程（实测：一条畸形 /power/log
 * 请求就让服务崩溃退出）。所有 async 路由都必须经这层注册。
 */
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const get = (path, handler) => router.get(path, wrap(handler))
const post = (path, handler) => router.post(path, wrap(handler))
const put = (path, handler) => router.put(path, wrap(handler))
const del = (path, handler) => router.delete(path, wrap(handler))

const VERDICTS = ['comfortable', 'want', 'no']
const MARKS = ['like', 'ok', 'no']
const MAX_CARDS = 12
const MAX_OPTIONS = 6
const ITEMS_PER_LEVEL = 3
const MAX_ZONES = 200

/**
 * 写操作必须带 X-Session-Id 头。
 *
 * 本服务不发任何 CORS 头，跨源请求一旦携带自定义头就会触发预检并失败，
 * 所以这道检查挡住的是「不需要 JSON body 的简单请求」—— 例如
 * `POST /ladder/reset` 用 `Content-Type: text/plain` 就能跨源盲发并清空阶梯进度
 * （实测确认）。前端 `src/shared/api.js` 的 api() 给每个请求都带了这个头，功能无感。
 *
 * 只认请求头，不认 `?sid=`：查询串仍属于简单请求，认了就等于没设防。
 */
router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  if (!isValidSessionId(req.get('X-Session-Id'))) {
    res.status(403).json({ message: '缺少会话标识（X-Session-Id）' })
    return
  }
  next()
})

// ============ 内容库 ============

router.get('/content/meta', (req, res) => {
  res.json({ dimensions: DIMENSIONS, tiers: TIERS, stats: stats() })
})

/**
 * 默契解锁用的选项卡。
 * 同一张卡内的选项按**强度带**抽取，保证几个选项「尺度相当」，
 * 选择才有意义；卡内尽量跨维度，避免四张卡全是触碰类。
 */
router.post('/content/cards', (req, res) => {
  const {
    tier = 'couple',
    cards = 5,
    optionsPerCard = 4,
    maxIntensity = 5,
    excludeIds = [],
    requireNoProps = false
  } = req.body || {}

  if (!TIERS[tier]) {
    res.status(400).json({ message: `无效档位，可选: ${Object.keys(TIERS).join(' / ')}` })
    return
  }

  const cardCount = Math.min(Math.max(Number(cards) || 5, 1), MAX_CARDS)
  const optionCount = Math.min(Math.max(Number(optionsPerCard) || 4, 2), MAX_OPTIONS)

  const pool = query({
    tier,
    maxIntensity: Number(maxIntensity) || 5,
    excludeIds,
    requireNoProps: requireNoProps === true
  })
  if (pool.length < optionCount) {
    res.status(400).json({
      message: `符合条件的内容只有 ${pool.length} 条，不足以组成 ${optionCount} 选项的卡片`
    })
    return
  }

  // 按强度分桶
  const buckets = new Map()
  for (const item of pool) {
    if (!buckets.has(item.intensity)) buckets.set(item.intensity, [])
    buckets.get(item.intensity).push(item)
  }
  const usableBuckets = [...buckets.values()].filter((b) => b.length >= optionCount)
  if (usableBuckets.length === 0) {
    res.status(400).json({ message: '没有任何强度档位能凑满一张卡，请放宽筛选条件' })
    return
  }

  const generated = []
  for (let i = 0; i < cardCount; i++) {
    const bucket = usableBuckets[i % usableBuckets.length]
    const options = pickSpread(bucket, optionCount)
    if (options.length < optionCount) continue
    generated.push({
      cardId: `card-${i + 1}`,
      intensity: options[0].intensity,
      options: options.map((item) => ({
        itemId: item.id,
        text: item.text,
        dimension: item.dimension,
        dimensionLabel: DIMENSIONS[item.dimension].label,
        props: item.props
      }))
    })
  }

  res.json({ tier, cards: generated, poolSize: pool.length })
})

/** 尽量让选项落在不同维度上，同维度用尽后再回补 */
function pickSpread(items, count) {
  const byDimension = new Map()
  for (const item of items) {
    if (!byDimension.has(item.dimension)) byDimension.set(item.dimension, [])
    byDimension.get(item.dimension).push(item)
  }

  const picked = []
  const groups = [...byDimension.values()].map((g) => pickRandom(g, g.length))
  while (picked.length < count && groups.some((g) => g.length > 0)) {
    for (const group of groups) {
      if (picked.length >= count) break
      const item = group.shift()
      if (item) picked.push(item)
    }
  }
  return picked
}

// ============ 愿望清单 ============

get('/wishlist', async (req, res) => {
  const data = await readStore()
  res.json({
    items: data.wishlist.map((entry) => ({ ...entry, item: getById(entry.itemId) })),
    updatedAt: data.updatedAt
  })
})

post('/wishlist', async (req, res) => {
  const { itemId, source = 'manual' } = req.body || {}
  const item = getById(itemId)
  if (!item) {
    res.status(400).json({ message: '条目不存在' })
    return
  }

  const data = await updateStore((draft) => {
    if (draft.wishlist.some((entry) => entry.itemId === itemId)) return
    draft.wishlist.push({ itemId, source, addedAt: new Date().toISOString() })
  })

  res.json({ ok: true, count: data.wishlist.length, item })
})

del('/wishlist/:itemId', async (req, res) => {
  const data = await updateStore((draft) => {
    draft.wishlist = draft.wishlist.filter((entry) => entry.itemId !== req.params.itemId)
  })
  res.json({ ok: true, count: data.wishlist.length })
})

// ============ 升温阶梯 ============

/**
 * 七级阶梯。级别按「档位 + 强度带」定义，条目从内容库按带抽取。
 * 抽中的条目会持久化，保证下次进来看到的是同一批 —— 否则进度没有意义。
 */
const LADDER_LEVELS = [
  { level: 1, label: '日常亲密', tier: 'basic', minIntensity: 1, maxIntensity: 1, hint: '无性意味的日常接触' },
  { level: 2, label: '浪漫表达', tier: 'basic', minIntensity: 2, maxIntensity: 2, hint: '明确的浪漫与亲密' },
  { level: 3, label: '初步越界', tier: 'couple', minIntensity: 2, maxIntensity: 2, hint: '进入亲密档的门槛' },
  { level: 4, label: '情欲升温', tier: 'couple', minIntensity: 3, maxIntensity: 3, hint: '情欲意味明显但非直接' },
  { level: 5, label: '感官与主导', tier: 'couple', minIntensity: 3, maxIntensity: 4, hint: '感官探索与权力交换' },
  { level: 6, label: '直接亲密', tier: 'couple', minIntensity: 4, maxIntensity: 4, hint: '直接的性相关行为' },
  { level: 7, label: '完全信任', tier: 'couple', minIntensity: 5, maxIntensity: 5, hint: '最高强度，需要充分信任' }
]

function drawLevelItems(levelDef) {
  const pool = query({ tier: levelDef.tier, minIntensity: levelDef.minIntensity, maxIntensity: levelDef.maxIntensity })
  return pickRandom(pool, Math.min(ITEMS_PER_LEVEL, pool.length)).map((item) => item.id)
}

function levelState(ladder, levelDef) {
  const answers = ladder.answers[String(levelDef.level)] || {}
  const itemIds = ladder.levelItems[String(levelDef.level)] || []

  const items = itemIds.map((id) => {
    const item = getById(id)
    if (!item) return null
    const perPlayer = answers[id] || {}
    const bothAnswered = PLAYERS.every((p) => VERDICTS.includes(perPlayer[p]))
    const rejected = PLAYERS.some((p) => perPlayer[p] === 'no')
    const agreed = bothAnswered && !rejected
    return {
      itemId: id,
      text: item.text,
      dimension: item.dimension,
      dimensionLabel: DIMENSIONS[item.dimension].label,
      intensity: item.intensity,
      props: item.props,
      // 双方都答完之前不返回任何一方的答案：
      // 否则后作答的人能在网络响应里看到对方选了什么，「独立作答」就失去意义
      answers: bothAnswered ? { a: perPlayer.a, b: perPlayer.b } : { a: null, b: null },
      bothAnswered,
      agreed
    }
  }).filter(Boolean)

  const allAnswered = items.length > 0 && items.every((i) => i.bothAnswered)
  const agreedCount = items.filter((i) => i.agreed).length

  return {
    level: levelDef.level,
    label: levelDef.label,
    hint: levelDef.hint,
    tier: levelDef.tier,
    items,
    allAnswered,
    agreedCount,
    // 整级零共识 = 触到天花板
    locked: allAnswered && agreedCount === 0,
    passed: allAnswered && agreedCount > 0
  }
}

function buildLadderView(ladder) {
  const levels = LADDER_LEVELS.map((def) => levelState(ladder, def))
  const passed = levels.filter((l) => l.passed).map((l) => l.level)
  const lockedAt = levels.find((l) => l.locked)?.level || null

  return {
    levels,
    currentLevel: ladder.currentLevel,
    ceiling: lockedAt,
    highestPassed: passed.length > 0 ? Math.max(...passed) : 0,
    // 直接返回解析后的条目，前端不必再持有一份内容库
    agreedItems: ladder.agreedItems.map(getById).filter(Boolean).map((item) => ({
      itemId: item.id,
      text: item.text,
      dimensionLabel: DIMENSIONS[item.dimension].label,
      intensity: item.intensity,
      props: item.props
    })),
    updatedAt: ladder.updatedAt
  }
}

get('/ladder', async (req, res) => {
  const data = await updateStore((draft) => {
    if (!draft.ladder) {
      draft.ladder = {
        currentLevel: 1,
        levelItems: {},
        answers: {},
        agreedItems: [],
        updatedAt: null
      }
    }
    // 只给「当前级及之前」发条目，未解锁的级别不预先生成
    for (const def of LADDER_LEVELS) {
      if (def.level > draft.ladder.currentLevel) continue
      const key = String(def.level)
      if (!draft.ladder.levelItems[key] || draft.ladder.levelItems[key].length === 0) {
        draft.ladder.levelItems[key] = drawLevelItems(def)
      }
    }
  })

  res.json(buildLadderView(data.ladder))
})

post('/ladder/answer', async (req, res) => {
  const { level, itemId, player, verdict } = req.body || {}

  const levelNum = Number(level)
  if (!LADDER_LEVELS.some((d) => d.level === levelNum)) {
    res.status(400).json({ message: '无效的层级' })
    return
  }
  if (!PLAYERS.includes(player)) {
    res.status(400).json({ message: `player 只能是 ${PLAYERS.join(' 或 ')}` })
    return
  }
  if (!VERDICTS.includes(verdict)) {
    res.status(400).json({ message: `verdict 只能是 ${VERDICTS.join(' / ')}` })
    return
  }
  if (!getById(itemId)) {
    res.status(400).json({ message: '条目不存在' })
    return
  }

  const data = await updateStore((draft) => {
    const ladder = draft.ladder
    const key = String(levelNum)
    if (!ladder.levelItems[key]?.includes(itemId)) {
      throw Object.assign(new Error('该条目不属于这一级'), { status: 400 })
    }

    ladder.answers[key] = ladder.answers[key] || {}
    ladder.answers[key][itemId] = ladder.answers[key][itemId] || {}
    ladder.answers[key][itemId][player] = verdict

    // 本级双方都答完且存在共识 → 解锁下一级
    const state = levelState(ladder, LADDER_LEVELS[levelNum - 1])
    if (state.allAnswered && state.agreedCount > 0 && ladder.currentLevel === levelNum) {
      ladder.currentLevel = Math.min(levelNum + 1, LADDER_LEVELS.length)
      const nextKey = String(ladder.currentLevel)
      if (!ladder.levelItems[nextKey] || ladder.levelItems[nextKey].length === 0) {
        ladder.levelItems[nextKey] = drawLevelItems(LADDER_LEVELS[levelNum])
      }
      for (const item of state.items) {
        if (item.agreed && !ladder.agreedItems.includes(item.itemId)) {
          ladder.agreedItems.push(item.itemId)
        }
      }
    }
    ladder.updatedAt = new Date().toISOString()
  }).catch((error) => {
    if (error.status === 400) return { error: error.message }
    throw error
  })

  if (data?.error) {
    res.status(400).json({ message: data.error })
    return
  }

  res.json(buildLadderView(data.ladder))
})

post('/ladder/reshuffle', async (req, res) => {
  const levelNum = Number(req.body?.level)
  const def = LADDER_LEVELS.find((d) => d.level === levelNum)
  if (!def) {
    res.status(400).json({ message: '无效的层级' })
    return
  }

  const data = await updateStore((draft) => {
    const key = String(levelNum)
    draft.ladder.levelItems[key] = drawLevelItems(def)
    // 换了一批条目，旧答案作废
    delete draft.ladder.answers[key]
    draft.ladder.updatedAt = new Date().toISOString()
  })

  res.json(buildLadderView(data.ladder))
})

post('/ladder/reset', async (req, res) => {
  const data = await updateStore((draft) => {
    draft.ladder = null
  })
  res.json({ ok: true, ladder: data.ladder })
})

// ============ 身体地图 ============

get('/body-map', async (req, res) => {
  const data = await readStore()
  res.json({ marks: data.bodyMap, updatedAt: data.updatedAt })
})

put('/body-map', async (req, res) => {
  const { player, marks } = req.body || {}

  if (!PLAYERS.includes(player)) {
    res.status(400).json({ message: `player 只能是 ${PLAYERS.join(' 或 ')}` })
    return
  }
  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) {
    res.status(400).json({ message: 'marks 必须是 { 区域ID: like|ok|no } 对象' })
    return
  }

  const entries = Object.entries(marks)
  if (entries.length > MAX_ZONES) {
    res.status(400).json({ message: `一次最多提交 ${MAX_ZONES} 个区域` })
    return
  }
  const invalid = entries.find(([, v]) => !MARKS.includes(v))
  if (invalid) {
    res.status(400).json({ message: `标注值只能是 ${MARKS.join(' / ')}，收到 ${JSON.stringify(invalid[1])}` })
    return
  }

  const data = await updateStore((draft) => {
    // 整份替换该玩家的标注：前端是「编辑完整张图后保存」，不做增量合并
    draft.bodyMap[player] = Object.fromEntries(
      entries.map(([zoneId, value]) => [String(zoneId).slice(0, 64), value])
    )
  })

  res.json({ ok: true, marks: data.bodyMap, updatedAt: data.updatedAt })
})

// ============ 限时主导权 ============

const ROUND_MINUTES = [5, 10, 15]
/** 指令池的目标条数：共识不足时从内容库补足到这里；共识更多时全部保留，所以实际池可以更大 */
const INSTRUCTION_POOL_SIZE = 8
/**
 * 单轮能记进 log 的指令上限。必须 ≥ 实际池，否则真实抽过的条目会被静默截断 ——
 * 界面上显示用了 12 条、库里只存 8 条。按内容库总量给，天然不可能被超过。
 */
const MAX_INSTRUCTIONS_PER_ROUND = ITEM_COUNT
/** 没有任何阶梯数据时的保守上限：只到「明确浪漫/亲密」，不含情欲意味 */
const FALLBACK_CAP = 2
const MAX_LOG_ENTRIES = 20

/** 阶梯里双方都通过的最高一级；0 表示一级都没过 */
function highestPassedLevel(ladder) {
  if (!ladder) return 0
  let highest = 0
  for (const def of LADDER_LEVELS) {
    if (levelState(ladder, def).passed) highest = def.level
  }
  return highest
}

/**
 * 推导一轮主导权的边界与指令池。
 *
 * 三条数据的来源优先级都写明在 `source` 字段里，前端必须如实展示 ——
 * 尤其当阶梯/身体地图还没数据时，要明确告诉用户「这是保守默认，不是你们的共识」。
 *
 * 已知限制：指令池不会按接收方的禁区自动过滤条目文本（例如禁区是「胸」，
 * 无法可靠判断哪条指令涉及胸），所以简报页把禁区清单和指令池并排显示，
 * 由两人在开局前自行对齐。这比做一个不可靠的关键词匹配更诚实。
 */
function buildPowerPlan(data, { leader, durationMin, maxIntensity }) {
  const receiver = leader === 'a' ? 'b' : 'a'
  const warnings = []

  // ---- 禁区：接收方在身体地图里标为「禁区」的分区 ----
  const receiverMarks = data.bodyMap?.[receiver] || {}
  const leaderMarks = data.bodyMap?.[leader] || {}
  const limitZones = Object.entries(receiverMarks)
    .filter(([, value]) => value === 'no')
    .map(([zoneId]) => zoneId)

  if (Object.keys(receiverMarks).length === 0) {
    warnings.push({
      level: 'warn',
      text: '接收方还没标注身体地图，本轮没有自动禁区。开局前请口头确认哪些部位不碰。'
    })
  } else if (limitZones.length === 0) {
    warnings.push({ level: 'ok', text: '接收方已标注身体地图，且没有标任何禁区。' })
  }

  // ---- 强度上限：显式指定 > 阶梯推导 > 保守默认 ----
  const highest = highestPassedLevel(data.ladder)
  let cap
  let capSource
  if (Number.isInteger(maxIntensity) && maxIntensity >= 1 && maxIntensity <= 5) {
    cap = maxIntensity
    capSource = 'manual'
  } else if (highest > 0) {
    cap = LADDER_LEVELS[highest - 1].maxIntensity
    capSource = 'ladder'
  } else {
    cap = FALLBACK_CAP
    capSource = 'fallback'
    warnings.push({
      level: 'warn',
      text: `还没跑过升温阶梯，指令池按保守默认筛选（强度 ≤ ${FALLBACK_CAP}，即「明确浪漫/亲密」为止）。想放宽请在设置里手动调上限。`
    })
  }

  // ---- 指令池：优先阶梯共识清单，不足再从内容库补 ----
  const agreed = (data.ladder?.agreedItems || [])
    .map(getById)
    .filter((item) => item && item.intensity <= cap)

  const poolIds = agreed.map((item) => item.id)
  const fillCount = Math.max(INSTRUCTION_POOL_SIZE - agreed.length, 0)
  const filled = fillCount > 0
    ? pickRandom(query({ maxIntensity: cap, excludeIds: poolIds }), fillCount)
    : []

  const pool = [...agreed, ...filled].map((item) => ({
    itemId: item.id,
    text: item.text,
    dimension: item.dimension,
    dimensionLabel: DIMENSIONS[item.dimension].label,
    intensity: item.intensity,
    props: item.props,
    fromAgreed: poolIds.includes(item.id)
  }))

  if (agreed.length === 0) {
    warnings.push({
      level: 'info',
      text: '阶梯里还没有双方共识条目，本轮指令池全部来自内容库筛选。'
    })
  } else if (filled.length > 0) {
    warnings.push({
      level: 'info',
      text: `指令池里 ${agreed.length} 条来自你们的阶梯共识，${filled.length} 条由内容库补足。`
    })
  }

  if (pool.length === 0) {
    warnings.push({ level: 'danger', text: '当前强度上限下没有任何可用指令，请调高上限后再开局。' })
  }

  return {
    leader,
    receiver,
    durationSec: durationMin * 60,
    cap,
    capSource,
    highestPassed: highest,
    limits: {
      zoneIds: limitZones,
      source: Object.keys(receiverMarks).length > 0 ? 'body-map' : 'none'
    },
    leaderMarkedCount: Object.keys(leaderMarks).length,
    pool,
    warnings
  }
}

post('/power/plan', async (req, res) => {
  const { leader, durationMin, maxIntensity } = req.body || {}

  if (!PLAYERS.includes(leader)) {
    res.status(400).json({ message: `leader 只能是 ${PLAYERS.join(' 或 ')}` })
    return
  }
  if (!ROUND_MINUTES.includes(Number(durationMin))) {
    res.status(400).json({ message: `时长只能是 ${ROUND_MINUTES.join(' / ')} 分钟` })
    return
  }
  if (maxIntensity !== undefined && !(Number.isInteger(maxIntensity) && maxIntensity >= 1 && maxIntensity <= 5)) {
    res.status(400).json({ message: 'maxIntensity 必须是 1-5 的整数' })
    return
  }

  const data = await readStore()
  res.json(buildPowerPlan(data, { leader, durationMin: Number(durationMin), maxIntensity }))
})

router.get('/power/options', (req, res) => {
  res.json({
    roundMinutes: ROUND_MINUTES,
    fallbackCap: FALLBACK_CAP,
    ladderCaps: LADDER_LEVELS.map((def) => ({ level: def.level, label: def.label, maxIntensity: def.maxIntensity }))
  })
})

post('/power/log', async (req, res) => {
  const {
    leader, durationSec, plannedSec, stoppedEarly = false,
    instructionsUsed = [], cap, capSource
  } = req.body || {}

  if (!PLAYERS.includes(leader)) {
    res.status(400).json({ message: `leader 只能是 ${PLAYERS.join(' 或 ')}` })
    return
  }
  if (!Number.isFinite(plannedSec) || plannedSec <= 0) {
    res.status(400).json({ message: 'plannedSec 必须是正数' })
    return
  }
  if (!Array.isArray(instructionsUsed) || instructionsUsed.some((id) => typeof id !== 'string')) {
    res.status(400).json({ message: 'instructionsUsed 必须是字符串数组' })
    return
  }

  const entry = {
    at: new Date().toISOString(),
    leader,
    plannedSec: Math.round(plannedSec),
    // 实际用时由服务端夹到 [0, 计划时长]，避免客户端时钟漂移写出离谱数字
    durationSec: Math.min(Math.max(Math.round(Number(durationSec) || 0), 0), Math.round(plannedSec)),
    stoppedEarly: stoppedEarly === true,
    instructionsUsed: instructionsUsed.slice(0, MAX_INSTRUCTIONS_PER_ROUND).filter(getById),
    cap: Number.isInteger(cap) ? cap : null,
    capSource: ['manual', 'ladder', 'fallback'].includes(capSource) ? capSource : null
  }

  const data = await updateStore((draft) => {
    draft.powerLog = [entry, ...(draft.powerLog || [])].slice(0, MAX_LOG_ENTRIES)
  })

  res.json({ ok: true, count: data.powerLog.length, entry })
})

get('/power/log', async (req, res) => {
  const data = await readStore()
  res.json({
    rounds: (data.powerLog || []).map((entry) => ({
      ...entry,
      instructions: entry.instructionsUsed.map(getById).filter(Boolean).map((i) => ({ itemId: i.id, text: i.text }))
    }))
  })
})

export default router
