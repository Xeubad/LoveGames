<template>
  <div class="lg-shell theme-truth-or-dare">
    <GameToolbar title="联机房间" icon="💕" to="/truth-or-dare">
      <template #actions>
        <span class="rm-room">房间 <strong>{{ roomId }}</strong></span>
        <button class="lg-btn lg-btn--ghost lg-btn--sm" type="button" @click="copyRoomId">
          📋 复制
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <p class="lg-notice rm-conn" :class="connectionNoticeTone">
        {{ connectionStatusText }}
      </p>

      <div v-if="roomFull" class="lg-notice lg-notice--danger rm-block">
        该房间已有 2 位玩家，无法加入。请让对方分享其他房间号。
      </div>

      <!-- 等待对方 -->
      <section v-if="players < 2" class="lg-card rm-waiting">
        <p class="rm-waiting__emoji">⏳</p>
        <p class="rm-waiting__lead">等待对方加入…</p>
        <p class="rm-waiting__id">{{ roomId }}</p>
        <p class="rm-waiting__hint">把房间号发给 TA，让 TA 在「联机房间」里输入加入</p>
      </section>

      <!-- 对局 -->
      <div v-else class="rm-layout">
        <section class="lg-card rm-settings">
          <div class="rm-settings__row">
            <span class="rm-settings__label">难度</span>
            <div class="lg-segment">
              <button
                v-for="option in difficultyOptions"
                :key="option.value"
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': difficulty === option.value }"
                @click="setDifficulty(option.value)"
              >{{ option.label }}</button>
            </div>
          </div>

          <div class="rm-settings__row">
            <span class="rm-settings__label">AI 出题</span>
            <div class="rm-settings__control">
              <label class="lg-switch">
                <input type="checkbox" v-model="useAI" :disabled="!aiConfigured || isGenerating">
                <span class="lg-switch__track"></span>
              </label>
              <span class="rm-settings__hint">{{ aiHint }}</span>
            </div>
          </div>

          <p v-if="aiStats.totalCalls > 0" class="rm-stats">
            调用 {{ aiStats.totalCalls }} 次 · 成功率 {{ successRate }}% · 平均 {{ averageTime }}s
            <span v-if="aiStats.lastError" class="rm-stats__error">最后错误：{{ aiStats.lastError }}</span>
            <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="clearHistory">
              清除历史与统计
            </button>
          </p>

          <p class="rm-sync-hint">难度与 AI 开关会自动同步给对方</p>
        </section>

        <section class="lg-card rm-stage">
          <div class="rm-players">
            <span class="lg-badge">💖 玩家1 ✓</span>
            <span class="lg-badge">💙 玩家2 ✓</span>
          </div>

          <div class="rm-question" :class="{ 'is-generating': isGenerating }">
            <span class="lg-badge lg-badge--accent rm-question__badge">
              {{ currentQuestion.type === 'truth' ? '💭 真心话' : '🎯 大冒险' }} · {{ difficultyLabel }}
            </span>
            <p class="rm-question__text">
              {{ isGenerating ? (progressText || '正在生成题目…') : currentQuestion.text }}
            </p>
            <div v-if="!isGenerating && currentQuestion.source" class="rm-question__source">
              <span
                class="lg-source"
                :class="currentQuestion.source === 'ai' ? 'lg-source--ai' : 'lg-source--local'"
              >
                {{ currentQuestion.source === 'ai' ? '🤖 AI 生成' : '📦 本地题库' }}
              </span>
            </div>
            <p v-if="!isGenerating && currentQuestion.notice" class="lg-notice lg-notice--warn">
              {{ currentQuestion.notice }}
            </p>
          </div>

          <div class="rm-actions">
            <button class="lg-btn lg-btn--primary" type="button" :disabled="isGenerating" @click="askQuestion('truth')">
              💭 真心话
            </button>
            <button class="lg-btn lg-btn--ghost" type="button" :disabled="isGenerating" @click="askQuestion('dare')">
              🎯 大冒险
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GameToolbar from '../../../shared/GameToolbar.vue'
import { fetchAIStatus } from '../services/ai.js'
import { useQuestionEngine } from '../composables/useQuestionEngine.js'

const route = useRoute()
const roomId = route.params.id

const difficultyOptions = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' }
]

const {
  difficulty,
  useAI,
  isGenerating,
  progressText,
  aiStats,
  successRate,
  averageTime,
  next,
  setDifficulty,
  clearHistory
} = useQuestionEngine()

const players = ref(0)
const ws = ref(null)
const connectionStatus = ref('connecting')
const connectionStatusText = ref('正在连接…')
const roomFull = ref(false)
const aiConfigured = ref(true)
const aiStatusLoaded = ref(false)

const currentQuestion = ref({
  type: 'truth',
  text: '选择难度后点击下方按钮开始',
  difficulty: 'medium',
  source: null,
  notice: ''
})

const difficultyLabel = computed(
  () => difficultyOptions.find((o) => o.value === difficulty.value)?.label || ''
)

const aiHint = computed(() => {
  if (!aiStatusLoaded.value) return '检查可用性中…'
  if (!aiConfigured.value) return '服务端未配置 AI_API_KEY，当前使用本地题库'
  return '开启后由 AI 生成更多样的题目'
})

const connectionNoticeTone = computed(() => {
  if (connectionStatus.value === 'connected') return 'lg-notice--ok'
  if (connectionStatus.value === 'connecting') return 'lg-notice--warn'
  return 'lg-notice--danger'
})

// ============ WebSocket ============

let reconnectTimer = null
let reconnectAttempts = 0
let disposed = false
/**
 * 最后一次已知的设置指纹。
 * 不能用「同步标志位 + watch」来防回播：watch 默认异步 flush，
 * 回调执行时标志位早已复位，守卫会失效。改成按值比对，与时序无关。
 */
let settingsFingerprint = null
const MAX_RECONNECT_DELAY_MS = 15000

const fingerprintOf = (difficultyValue, useAIValue) => `${difficultyValue}|${useAIValue}`

const send = (payload) => {
  if (ws.value && ws.value.readyState === WebSocket.OPEN) {
    ws.value.send(JSON.stringify(payload))
  }
}

const scheduleReconnect = () => {
  if (disposed || reconnectTimer) return
  reconnectAttempts += 1
  const delay = Math.min(1000 * 2 ** (reconnectAttempts - 1), MAX_RECONNECT_DELAY_MS)
  connectionStatus.value = 'disconnected'
  connectionStatusText.value = `连接断开，${Math.round(delay / 1000)} 秒后第 ${reconnectAttempts} 次重连`
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

const handleMessage = (event) => {
  let message
  try {
    message = JSON.parse(event.data)
  } catch (error) {
    console.error('[客户端] 消息解析错误:', error)
    return
  }

  if (message.type === 'players') {
    players.value = message.count
    if (roomFull.value && message.count < 2) roomFull.value = false
  } else if (message.type === 'question') {
    currentQuestion.value = { notice: '', source: null, ...message.data }
  } else if (message.type === 'settings') {
    // 跟随对方的难度/AI 设置，避免两端出不同档位的题
    if (message.difficulty) setDifficulty(message.difficulty)
    if (typeof message.useAI === 'boolean') useAI.value = message.useAI
    // 记下指纹，随后的 watch 就不会把同一份设置回播给对方
    settingsFingerprint = fingerprintOf(difficulty.value, useAI.value)
  }
}

const connect = () => {
  if (disposed) return

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}`

  connectionStatus.value = 'connecting'
  connectionStatusText.value = reconnectAttempts > 0 ? `正在重连（第 ${reconnectAttempts} 次）…` : '正在连接…'

  const socket = new WebSocket(wsUrl)
  ws.value = socket

  socket.onopen = () => {
    reconnectAttempts = 0
    roomFull.value = false
    connectionStatus.value = 'connected'
    connectionStatusText.value = '已连接到服务器'
    // 重连后补发一次自己的设置，保证两端一致
    settingsFingerprint = fingerprintOf(difficulty.value, useAI.value)
    send({ type: 'settings', difficulty: difficulty.value, useAI: useAI.value })
  }

  socket.onmessage = handleMessage

  socket.onerror = () => {
    connectionStatus.value = 'error'
    connectionStatusText.value = '连接出错'
  }

  socket.onclose = (event) => {
    if (disposed) return

    // 房间已满：重连只会一直被拒，直接告知用户
    if (event.code === 1013) {
      roomFull.value = true
      connectionStatus.value = 'error'
      connectionStatusText.value = '房间已满（最多 2 人）'
      return
    }

    if (event.code === 1008) {
      connectionStatus.value = 'error'
      connectionStatusText.value = event.reason || '连接被服务器拒绝'
      return
    }

    scheduleReconnect()
  }
}

// 设置真正变化时才同步给对方
watch([difficulty, useAI], () => {
  const fingerprint = fingerprintOf(difficulty.value, useAI.value)
  if (fingerprint === settingsFingerprint) return
  settingsFingerprint = fingerprint
  send({ type: 'settings', difficulty: difficulty.value, useAI: useAI.value })
})

// ============ 出题 ============

const askQuestion = async (type) => {
  const question = await next(type)
  if (!question) return
  currentQuestion.value = question
  send({ type: 'question', data: question })
}

const copyRoomId = async () => {
  try {
    await navigator.clipboard.writeText(roomId)
    alert('房间号已复制: ' + roomId)
  } catch {
    prompt('请手动复制房间号:', roomId)
  }
}

onMounted(async () => {
  connect()

  const status = await fetchAIStatus()
  aiConfigured.value = status.configured === true
  aiStatusLoaded.value = true
})

onUnmounted(() => {
  disposed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws.value) ws.value.close()
})
</script>

<style scoped>
.rm-room {
  font-size: var(--lg-fs-sm);
  color: var(--lg-muted);
  white-space: nowrap;
}

.rm-room strong {
  color: var(--lg-accent);
  letter-spacing: 1px;
}

.rm-conn {
  margin-bottom: var(--lg-sp-4);
  text-align: center;
}

.rm-block {
  margin-bottom: var(--lg-sp-4);
  text-align: center;
}

.rm-layout {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

/* ---- 等待页 ---- */

.rm-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-7) var(--lg-sp-5);
  text-align: center;
}

.rm-waiting__emoji {
  font-size: 44px;
  line-height: 1;
}

.rm-waiting__lead {
  font-size: var(--lg-fs-lg);
  font-weight: 650;
  color: var(--lg-ink);
}

.rm-waiting__id {
  padding: var(--lg-sp-2) var(--lg-sp-4);
  border-radius: var(--lg-r-sm);
  background: var(--lg-surface-sunken);
  border: 1px dashed var(--lg-border-strong);
  font-size: var(--lg-fs-xl);
  font-weight: 700;
  letter-spacing: 6px;
  color: var(--lg-accent);
}

.rm-waiting__hint {
  max-width: 32ch;
  font-size: var(--lg-fs-sm);
  line-height: 1.7;
  color: var(--lg-muted);
}

/* ---- 设置卡 ---- */

.rm-settings {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-4) var(--lg-sp-5);
}

.rm-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  flex-wrap: wrap;
}

.rm-settings__label {
  font-size: var(--lg-fs-sm);
  font-weight: 600;
  color: var(--lg-muted);
}

.rm-settings__control {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
}

.rm-settings__hint {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.rm-stats {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
  flex-wrap: wrap;
  padding-top: var(--lg-sp-2);
  border-top: 1px solid var(--lg-border);
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.rm-stats__error {
  color: var(--lg-danger-ink);
}

.rm-sync-hint {
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
}

/* ---- 对局卡 ---- */

.rm-stage {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.rm-players {
  display: flex;
  gap: var(--lg-sp-2);
  justify-content: center;
}

.rm-question {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  min-height: 180px;
  justify-content: center;
  padding: var(--lg-sp-5) var(--lg-sp-4);
  border-radius: var(--lg-r-md);
  background: var(--lg-surface-sunken);
  text-align: center;
  transition: opacity 0.25s ease;
}

.rm-question.is-generating {
  opacity: 0.65;
}

.rm-question__text {
  font-size: var(--lg-fs-lg);
  line-height: 1.75;
  color: var(--lg-ink);
}

.rm-actions {
  display: flex;
  gap: var(--lg-sp-3);
  justify-content: center;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .rm-actions .lg-btn {
    flex: 1;
  }
}
</style>
