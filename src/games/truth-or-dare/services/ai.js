/**
 * 真心话大冒险 - AI 题目生成客户端
 *
 * 密钥全部在服务端，这里只负责发请求和如实转达结果。
 * 失败时返回 { ok: false, code, message }，由调用方决定降级，
 * 不允许把本地题库的结果当成 AI 生成。
 */
import { apiJSON, postJSON } from '../../../shared/api.js'

export async function generateQuestion(type, difficulty, history = []) {
  try {
    return await postJSON('/api/truth-or-dare/question', { type, difficulty, history })
  } catch (error) {
    return { ok: false, code: 'network', message: error.message, durationMs: 0 }
  }
}

/** AI 配置概况（不含密钥），供房间页与诊断面板展示 */
export async function fetchAIStatus() {
  try {
    return await apiJSON('/api/truth-or-dare/ai-status')
  } catch {
    return { configured: false, unreachable: true }
  }
}

/** 真实打一次模型，用于区分「Key 配错」与「网络/审核不通」 */
export async function probeAI() {
  try {
    return await postJSON('/api/diagnostics/ai-probe', {})
  } catch (error) {
    return { ok: false, code: 'network', message: error.message }
  }
}
