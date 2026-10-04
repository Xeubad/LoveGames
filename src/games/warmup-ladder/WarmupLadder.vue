<template>
  <div class="lg-shell theme-warmup-ladder">
    <GameToolbar title="升温阶梯" icon="🪜">
      <template #actions>
        <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="confirmReset">
          重置进度
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <p v-if="loadError" class="lg-notice lg-notice--danger">{{ loadError }}</p>

      <template v-if="ladder">
        <!-- 顶部概况 -->
        <section class="lg-card wl-summary">
          <div class="wl-summary__item">
            <span class="wl-summary__num">{{ ladder.currentLevel }}</span>
            <span class="wl-summary__label">当前级</span>
          </div>
          <div class="wl-summary__item">
            <span class="wl-summary__num">{{ ladder.highestPassed }}</span>
            <span class="wl-summary__label">已通过</span>
          </div>
          <div class="wl-summary__item">
            <span class="wl-summary__num">{{ ladder.agreedItems.length }}</span>
            <span class="wl-summary__label">共识条目</span>
          </div>
          <div class="wl-summary__item">
            <span class="wl-summary__num">{{ ladder.ceiling ? `L${ladder.ceiling}` : '—' }}</span>
            <span class="wl-summary__label">天花板</span>
          </div>
        </section>

        <!-- 七级阶梯 -->
        <section class="wl-levels">
          <div
            v-for="level in ladder.levels"
            :key="level.level"
            class="lg-card wl-level"
            :class="levelClass(level)"
          >
            <div class="wl-level__head">
              <span class="wl-level__no">L{{ level.level }}</span>
              <div class="wl-level__title">
                <strong>{{ level.label }}</strong>
                <span>{{ level.hint }}</span>
              </div>
              <span class="lg-badge" :class="badgeClass(level)">{{ badgeText(level) }}</span>
            </div>

            <ul v-if="level.items.length" class="wl-items">
              <li v-for="item in level.items" :key="item.itemId">
                <span class="wl-items__text">{{ item.text }}</span>
                <span class="wl-items__meta">
                  {{ item.dimensionLabel }} · 强度 {{ item.intensity }}
                  <template v-if="item.props.length"> · 需 {{ item.props.join('、') }}</template>
                </span>
                <span class="wl-items__verdict" :class="verdictClass(item)">
                  {{ verdictText(item) }}
                </span>
              </li>
            </ul>

            <div v-if="level.level === ladder.currentLevel && !level.allAnswered" class="wl-level__actions">
              <button class="lg-btn lg-btn--primary lg-btn--sm" type="button" @click="beginLevel(level)">
                开始本级作答
              </button>
              <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="reshuffle(level.level)">
                换一批
              </button>
            </div>
          </div>
        </section>

        <!-- 共识清单 -->
        <section v-if="agreedList.length" class="lg-card wl-agreed">
          <h2 class="wl-h2">双方都接受的条目</h2>
          <div v-for="item in agreedList" :key="item.itemId" class="wl-agreed__row">
            <span>{{ item.text }}</span>
            <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="toWishlist(item.itemId)">
              ♡ 收藏
            </button>
          </div>
        </section>
      </template>

      <!-- 作答：一方 -->
      <HandoverMask
        v-if="answering && answeringPlayer === 'b'"
        title="请把设备交给 💙"
        description="💖 已经答完本级。轮到 💙 独立作答，看不到对方的答案。"
        confirm-text="我是 💙，开始作答"
        @ready="answeringSolo = true"
      />

      <section v-if="answering && (answeringPlayer === 'a' || answeringSolo)" class="lg-modal">
        <div class="lg-modal__panel wl-answer">
          <h2 class="lg-modal__title">
            {{ answeringPlayer === 'a' ? '💖' : '💙' }} 独立作答 · L{{ answeringLevel }}
          </h2>
          <p class="wl-answer__hint">
            按真实感受选，不用担心对方看到 —— 答案在双方都答完前不会互相显示。
          </p>

          <div v-for="item in answeringItems" :key="item.itemId" class="wl-answer__item">
            <p class="wl-answer__text">{{ item.text }}</p>
            <div class="lg-segment">
              <button
                v-for="v in VERDICT_OPTIONS"
                :key="v.value"
                type="button"
                class="lg-segment__item"
                :class="{ 'is-active': localAnswers[item.itemId] === v.value }"
                @click="localAnswers[item.itemId] = v.value"
              >{{ v.label }}</button>
            </div>
          </div>

          <button
            class="lg-btn lg-btn--primary lg-btn--block"
            type="button"
            :disabled="!allAnsweredLocally || submitting"
            @click="submitAnswers"
          >
            {{ submitting ? '提交中…' : '提交本级答案' }}
          </button>
        </div>
      </section>

      <!-- 本级结果 -->
      <section v-if="levelResult" class="lg-modal">
        <div class="lg-modal__panel">
          <p class="wl-result__emoji">{{ levelResult.passed ? '🎉' : '🛑' }}</p>
          <h2 class="lg-modal__title">
            {{ levelResult.passed ? `L${levelResult.level} 通过` : `停在 L${levelResult.level}` }}
          </h2>
          <p class="lg-modal__text">
            <template v-if="levelResult.passed">
              本级有 {{ levelResult.agreedCount }} 条双方都接受，已解锁 L{{ levelResult.level + 1 }}。
            </template>
            <template v-else>
              本级没有任何一条双方都接受，这里就是当前的天花板 —— 完全没问题，
              阶梯的意义是找到你们都舒服的位置，不是爬到顶。
            </template>
          </p>
          <div v-if="levelResult.agreed.length" class="wl-result__list">
            <p v-for="text in levelResult.agreed" :key="text" class="wl-result__item">✓ {{ text }}</p>
          </div>
          <div v-if="levelResult.excluded.length" class="wl-result__list wl-result__list--muted">
            <p v-for="text in levelResult.excluded" :key="text" class="wl-result__item">— {{ text }}</p>
          </div>
          <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="levelResult = null">
            知道了
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import GameToolbar from '../../shared/GameToolbar.vue'
import HandoverMask from '../../shared/HandoverMask.vue'
import { apiJSON, postJSON } from '../../shared/api.js'

const VERDICT_OPTIONS = [
  { value: 'comfortable', label: '舒适' },
  { value: 'want', label: '想试' },
  { value: 'no', label: '不想' }
]

const ladder = ref(null)
const loadError = ref('')

const answering = ref(false)
const answeringPlayer = ref('a')
const answeringSolo = ref(false)
const answeringLevel = ref(1)
const answeringItems = ref([])
const localAnswers = reactive({})
const submitting = ref(false)
const levelResult = ref(null)

const allAnsweredLocally = computed(() =>
  answeringItems.value.length > 0 && answeringItems.value.every((i) => localAnswers[i.itemId])
)

// 服务端已把共识条目解析成完整对象，前端不必再持有一份内容库
const agreedList = computed(() => ladder.value?.agreedItems || [])

const load = async () => {
  try {
    ladder.value = await apiJSON('/api/couple/ladder')
    loadError.value = ''
  } catch (error) {
    loadError.value = `加载阶梯失败：${error.message}`
  }
}

onMounted(load)

const levelClass = (level) => ({
  'is-current': level.level === ladder.value?.currentLevel,
  'is-passed': level.passed,
  'is-locked': level.locked,
  'is-future': level.items.length === 0
})

const badgeText = (level) => {
  if (level.locked) return '🛑 天花板'
  if (level.passed) return '✓ 已通过'
  if (level.items.length === 0) return '未解锁'
  if (level.level === ladder.value?.currentLevel) return '进行中'
  return '待作答'
}

const badgeClass = (level) => (level.passed || level.level === ladder.value?.currentLevel ? 'lg-badge--accent' : '')

const verdictText = (item) => {
  if (!item.bothAnswered) return '待作答'
  if (item.agreed) return '✓ 共识'
  return '— 有一方不想'
}

const verdictClass = (item) => ({
  'is-agreed': item.agreed,
  'is-rejected': item.bothAnswered && !item.agreed
})

const beginLevel = (level) => {
  answeringLevel.value = level.level
  answeringItems.value = level.items
  for (const key of Object.keys(localAnswers)) delete localAnswers[key]
  answeringPlayer.value = 'a'
  answeringSolo.value = false
  answering.value = true
}

const submitAnswers = async () => {
  submitting.value = true
  try {
    for (const item of answeringItems.value) {
      await postJSON('/api/couple/ladder/answer', {
        level: answeringLevel.value,
        itemId: item.itemId,
        player: answeringPlayer.value,
        verdict: localAnswers[item.itemId]
      })
    }

    if (answeringPlayer.value === 'a') {
      answeringPlayer.value = 'b'
      for (const key of Object.keys(localAnswers)) delete localAnswers[key]
      await load()
    } else {
      await load()
      const level = ladder.value.levels.find((l) => l.level === answeringLevel.value)
      levelResult.value = {
        level: level.level,
        passed: level.passed,
        agreedCount: level.agreedCount,
        agreed: level.items.filter((i) => i.agreed).map((i) => i.text),
        excluded: level.items.filter((i) => i.bothAnswered && !i.agreed).map((i) => i.text)
      }
      answering.value = false
      answeringSolo.value = false
    }
  } catch (error) {
    loadError.value = `提交失败：${error.message}`
  } finally {
    submitting.value = false
  }
}

const reshuffle = async (level) => {
  try {
    ladder.value = await postJSON('/api/couple/ladder/reshuffle', { level })
  } catch (error) {
    loadError.value = `换一批失败：${error.message}`
  }
}

const confirmReset = async () => {
  if (!confirm('确定要清空阶梯进度、共识清单和已抽条目吗？身体地图与愿望清单不受影响。')) return
  try {
    await postJSON('/api/couple/ladder/reset', {})
    await load()
  } catch (error) {
    loadError.value = `重置失败：${error.message}`
  }
}

const toWishlist = async (itemId) => {
  try {
    await postJSON('/api/couple/wishlist', { itemId, source: 'warmup-ladder' })
  } catch (error) {
    loadError.value = `收藏失败：${error.message}`
  }
}
</script>

<style scoped>
.wl-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--lg-sp-3);
  margin-bottom: var(--lg-sp-4);
  padding: var(--lg-sp-4);
  text-align: center;
}

.wl-summary__num {
  display: block;
  font-size: var(--lg-fs-xl);
  font-weight: 700;
  color: var(--lg-accent);
}

.wl-summary__label {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.wl-levels {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
}

.wl-level {
  padding: var(--lg-sp-4);
  border-left: 4px solid var(--lg-border-strong);
  transition: opacity 0.2s ease, border-color 0.2s ease;
}

.wl-level.is-current {
  border-left-color: var(--lg-accent);
}

.wl-level.is-passed {
  border-left-color: var(--lg-ok-ink);
}

.wl-level.is-locked {
  border-left-color: var(--lg-danger-ink);
}

.wl-level.is-future {
  opacity: 0.55;
}

.wl-level__head {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-3);
}

.wl-level__no {
  flex-shrink: 0;
  font-size: var(--lg-fs-sm);
  font-weight: 700;
  color: var(--lg-accent);
}

.wl-level__title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wl-level__title strong {
  font-size: var(--lg-fs-md);
  color: var(--lg-ink);
}

.wl-level__title span {
  font-size: var(--lg-fs-xs);
  color: var(--lg-muted);
}

.wl-items {
  margin-top: var(--lg-sp-3);
  padding-top: var(--lg-sp-3);
  border-top: 1px solid var(--lg-border);
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
}

.wl-items li {
  display: flex;
  align-items: baseline;
  gap: var(--lg-sp-2);
  flex-wrap: wrap;
  font-size: var(--lg-fs-sm);
}

.wl-items__text {
  flex: 1;
  min-width: 12ch;
  color: var(--lg-ink-soft);
  line-height: 1.6;
}

.wl-items__meta {
  font-size: var(--lg-fs-xs);
  color: var(--lg-faint);
}

.wl-items__verdict {
  font-size: var(--lg-fs-xs);
  font-weight: 600;
  color: var(--lg-muted);
}

.wl-items__verdict.is-agreed { color: var(--lg-ok-ink); }
.wl-items__verdict.is-rejected { color: var(--lg-danger-ink); }

.wl-level__actions {
  display: flex;
  gap: var(--lg-sp-2);
  margin-top: var(--lg-sp-3);
  flex-wrap: wrap;
}

.wl-h2 {
  margin-bottom: var(--lg-sp-3);
  font-size: var(--lg-fs-md);
  font-weight: 650;
  color: var(--lg-ink);
}

.wl-agreed {
  margin-top: var(--lg-sp-4);
}

.wl-agreed__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-2) 0;
  border-bottom: 1px solid var(--lg-border);
  font-size: var(--lg-fs-sm);
  color: var(--lg-ink-soft);
}

.wl-agreed__row:last-child {
  border-bottom: none;
}

.wl-answer {
  text-align: left;
  max-width: 480px;
}

.wl-answer__hint {
  margin-bottom: var(--lg-sp-4);
  font-size: var(--lg-fs-xs);
  line-height: 1.7;
  color: var(--lg-muted);
}

.wl-answer__item {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-2);
  padding: var(--lg-sp-3) 0;
  border-top: 1px solid var(--lg-border);
}

.wl-answer__text {
  font-size: var(--lg-fs-md);
  line-height: 1.6;
  color: var(--lg-ink);
}

.wl-result__emoji {
  margin-bottom: var(--lg-sp-3);
  font-size: 52px;
  line-height: 1;
}

.wl-result__list {
  margin-bottom: var(--lg-sp-4);
  text-align: left;
}

.wl-result__list--muted {
  color: var(--lg-muted);
}

.wl-result__item {
  padding: 4px 0;
  font-size: var(--lg-fs-sm);
  line-height: 1.6;
  color: var(--lg-ink-soft);
}

.wl-result__list--muted .wl-result__item {
  color: var(--lg-muted);
}

@media (max-width: 640px) {
  .wl-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
