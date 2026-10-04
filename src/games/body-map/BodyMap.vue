<template>
  <div class="lg-shell theme-body-map">
    <GameToolbar title="身体地图" icon="🗺️">
      <template #actions>
        <button
          v-if="stage === 'overlay'"
          class="lg-btn lg-btn--quiet lg-btn--sm"
          type="button"
          @click="stage = 'intro'"
        >
          ← 返回
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <p v-if="loadError" class="lg-notice lg-notice--danger">{{ loadError }}</p>

      <!-- 说明与入口 -->
      <section v-if="stage === 'intro'" class="lg-card bm-intro">
        <h1 class="bm-title">🗺️ 身体地图</h1>
        <p class="bm-lead">
          两人<strong>各自私密</strong>在人体分区图上标注「喜欢 / 一般 / 禁区」，
          双方都标完之后才叠加显示结果。标注对方时看不到你的选择，
          所以可以放心标真实感受。结果会长期保存，越用越准。
        </p>

        <div class="bm-status">
          <div v-for="p in PLAYERS_META" :key="p.key" class="bm-status__card" :class="{ 'is-done': markCount(p.key) > 0 }">
            <span class="bm-status__emoji">{{ p.emoji }}</span>
            <span class="bm-status__name">{{ p.name }}</span>
            <span class="bm-status__count">
              {{ markCount(p.key) > 0 ? `已标注 ${markCount(p.key)} 区` : '尚未标注' }}
            </span>
          </div>
        </div>

        <div class="bm-actions">
          <button v-if="nextToMark" class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="beginMarking">
            {{ bothMarked ? '重新标注' : `开始标注（${nextToMark.emoji} 先来）` }}
          </button>
          <button
            v-if="bothMarked"
            class="lg-btn lg-btn--ghost lg-btn--block"
            type="button"
            @click="showOverlay"
          >
            💞 查看叠加结果
          </button>
        </div>

        <p v-if="updatedAt" class="bm-meta">上次更新：{{ formattedUpdated }}</p>
      </section>

      <!-- 标注 -->
      <template v-else-if="stage === 'mark'">
        <HandoverMask
          v-if="!markingReady"
          :title="`请把设备交给 ${activePlayerMeta.emoji} ${activePlayerMeta.name}`"
          description="另一方已经标完并保存。现在开始你的私密标注，看不到对方的任何选择。"
          :confirm-text="`我是 ${activePlayerMeta.emoji}，开始标注`"
          @ready="markingReady = true"
        />

        <section v-else class="lg-card bm-mark">
          <header class="bm-mark__head">
            <h2 class="bm-title bm-title--sm">
              {{ activePlayerMeta.emoji }} {{ activePlayerMeta.name }} 的私密标注
            </h2>
            <div class="lg-segment">
              <button
                v-for="(view, key) in VIEWS"
                :key="key"
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': activeView === key }"
                @click="activeView = key"
              >{{ view.label }}</button>
            </div>
          </header>

          <div class="bm-canvas">
            <svg viewBox="0 0 200 440" class="bm-svg" role="group" aria-label="身体分区图">
              <g v-for="zone in VIEWS[activeView].zones" :key="zone.id">
                <rect
                  v-for="(shape, i) in zone.shapes"
                  :key="i"
                  :x="shape.x"
                  :y="shape.y"
                  :width="shape.w"
                  :height="shape.h"
                  :rx="shape.rx"
                  class="bm-zone"
                  :style="{ fill: markFill(draft[zone.id]) }"
                  @click="cycle(zone.id)"
                />
                <title>{{ zone.label }}</title>
              </g>
            </svg>

            <div class="bm-legend">
              <p class="bm-legend__title">点击区块切换标注</p>
              <ul>
                <li v-for="m in MARK_VALUES" :key="m.value">
                  <span class="bm-swatch" :style="{ background: markFill(m.value) }"></span>
                  {{ m.icon }} {{ m.label }}
                </li>
                <li>
                  <span class="bm-swatch" :style="{ background: markFill(null) }"></span>
                  ⬜ 未标注
                </li>
              </ul>
              <p class="bm-legend__count">
                已标 {{ Object.keys(draft).length }} / {{ ALL_ZONES.length }} 区
              </p>
            </div>
          </div>

          <div class="bm-zone-list">
            <span
              v-for="zone in VIEWS[activeView].zones"
              :key="zone.id"
              class="lg-badge"
              :class="{ 'lg-badge--accent': draft[zone.id] === 'like' }"
            >
              {{ zone.label }}：{{ markLabel(draft[zone.id]) }}
            </span>
          </div>

          <div class="bm-actions">
            <button class="lg-btn lg-btn--primary lg-btn--block" type="button" :disabled="saving" @click="saveMarks">
              {{ saving ? '保存中…' : '保存我的标注' }}
            </button>
            <button class="lg-btn lg-btn--quiet" type="button" @click="stage = 'intro'">取消</button>
          </div>
        </section>
      </template>

      <!-- 叠加结果 -->
      <section v-else-if="stage === 'overlay'" class="lg-card bm-overlay">
        <h2 class="bm-title bm-title--sm">💞 叠加结果</h2>

        <div class="bm-cats">
          <div v-for="(meta, key) in CATEGORIES" :key="key" class="bm-cat" :class="`is-${meta.tone}`">
            <span class="bm-cat__num">{{ countOf(key) }}</span>
            <span class="bm-cat__label">{{ meta.icon }} {{ meta.label }}</span>
          </div>
        </div>

        <div class="bm-canvas">
          <svg viewBox="0 0 200 440" class="bm-svg" role="img" aria-label="共识叠加图">
            <g v-for="zone in VIEWS[activeView].zones" :key="zone.id">
              <rect
                v-for="(shape, i) in zone.shapes"
                :key="i"
                :x="shape.x"
                :y="shape.y"
                :width="shape.w"
                :height="shape.h"
                :rx="shape.rx"
                class="bm-zone bm-zone--static"
                :style="{ fill: categoryFill(categoryOf(zone.id)) }"
              />
            </g>
          </svg>
          <div class="bm-legend">
            <div class="lg-segment">
              <button
                v-for="(view, key) in VIEWS"
                :key="key"
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': activeView === key }"
                @click="activeView = key"
              >{{ view.label }}</button>
            </div>
            <ul>
              <li v-for="(meta, key) in CATEGORIES" :key="key">
                <span class="bm-swatch" :style="{ background: categoryFill(key) }"></span>
                {{ meta.icon }} {{ meta.label }}
              </li>
            </ul>
          </div>
        </div>

        <div v-for="(meta, key) in CATEGORIES" :key="key" class="bm-group">
          <template v-if="zonesIn(key).length">
            <h3 class="bm-group__title">{{ meta.icon }} {{ meta.label }} <small>{{ meta.hint }}</small></h3>
            <div class="bm-zone-list">
              <span v-for="z in zonesIn(key)" :key="z.zoneId" class="lg-badge" :class="{ 'lg-badge--accent': key === 'consensus' }">
                {{ z.label }}
                <small v-if="key === 'talk'">（{{ z.a === 'like' ? '💖喜欢' : '💙喜欢' }} / 另一方{{ markLabel(z.a === 'like' ? z.b : z.a) }}）</small>
              </span>
            </div>
          </template>
        </div>

        <p class="lg-notice bm-tip">
          「沟通区」不是问题清单，是话题清单 —— 一方喜欢而另一方犹豫的地方，
          往往是聊一次就能变成共识的地方。不想聊的直接跳过就行。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import GameToolbar from '../../shared/GameToolbar.vue'
import HandoverMask from '../../shared/HandoverMask.vue'
import { apiJSON, putJSON } from '../../shared/api.js'
import { ALL_ZONES, CATEGORIES, MARK_VALUES, VIEWS, nextMark, overlayMarks } from '../../shared/body-zones.js'

const PLAYERS_META = [
  { key: 'a', emoji: '💖', name: '一方' },
  { key: 'b', emoji: '💙', name: '另一方' }
]

const marks = reactive({ a: {}, b: {} })
const draft = reactive({})
const stage = ref('intro')
const activeView = ref('front')
const activePlayer = ref('a')
const markingReady = ref(false)
const saving = ref(false)
const loadError = ref('')
const updatedAt = ref(null)
const overlay = ref([])

const activePlayerMeta = computed(() => PLAYERS_META.find((p) => p.key === activePlayer.value))
const markCount = (key) => Object.keys(marks[key] || {}).length
const bothMarked = computed(() => markCount('a') > 0 && markCount('b') > 0)
const nextToMark = computed(() => {
  if (markCount('a') === 0) return PLAYERS_META[0]
  if (markCount('b') === 0) return PLAYERS_META[1]
  return PLAYERS_META[0]
})

const formattedUpdated = computed(() =>
  updatedAt.value ? new Date(updatedAt.value).toLocaleString('zh-CN') : ''
)

const TOKEN_FILLS = {
  accent: 'color-mix(in srgb, var(--lg-accent) 72%, transparent)',
  muted: 'color-mix(in srgb, var(--lg-muted) 34%, transparent)',
  danger: 'color-mix(in srgb, var(--lg-danger-ink) 52%, transparent)',
  warn: 'color-mix(in srgb, var(--lg-warn-ink) 48%, transparent)',
  faint: 'color-mix(in srgb, var(--lg-ink) 7%, transparent)'
}

const markFill = (value) => ({
  like: TOKEN_FILLS.accent,
  ok: TOKEN_FILLS.muted,
  no: TOKEN_FILLS.danger
}[value] || TOKEN_FILLS.faint)

const categoryFill = (category) => TOKEN_FILLS[CATEGORIES[category]?.tone] || TOKEN_FILLS.faint

const markLabel = (value) => MARK_VALUES.find((m) => m.value === value)?.label || '未标注'

const categoryOf = (zoneId) => overlay.value.find((z) => z.zoneId === zoneId)?.category || 'unset'
const zonesIn = (category) => overlay.value.filter((z) => z.category === category)
const countOf = (category) => zonesIn(category).length

const load = async () => {
  try {
    const data = await apiJSON('/api/couple/body-map')
    marks.a = data.marks?.a || {}
    marks.b = data.marks?.b || {}
    updatedAt.value = data.updatedAt
    loadError.value = ''
  } catch (error) {
    loadError.value = `加载身体地图失败：${error.message}`
  }
}

onMounted(load)

const beginMarking = () => {
  activePlayer.value = nextToMark.value.key
  for (const key of Object.keys(draft)) delete draft[key]
  // 从已保存的标注继续编辑，而不是每次从空白开始
  Object.assign(draft, marks[activePlayer.value] || {})
  // 只有对方已经标过时才需要交接遮挡 —— 那才是有东西要藏的时候
  const other = activePlayer.value === 'a' ? 'b' : 'a'
  markingReady.value = markCount(other) === 0
  activeView.value = 'front'
  stage.value = 'mark'
}

const cycle = (zoneId) => {
  const value = nextMark(draft[zoneId])
  if (value === null) delete draft[zoneId]
  else draft[zoneId] = value
}

const saveMarks = async () => {
  saving.value = true
  try {
    const data = await putJSON('/api/couple/body-map', {
      player: activePlayer.value,
      marks: { ...draft }
    })
    marks.a = data.marks?.a || {}
    marks.b = data.marks?.b || {}
    updatedAt.value = data.updatedAt

    // 另一方还没标 → 交接；双方都标完 → 直接看结果
    if (bothMarked.value) {
      showOverlay()
    } else {
      activePlayer.value = activePlayer.value === 'a' ? 'b' : 'a'
      for (const key of Object.keys(draft)) delete draft[key]
      Object.assign(draft, marks[activePlayer.value] || {})
      markingReady.value = false
    }
  } catch (error) {
    loadError.value = `保存失败：${error.message}`
  } finally {
    saving.value = false
  }
}

const showOverlay = () => {
  overlay.value = overlayMarks(marks.a, marks.b)
  activeView.value = 'front'
  stage.value = 'overlay'
}
</script>

<style scoped>
.bm-title {
  font-size: var(--lg-fs-xl);
  font-weight: 700;
  color: var(--lg-ink);
  text-align: center;
}

.bm-title--sm {
  font-size: var(--lg-fs-lg);
}

.bm-lead {
  font-size: var(--lg-fs-sm);
  line-height: 1.85;
  color: var(--lg-muted);
}

.bm-lead strong {
  color: var(--lg-ink-soft);
}

.bm-intro,
.bm-mark,
.bm-overlay {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.bm-meta {
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
  text-align: center;
}

.bm-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--lg-sp-3);
}

.bm-status__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--lg-sp-3);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-r-md);
  background: var(--lg-surface-sunken);
  color: var(--lg-faint);
}

.bm-status__card.is-done {
  border-color: color-mix(in srgb, var(--lg-accent) 45%, transparent);
  background: color-mix(in srgb, var(--lg-accent) 9%, transparent);
  color: var(--lg-ink);
}

.bm-status__emoji {
  font-size: 26px;
  line-height: 1;
}

.bm-status__name {
  font-size: var(--lg-fs-sm);
  font-weight: 650;
}

.bm-status__count {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.bm-actions {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.bm-mark__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  flex-wrap: wrap;
}

.bm-canvas {
  display: flex;
  gap: var(--lg-sp-4);
  align-items: flex-start;
  justify-content: center;
  flex-wrap: wrap;
}

.bm-svg {
  width: 200px;
  height: 440px;
  flex-shrink: 0;
}
.bm-zone {
  cursor: pointer;
  stroke: var(--lg-border-strong);
  stroke-width: 1;
  transition: fill 0.18s ease, opacity 0.18s ease;
}

/* iOS 点完格子会把 :hover 留在身上，那块会一直发暗 */
@media (hover: hover) and (pointer: fine) {
  .bm-zone:hover {
    opacity: 0.78;
  }
}

.bm-zone--static {
  cursor: default;
}

.bm-legend {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.bm-legend__title {
  font-weight: 650;
  color: var(--lg-ink-soft);
}

.bm-legend ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bm-legend li {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
}

.bm-swatch {
  width: 16px;
  height: 16px;
  border-radius: var(--lg-r-xs);
  border: 1px solid var(--lg-border-strong);
  flex-shrink: 0;
}

.bm-legend__count {
  color: var(--lg-faint);
}

.bm-zone-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lg-sp-2);
}

.bm-zone-list small {
  color: var(--lg-muted);
}

.bm-cats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--lg-sp-2);
}

.bm-cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--lg-sp-2);
  border-radius: var(--lg-r-sm);
  border: 1px solid var(--lg-border);
  background: var(--lg-surface-sunken);
}

.bm-cat__num {
  font-size: var(--lg-fs-lg);
  font-weight: 700;
  color: var(--lg-ink);
}

.bm-cat__label {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.bm-cat.is-accent { border-color: color-mix(in srgb, var(--lg-accent) 45%, transparent); }
.bm-cat.is-accent .bm-cat__num { color: var(--lg-accent); }
.bm-cat.is-warn { border-color: var(--lg-warn-border); }
.bm-cat.is-warn .bm-cat__num { color: var(--lg-warn-ink); }
.bm-cat.is-danger { border-color: var(--lg-danger-border); }
.bm-cat.is-danger .bm-cat__num { color: var(--lg-danger-ink); }

.bm-group__title {
  margin-bottom: var(--lg-sp-2);
  font-size: var(--lg-fs-sm);
  font-weight: 650;
  color: var(--lg-ink);
}

.bm-group__title small {
  font-weight: 400;
  color: var(--lg-muted);
}

.bm-tip {
  margin-top: var(--lg-sp-2);
}

@media (max-width: 640px) {
  .bm-canvas {
    flex-direction: column;
    align-items: center;
  }
}

/* 横屏的手机：440px 高的身体图会把页面顶出可视区，得整套图一起等比缩小。
   SVG 带 viewBox，所以 width: auto 会按 200:440 的固有比例反推，
   分区形状和点击热区同步缩放，不会错位。 */
@media (max-height: 500px) {
  .bm-svg {
    width: auto;
    height: calc(100dvh - var(--lg-toolbar-h) - var(--lg-sp-6));
  }
}
</style>
