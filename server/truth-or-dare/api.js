/**
 * 真心话大冒险 - 题目生成 API
 *
 * AI Key 只存在于服务端：前端不再持有任何密钥，也不再直连模型供应商。
 * 本地题库降级仍在前端完成（断网也能玩），这里只负责「AI 能不能给出题目」。
 */
import { Router } from 'express'
import { chat, isConfigured, describeConfig } from '../shared/ai-client.js'

const router = Router()

const TYPES = ['truth', 'dare']
const DIFFICULTIES = ['easy', 'medium', 'hard']
/** 相似度超过该阈值判定为重复，拒绝使用 AI 结果 */
const SIMILARITY_THRESHOLD = 0.5
const MAX_HISTORY = 30

const aiPrompts = {
  truth: {
    easy: `生成一个适合情侣玩的【简单】真心话问题。

难度要求：
- 轻松愉快，不涉及隐私或敏感话题
- 关于日常生活、喜好、习惯等表面话题
- 回答时不会感到尴尬或压力
- 适合刚开始交往或关系轻松的情侣

示例风格：
- 你最喜欢我的哪个笑容？
- 你觉得我穿什么颜色最好看？
- 你最喜欢我们一起做什么事？

请生成一个类似难度的问题`,

    medium: `生成一个适合情侣玩的【中等难度】真心话问题。

难度要求：
- 涉及感情深度，但不触及底线
- 关于感情期待、相处模式、未来规划
- 需要认真思考，但不会引起争吵
- 适合稳定交往的情侣

示例风格：
- 你对我们的未来有什么期待？
- 你觉得我们的相处模式需要调整吗？
- 你最想对我说但一直没说的话是什么？

请生成一个类似难度的问题`,

    hard: `生成一个适合情侣玩的【困难】真心话问题。

难度要求：
- 涉及敏感话题，可能触及隐私
- 关于秘密、过往、缺点、矛盾
- 回答需要勇气，可能引起深度讨论
- 适合感情稳定、互相信任的情侣

示例风格：
- 你有什么秘密一直没告诉我？
- 你觉得我最大的缺点是什么？
- 你有没有想过分手？什么时候？

请生成一个类似难度的问题`
  },
  dare: {
    easy: `生成一个适合情侣玩的【简单】大冒险任务。

难度要求：
- 轻松有趣，容易完成
- 不需要太多勇气或技能
- 适合活跃气氛，增加互动
- 1-2分钟内可以完成

示例风格：
- 给对方一个拥抱，持续30秒
- 说三句情话
- 模仿对方最可爱的表情

请生成一个类似难度的任务`,

    medium: `生成一个适合情侣玩的【中等难度】大冒险任务。

难度要求：
- 需要一定创意或表现力
- 稍微需要一点勇气
- 浪漫温馨，增进感情
- 3-5分钟内可以完成

示例风格：
- 给对方按摩5分钟
- 写一首小诗给对方
- 计划一次约会并说出详细安排

请生成一个类似难度的任务`,

    hard: `生成一个适合情侣玩的【高难度】大冒险任务。

难度要求：
- 需要较大勇气或承诺
- 可能有点尴尬或挑战
- 深度互动，考验感情
- 可能需要较长时间完成

示例风格：
- 深情对视3分钟不能笑
- 写一封情书念给对方听
- 承诺为对方改掉一个坏习惯

请生成一个类似难度的任务`
  }
}

const DIVERSITY_HINTS = [
  '从一个意想不到的角度提问',
  '关注一个很少被讨论的话题',
  '用一种新颖的方式表达',
  '探索一个深层次的情感',
  '从对方的视角出发',
  '关注具体的细节或场景',
  '探讨未来或过去的某个时刻',
  '从第三方的角度观察你们的关系'
]

// 与原前端实现保持一致：多字词在按字过滤时本就不会命中，保留原表以免行为漂移
const STOP_WORDS = ['你', '我', '的', '了', '是', '在', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '吗', '会', '能', '什么', '怎么', '为什么', '哪', '这', '那']

function extractKeywords(text) {
  const chars = [...text].filter((c) => c.trim() && !STOP_WORDS.includes(c))
  const phrases = []
  for (let i = 0; i < text.length - 1; i++) {
    phrases.push(text.substring(i, i + 2))
    if (i < text.length - 2) phrases.push(text.substring(i, i + 3))
  }
  return [...new Set([...chars, ...phrases])]
}

function similarity(str1, str2) {
  if (str1 === str2) return 1

  const strip = (s) => s.replace(/[，。！？、；：""''（）【】《》]/g, '')
  if (strip(str1) === strip(str2)) return 0.95

  const k1 = extractKeywords(strip(str1))
  const k2 = extractKeywords(strip(str2))
  const common = k1.filter((k) => k2.includes(k)).length
  const keywordSimilarity = common / Math.max(k1.length, k2.length, 1)

  const s1 = new Set(str1)
  const s2 = new Set(str2)
  const intersection = [...s1].filter((c) => s2.has(c)).length
  const charSimilarity = intersection / new Set([...s1, ...s2]).size

  return keywordSimilarity * 0.7 + charSimilarity * 0.3
}

function findDuplicate(candidate, history) {
  for (const previous of history) {
    const score = similarity(previous, candidate)
    if (score > SIMILARITY_THRESHOLD) return { previous, score }
  }
  return null
}

router.get('/ai-status', (req, res) => {
  res.json(describeConfig())
})

router.post('/question', async (req, res) => {
  const { type, difficulty, history = [] } = req.body || {}
  const startedAt = Date.now()

  if (!TYPES.includes(type) || !DIFFICULTIES.includes(difficulty)) {
    res.status(400).json({ ok: false, code: 'bad_request', message: 'type 或 difficulty 取值非法' })
    return
  }

  if (!isConfigured()) {
    res.json({ ok: false, code: 'not_configured', message: '服务端未配置 AI_API_KEY', durationMs: 0 })
    return
  }

  const previous = Array.isArray(history) ? history.slice(-MAX_HISTORY).filter((q) => typeof q === 'string') : []

  let antiRepeat = ''
  if (previous.length > 0) {
    antiRepeat = `

【严格要求 - 必须遵守】
以下是最近生成过的问题，你生成的新问题必须满足：
1. 主题完全不同（不能问相似的事情）
2. 角度完全不同（不能换个说法问同样的内容）
3. 关键词不能重复（避免使用相同的核心词汇）
4. 情感方向不同（如果之前问的是正面的，可以问中性或反思的）

已使用的问题：
${previous.map((q, i) => `${i + 1}. ${q}`).join('\n')}

请生成一个与上述所有问题在主题、角度、关键词、情感方向上都完全不同的新问题。`
  }

  const hint = DIVERSITY_HINTS[Math.floor(Math.random() * DIVERSITY_HINTS.length)]

  try {
    const raw = await chat([
      {
        role: 'system',
        content: '你是一个专业的情侣游戏设计师，擅长根据不同难度生成合适的问题。你必须严格遵守用户指定的难度要求，确保生成的问题符合难度定位。每次生成的问题都必须独特、新颖、有创意。只返回问题本身，不要有任何解释或额外内容。'
      },
      {
        role: 'user',
        content: `${aiPrompts[type][difficulty]}${antiRepeat}

【创意提示】${hint}

现在请生成一个全新的、独特的、有创意的问题：`
      }
    ], { temperature: 1.0, maxTokens: 150 })

    const text = raw.replace(/^["'「『]|["'」』]$/g, '').trim()
    const durationMs = Date.now() - startedAt

    const duplicate = findDuplicate(text, previous)
    if (duplicate) {
      res.json({
        ok: false,
        code: 'duplicate',
        message: `与历史题目相似度 ${(duplicate.score * 100).toFixed(1)}%，已丢弃`,
        durationMs
      })
      return
    }

    res.json({ ok: true, text, durationMs })
  } catch (error) {
    res.json({
      ok: false,
      code: error.code || 'unknown',
      message: error.message,
      durationMs: Date.now() - startedAt
    })
  }
})

export default router
