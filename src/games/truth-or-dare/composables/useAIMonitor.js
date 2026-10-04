import { ref, computed } from 'vue'

const initialState = () => ({
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  totalTime: 0,
  lastCallTime: null,
  lastError: null,
  isGenerating: false
})

export function useAIMonitor() {
  // 状态放在工厂内部：换房间/重进页面时重新计数，不会跨实例串数据
  const aiStats = ref(initialState())
  const successRate = computed(() => {
    if (aiStats.value.totalCalls === 0) return 0
    return ((aiStats.value.successCalls / aiStats.value.totalCalls) * 100).toFixed(1)
  })

  const averageTime = computed(() => {
    if (aiStats.value.successCalls === 0) return 0
    return (aiStats.value.totalTime / aiStats.value.successCalls / 1000).toFixed(2)
  })

  const startGeneration = () => {
    aiStats.value.isGenerating = true
    aiStats.value.lastCallTime = Date.now()
  }

  const recordSuccess = (duration) => {
    aiStats.value.totalCalls++
    aiStats.value.successCalls++
    aiStats.value.totalTime += duration
    aiStats.value.isGenerating = false
    aiStats.value.lastError = null
  }

  const recordFailure = (error) => {
    aiStats.value.totalCalls++
    aiStats.value.failedCalls++
    aiStats.value.isGenerating = false
    aiStats.value.lastError = error
  }

  const resetStats = () => {
    aiStats.value = initialState()
  }

  return {
    aiStats,
    successRate,
    averageTime,
    startGeneration,
    recordSuccess,
    recordFailure,
    resetStats
  }
}
