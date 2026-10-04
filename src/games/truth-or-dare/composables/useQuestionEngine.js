import { ref } from 'vue'
import { questions } from '../data/questions.js'
import { generateQuestion } from '../services/ai.js'
import { useAIMonitor } from './useAIMonitor.js'

const DIFFICULTIES = ['easy', 'medium', 'hard']
const MAX_AI_HISTORY = 30

const emptyByDifficulty = () => Object.fromEntries(DIFFICULTIES.map((d) => [d, null]))

/**
 * 真心话大冒险出题引擎
 *
 * 联机房间与本地同屏对局共用这一份实现，避免两边各写一遍后行为漂移。
 * 职责：难度/AI 开关状态、AI 出题、本地题库不重复抽取、来源如实标注、调用统计。
 */
export function useQuestionEngine() {
  const difficulty = ref('medium')
  const useAI = ref(false)
  const isGenerating = ref(false)
  const progressText = ref('')
  /** 'ai' | 'local' | null —— 永远反映真实来源，降级时不伪装成 AI */
  const source = ref(null)
  const notice = ref('')

  const { aiStats, successRate, averageTime, startGeneration, recordSuccess, recordFailure, resetStats } = useAIMonitor()

  // 这两个不需要响应式，纯内部记账
  const usedIndexes = { truth: emptyByDifficulty(), dare: emptyByDifficulty() }
  const aiHistory = { truth: emptyByDifficulty(), dare: emptyByDifficulty() }
  for (const type of ['truth', 'dare']) {
    for (const level of DIFFICULTIES) {
      usedIndexes[type][level] = new Set()
      aiHistory[type][level] = []
    }
  }

  const pickLocal = (type) => {
    const list = questions[type][difficulty.value]
    const used = usedIndexes[type][difficulty.value]

    if (used.size >= list.length) used.clear()

    let available = list.filter((q, index) => !used.has(index))
    if (available.length === 0) available = list

    const text = available[Math.floor(Math.random() * available.length)]
    used.add(list.indexOf(text))
    return text
  }

  /**
   * 出下一道题。
   * @returns {Promise<{type:string,text:string,difficulty:string,source:string,notice:string}|null>}
   *          正在生成时返回 null，调用方不必额外判重
   */
  const next = async (type) => {
    if (isGenerating.value) return null

    isGenerating.value = true
    progressText.value = ''
    notice.value = ''
    source.value = null

    let text = null

    if (useAI.value) {
      startGeneration()
      progressText.value = 'AI 正在生成…'

      const history = aiHistory[type][difficulty.value]
      const result = await generateQuestion(type, difficulty.value, history)

      if (result.ok && result.text) {
        text = result.text
        source.value = 'ai'
        recordSuccess(result.durationMs || 0)

        history.push(text)
        if (history.length > MAX_AI_HISTORY) history.shift()
      } else {
        recordFailure(result.message || result.code)
        notice.value = `AI 未能出题（${result.code || 'unknown'}）：${result.message || '未知原因'}，已改用本地题库`
      }
    }

    if (!text) {
      text = pickLocal(type)
      source.value = 'local'
    }

    isGenerating.value = false
    progressText.value = ''

    return {
      type,
      text,
      difficulty: difficulty.value,
      source: source.value,
      notice: notice.value
    }
  }

  /** 换难度后本地抽取记录作废，否则新档位的题会被旧记录误判为已用 */
  const setDifficulty = (value) => {
    if (!DIFFICULTIES.includes(value) || value === difficulty.value) return
    difficulty.value = value
    for (const type of ['truth', 'dare']) {
      for (const level of DIFFICULTIES) usedIndexes[type][level].clear()
    }
  }

  const clearHistory = () => {
    for (const type of ['truth', 'dare']) {
      for (const level of DIFFICULTIES) {
        usedIndexes[type][level].clear()
        aiHistory[type][level] = []
      }
    }
    resetStats()
  }

  return {
    difficulty,
    useAI,
    isGenerating,
    progressText,
    source,
    notice,
    aiStats,
    successRate,
    averageTime,
    next,
    setDifficulty,
    clearHistory
  }
}
