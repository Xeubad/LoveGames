<template>
  <div class="lg-shell theme-truth-or-dare">
    <GameToolbar title="真心话大冒险" icon="💕" />

    <div class="lg-body">
      <header class="td-hero">
        <h1 class="td-hero__title">和 TA 一起玩</h1>
        <p class="td-hero__sub">选一种开始方式</p>
      </header>

      <div class="td-modes">
        <section class="lg-card td-mode">
          <h2 class="td-mode__title">📱 本地同屏对局</h2>
          <p class="td-mode__desc">
            一台设备两人轮流。题目抽出后先遮住，交给对方再揭开，不会提前穿帮。
            不用联网，也不用房间号。
          </p>
          <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="goLocal">
            开始本地对局
          </button>
        </section>

        <section class="lg-card td-mode">
          <h2 class="td-mode__title">🌐 联机房间</h2>
          <p class="td-mode__desc">
            各自一台设备，用房间号连接，题目与难度设置实时同步。
          </p>
          <div class="td-mode__actions">
            <button class="lg-btn lg-btn--primary lg-btn--block" type="button" @click="createRoom">
              创建房间
            </button>
            <div class="td-join">
              <input
                v-model="roomId"
                class="lg-field td-join__input"
                placeholder="房间号"
                maxlength="6"
                @keyup.enter="joinRoom"
              />
              <button class="lg-btn lg-btn--ghost" type="button" @click="joinRoom">
                加入
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="td-footer">
        <button class="lg-btn lg-btn--quiet lg-btn--sm" type="button" @click="goToTests">
          🧪 诊断面板
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import GameToolbar from '../../../shared/GameToolbar.vue'

const router = useRouter()
const roomId = ref('')

const goLocal = () => {
  router.push('/truth-or-dare/local')
}

const createRoom = () => {
  const id = Math.random().toString(36).substring(2, 8).toUpperCase()
  router.push(`/truth-or-dare/room/${id}`)
}

const joinRoom = () => {
  const id = roomId.value.trim().toUpperCase()
  if (!id) {
    alert('请输入房间号')
    return
  }
  router.push(`/truth-or-dare/room/${id}`)
}

const goToTests = () => {
  router.push('/truth-or-dare/tests')
}
</script>

<style scoped>
.td-hero {
  margin-bottom: var(--lg-sp-5);
  text-align: center;
}

.td-hero__title {
  font-size: var(--lg-fs-2xl);
  font-weight: 700;
  color: var(--lg-ink);
}

.td-hero__sub {
  margin-top: var(--lg-sp-2);
  font-size: var(--lg-fs-md);
  color: var(--lg-muted);
}

.td-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--lg-sp-4);
}

.td-mode {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
}

.td-mode__title {
  font-size: var(--lg-fs-lg);
  font-weight: 650;
  color: var(--lg-ink);
}

.td-mode__desc {
  flex: 1;
  font-size: var(--lg-fs-sm);
  line-height: 1.75;
  color: var(--lg-muted);
}

.td-mode__actions {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
}

.td-join {
  display: flex;
  gap: var(--lg-sp-2);
}

.td-join__input {
  flex: 1;
  min-width: 0;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-align: center;
}

.td-footer {
  margin-top: var(--lg-sp-5);
  display: flex;
  justify-content: center;
}
</style>
