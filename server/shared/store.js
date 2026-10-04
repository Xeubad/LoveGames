/**
 * 情侣共同资产的持久化存储
 *
 * 与 session-store 的分工要说清楚，别用错：
 * - session-store  →  按访客隔离的临时状态（内容尺度、AI 任务池），重启即失效
 * - 这里           →  两人**共享**的长期资产（身体地图、阶梯进度、愿望清单），落盘持久
 *
 * 存储用一个 JSON 文件而不是数据库：本项目是个人自用、单进程、写入极低频，
 * 上数据库只会增加运维负担。写入是「临时文件 + rename」的原子替换，
 * 并用进程内写队列串行化，避免并发读改写互相覆盖。
 */
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_FILE = process.env.DATA_FILE || join(__dirname, '../../data/couple.json')

const PLAYERS = ['a', 'b']

const emptyData = () => ({
  version: 1,
  bodyMap: { a: {}, b: {} },
  ladder: null,
  wishlist: [],
  powerLog: [],
  updatedAt: null
})

let cache = null
let queue = Promise.resolve()

/** 合并默认结构，兼容旧文件缺字段的情况 */
function normalize(raw) {
  const base = emptyData()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    bodyMap: { a: {}, b: {}, ...(raw.bodyMap || {}) },
    wishlist: Array.isArray(raw.wishlist) ? raw.wishlist : [],
    powerLog: Array.isArray(raw.powerLog) ? raw.powerLog : []
  }
}

async function load() {
  if (cache) return cache

  try {
    const text = await readFile(DATA_FILE, 'utf8')
    cache = normalize(JSON.parse(text))
  } catch (error) {
    if (error.code === 'ENOENT') {
      cache = emptyData()
    } else {
      // 文件损坏（多半是手动编辑 JSON 改坏了）：把坏文件留证，从空数据继续，
      // 而不是让整个服务起不来
      const backup = `${DATA_FILE}.corrupt-${Date.now()}`
      console.error(`[store] 数据文件解析失败，已备份到 ${backup}:`, error.message)
      try {
        await rename(DATA_FILE, backup)
      } catch {
        // 备份失败不阻塞启动
      }
      cache = emptyData()
    }
  }

  return cache
}

async function flush() {
  await mkdir(dirname(DATA_FILE), { recursive: true })
  const tmp = `${DATA_FILE}.tmp`
  await writeFile(tmp, JSON.stringify(cache, null, 2), 'utf8')
  await rename(tmp, DATA_FILE)
}

/** 读取（返回副本，调用方改它不会影响存储） */
export async function readStore() {
  const data = await load()
  return structuredClone(data)
}

/**
 * 读-改-写。mutator 收到当前数据的副本，改完返回即可（也可不返回，直接改副本）。
 * 所有写入经同一条队列串行执行。
 */
export function updateStore(mutator) {
  const run = queue.then(async () => {
    const data = await load()
    const draft = structuredClone(data)
    const returned = await mutator(draft)
    cache = returned === undefined ? draft : normalize(returned)
    cache.updatedAt = new Date().toISOString()
    await flush()
    return structuredClone(cache)
  })

  // 队列本身不能被单次失败卡死
  queue = run.catch(() => {})
  return run
}

export { DATA_FILE, PLAYERS }
