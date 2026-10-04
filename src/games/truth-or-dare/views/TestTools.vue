<template>
  <div class="lg-shell theme-truth-or-dare">
    <GameToolbar title="诊断面板" icon="🧪" to="/truth-or-dare">
      <template #actions>
        <button class="lg-btn lg-btn--primary lg-btn--sm" type="button" :disabled="anyRunning" @click="runAll">
          {{ anyRunning ? '检测中…' : '▶ 全部检测' }}
        </button>
      </template>
    </GameToolbar>

    <div class="lg-body">
      <p class="dx-intro">就地检测服务端、WebSocket 与 AI 连通性，不跳转外部页面。</p>

      <div class="dx-list">
        <section v-for="check in checks" :key="check.id" class="lg-card dx-check">
          <header class="dx-check__head">
            <span class="dx-check__icon">{{ check.icon }}</span>
            <div class="dx-check__title">
              <h2>{{ check.title }}</h2>
              <p>{{ check.desc }}</p>
            </div>
            <span class="dx-state" :class="`dx-state--${states[check.id].status}`">
              {{ stateLabel(states[check.id].status) }}
            </span>
            <button
              class="lg-btn lg-btn--ghost lg-btn--sm"
              type="button"
              :disabled="states[check.id].status === 'running'"
              @click="runCheck(check.id)"
            >
              {{ states[check.id].status === 'running' ? '…' : '检测' }}
            </button>
          </header>

          <dl v-if="states[check.id].detail" class="dx-detail">
            <div v-for="(value, key) in states[check.id].detail" :key="key" class="dx-detail__row">
              <dt>{{ key }}</dt>
              <dd :class="{ 'is-bad': value === false }">{{ formatValue(value) }}</dd>
            </div>
          </dl>

          <p
            v-if="states[check.id].message"
            class="lg-notice"
            :class="toneOf(states[check.id].status) && `lg-notice--${toneOf(states[check.id].status)}`"
          >
            {{ states[check.id].message }}
          </p>

          <template v-if="check.id === 'ai'">
            <button
              v-if="aiConfigured && states.ai.status !== 'running'"
              class="lg-btn lg-btn--ghost lg-btn--sm"
              type="button"
              :disabled="probing"
              @click="runProbe"
            >
              {{ probing ? '调用中…' : '🔬 实测调用一次模型' }}
            </button>
            <p
              v-if="probeMessage"
              class="lg-notice"
              :class="probeOk ? 'lg-notice--ok' : 'lg-notice--danger'"
            >
              {{ probeMessage }}
            </p>
          </template>
        </section>
      </div>

      <section class="lg-card dx-info">
        <h3>📋 说明</h3>
        <ul>
          <li>服务端：读取运行时长、在线房间数与已注册游戏数，确认进程与路由正常</li>
          <li>WebSocket：实连测试房间等人数广播，并验证不带房间号会被拒绝</li>
          <li>AI 服务：先看配置（不含密钥），再可选真实调用，用于区分「Key 配错」和「网络/审核不通」</li>
          <li>AI 未配置是正常状态，此时全部游戏自动使用本地题库，不影响可玩性</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import GameToolbar from '../../../shared/GameToolbar.vue'
import { apiJSON, postJSON } from '../../../shared/api.js'

const checks = [
  { id: 'server', icon: '🖥️', title: '服务端', desc: '进程存活、路由已挂载、房间与在线人数' },
  { id: 'ws', icon: '🔌', title: 'WebSocket', desc: '实连测试房间收广播，并验证无房间号会被拒绝' },
  { id: 'ai', icon: '🤖', title: 'AI 服务', desc: '读取配置（不含密钥），可选真实调用一次模型' }
]

const idle = () => ({ status: 'idle', message: '', detail: null })
const states = reactive({ server: idle(), ws: idle(), ai: idle() })

const aiConfigured = ref(false)
const probing = ref(false)
const probeOk = ref(false)
const probeMessage = ref('')

const anyRunning = computed(() => checks.some((check) => states[check.id].status === 'running'))

const STATE_LABELS = {
  idle: '未检测',
  running: '检测中',
  pass: '✓ 通过',
  warn: '! 注意',
  fail: '✗ 失败'
}

const stateLabel = (status) => STATE_LABELS[status] || status

/** 检测结果状态 → 提示条色调 */
const toneOf = (status) => ({ pass: 'ok', warn: 'warn', fail: 'danger' }[status] || '')

const formatValue = (value) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const checkServer = async () => {
  const data = await apiJSON('/api/diagnostics/server')
  return {
    status: data.ok ? 'pass' : 'fail',
    message: data.ok ? `服务端正常，已注册 ${data.games} 个游戏` : '服务端返回异常状态',
    detail: {
      运行时长: `${data.uptimeSec} 秒`,
      在线连接: data.wsClients,
      活跃房间: data.rooms?.count ?? 0,
      房间内玩家: data.rooms?.players ?? 0,
      Node版本: data.node
    }
  }
}

/**
 * 连一次 WebSocket 并把首个结果交回来。
 * expect 为 'message' 时期待收到广播；为 'close:CODE' 时期待被以指定状态码拒绝。
 */
const wsProbe = (query, expect, timeoutMs = 4000) => new Promise((resolve) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const socket = new WebSocket(`${protocol}//${window.location.host}/ws${query}`)
  let settled = false

  const finish = (result) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    try {
      socket.close()
    } catch {
      // 已经关闭，忽略
    }
    resolve(result)
  }

  const timer = setTimeout(() => finish({ ok: false, reason: `${timeoutMs}ms 内未等到预期结果` }), timeoutMs)

  socket.onmessage = (event) => {
    if (expect !== 'message') return
    try {
      finish({ ok: true, detail: JSON.parse(event.data) })
    } catch {
      finish({ ok: false, reason: '收到的广播不是合法 JSON' })
    }
  }

  socket.onclose = (event) => {
    if (!expect.startsWith('close:')) {
      finish({ ok: false, reason: `连接被关闭（${event.code} ${event.reason || ''}）` })
      return
    }
    const wanted = Number(expect.split(':')[1])
    finish({
      ok: event.code === wanted,
      reason: event.code === wanted ? '' : `期望关闭码 ${wanted}，实际 ${event.code}（${event.reason || '无原因'}）`
    })
  }

  socket.onerror = () => finish({ ok: false, reason: '连接出错，请确认服务端已启动' })
})

const checkWebSocket = async () => {
  const joined = await wsProbe('?room=DIAG0001', 'message')
  if (!joined.ok) {
    return { status: 'fail', message: `加入房间失败：${joined.reason}`, detail: null }
  }

  const rejected = await wsProbe('', 'close:1008')
  const detail = { 房间广播: joined.detail, 无房间号被拒: rejected.ok }

  if (!rejected.ok) {
    return { status: 'warn', message: `可正常连房，但缺少房间号时未被拒绝：${rejected.reason}`, detail }
  }

  return { status: 'pass', message: '连接、广播与参数校验均正常', detail }
}

const checkAI = async () => {
  const data = await apiJSON('/api/diagnostics/ai')
  aiConfigured.value = data.configured === true

  const detail = {
    已配置密钥: data.configured,
    模型: data.model,
    接口地址: data.baseUrl,
    超时: `${data.timeoutMs}ms`,
    密钥来源: data.keySource || '未设置'
  }

  if (!data.configured) {
    return {
      status: 'warn',
      message: '未配置 AI_API_KEY，所有游戏将使用本地题库（可正常游玩，只是题目不会扩充）',
      detail
    }
  }

  return { status: 'pass', message: '配置就绪，可点下方按钮实测一次真实调用', detail }
}

const runners = { server: checkServer, ws: checkWebSocket, ai: checkAI }

const runCheck = async (id) => {
  states[id] = { status: 'running', message: '', detail: null }
  try {
    states[id] = await runners[id]()
  } catch (error) {
    states[id] = { status: 'fail', message: error.message, detail: null }
  }
}

const runAll = async () => {
  probeMessage.value = ''
  for (const check of checks) {
    await runCheck(check.id)
  }
}

const runProbe = async () => {
  probing.value = true
  probeMessage.value = ''
  try {
    const data = await postJSON('/api/diagnostics/ai-probe', {})
    probeOk.value = data.ok === true
    probeMessage.value = data.ok
      ? `✓ 模型响应正常，耗时 ${data.durationMs}ms`
      : `✗ 调用失败（${data.code}）：${data.message}`
  } catch (error) {
    probeOk.value = false
    probeMessage.value = `✗ 请求未送达：${error.message}`
  } finally {
    probing.value = false
  }
}
</script>

<style scoped>
.dx-intro {
  margin-bottom: var(--lg-sp-4);
  font-size: var(--lg-fs-sm);
  color: var(--lg-muted);
}

.dx-list {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-4);
}

.dx-check {
  display: flex;
  flex-direction: column;
  gap: var(--lg-sp-3);
  padding: var(--lg-sp-4) var(--lg-sp-5);
}

.dx-check__head {
  display: flex;
  align-items: center;
  gap: var(--lg-sp-3);
}

.dx-check__icon {
  font-size: 28px;
  line-height: 1;
}

.dx-check__title {
  flex: 1;
  min-width: 0;
}

.dx-check__title h2 {
  font-size: var(--lg-fs-md);
  font-weight: 650;
  color: var(--lg-ink);
}

.dx-check__title p {
  margin-top: 2px;
  font-size: var(--lg-fs-xs);
  line-height: 1.6;
  color: var(--lg-muted);
}

.dx-state {
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: var(--lg-r-pill);
  border: 1px solid var(--lg-border-strong);
  background: var(--lg-surface-sunken);
  color: var(--lg-muted);
  font-size: var(--lg-fs-xs);
  font-weight: 650;
  white-space: nowrap;
}

.dx-state--running { color: var(--lg-warn-ink); background: var(--lg-warn-bg); border-color: var(--lg-warn-border); }
.dx-state--pass { color: var(--lg-ok-ink); background: var(--lg-ok-bg); border-color: var(--lg-ok-border); }
.dx-state--warn { color: var(--lg-warn-ink); background: var(--lg-warn-bg); border-color: var(--lg-warn-border); }
.dx-state--fail { color: var(--lg-danger-ink); background: var(--lg-danger-bg); border-color: var(--lg-danger-border); }

.dx-detail {
  display: grid;
  gap: var(--lg-sp-1);
  padding-top: var(--lg-sp-3);
  border-top: 1px solid var(--lg-border);
}

.dx-detail__row {
  display: flex;
  justify-content: space-between;
  gap: var(--lg-sp-3);
  font-size: var(--lg-fs-sm);
}

.dx-detail__row dt {
  color: var(--lg-muted);
  flex-shrink: 0;
}

.dx-detail__row dd {
  color: var(--lg-ink-soft);
  text-align: right;
  word-break: break-all;
}

.dx-detail__row dd.is-bad {
  color: var(--lg-danger-ink);
  font-weight: 700;
}

.dx-info h3 {
  margin-bottom: var(--lg-sp-3);
  font-size: var(--lg-fs-md);
  font-weight: 650;
  color: var(--lg-ink);
}

.dx-info ul {
  display: grid;
  gap: var(--lg-sp-2);
  list-style: none;
}

.dx-info li {
  padding: var(--lg-sp-2) var(--lg-sp-3);
  border-radius: var(--lg-r-xs);
  background: var(--lg-surface-sunken);
  color: var(--lg-muted);
  font-size: var(--lg-fs-xs);
  line-height: 1.7;
}

@media (max-width: 640px) {
  .dx-check__head {
    flex-wrap: wrap;
  }

  .dx-check__title {
    flex-basis: 100%;
    order: 3;
  }
}
</style>
