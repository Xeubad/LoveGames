/**
 * 真心话大冒险 - WebSocket 房间管理
 *
 * 增量加固（未做协议重构，各游戏形态确定后再统一）：
 * - 房间人数上限，第三人会被明确拒绝而不是把 UI 的「玩家1/玩家2」撑坏
 * - 心跳探活，手机锁屏等假死连接不再虚增在线人数
 * - 广播前校验消息结构，避免把垃圾帧转发给房内所有人
 */

const MAX_ROOM_SIZE = 2
const HEARTBEAT_INTERVAL_MS = 30 * 1000
const CLOSE_ROOM_FULL = 1013

const rooms = new Map()

export function roomStats() {
  return {
    count: rooms.size,
    players: [...rooms.values()].reduce((sum, room) => sum + room.clients.size, 0)
  }
}

function broadcast(room, payload) {
  const text = JSON.stringify(payload)
  for (const client of room.clients) {
    if (client.readyState === 1) client.send(text)
  }
}

function announceCount(room) {
  broadcast(room, { type: 'players', count: room.clients.size })
}

export function setupWebSocket(wss) {
  // 定期 ping，未回应 pong 的连接判定为已死并清理
  const heartbeat = setInterval(() => {
    for (const [roomId, room] of rooms) {
      for (const client of room.clients) {
        if (client.isAlive === false) {
          room.clients.delete(client)
          client.terminate()
          continue
        }
        client.isAlive = false
        client.ping()
      }
      if (room.clients.size === 0) rooms.delete(roomId)
      else announceCount(room)
    }
  }, HEARTBEAT_INTERVAL_MS)
  heartbeat.unref?.()

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const roomId = url.searchParams.get('room')

    if (!roomId) {
      ws.close(1008, '未提供房间号')
      return
    }

    let room = rooms.get(roomId)
    if (!room) {
      room = { clients: new Set() }
      rooms.set(roomId, room)
    }

    if (room.clients.size >= MAX_ROOM_SIZE) {
      console.log(`[房间 ${roomId}] 已满 (${MAX_ROOM_SIZE} 人)，拒绝新连接`)
      ws.close(CLOSE_ROOM_FULL, `房间已满（最多 ${MAX_ROOM_SIZE} 人）`)
      return
    }

    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

    room.clients.add(ws)
    console.log(`[房间 ${roomId}] 玩家加入，当前 ${room.clients.size}/${MAX_ROOM_SIZE}`)
    announceCount(room)

    ws.on('message', (data) => {
      let message
      try {
        message = JSON.parse(data.toString())
      } catch {
        console.error(`[房间 ${roomId}] 丢弃非 JSON 消息`)
        return
      }

      if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
        console.error(`[房间 ${roomId}] 丢弃缺少 type 字段的消息`)
        return
      }

      // 服务端自己维护的消息类型不允许客户端伪造
      if (message.type === 'players') return

      broadcast(room, message)
    })

    ws.on('close', () => {
      room.clients.delete(ws)
      console.log(`[房间 ${roomId}] 玩家离开，剩余 ${room.clients.size}`)
      if (room.clients.size === 0) {
        rooms.delete(roomId)
      } else {
        announceCount(room)
      }
    })

    ws.on('error', (error) => {
      console.error(`[房间 ${roomId}] WebSocket 错误:`, error.message)
    })
  })

  wss.on('error', (error) => {
    console.error('[服务器] WebSocket 服务器错误:', error)
  })

  wss.on('close', () => clearInterval(heartbeat))

  return rooms
}

export { MAX_ROOM_SIZE, CLOSE_ROOM_FULL }
