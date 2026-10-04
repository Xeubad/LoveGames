<template>
  <div class="lg-lobby">
    <div class="gs-wrap">
      <header class="gs-hero">
        <h1 class="gs-hero__title">💕 情侣游戏合集</h1>
        <p class="gs-hero__sub">选择一个游戏，和 TA 一起玩吧</p>
      </header>

      <p v-if="loadState === 'loading'" class="gs-status">正在加载游戏列表…</p>

      <div v-else-if="loadState === 'error'" class="gs-status gs-status--error">
        <p>游戏列表加载失败：{{ loadError }}</p>
        <button class="lg-btn lg-btn--ghost lg-btn--sm" type="button" @click="loadGames">重试</button>
      </div>

      <p v-else-if="games.length === 0" class="gs-status">暂无可玩的游戏</p>

      <div v-else class="gs-grid">
        <button
          v-for="game in games"
          :key="game.id"
          type="button"
          :class="['gs-card', `theme-${game.id}`]"
          @click="goToGame(game.route)"
        >
          <span class="gs-card__icon">{{ game.icon }}</span>
          <span class="gs-card__name">{{ game.name }}</span>
          <span class="gs-card__desc">{{ game.description }}</span>
          <span class="gs-card__cta">开始游戏 →</span>
        </button>
      </div>

      <footer class="gs-footer">
        <p>更多游戏即将上线…</p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const games = ref([])
const loadState = ref('loading')
const loadError = ref('')

const loadGames = async () => {
  loadState.value = 'loading'
  try {
    const res = await fetch('/api/games')
    if (!res.ok) throw new Error(`服务端返回 ${res.status}`)
    games.value = await res.json()
    loadState.value = 'ready'
  } catch (error) {
    loadError.value = error.message
    loadState.value = 'error'
  }
}

onMounted(loadGames)

const goToGame = (route) => {
  router.push(route)
}
</script>

<style scoped>
.gs-wrap {
  max-width: var(--lg-content-max);
  margin: 0 auto;
  padding: var(--lg-sp-7) var(--lg-sp-4);
  /* 刘海机横屏时最后一张卡片会压在 Home 指示条上 */
  padding-bottom: calc(var(--lg-sp-7) + var(--lg-safe-b));
}

.gs-hero {
  margin-bottom: var(--lg-sp-6);
  text-align: center;
}

.gs-hero__title {
  font-size: 40px;
  font-weight: 700;
  color: var(--lg-lobby-ink);
  text-shadow: 0 4px 24px rgba(255, 107, 157, 0.28);
}

.gs-hero__sub {
  margin-top: var(--lg-sp-3);
  font-size: var(--lg-fs-lg);
  color: var(--lg-lobby-muted);
}

.gs-status {
  padding: var(--lg-sp-6) var(--lg-sp-4);
  border-radius: var(--lg-r-lg);
  border: 1px solid var(--lg-lobby-border);
  background: var(--lg-lobby-surface);
  color: var(--lg-lobby-muted);
  font-size: var(--lg-fs-md);
  text-align: center;
}

.gs-status--error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  color: #ffb4c0;
}

.gs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--lg-sp-5);
}

/* 卡片本身是 button，整块可点且键盘可达 */
.gs-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-6) var(--lg-sp-5);
  border: 1px solid var(--lg-lobby-border);
  border-radius: var(--lg-r-xl);
  background: var(--lg-lobby-surface);
  backdrop-filter: blur(10px);
  color: var(--lg-lobby-ink);
  font-family: inherit;
  text-align: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
    border-color 0.25s ease, box-shadow 0.25s ease;
}

.gs-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--lg-gradient);
  opacity: 0;
  transition: opacity 0.25s ease;
}

.gs-card:focus-visible {
  transform: translateY(-10px);
  border-color: var(--lg-accent);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  outline: none;
}

.gs-card:focus-visible::before {
  opacity: 1;
}

/* 抬起效果只给悬停设备。iOS 点完卡片会把 :hover 一直留在身上，
   卡片会僵在抬起的位置不回来。 */
@media (hover: hover) and (pointer: fine) {
  .gs-card:hover {
    transform: translateY(-10px);
    border-color: var(--lg-accent);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    outline: none;
  }

  .gs-card:hover::before {
    opacity: 1;
  }
}

.gs-card__icon {
  font-size: 64px;
  line-height: 1;
  animation: gs-float 3s ease-in-out infinite;
}

@keyframes gs-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.gs-card__name {
  font-size: var(--lg-fs-xl);
  font-weight: 650;
}

.gs-card__desc {
  flex: 1;
  font-size: var(--lg-fs-sm);
  line-height: 1.75;
  color: var(--lg-lobby-muted);
}

.gs-card__cta {
  padding: 10px 28px;
  border-radius: var(--lg-r-pill);
  background: var(--lg-gradient);
  color: var(--lg-on-accent);
  font-size: var(--lg-fs-md);
  font-weight: 600;
  box-shadow: var(--lg-sh-accent);
}

.gs-footer {
  margin-top: var(--lg-sp-6);
  text-align: center;
}

.gs-footer p {
  font-size: var(--lg-fs-sm);
  color: var(--lg-lobby-faint);
}

@media (max-width: 640px) {
  .gs-wrap {
    padding: var(--lg-sp-6) var(--lg-sp-3);
  }

  .gs-hero__title {
    font-size: var(--lg-fs-2xl);
  }

  .gs-grid {
    grid-template-columns: 1fr;
    gap: var(--lg-sp-4);
  }
}
</style>
