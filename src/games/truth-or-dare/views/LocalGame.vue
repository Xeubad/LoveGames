<template>
  <div class="lg-shell theme-truth-or-dare">
    <GameToolbar title="本地对局" icon="💕" to="/truth-or-dare">
      <template #actions>
        <span class="tl-round">第 {{ round }} 轮</span>
        <button class="lg-btn lg-btn--ghost lg-btn--sm" type="button" @click="resetMatch">
          重新开始
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <div class="tl-layout">
        <!-- 设置 -->
        <section class="lg-card tl-settings">
          <div class="tl-settings__row">
            <span class="tl-settings__label">难度</span>
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

          <div class="tl-settings__row">
            <span class="tl-settings__label">AI 出题</span>
            <div class="tl-settings__control">
              <label class="lg-switch">
                <input type="checkbox" v-model="useAI" :disabled="!aiConfigured || isGenerating">
                <span class="lg-switch__track"></span>
              </label>
              <span class="tl-settings__hint">{{ aiHint }}</span>
            </div>
          </div>

          <p v-if="aiStats.totalCalls > 0" class="tl-stats">
            调用 {{ aiStats.totalCalls }} 次 · 成功率 {{ successRate }}% · 平均 {{ averageTime }}s
            <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="clearHistory">
              清除历史与统计
            </button>
          </p>
        </section>

        <!-- 对局主区 -->
        <section class="lg-card tl-stage">
          <!-- 轮次指示 -->
          <div class="tl-players">
            <div
              v-for="p in [1, 2]"
              :key="p"
              class="tl-player"
              :class="{ 'is-active': currentPlayer === p }"
            >
              <span class="tl-player__emoji">{{ p === 1 ? '💖' : '💙' }}</span>
              <span class="tl-player__name">玩家{{ p }}</span>
              <span class="tl-player__turns">{{ turnsOf(p) }} 题</span>
            </div>
          </div>

          <!-- 待抽题 -->
          <div v-if="stage === 'ready'" class="tl-pane">
            <p class="tl-pane__lead">
              轮到 <strong>{{ playerName }}</strong>
            </p>
            <p class="tl-pane__sub">选择一种题型，题目抽出后会先遮住，交给对方再看</p>
            <div class="tl-actions">
              <button class="lg-btn lg-btn--primary" type="button" :disabled="isGenerating" @click="draw('truth')">
                💭 真心话
              </button>
              <button class="lg-btn lg-btn--ghost" type="button" :disabled="isGenerating" @click="draw('dare')">
                🎯 大冒险
              </button>
            </div>
            <p v-if="isGenerating" class="tl-progress">{{ progressText || '正在生成题目…' }}</p>
          </div>

          <!-- 遮题：设备交接 -->
          <div v-else-if="stage === 'masked'" class="tl-pane">
            <p class="tl-mask__emoji">🙈</p>
            <p class="tl-pane__lead">题目已抽出</p>
            <p class="tl-pane__sub">
              请把设备交给 <strong>{{ playerName }}</strong>，确认周围没有别人偷看后再揭开
            </p>
            <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="reveal">
              我是 {{ playerName }}，显示题目
            </button>
          </div>

          <!-- 已揭题 -->
          <div v-else class="tl-pane">
            <span class="lg-badge lg-badge--accent">
              {{ drawn?.type === 'truth' ? '💭 真心话' : '🎯 大冒险' }} · {{ difficultyLabel }}
            </span>
            <p class="tl-question">{{ drawn?.text }}</p>
            <div class="tl-source">
              <span class="lg-source" :class="drawn?.source === 'ai' ? 'lg-source--ai' : 'lg-source--local'">
                {{ drawn?.source === 'ai' ? '🤖 AI 生成' : '📦 本地题库' }}
              </span>
            </div>
            <p v-if="drawn?.notice" class="lg-notice lg-notice--warn">{{ drawn.notice }}</p>
            <div class="tl-actions tl-actions--stack">
              <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="finishTurn">
                ✓ 完成，交给对方
              </button>
              <button class="lg-btn lg-btn--quiet" type="button" @click="stage = 'masked'">
                🙈 重新遮住
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import GameToolbar from '../../../shared/GameToolbar.vue'
import { fetchAIStatus } from '../services/ai.js'
import { useQuestionEngine } from '../composables/useQuestionEngine.js'

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

const stage = ref('ready')
const currentPlayer = ref(1)
const turnCount = ref(0)
const drawn = ref(null)

const aiConfigured = ref(true)
const aiStatusLoaded = ref(false)

const round = computed(() => Math.floor(turnCount.value / 2) + 1)
const playerName = computed(() => `玩家${currentPlayer.value}`)
const difficultyLabel = computed(() => difficultyOptions.find((o) => o.value === difficulty.value)?.label || '')

const aiHint = computed(() => {
  if (!aiStatusLoaded.value) return '检查可用性中…'
  if (!aiConfigured.value) return '服务端未配置 AI_API_KEY，当前使用本地题库'
  return '开启后由 AI 生成更多样的题目'
})

const turnsOf = (player) => {
  const done = turnCount.value + (stage.value === 'revealed' ? 1 : 0)
  return player === 1 ? Math.ceil(done / 2) : Math.floor(done / 2)
}

const draw = async (type) => {
  const question = await next(type)
  if (!question) return
  drawn.value = question
  stage.value = 'masked'
}

const reveal = () => {
  stage.value = 'revealed'
}

const finishTurn = () => {
  turnCount.value += 1
  currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
  drawn.value = null
  stage.value = 'ready'
}

const resetMatch = () => {
  turnCount.value = 0
  currentPlayer.value = 1
  drawn.value = null
  stage.value = 'ready'
}

onMounted(async () => {
  const status = await fetchAIStatus()
  aiConfigured.value = status.configured === true
  aiStatusLoaded.value = true
})
</script>

<style scoped>
.tl-layout {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.tl-round {
  font-size: var(--lg-fs-sm);
  color: var(--lg-muted);
  white-space: nowrap;
}

/* ---- 设置卡 ---- */

.tl-settings {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-4) var(--lg-sp-5);
}

.tl-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  flex-wrap: wrap;
}

.tl-settings__label {
  font-size: var(--lg-fs-sm);
  font-weight: 600;
  color: var(--lg-muted);
}

.tl-settings__control {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
}

.tl-settings__hint {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.tl-stats {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
  flex-wrap: wrap;
  padding-top: var(--lg-sp-2);
  border-top: 1px solid var(--lg-border);
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

/* ---- 对局卡 ---- */

.tl-stage {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-5);
}

.tl-players {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lg-sp-3);
}

.tl-player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--lg-sp-3);
  border-radius: var(--lg-r-md);
  border: 1px solid var(--lg-border);
  background: var(--lg-surface-sunken);
  color: var(--lg-faint);
  transition: border-color 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.tl-player.is-active {
  border-color: color-mix(in srgb, var(--lg-accent) 55%, transparent);
  background: color-mix(in srgb, var(--lg-accent) 10%, transparent);
  color: var(--lg-ink);
}

.tl-player__emoji {
  font-size: 28px;
  line-height: 1;
}

.tl-player__name {
  font-size: var(--lg-fs-sm);
  font-weight: 650;
}

.tl-player__turns {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.tl-pane {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  text-align: center;
  min-height: 220px;
  justify-content: center;
}

.tl-pane__lead {
  font-size: var(--lg-fs-lg);
  font-weight: 650;
  color: var(--lg-ink);
}

.tl-pane__lead strong {
  color: var(--lg-accent);
}

.tl-pane__sub {
  max-width: 34ch;
  font-size: var(--lg-fs-sm);
  line-height: 1.7;
  color: var(--lg-muted);
}

.tl-mask__emoji {
  font-size: 48px;
  line-height: 1;
}

.tl-question {
  padding: var(--lg-sp-4);
  border-radius: var(--lg-r-md);
  background: var(--lg-gradient);
  color: var(--lg-on-accent);
  font-size: var(--lg-fs-lg);
  line-height: 1.7;
  box-shadow: var(--lg-sh-accent);
}

.tl-source {
  display: flex;
  justify-content: center;
}

.tl-progress {
  font-size: var(--lg-fs-sm);
  color: var(--lg-accent);
}

.tl-actions {
  display: flex;
  gap: var(--lg-sp-3);
  flex-wrap: wrap;
  justify-content: center;
}

.tl-actions--stack {
  flex-direction: column;
  width: 100%;
  max-width: 320px;
}

@media (max-width: 640px) {
  .tl-actions .lg-btn {
    flex: 1;
  }
}
</style>
