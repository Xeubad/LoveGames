<template>
  <div class="lg-shell theme-flight-chess">
    <GameToolbar title="情侣飞行棋" icon="🎲">
      <template #actions>
        <button class="lg-btn lg-btn--ghost lg-btn--sm" type="button" @click="resetGame">
          🔄 重开
        </button>
      </template>
    </GameToolbar>

    <div class="fc-stage">
      <div class="fc-layout">
        <!-- 棋盘 -->
        <div class="fc-board">
          <div
            v-for="i in 40"
            :key="i"
            class="fc-cell"
            :class="getCellClass(i)"
            :style="getCellPosition(i)"
          >
            <span class="fc-cell__num">{{ i }}</span>
          </div>

          <div
            class="fc-piece"
            :style="getPlayerPosition(player1Position, piecesOverlap ? '-30%' : '0')"
          >
            <span class="fc-piece__glyph" :class="{ 'is-moving': isMoving && currentPlayer === 1 }">💖</span>
          </div>

          <div
            class="fc-piece"
            :style="getPlayerPosition(player2Position, piecesOverlap ? '30%' : '0')"
          >
            <span class="fc-piece__glyph" :class="{ 'is-moving': isMoving && currentPlayer === 2 }">💙</span>
          </div>
        </div>

        <!-- 控制台：宽屏悬浮在棋盘中心，窄屏落到棋盘下方 -->
        <div class="fc-panel">
          <div class="fc-row">
            <span class="fc-row__label">内容尺度</span>
            <div class="lg-segment">
              <button
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': contentLevel === 'basic' }"
                @click="setContentLevel('basic')"
              >💕 基本</button>
              <button
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': contentLevel === 'couple' }"
                @click="setContentLevel('couple')"
              >🔥 情侣</button>
            </div>
          </div>

          <div class="fc-row">
            <label class="lg-switch">
              <input type="checkbox" v-model="useAI" :disabled="aiToggleDisabled || isSyncing">
              <span class="lg-switch__track"></span>
            </label>
            <span class="fc-row__hint">
              {{ aiToggleLabel }}<template v-if="isSyncing"> · 同步中…</template>
            </span>
          </div>

          <p v-if="aiNotice" class="lg-notice lg-notice--warn">{{ aiNotice }}</p>

          <div class="fc-dice" :class="{ 'is-rolling': isRolling }">
            <span
              v-for="dot in getDots(diceResult || 1)"
              :key="dot"
              class="fc-dice__dot"
              :style="getDotStyle(dot)"
            ></span>
          </div>

          <button
            class="lg-btn lg-btn--primary lg-btn--block"
            type="button"
            :disabled="isRolling || showTask || !!winner"
            @click="rollDice"
          >
            {{ isRolling ? '掷骰子中…' : '🎲 掷骰子' }}
          </button>

          <p class="fc-turn">
            当前玩家
            <strong>{{ currentPlayer === 1 ? '💖 玩家1' : '💙 玩家2' }}</strong>
          </p>

          <details class="fc-rules">
            <summary>🎮 游戏规则</summary>
            <ol>
              <li>摇骰子自动走棋</li>
              <li>每个格子都有任务</li>
              <li>可自行商量执行其他任务</li>
              <li>率先走到终点的一方获胜</li>
            </ol>
          </details>
        </div>
      </div>
    </div>

    <!-- 任务弹窗 -->
    <div v-if="showTask" class="lg-modal" @click="closeTask">
      <div class="lg-modal__panel" @click.stop>
        <h2 class="lg-modal__title">{{ taskTitle }}</h2>
        <p class="lg-modal__text">{{ currentTask }}</p>
        <span class="lg-source" :class="taskSource === 'ai' ? 'lg-source--ai' : 'lg-source--local'">
          {{ taskSource === 'ai' ? '🤖 AI 生成' : '📦 本地题库' }}
        </span>
        <p v-if="taskNotice" class="lg-notice lg-notice--warn fc-gap">{{ taskNotice }}</p>
        <button class="lg-btn lg-btn--primary lg-btn--block fc-gap" type="button" @click="closeTask">
          完成任务
        </button>
      </div>
    </div>

    <!-- 胜利弹窗 -->
    <div v-if="winner" class="lg-modal lg-modal--top">
      <div class="lg-modal__panel">
        <p class="fc-win__emoji">🎉</p>
        <h2 class="lg-modal__title">{{ winner === 1 ? '💖 玩家1' : '💙 玩家2' }} 胜利！</h2>
        <p class="lg-modal__text">率先到达终点，赢得了这场甜蜜的比赛</p>
        <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="resetGame">
          🔄 再来一局
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import GameToolbar from '../../shared/GameToolbar.vue'
import { apiJSON, postJSON } from '../../shared/api.js'

const player1Position = ref(1)
const player2Position = ref(1)
const currentPlayer = ref(1)
const diceResult = ref(null)
const isRolling = ref(false)
const isMoving = ref(false)
const showTask = ref(false)
const currentTask = ref('')
const taskTitle = ref('')
const taskNotice = ref('')
const taskSource = ref('local')
const winner = ref(null)
const contentLevel = ref('basic')
const useAI = ref(false)
const isSyncing = ref(false)

// 以下三项由服务端下发，前端不重复判断策略
const aiEligible = ref(true)
const aiAvailable = ref(false)
const aiConfigured = ref(false)
const aiNotice = ref('')

const specialCells = [5, 10, 15, 20, 25, 30, 35, 40]

const aiToggleDisabled = computed(() => !aiEligible.value || !aiConfigured.value)
const piecesOverlap = computed(() => player1Position.value === player2Position.value)

const aiToggleLabel = computed(() => {
  if (!aiEligible.value) return '📦 亲密档仅本地题库'
  if (!aiConfigured.value) return '📦 AI 未配置'
  return aiAvailable.value && useAI.value ? '🤖 AI 生成已启用' : '📦 使用本地样例'
})

const getCellClass = (cellNumber) => {
  if (cellNumber === 1) return 'is-start'
  if (cellNumber === 40) return 'is-end'
  if (specialCells.includes(cellNumber)) return 'is-special'
  return ''
}

const applyServerState = (data) => {
  contentLevel.value = data.level
  aiEligible.value = data.aiEligible
  aiAvailable.value = data.aiAvailable
  aiConfigured.value = data.aiConfigured
  aiNotice.value = data.aiNotice || ''
}

const syncSettings = async (level, useAi) => {
  isSyncing.value = true
  try {
    applyServerState(await postJSON('/api/flight-chess/set-content-level', { level, useAI: useAi }))
  } catch (error) {
    console.error('同步内容尺度失败:', error)
    aiNotice.value = '无法连接服务器，本次设置未保存'
  } finally {
    isSyncing.value = false
  }
}

const setContentLevel = (level) => {
  if (level === contentLevel.value) return
  syncSettings(level, useAI.value)
}

onMounted(async () => {
  try {
    const data = await apiJSON('/api/flight-chess/content-level')
    useAI.value = data.useAI === true
    applyServerState(data)
  } catch (error) {
    console.error('加载内容尺度失败:', error)
    aiNotice.value = '无法连接服务器'
  }
})

// 设置与切换统一走 syncSettings，避免两条路径重复请求
watch(useAI, (value) => syncSettings(contentLevel.value, value))

/**
 * 棋盘是 11x11 网格的外圈：4 x 11 - 4 = 40 格，正好放下 40 个格子。
 * （每边 10 格的话周长只有 36 格，四个角会出现两格完全重叠。）
 * 角落归属：上边含右上角、右边含右下角、下边含左下角、左边不含角。
 */
const CELLS_PER_SIDE = 11
const CELL_PCT = 100 / CELLS_PER_SIDE

const cellBox = (cellNumber) => {
  const n = Math.min(Math.max(cellNumber, 1), 40)

  if (n <= 11) {
    return { top: 0, left: (n - 1) * CELL_PCT }
  }
  if (n <= 21) {
    return { top: (n - 11) * CELL_PCT, left: 100 - CELL_PCT }
  }
  if (n <= 31) {
    return { top: 100 - CELL_PCT, left: 100 - (n - 20) * CELL_PCT }
  }
  return { top: 100 - (n - 30) * CELL_PCT, left: 0 }
}

const getCellPosition = (cellNumber) => {
  const { top, left } = cellBox(cellNumber)
  return {
    top: `${top}%`,
    left: `${left}%`,
    width: `${CELL_PCT}%`,
    height: `${CELL_PCT}%`
  }
}

// 两枚棋子落在同一格时反向错开，否则位移相同仍会完全重叠
const getPlayerPosition = (cellNumber, nudge = '0') => {
  const { top, left } = cellBox(cellNumber)
  return {
    top: `${top + CELL_PCT / 2}%`,
    left: `${left + CELL_PCT / 2}%`,
    transform: `translate(-50%, -50%) translateX(${nudge})`
  }
}

// 获取骰子点数对应的点位置（1-9 对应 3x3 网格的九宫位）
const getDots = (value) => {
  const dotPatterns = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  }
  return dotPatterns[value] || dotPatterns[1]
}

// 点位必须显式落到九宫格里，否则 v-for 出来的点会按顺序挤在前几格，骰面是错的
const getDotStyle = (cell) => ({
  gridColumn: ((cell - 1) % 3) + 1,
  gridRow: Math.floor((cell - 1) / 3) + 1
})

const rollDice = async () => {
  if (isRolling.value || showTask.value || winner.value) return

  isRolling.value = true

  try {
    const data = await apiJSON('/api/flight-chess/dice')

    setTimeout(async () => {
      diceResult.value = data.result
      isRolling.value = false
      await movePlayer(data.result)
    }, 1000)
  } catch (error) {
    console.error('掷骰子失败:', error)
    isRolling.value = false
  }
}

const movePlayer = async (steps) => {
  isMoving.value = true

  const currentPos = currentPlayer.value === 1 ? player1Position.value : player2Position.value
  let newPos = currentPos + steps

  if (newPos >= 40) {
    newPos = 40
    if (currentPlayer.value === 1) {
      player1Position.value = newPos
    } else {
      player2Position.value = newPos
    }

    setTimeout(() => {
      isMoving.value = false
      winner.value = currentPlayer.value
    }, 500)
    return
  }

  if (currentPlayer.value === 1) {
    player1Position.value = newPos
  } else {
    player2Position.value = newPos
  }

  setTimeout(async () => {
    isMoving.value = false
    await showCellContent(newPos)
  }, 500)
}

const resetGame = () => {
  player1Position.value = 1
  player2Position.value = 1
  currentPlayer.value = 1
  diceResult.value = null
  winner.value = null
  showTask.value = false
  currentTask.value = ''
  taskNotice.value = ''
  taskSource.value = 'local'
  isRolling.value = false
  isMoving.value = false
}

const showCellContent = async (cellNumber) => {
  await showTaskModal(cellNumber)
}

const showTaskModal = async (cellNumber) => {
  try {
    // 是否用 AI 由服务端按会话决定，前端不再重复传参
    const data = await postJSON('/api/flight-chess/generate-task', {
      cellNumber,
      player: currentPlayer.value
    })

    taskTitle.value = data.title
    currentTask.value = data.task
    taskNotice.value = data.notice || ''
    taskSource.value = data.source
  } catch (error) {
    console.error('获取任务失败:', error)
    taskTitle.value = `格子 ${cellNumber}`
    currentTask.value = '无法获取任务，请检查网络后重新掷骰子'
    taskNotice.value = error.message
    taskSource.value = 'local'
  }

  showTask.value = true
}

const closeTask = () => {
  showTask.value = false
  currentTask.value = ''
  switchPlayer()
}

const switchPlayer = () => {
  currentPlayer.value = currentPlayer.value === 1 ? 2 : 1
  diceResult.value = null
}
</script>

<style scoped>
/* 舞台：棋盘 + 控制台整体在工具条下方居中 */
.fc-stage {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lg-sp-4);
  min-height: 0;
}

/* 宽度贴合棋盘，控制台的绝对定位才有正确参照。
   两行是为 iOS 写的：100vh 是不含地址栏收缩的大视口，
   横屏时会把棋盘算得比可见区域还高，dvh 才跟着工具条实际伸缩。 */
.fc-layout {
  position: relative;
  width: min(100%, calc(100vh - var(--lg-toolbar-h) - var(--lg-sp-5) * 2));
  width: min(100%, calc(100dvh - var(--lg-toolbar-h) - var(--lg-sp-5) * 2));
}

/* 棋盘强制正方形：竖屏下不再被拉成长方形、格子不再变形 */
.fc-board {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: var(--lg-r-lg);
  overflow: hidden;
  box-shadow: var(--lg-sh-2);
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--lg-accent) 30%, #fff) 0%,
    color-mix(in srgb, var(--lg-accent-2) 34%, #fff) 100%);
}

.fc-cell {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.fc-cell__num {
  font-size: var(--lg-fs-xs);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.14);
}

.fc-cell.is-start { background: rgba(46, 160, 67, 0.55); }
.fc-cell.is-end { background: rgba(255, 193, 7, 0.6); }
.fc-cell.is-special { background: color-mix(in srgb, var(--lg-accent) 58%, transparent); }

.fc-piece {
  position: absolute;
  z-index: 10;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.22));
}

/* 弹跳动画放在内层，避免与外层定位用的 transform 互相覆盖 */
.fc-piece__glyph {
  display: inline-block;
  font-size: 26px;
  transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.fc-piece__glyph.is-moving {
  animation: fc-bounce 0.5s ease-in-out;
}

@keyframes fc-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* 控制台：宽屏悬浮在棋盘正中 */
.fc-panel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 46%;
  max-height: 86%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-4);
  border-radius: var(--lg-r-md);
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid var(--lg-border);
  box-shadow: var(--lg-sh-2);
}

.fc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-2);
  flex-wrap: wrap;
}

.fc-row__label {
  font-size: var(--lg-fs-sm);
  font-weight: 600;
  color: var(--lg-muted);
}

.fc-row__hint {
  font-size: var(--lg-fs-sm);
  color: var(--lg-ink-soft);
}

/* 骰子本身就是 3x3 九宫格，点位由 getDotStyle 显式指定 */
.fc-dice {
  align-self: center;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  width: 62px;
  height: 62px;
  padding: 9px;
  border-radius: var(--lg-r-sm);
  background: var(--lg-surface);
  border: 1px solid var(--lg-border);
  box-shadow: var(--lg-sh-2);
}

.fc-dice.is-rolling {
  animation: fc-roll 0.5s ease-in-out infinite;
}

@keyframes fc-roll {
  0% { transform: rotate(0deg); }
  50% { transform: rotate(180deg); }
  100% { transform: rotate(360deg); }
}

.fc-dice__dot {
  align-self: center;
  justify-self: center;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--lg-ink);
}

.fc-turn {
  font-size: var(--lg-fs-sm);
  color: var(--lg-muted);
  text-align: center;
}

.fc-turn strong {
  color: var(--lg-ink);
}

.fc-rules {
  border-top: 1px solid var(--lg-border);
  padding-top: var(--lg-sp-2);
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.fc-rules summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--lg-ink-soft);
}

.fc-rules ol {
  margin: var(--lg-sp-2) 0 0 var(--lg-sp-4);
  line-height: 1.7;
}

.fc-gap {
  margin-top: var(--lg-sp-4);
}

.fc-win__emoji {
  font-size: 52px;
  line-height: 1;
  margin-bottom: var(--lg-sp-3);
}

/* 窄屏：控制台移出棋盘落到下方，避免在小方块里挤成一团 */
@media (max-width: 640px) {
  .fc-stage {
    align-items: flex-start;
  }

  .fc-layout {
    display: flex;
    flex-direction: column;
    gap: var(--lg-sp-3);
    width: 100%;
  }

  .fc-panel {
    position: static;
    transform: none;
    width: 100%;
    max-height: none;
    overflow: visible;
  }

  .fc-cell__num { font-size: 10px; }
  .fc-piece__glyph { font-size: 18px; }
  .fc-dice { width: 52px; height: 52px; padding: 7px; }
  .fc-dice__dot { width: 8px; height: 8px; }
}
</style>