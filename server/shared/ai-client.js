/**
 * 统一 AI 客户端（平台级共享模块）
 *
 * 设计要点：
 * - Key 只存在于服务端，任何游戏都通过这里调用，前端拿不到 Key
 * - OpenAI 兼容协议，换供应商只改 AI_BASE_URL / AI_MODEL
 * - 所有请求强制超时，避免挂住前端
 * - 失败时返回结构化原因，调用方必须如实告知用户，不得把本地数据伪装成 AI 结果
 */

const API_KEY = process.env.AI_API_KEY || process.env.DASHSCOPE_API_KEY || ''
const BASE_URL = (process.env.AI_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '')
const MODEL = process.env.AI_MODEL || 'qwen-plus'
const DEFAULT_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20000

/** 供应商侧内容审核拒绝的错误码，用于把「模型不肯写」和「配置错了」区分开 */
const MODERATION_CODES = new Set([
  'DataInspectionFailed',
  'data_inspection_failed',
  'ContentFilter',
  'content_filter',
  'InvalidParameter.DataInspection'
])

export class AIError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'AIError'
    this.code = code
  }
}

export function isConfigured() {
  return Boolean(API_KEY)
}

/** 供诊断面板展示，绝不返回 Key 本身 */
export function describeConfig() {
  return {
    configured: isConfigured(),
    model: MODEL,
    baseUrl: BASE_URL,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    keySource: process.env.AI_API_KEY ? 'AI_API_KEY' : process.env.DASHSCOPE_API_KEY ? 'DASHSCOPE_API_KEY' : null
  }
}

async function chat(messages, { temperature = 0.8, maxTokens = 300, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isConfigured()) {
    throw new AIError('not_configured', '未配置 AI_API_KEY 环境变量')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: controller.signal
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AIError('timeout', `AI 请求超过 ${timeoutMs}ms 未响应`)
    }
    throw new AIError('network', `无法连接 AI 服务: ${error.message}`)
  } finally {
    clearTimeout(timer)
  }

  const raw = await response.text()

  if (!response.ok) {
    let code = 'http_error'
    let detail = raw.slice(0, 300)
    try {
      const parsed = JSON.parse(raw)
      const providerCode = parsed?.error?.code || parsed?.code
      if (providerCode) {
        detail = parsed?.error?.message || parsed?.message || detail
        code = MODERATION_CODES.has(providerCode) ? 'moderation' : 'provider_error'
      }
    } catch {
      // 非 JSON 错误体，保留原文
    }
    throw new AIError(code, `AI 服务返回 ${response.status}: ${detail}`)
  }

  let content
  try {
    content = JSON.parse(raw)?.choices?.[0]?.message?.content?.trim()
  } catch {
    throw new AIError('bad_response', 'AI 返回内容不是合法 JSON')
  }

  if (!content) {
    throw new AIError('empty', 'AI 返回内容为空')
  }

  return content
}

/**
 * 生成飞行棋任务列表。
 * 只对温馨档开放 —— 亲密档的请求会被主流供应商的内容审核拦截，
 * 与其让用户看到莫名失败，不如在设计上就不走 AI。
 */
export async function generateTasks(count, samples, styleGuide) {
  const sampleText = samples.slice(0, 15).join('\n')

  const text = await chat([
    {
      role: 'system',
      content: '你是一个情侣游戏任务生成器，生成简短、温馨、可直接执行的互动任务。'
    },
    {
      role: 'user',
      content: `请严格参考以下样例风格，生成 ${count} 个情侣温馨互动任务。

【样例任务】
${sampleText}

【生成要求】
${styleGuide}

【输出格式】
直接输出 ${count} 个任务，每行一个，不要编号，不要任何其他文字。`
    }
  ], { temperature: 0.7, maxTokens: 400 })

  const tasks = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^[\d.\-*、]+/.test(line))
    .slice(0, count)

  if (tasks.length === 0) {
    throw new AIError('parse_failed', 'AI 生成的任务解析后为空')
  }

  return tasks
}

export { chat }
