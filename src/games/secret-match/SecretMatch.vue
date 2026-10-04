<template>
  <div class="lg-shell theme-secret-match">
    <GameToolbar title="默契解锁" icon="🎴">
      <template #actions>
        <span v-if="stage !== 'setup'" class="sm-progress">
          {{ Math.min(cardIndex + 1, cards.length) }} / {{ cards.length }}
        </span>
        <button v-if="stage !== 'setup'" class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="quit">
          退出
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <!-- 设置 -->
      <section v-if="stage === 'setup'" class="lg-card sm-setup">
        <h1 class="sm-title">🎴 默契解锁</h1>
        <p class="sm-lead">
          每张卡有若干选项，你们各自秘密选一个，同时揭晓。
          <strong>选中同一项才会显示内容</strong>；没对上只会告诉你「没对上」，
          不会暴露对方选了什么 —— 所以可以放心选真实想要的。
        </p>

        <div class="sm-field">
          <span class="sm-field__label">内容档位</span>
          <div class="lg-segment">
            <button
              v-for="(meta, key) in tiers"
              :key="key"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.tier === key }"
              @click="setup.tier = key"
            >{{ meta.icon }} {{ meta.label }}</button>
          </div>
        </div>

        <div class="sm-field">
          <span class="sm-field__label">强度上限</span>
          <div class="lg-segment">
            <button
              v-for="n in intensityOptions"
              :key="n"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.maxIntensity === n }"
              @click="setup.maxIntensity = n"
            >{{ n }}</button>
          </div>
          <span class="sm-field__hint">{{ intensityHint }}</span>
        </div>

        <div class="sm-field">
          <span class="sm-field__label">卡片数</span>
          <div class="lg-segment">
            <button
              v-for="n in [3, 5, 8]"
              :key="n"
              type="button"
              class="lg-segment__item"
              :class="{ 'is-active': setup.cards === n }"
              @click="setup.cards = n"
            >{{ n }}</button>
          </div>
        </div>

        <div class="sm-field">
          <span class="sm-field__label">只用现成能做的</span>
          <div class="sm-field__control">
            <label class="lg-switch">
              <input type="checkbox" v-model="setup.noProps">
              <span class="lg-switch__track"></span>
            </label>
            <span class="sm-field__hint">开启后排除需要道具的条目（眼罩、冰块、情趣内衣等）</span>
          </div>
        </div>

        <p v-if="setupError" class="lg-notice lg-notice--danger">{{ setupError }}</p>

        <button class="lg-btn lg-btn--primary lg-btn--block" type="button" :disabled="loading" @click="start">
          {{ loading ? '正在组卡…' : '开始' }}
        </button>
      </section>

      <!-- 选择阶段 -->
      <section v-else-if="stage === 'pickA' || stage === 'pickB'" class="lg-card sm-pick">
        <p class="sm-turn">
          <span class="sm-turn__emoji">{{ currentPicker === 'a' ? '💖' : '💙' }}</span>
          由 {{ currentPicker === 'a' ? '💖 一方' : '💙 另一方' }} 选择
        </p>
        <p class="sm-card-meta">
          第 {{ cardIndex + 1 }} 张 · 强度 {{ currentCard.intensity }}
        </p>
        <p class="sm-pick__hint">只有你看到自己的选择，对方不会知道你选了什么</p>

        <div class="sm-options">
          <button
            v-for="option in currentCard.options"
            :key="option.itemId"
            type="button"
            class="sm-option"
            :class="{ 'is-picked': currentPick === option.itemId }"
            @click="currentPick = option.itemId"
          >
            <span class="sm-option__text">{{ option.text }}</span>
            <span class="sm-option__meta">
              {{ option.dimensionLabel }}
              <template v-if="option.props.length"> · 需 {{ option.props.join('、') }}</template>
            </span>
          </button>
        </div>

        <button
          class="lg-btn lg-btn--primary lg-btn--block"
          type="button"
          :disabled="!currentPick"
          @click="confirmPick"
        >
          就选这个
        </button>
      </section>

      <!-- 交接 -->
      <HandoverMask
        v-else-if="stage === 'handover'"
        title="请把设备交给对方"
        description="💖 已经选好了。现在轮到 💙 选择，看不到对方的答案。"
        confirm-text="我是 💙，开始选择"
        @ready="beginPickB"
      />

      <!-- 揭晓 -->
      <section v-else-if="stage === 'reveal'" class="lg-card sm-reveal">
        <template v-if="lastResult.matched">
          <p class="sm-reveal__emoji">💞</p>
          <h2 class="sm-title sm-title--accent">对上了！</h2>
          <p class="sm-unlocked">{{ lastResult.text }}</p>
          <span class="lg-badge lg-badge--accent">
            {{ lastResult.dimensionLabel }} · 强度 {{ lastResult.intensity }}
          </span>
          <button
            class="lg-btn lg-btn--ghost lg-btn--block"
            type="button"
            :disabled="lastResult.saved"
            @click="saveToWishlist(lastResult)"
          >
            {{ lastResult.saved ? '✓ 已在愿望清单' : '♡ 加入愿望清单' }}
          </button>
        </template>

        <template v-else>
          <p class="sm-reveal__emoji">🌫️</p>
          <h2 class="sm-title">这次没对上</h2>
          <p class="sm-lead sm-lead--center">
            你们选的不是同一项。按规则不显示各自选了什么 ——
            这不是失败，下一张再试。
          </p>
        </template>

        <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="nextCard">
          {{ cardIndex + 1 >= cards.length ? '看本轮结果' : '下一张卡' }}
        </button>
      </section>

      <!-- 结算 -->
      <section v-else-if="stage === 'done'" class="lg-card sm-done">
        <h2 class="sm-title">本轮结果</h2>        <p class="sm-score">
          对上 <strong>{{ matched.length }}</strong> / {{ cards.length }} 张
          <span class="sm-rate">默契度 {{ matchRate }}%</span>
        </p>

        <div v-if="matched.length" class="sm-unlocked-list">
          <div v-for="item in matched" :key="item.itemId" class="sm-unlocked-row">
            <span class="sm-unlocked-row__text">{{ item.text }}</span>
            <button
              class="lg-btn lg-btn--quiet lg-btn--sm"
              type="button"
              :disabled="item.saved"
              @click="saveToWishlist(item)"
            >{{ item.saved ? '✓' : '♡ 收藏' }}</button>
          </div>
          <button class="lg-btn lg-btn--ghost lg-btn--block" type="button" @click="saveAll">
            全部加入愿望清单
          </button>
        </div>

        <p v-else class="lg-notice">
          这轮一张都没对上。可以试着调低强度上限，或者换一档内容再来。
        </p>

        <div class="sm-actions">
          <button class="lg-btn lg-btn--primary" type="button" @click="again">再来一轮</button>
          <button class="lg-btn lg-btn--ghost" type="button" @click="stage = 'setup'">改设置</button>
        </div>
      </section>

      <p v-if="setupError && stage !== 'setup'" class="lg-notice lg-notice--danger sm-error">
        {{ setupError }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import GameToolbar from '../../shared/GameToolbar.vue'
import HandoverMask from '../../shared/HandoverMask.vue'
import { apiJSON, postJSON } from '../../shared/api.js'

const INTENSITY_HINTS = {
  1: '只有日常亲密',
  2: '到浪漫表达为止',
  3: '含情欲意味但非直接',
  4: '含直接的性相关行为',
  5: '不设上限'
}

const tiers = ref({})
const setup = reactive({ tier: 'couple', maxIntensity: 5, cards: 5, noProps: false })
const loading = ref(false)
const setupError = ref('')

const stage = ref('setup')
const cards = ref([])
const cardIndex = ref(0)
const currentPicker = ref('a')
const currentPick = ref(null)
const pickA = ref(null)
const results = ref([])

const intensityOptions = computed(() => {
  const max = setup.tier === 'basic' ? 2 : 5
  return [1, 2, 3, 4, 5].filter((n) => n <= max)
})

const intensityHint = computed(() => INTENSITY_HINTS[setup.maxIntensity] || '')
const currentCard = computed(() => cards.value[cardIndex.value] || { options: [], intensity: 0 })
const matched = computed(() => results.value.filter((r) => r.matched))
const matchRate = computed(() =>
  cards.value.length ? Math.round((matched.value.length / cards.value.length) * 100) : 0
)
const lastResult = computed(() => results.value[results.value.length - 1] || {})

onMounted(async () => {
  try {
    const meta = await apiJSON('/api/couple/content/meta')
    tiers.value = meta.tiers
  } catch (error) {
    setupError.value = `加载内容库失败：${error.message}`
  }
})

const start = async () => {
  loading.value = true
  setupError.value = ''
  try {
    const data = await postJSON('/api/couple/content/cards', {
      tier: setup.tier,
      cards: setup.cards,
      optionsPerCard: 4,
      maxIntensity: setup.maxIntensity,
      requireNoProps: setup.noProps
    })
    if (data.cards.length === 0) throw new Error('没有生成任何卡片')

    cards.value = data.cards
    cardIndex.value = 0
    results.value = []
    currentPick.value = null
    pickA.value = null
    currentPicker.value = 'a'
    stage.value = 'pickA'
  } catch (error) {
    setupError.value = error.body || error.message
  } finally {
    loading.value = false
  }
}

const confirmPick = () => {
  if (currentPicker.value === 'a') {
    pickA.value = currentPick.value
    currentPick.value = null
    stage.value = 'handover'
  } else {
    resolveRound(currentPick.value)
    currentPick.value = null
  }
}

const beginPickB = () => {
  currentPicker.value = 'b'
  stage.value = 'pickB'
}

const resolveRound = (pickB) => {
  const card = currentCard.value
  const isMatch = pickA.value === pickB
  // 关键：不匹配时只记录「没对上」，绝不记录对方选了什么
  const option = card.options.find((o) => o.itemId === pickA.value)

  results.value.push(
    isMatch
      ? {
        matched: true,
        itemId: option.itemId,
        text: option.text,
        dimensionLabel: option.dimensionLabel,
        intensity: card.intensity,
        saved: false
      }
      : { matched: false }
  )

  stage.value = 'reveal'
}

const nextCard = () => {
  if (cardIndex.value + 1 >= cards.value.length) {
    stage.value = 'done'
    return
  }
  cardIndex.value += 1
  pickA.value = null
  currentPick.value = null
  currentPicker.value = 'a'
  stage.value = 'pickA'
}

const saveToWishlist = async (item) => {
  if (item.saved) return
  try {
    await postJSON('/api/couple/wishlist', { itemId: item.itemId, source: 'secret-match' })
    item.saved = true
  } catch (error) {
    setupError.value = `收藏失败：${error.message}`
  }
}

const saveAll = async () => {
  for (const item of matched.value) {
    await saveToWishlist(item)
  }
}

const again = async () => {
  stage.value = 'setup'
  await start()
}

const quit = () => {
  stage.value = 'setup'
  cards.value = []
  results.value = []
  cardIndex.value = 0
}
</script>

<style scoped>
.sm-title {
  font-size: var(--lg-fs-xl);
  font-weight: 700;
  color: var(--lg-ink);
  text-align: center;
}

.sm-title--accent {
  color: var(--lg-accent);
}

.sm-lead {
  font-size: var(--lg-fs-sm);
  line-height: 1.8;
  color: var(--lg-muted);
}

.sm-lead--center {
  text-align: center;
}

.sm-lead strong {
  color: var(--lg-ink-soft);
}

.sm-setup {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.sm-field {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.sm-field__label {
  font-size: var(--lg-fs-sm);
  font-weight: 600;
  color: var(--lg-muted);
}

.sm-field__control {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-2);
}

.sm-field__hint {
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
}

.sm-progress {
  font-size: var(--lg-fs-sm);
  color: var(--lg-muted);
}

.sm-pick,
.sm-reveal,
.sm-done {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.sm-turn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--lg-sp-2);
  font-size: var(--lg-fs-lg);
  font-weight: 650;
  color: var(--lg-ink);
}

.sm-turn__emoji {
  font-size: 28px;
}

.sm-card-meta {
  text-align: center;
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.sm-pick__hint {
  text-align: center;
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
}

.sm-options {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.sm-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--lg-sp-3) var(--lg-sp-4);
  border: 1px solid var(--lg-border-strong);
  border-radius: var(--lg-r-md);
  background: var(--lg-surface);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.18s ease, background 0.18s ease, transform 0.18s ease;
}

/* 触屏无悬停，iOS 还会把 :hover 粘在选中的选项上 */
@media (hover: hover) and (pointer: fine) {
  .sm-option:hover {
    border-color: var(--lg-accent);
  }
}

.sm-option.is-picked {
  border-color: var(--lg-accent);
  background: color-mix(in srgb, var(--lg-accent) 12%, transparent);
  transform: translateX(2px);
}

.sm-option__text {
  font-size: var(--lg-fs-md);
  line-height: 1.6;
  color: var(--lg-ink);
}

.sm-option__meta {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.sm-reveal {
  align-items: center;
  text-align: center;
}

.sm-reveal__emoji {
  font-size: 56px;
  line-height: 1;
}

.sm-unlocked {
  padding: var(--lg-sp-4);
  border-radius: var(--lg-r-md);
  background: var(--lg-gradient);
  color: var(--lg-on-accent);
  font-size: var(--lg-fs-lg);
  line-height: 1.7;
  box-shadow: var(--lg-sh-accent);
}

.sm-score {
  text-align: center;
  font-size: var(--lg-fs-md);
  color: var(--lg-muted);
}

.sm-score strong {
  font-size: var(--lg-fs-xl);
  color: var(--lg-accent);
}

.sm-rate {
  display: block;
  margin-top: var(--lg-sp-1);
  font-size: var(--lg-fs-xs);
}

.sm-unlocked-list {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.sm-unlocked-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-2) var(--lg-sp-3);
  border-radius: var(--lg-r-sm);
  background: var(--lg-surface-sunken);
}

.sm-unlocked-row__text {
  font-size: var(--lg-fs-sm);
  line-height: 1.6;
  color: var(--lg-ink-soft);
}

.sm-actions {
  display: flex;
  gap: var(--lg-sp-3);
  justify-content: center;
  flex-wrap: wrap;
}

.sm-error {
  margin-top: var(--lg-sp-4);
}
</style>
