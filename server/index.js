/**
 * 情侣游戏合集 - 统一服务器
 * Express + WebSocket 共用 3000 端口
 */
import express from 'express'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { networkInterfaces } from 'os'

import { GAMES } from './games-registry.js'
import { setupWebSocket, roomStats } from './truth-or-dare/ws-handler.js'
import { describeConfig, chat } from './shared/ai-client.js'
import flightChessRouter from './flight-chess/api.js'
import truthOrDareRouter from './truth-or-dare/api.js'
import coupleRouter from './couple/api.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const server = createServer(app)
const startedAt = Date.now()

// ============ 中间件 ============
// 不要加 cors()。前端与接口永远同源（开发走 vite 代理，生产由本进程发静态文件），
// 一旦放开 Access-Control-Allow-Origin，用户浏览器里任何网页都能读写 /api/couple/*
// 里的身体地图与阶梯答案 —— 这些接口本身没有鉴权，靠的就是同源策略。
app.use(express.json({ limit: '64kb' }))

// ============ WebSocket 服务器 ============
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: 16 * 1024
})

setupWebSocket(wss)

// ============ 通用 API ============

app.get('/api/games', (req, res) => {
  res.json(GAMES)
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    games: GAMES.length,
    timestamp: new Date().toISOString()
  })
})

// ============ 诊断（供前端内置诊断面板使用，不暴露任何密钥） ============

app.get('/api/diagnostics/server', (req, res) => {
  res.json({
    ok: true,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    games: GAMES.length,
    wsClients: wss.clients.size,
    rooms: roomStats(),
    node: process.version
  })
})

app.get('/api/diagnostics/ai', (req, res) => {
  res.json(describeConfig())
})

// 真实打一次模型，用于区分「Key 配错了」和「网络/审核不通」
app.post('/api/diagnostics/ai-probe', async (req, res) => {
  const started = Date.now()
  try {
    await chat([{ role: 'user', content: '回复两个字：正常' }], { temperature: 0, maxTokens: 10 })
    res.json({ ok: true, durationMs: Date.now() - started })
  } catch (error) {
    res.json({ ok: false, code: error.code || 'unknown', message: error.message, durationMs: Date.now() - started })
  }
})

// ============ 游戏 API 路由 ============

app.use('/api/flight-chess', flightChessRouter)
app.use('/api/truth-or-dare', truthOrDareRouter)
app.use('/api/couple', coupleRouter)

// ============ 静态文件服务（生产环境） ============
const distPath = join(__dirname, '../dist')
app.use(express.static(distPath))

// SPA 路由处理（所有非 API 路由返回 index.html）
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'))
})

// 兜底错误处理：任何 handler 里漏出的异常都收敛成 500，
// 而不是让未捕获异常掀掉整个进程（Express 4 不接管 async rejection，
// 所以各路由还需自行 wrap —— 见 server/couple/api.js 顶部的 wrap/get/post/put/del）
app.use((error, req, res, next) => {
  console.error(`[api] ${req.method} ${req.originalUrl} 未捕获错误:`, error)
  if (!res.headersSent) {
    res.status(500).json({ message: '服务器内部错误' })
  }
})

// ============ 启动服务器 ============
const PORT = process.env.PORT || 3000
const aiConfig = describeConfig()

/** 同网设备直连用的地址（真心话联机房间靠它），没有就返回空数组 */
function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((nic) => nic && nic.family === 'IPv4' && !nic.internal)
    .map((nic) => nic.address)
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('')
  console.log('════════════════════════════════════════')
  console.log('  💕 情侣游戏合集已启动')
  console.log('════════════════════════════════════════')
  console.log(`  本机:      http://localhost:${PORT}`)
  for (const ip of lanAddresses()) console.log(`  局域网:    http://${ip}:${PORT}`)
  console.log(`  WebSocket: ws://localhost:${PORT}/ws`)
  console.log(`  游戏数量:  ${GAMES.length}`)
  console.log(`  AI:        ${aiConfig.configured ? `${aiConfig.model} (已配置)` : '未配置 AI_API_KEY，全部走本地题库'}`)
  console.log('────────────────────────────────────────')
  console.log('  ⚠️  接口没有鉴权，上面每个地址谁都能打开。')
  console.log('     公共 Wi-Fi（咖啡馆/酒店/机场）下不要启动，')
  console.log('     否则同网任何人都能读到身体地图和阶梯答案。')
  console.log('════════════════════════════════════════')
  console.log('')
})
