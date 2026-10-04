<template>
  <div class="lg-shell theme-power-play">
    <GameToolbar title="限时主导权" icon="👑" />

    <div class="lg-body">
      <p v-if="loadError" class="lg-notice lg-notice--danger">{{ loadError }}</p>

      <!-- ============ 设置 ============ -->
      <section v-if="stage === 'setup'" class="lg-card pp-setup">
        <h1 class="pp-title">👑 限时主导权</h1>
        <p class="pp-lead">
          抽定谁在这一轮里主导，另一方在限定时间内跟随。
          <strong>接收方在身体地图里标为禁区的部位，会自动成为这一轮的硬边界</strong>；
          指令池优先取你们在升温阶梯里达成共识的条目。随时可以叫停，叫停不是失败。
        </p>

        <div class="pp-field">
          <span class="pp-field__label">时长</span>
          <div class="lg-segment">
            <button
              v-for="m in options.roundMinutes"
              :key="m"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.durationMin === m }"
              @click="setup.durationMin = m"
            >{{ m }} 分钟</button>
          </div>
        </div>

        <div class="pp-field">
          <span class="pp-field__label">谁主导</span>
          <div class="lg-segment">
            <button
              v-for="p in PLAYERS_META"
              :key="p.key"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.leader === p.key }"
              @click="setup.leader = p.key"
            >{{ p.emoji }} {{ p.name }}</button>
            <button
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.leader === null }"
              @click="setup.leader = null"
            >🎲 抽定</button>
          </div>
        </div>

        <div class="pp-field">
          <span class="pp-field__label">强度上限</span>
          <div class="lg-segment">
            <button
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.cap === null }"
              @click="setup.cap = null"
            >自动</button>
            <button
              v-for="n in [1, 2, 3, 4, 5]"
              :key="n"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.cap === n }"
              @click="setup.cap = n"
            >{{ n }}</button>
          </div>
          <span class="pp-field__hint">{{ capHint }}</span>
        </div>

        <div v-if="recent.length" class="pp-recent">
          <span class="pp-field__label">最近几轮</span>
          <ul>
            <li v-for="(r, i) in recent" :key="i">
              {{ meta(r.leader).emoji }} 主导 · {{ Math.round(r.plannedSec / 60) }} 分钟
              · 用了 {{ r.instructionsUsed.length }} 条
              <strong v-if="r.stoppedEarly" class="pp-stopped">中途叫停</strong>
              <span v-else>完整结束</span>
            </li>
          </ul>
        </div>

        <button class="lg-btn lg-btn--primary lg-btn--block" type="button" :disabled="loading" @click="toBriefing">
          {{ loading ? '正在生成本轮边界…' : '生成开局简报 →' }}
        </button>
      </section>

      <!-- ============ 开局简报：双方都确认才能开始 ============ -->
      <section v-else-if="stage === 'briefing' && plan" class="lg-card pp-brief">
        <h2 class="pp-title pp-title--sm">开局简报</h2>

        <div class="pp-roles">
          <div class="pp-role pp-role--lead">
            <span class="pp-role__emoji">{{ meta(plan.leader).emoji }}</span>
            <span class="pp-role__name">主导</span>
            <span class="pp-role__who">{{ meta(plan.leader).name }}</span>
          </div>
          <span class="pp-roles__arrow">→</span>
          <div class="pp-role">
            <span class="pp-role__emoji">{{ meta(plan.receiver).emoji }}</span>
            <span class="pp-role__name">跟随</span>
            <span class="pp-role__who">{{ meta(plan.receiver).name }}</span>
          </div>
          <div class="pp-role pp-role--time">
            <span class="pp-role__emoji">⏱️</span>
            <span class="pp-role__name">{{ Math.round(plan.durationSec / 60) }} 分钟</span>
            <span class="pp-role__who">强度 ≤ {{ plan.cap }}</span>
          </div>
        </div>

        <!-- 没有禁区时整块不渲染：这件事由服务端 warnings 统一说明，避免同一句话在简报里出现两遍 -->
        <div v-if="plan.limits.zoneIds.length" class="pp-block">
          <h3 class="pp-block__title">🚫 {{ meta(plan.receiver).name }}的硬边界</h3>
          <div class="pp-chips">
            <span v-for="z in plan.limits.zoneIds" :key="z" class="lg-badge pp-chip--no">{{ ZONE_LABELS[z] || z }}</span>
          </div>
          <p class="pp-block__note">
            这些部位本轮不碰。指令池不会自动按禁区过滤文本，所以下面每条指令在执行前，
            主导方自己对照一遍这个清单。
          </p>
        </div>

        <div class="pp-block">
          <h3 class="pp-block__title">🎴 指令池（{{ plan.pool.length }} 条）</h3>
          <ul class="pp-pool">
            <li v-for="item in plan.pool" :key="item.itemId">
              <span class="pp-pool__text">{{ item.text }}</span>
              <span class="pp-pool__meta">
                <em :class="item.fromAgreed ? 'pp-pool__tag--agreed' : 'pp-pool__tag--lib'">
                  {{ item.fromAgreed ? '共识' : '内容库' }}
                </em>
                {{ item.dimensionLabel }} · 强度 {{ item.intensity }}
                <template v-if="item.props.length"> · 需 {{ item.props.join('、') }}</template>
              </span>
            </li>
          </ul>
        </div>

        <p v-for="(w, i) in plan.warnings" :key="i" class="lg-notice" :class="noticeTone(w.level)">
          {{ w.text }}
        </p>

        <div class="pp-confirm">
          <button
            v-for="p in PLAYERS_META"
            :key="p.key"
            type="button"
            class="lg-btn pp-confirm__btn"
            :class="confirmed[p.key] ? 'lg-btn--primary' : 'lg-btn--ghost'"
            @click="confirmed[p.key] = !confirmed[p.key]"
          >
            {{ confirmed[p.key] ? '✓' : '' }} {{ p.emoji }} 我已看过并接受
          </button>
        </div>

        <div class="pp-actions">
          <button
            class="lg-btn lg-btn--primary lg-btn--block"
            type="button"
            :disabled="!confirmed.a || !confirmed.b || plan.pool.length === 0"
            @click="startRound"
          >
            {{ confirmed.a && confirmed.b ? '开始本轮' : '需要双方都确认' }}
          </button>
          <button class="lg-btn lg-btn--quiet" type="button" @click="backToSetup">← 改设置</button>
        </div>
      </section>

      <!-- ============ 进行中 ============ -->
      <section v-else-if="stage === 'running' && plan" class="pp-run">
        <div class="lg-card pp-timer-card">
          <p class="pp-timer" :class="{ 'is-low': remaining <= 60 }">{{ formatTime(remaining) }}</p>
          <p class="pp-timer__meta">
            {{ meta(plan.leader).emoji }} {{ meta(plan.leader).name }} 主导 ·
            {{ meta(plan.receiver).emoji }} {{ meta(plan.receiver).name }} 跟随
          </p>
        </div>

        <p v-if="plan.limits.zoneIds.length" class="lg-notice lg-notice--danger pp-limits">
          🚫 本轮不碰：{{ plan.limits.zoneIds.map((z) => ZONE_LABELS[z] || z).join('、') }}
        </p>

        <div class="lg-card pp-instruction">
          <template v-if="current">
            <span class="lg-badge lg-badge--accent">
              {{ current.dimensionLabel }} · 强度 {{ current.intensity }}
            </span>
            <p class="pp-instruction__text">{{ current.text }}</p>
            <p v-if="current.props.length" class="pp-instruction__props">需要：{{ current.props.join('、') }}</p>
            <button class="lg-btn lg-btn--ghost lg-btn--block" type="button" :disabled="available.length === 0" @click="drawInstruction">
              {{ available.length === 0 ? '指令池已用完' : '换下一条（剩 ' + available.length + ' 条）' }}
            </button>
          </template>
          <template v-else>
            <p class="pp-instruction__hint">
              由 {{ meta(plan.leader).name }} 决定什么时候抽第一条指令。<br>
              也可以完全不抽，自己安排这段时间。
            </p>
            <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="drawInstruction">
              🎴 抽一条指令（共 {{ plan.pool.length }} 条）
            </button>
          </template>
        </div>

        <!-- 叫停是唯一的撤回同意入口，必须不滚动就能按到。
             手机上横屏时它原本会掉到折叠线以下（实测 bottom=462 / 视口 350），
             所以整条钉在视口底部。 -->
        <div class="pp-stopbar">
          <button class="pp-stop" type="button" @click="stopRound">
            ⏹ 叫停 · 立即结束本轮
          </button>
          <p class="pp-stop__note">任何一方都可以按，不需要理由，也不需要解释。</p>
        </div>
      </section>

      <!-- ============ 结算 ============ -->
      <section v-else-if="stage === 'done'" class="lg-card pp-done">
        <p class="pp-done__emoji">{{ result.stoppedEarly ? '🫂' : '🎉' }}</p>
        <h2 class="pp-title pp-title--sm">
          {{ result.stoppedEarly ? '本轮已叫停' : '本轮完整结束' }}
        </h2>
        <p class="pp-lead pp-lead--center">
          <template v-if="result.stoppedEarly">
            叫停完全没问题 —— 这个按钮存在的意义就是让你随时能用它。
          </template>
          <template v-else>
            {{ meta(plan.leader).emoji }} 主导了 {{ Math.round(result.actualSec / 60) }} 分钟。
          </template>
        </p>

        <dl class="pp-stats">
          <div><dt>计划时长</dt><dd>{{ Math.round(result.plannedSec / 60) }} 分钟</dd></div>
          <div><dt>实际时长</dt><dd>{{ formatTime(result.actualSec) }}</dd></div>
          <div><dt>用了指令</dt><dd>{{ result.used.length }} / {{ plan.pool.length }} 条</dd></div>
          <div><dt>强度上限</dt><dd>≤ {{ plan.cap }}（{{ capSourceLabel }}）</dd></div>
        </dl>

        <div v-if="result.used.length" class="pp-block">
          <h3 class="pp-block__title">本轮用过的指令</h3>
          <ul class="pp-pool">
            <li v-for="item in result.used" :key="item.itemId">
              <span class="pp-pool__text">{{ item.text }}</span>
              <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" :disabled="saved[item.itemId]" @click="saveItem(item)">
                {{ saved[item.itemId] ? '✓ 已收藏' : '♡ 收藏' }}
              </button>
            </li>
          </ul>
        </div>

        <p class="lg-notice pp-aftercare">
          花一分钟聊聊刚才哪一条舒服、哪一条想停，比直接进入下一轮更有用。
          想调整边界就去身体地图改标注，想调整强度就去升温阶梯重答那一级。
        </p>

        <div class="pp-actions">
          <button class="lg-btn lg-btn--primary" type="button" @click="again">再来一轮</button>
          <button class="lg-btn lg-btn--ghost" type="button" @click="backToSetup">改设置</button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import GameToolbar from '../../shared/GameToolbar.vue'
import { ZONE_LABELS } from '../../shared/body-zones.js'
import { apiJSON, postJSON } from '../../shared/api.js'

const PLAYERS_META = [
  { key: 'a', emoji: '💖', name: '一方' },
  { key: 'b', emoji: '💙', name: '另一方' }
]

const CAP_SOURCE_LABELS = {
  manual: '手动设定',
  ladder: '按阶梯推导',
  fallback: '保守默认'
}

const stage = ref('setup')
const loading = ref(false)
const loadError = ref('')

const options = reactive({ roundMinutes: [5, 10, 15], fallbackCap: 2, ladderCaps: [] })
const setup = reactive({ durationMin: 10, leader: null, cap: null })
const ladderInfo = ref(null)
const recent = ref([])

const plan = ref(null)
const confirmed = reactive({ a: false, b: false })

const remaining = ref(0)
const current = ref(null)
const available = ref([])
const usedIds = ref([])
const result = ref({ actualSec: 0, plannedSec: 0, stoppedEarly: false, used: [] })
const saved = reactive({})

let endsAt = 0
let ticker = null
/** 「再来一轮」在抽定模式下用来交换主导方 */
let leaderOverride = null

const meta = (key) => PLAYERS_META.find((p) => p.key === key) || PLAYERS_META[0]
const capSourceLabel = computed(() => CAP_SOURCE_LABELS[plan.value?.capSource] || '')

/** info 级用中性底色，其余映射到对应的 notice 变体 */
const noticeTone = (level) => (level && level !== 'info' ? `lg-notice--${level}` : '')

const capHint = computed(() => {
  if (setup.cap !== null) return '手动锁定为强度 ≤ ' + setup.cap
  const passed = ladderInfo.value?.highestPassed || 0
  const level = options.ladderCaps.find((l) => l.level === passed)
  if (passed > 0 && level) {
    return `自动：你们已通过阶梯 L${passed}（${level.label}），上限取强度 ≤ ${level.maxIntensity}`
  }
  return `自动：还没有阶梯数据，按保守默认强度 ≤ ${options.fallbackCap}（明确浪漫/亲密为止）`
})

const formatTime = (sec) => {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    const [opts, log, ladder] = await Promise.all([
      apiJSON('/api/couple/power/options'),
      apiJSON('/api/couple/power/log'),
      apiJSON('/api/couple/ladder')
    ])
    Object.assign(options, opts)
    recent.value = (log.rounds || []).slice(0, 5)
    ladderInfo.value = ladder
  } catch (error) {
    loadError.value = `加载失败：${error.message}`
  }
})

const toBriefing = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const leader = setup.leader || leaderOverride || (Math.random() < 0.5 ? 'a' : 'b')
    leaderOverride = null
    const body = { leader, durationMin: setup.durationMin }
    if (setup.cap !== null) body.maxIntensity = setup.cap

    plan.value = await postJSON('/api/couple/power/plan', body)
    confirmed.a = false
    confirmed.b = false
    stage.value = 'briefing'
  } catch (error) {
    loadError.value = error.body || error.message
  } finally {
    loading.value = false
  }
}

const backToSetup = () => {
  stopTicker()
  stage.value = 'setup'
  plan.value = null
  current.value = null
}

const startRound = () => {
  available.value = [...plan.value.pool]
  usedIds.value = []
  current.value = null
  remaining.value = plan.value.durationSec
  // 基于时间戳倒计时：标签页被节流时显示值仍然准确
  endsAt = Date.now() + plan.value.durationSec * 1000
  ticker = setInterval(tick, 250)
  stage.value = 'running'
}

const tick = () => {
  remaining.value = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
  if (remaining.value <= 0) finishRound(false)
}

const stopTicker = () => {
  if (ticker) clearInterval(ticker)
  ticker = null
}

const drawInstruction = () => {
  if (available.value.length === 0) return
  const index = Math.floor(Math.random() * available.value.length)
  current.value = available.value.splice(index, 1)[0]
  usedIds.value.push(current.value.itemId)
}

const finishRound = async (stoppedEarly) => {
  stopTicker()

  const actualSec = Math.min(
    Math.max(Math.round((Date.now() - (endsAt - plan.value.durationSec * 1000)) / 1000), 0),
    plan.value.durationSec
  )
  const used = usedIds.value.map((id) => plan.value.pool.find((i) => i.itemId === id)).filter(Boolean)

  result.value = { actualSec, plannedSec: plan.value.durationSec, stoppedEarly, used }
  stage.value = 'done'

  try {
    await postJSON('/api/couple/power/log', {
      leader: plan.value.leader,
      durationSec: actualSec,
      plannedSec: plan.value.durationSec,
      stoppedEarly,
      instructionsUsed: usedIds.value,
      cap: plan.value.cap,
      capSource: plan.value.capSource
    })
    const log = await apiJSON('/api/couple/power/log')
    recent.value = (log.rounds || []).slice(0, 5)
  } catch (error) {
    loadError.value = `本轮记录保存失败：${error.message}`
  }
}

const stopRound = () => finishRound(true)

const saveItem = async (item) => {
  if (saved[item.itemId]) return
  try {
    await postJSON('/api/couple/wishlist', { itemId: item.itemId, source: 'power-play' })
    saved[item.itemId] = true
  } catch (error) {
    loadError.value = `收藏失败：${error.message}`
  }
}

const again = async () => {
  // 抽定模式下自动交换主导方；用户在设置里明确指定过就尊重指定
  if (setup.leader === null && plan.value) {
    leaderOverride = plan.value.leader === 'a' ? 'b' : 'a'
  }
  await toBriefing()
}

onUnmounted(stopTicker)
</script>

<style scoped>
.pp-title {
  font-size: var(--lg-fs-xl);
  font-weight: 700;
  color: var(--lg-ink);
  text-align: center;
}

.pp-title--sm {
  font-size: var(--lg-fs-lg);
}

.pp-lead {
  font-size: var(--lg-fs-sm);
  line-height: 1.85;
  color: var(--lg-muted);
}

.pp-lead strong {
  color: var(--lg-ink-soft);
}

.pp-lead--center {
  text-align: center;
}

.pp-setup,
.pp-brief,
.pp-done {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.pp-field {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.pp-field__label {
  font-size: var(--lg-fs-sm);
  font-weight: 600;
  color: var(--lg-muted);
}

.pp-field__hint {
  font-size: var(--lg-fs-xs);
  line-height: 1.6;
  color: var(--lg-faint);
}

.pp-recent ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.pp-stopped {
  color: var(--lg-warn-ink);
}

/* ---- 简报 ---- */

.pp-roles {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--lg-sp-3);
  flex-wrap: wrap;
}

.pp-role {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 88px;
  padding: var(--lg-sp-3);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-r-md);
  background: var(--lg-surface-sunken);
}

.pp-role--lead {
  border-color: color-mix(in srgb, var(--lg-accent) 50%, transparent);
  background: color-mix(in srgb, var(--lg-accent) 10%, transparent);
}

.pp-role__emoji {
  font-size: 26px;
  line-height: 1;
}

.pp-role__name {
  font-size: var(--lg-fs-sm);
  font-weight: 700;
  color: var(--lg-ink);
}

.pp-role__who {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.pp-roles__arrow {
  color: var(--lg-faint);
  font-size: var(--lg-fs-lg);
}

.pp-block {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.pp-block__title {
  font-size: var(--lg-fs-sm);
  font-weight: 650;
  color: var(--lg-ink);
}

.pp-block__note {
  font-size: var(--lg-fs-xs);
  line-height: 1.7;
  color: var(--lg-faint);
}

.pp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lg-sp-2);
}

.pp-chip--no {
  border-color: var(--lg-danger-border);
  background: var(--lg-danger-bg);
  color: var(--lg-danger-ink);
}

.pp-pool {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.pp-pool li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-2) var(--lg-sp-3);
  border-radius: var(--lg-r-sm);
  background: var(--lg-surface-sunken);
}

.pp-pool__text {
  flex: 1;
  font-size: var(--lg-fs-sm);
  line-height: 1.6;
  color: var(--lg-ink-soft);
}

.pp-pool__meta {
  flex-shrink: 0;
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
  text-align: right;
}

.pp-pool__meta em {
  font-style: normal;
  font-weight: 650;
}

.pp-pool__tag--agreed {
  color: var(--lg-ok-ink);
}

.pp-pool__tag--lib {
  color: var(--lg-muted);
}

.pp-confirm {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lg-sp-2);
}

.pp-confirm__btn {
  font-size: var(--lg-fs-sm);
}

.pp-actions {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

/* ---- 进行中 ---- */

.pp-run {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
}

.pp-timer-card {
  padding: var(--lg-sp-4);
  text-align: center;
}

.pp-timer {
  font-size: 56px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--lg-accent);
}

.pp-timer.is-low {
  color: var(--lg-warn-ink);
}

.pp-timer__meta {
  margin-top: var(--lg-sp-1);
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.pp-limits {
  text-align: center;
  font-weight: 600;
}

.pp-instruction {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  text-align: center;
  min-height: 180px;
  justify-content: center;
}

.pp-instruction__text {
  font-size: var(--lg-fs-lg);
  line-height: 1.75;
  color: var(--lg-ink);
}

.pp-instruction__props {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.pp-instruction__hint {
  font-size: var(--lg-fs-sm);
  line-height: 1.8;
  color: var(--lg-muted);
}

/* 钉在视口底部：内容够长时它会浮在页面下沿，滚到末尾再归位。
   底部留出 iOS 安全区，别让 Home 指示条盖住按钮。 */
.pp-stopbar {
  position: sticky;
  bottom: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
  padding: var(--lg-sp-3) 0 calc(var(--lg-sp-3) + var(--lg-safe-b));
  background: linear-gradient(180deg, transparent, var(--lg-surface-sunken) 30%);
}

.pp-stop {
  width: 100%;
  padding: var(--lg-sp-4);
  border: 2px solid var(--lg-danger-border);
  border-radius: var(--lg-r-md);
  background: var(--lg-danger-bg);
  color: var(--lg-danger-ink);
  font-family: inherit;
  font-size: var(--lg-fs-lg);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

/* 触屏上没有悬停，iOS 还会把 :hover 粘在按钮上 */
@media (hover: hover) and (pointer: fine) {
  .pp-stop:hover {
    background: color-mix(in srgb, var(--lg-danger-ink) 18%, transparent);
  }
}

.pp-stop:active {
  transform: scale(0.99);
}

.pp-stop__note {
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
  text-align: center;
}

/* ---- 结算 ---- */

.pp-done {
  align-items: stretch;
}

.pp-done__emoji {
  font-size: 52px;
  line-height: 1;
  text-align: center;
}

.pp-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--lg-sp-2);
}

.pp-stats > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--lg-sp-2) var(--lg-sp-3);
  border-radius: var(--lg-r-sm);
  background: var(--lg-surface-sunken);
}

.pp-stats dt {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.pp-stats dd {
  margin: 0;
  font-size: var(--lg-fs-md);
  font-weight: 650;
  color: var(--lg-ink);
}

.pp-aftercare {
  line-height: 1.8;
}

@media (max-width: 640px) {
  .pp-confirm {
    grid-template-columns: 1fr;
  }

  .pp-pool li {
    flex-direction: column;
    gap: 2px;
  }

  .pp-pool__meta {
    text-align: left;
  }

  .pp-timer {
    font-size: 44px;
  }
}

/* 手机横屏：宽度充裕但纵向很紧（iPhone 横屏可视高只有 ~290–350px），
   把计时器压小、间距收紧，让进行中这一屏尽量少滚动。
   叫停本身已经 sticky 钉底，不依赖这里就能按到。 */
@media (max-height: 500px) {
  .pp-run {
    gap: var(--lg-sp-2);
  }

  .pp-timer {
    font-size: 34px;
  }

  .pp-timer-card {
    padding: var(--lg-sp-2) var(--lg-sp-4);
  }
}
</style>
