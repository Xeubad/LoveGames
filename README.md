# 💕 情侣游戏合集

一个基于 Vue 3 + Node.js 的情侣互动游戏平台，支持多游戏扩展、实时联机和 AI 智能生成。

## 🎮 内置游戏

| 游戏 | 说明 | 特性 |
|------|------|------|
| 💕 真心话大冒险 | 经典情侣问答游戏 | 本地同屏轮流（带遮题）、WebSocket 实时联机、AI 生成题目、三档难度、85 条本地题库 |
| 🎲 情侣飞行棋 | 40 格棋盘任务游戏 | AI 任务生成（仅温馨档）、两种内容尺度、按访客隔离的任务池 |
| 🎴 默契解锁 | 秘密选择匹配游戏 | 双方各自暗选后同时揭晓，**没对上不会暴露对方选了什么**，匹配项可存入愿望清单 |
| 🪜 升温阶梯 | 七级强度阶梯 | 双方独立作答，有共识才升级，整级零共识即为天花板；进度长期保存 |
| 🗺️ 身体地图 | 偏好叠加图 | 各自私密标注 23 个身体分区的喜欢/一般/禁区，双方都标完才叠加，输出共识区与沟通区 |
| 👑 限时主导权 | 抽定主导方的限时轮次 | 接收方标过的禁区自动成为硬边界，指令池优先取阶梯共识，双方确认后开局，全程可随时叫停 |

真心话大冒险有两种开局方式：

- **📱 本地同屏对局** —— 一台设备两人轮流，题目抽出后先遮住，交给对方再揭开。不需要联网，也不需要房间号。
- **🌐 联机房间** —— 各自一台设备，用房间号连接，题目与难度设置实时同步。

后四个游戏都是**同屏轮流 + 遮挡交接**：轮到的一方作答时，另一方的选择在界面和网络响应里都不可见。

## 🚀 快速开始

```bash
npm install
npm start
```

访问 http://localhost:3000

`npm start` 会先构建前端再起服务，Windows / macOS / Linux 都一样，不需要额外的启动脚本。
首次运行如果缺依赖，先跑一次 `npm install`。

### 开发模式

需要两个终端，各跑一个进程（`npm run dev` 只启动前端，不再顺带起后端）：

```bash
# 终端 1：后端服务器（端口 3000）
npm run server

# 终端 2：前端开发服务器（热更新，端口 5173）
npm run dev
```

前端开发服务器运行在 http://localhost:5173，`/api` 与 `/ws` 自动代理到后端 3000 端口。

> 需要 Node.js 18 以上（服务端使用内置 `fetch` 调用模型接口）。

## 📁 项目结构

```
LoveGames/
├── server/
│   ├── index.js                  # 统一服务器（Express + WebSocket，端口 3000）+ 诊断接口
│   ├── games-registry.js         # 游戏注册表（扩展新游戏只需改这里）
│   ├── shared/                   # 平台级共享模块
│   │   ├── session-store.js      # 按访客隔离的**临时**状态（TTL + 容量上限）
│   │   ├── store.js              # 两人共享的**长期**资产（JSON 落盘、原子写入、写队列）
│   │   ├── content-library.js    # 结构化内容库（维度 + 强度 + 道具），所有游戏共用
│   │   └── ai-client.js          # 统一 AI 代理（密钥只在服务端、强制超时、结构化失败原因）
│   ├── couple/
│   │   └── api.js                # 默契解锁 / 升温阶梯 / 身体地图 / 限时主导权 的共享后端
│   ├── truth-or-dare/
│   │   ├── api.js                # 题目生成 API（含 prompt 与去重）
│   │   └── ws-handler.js         # WebSocket 房间管理（人数上限、心跳、消息校验）
│   └── flight-chess/
│       └── api.js                # 飞行棋 API 路由
├── src/
│   ├── main.js                   # Vue 入口
│   ├── App.vue                   # 根组件（只有 router-view）
│   ├── router/index.js           # 路由配置
│   ├── shared/
│   │   ├── styles.css            # 设计令牌 + 共享组件类 + 各游戏主题色（唯一来源）
│   │   ├── api.js                # 统一请求客户端（自动带会话 ID）
│   │   ├── GameToolbar.vue       # 顶部固定工具条（返回入口在游戏区域之外）
│   │   ├── HandoverMask.vue      # 交设备时的遮挡屏（三个同屏游戏共用）
│   │   └── body-zones.js         # 23 个身体分区定义 + 叠加分类规则（身体地图与主导权共用）
│   ├── views/
│   │   └── GameSelector.vue      # 游戏选择首页（深色大厅）
│   └── games/
│       ├── truth-or-dare/
│       │   ├── views/            # Home / LocalGame / Room / TestTools（诊断面板）
│       │   ├── services/ai.js    # 调用服务端出题接口（不含密钥）
│       │   ├── data/questions.js # 本地题库
│       │   └── composables/      # useQuestionEngine（出题引擎）+ useAIMonitor（统计）
│       ├── flight-chess/
│       │   └── FlightChess.vue
│       ├── secret-match/
│       │   └── SecretMatch.vue   # 默契解锁
│       ├── warmup-ladder/
│       │   └── WarmupLadder.vue  # 升温阶梯
│       ├── body-map/
│       │   └── BodyMap.vue       # 身体地图
│       └── power-play/
│           └── PowerPlay.vue     # 限时主导权
├── package.json
├── vite.config.js
└── index.html
```

## 🎨 界面约定

设计令牌集中在 `src/shared/styles.css` 的 `:root`：颜色、圆角、阴影、间距、字号都只在那里定义一次，
组件内一律用 `var(--lg-*)`，不写死值。

**主题色的唯一来源是 CSS 的 `.theme-<游戏id>` 类**，`server/games-registry.js` 不再存颜色。
游戏页面在自己的根元素上挂 `lg-shell theme-<id>` 即可，大厅卡片用同一个类，两边不会漂移。

导航统一走 `GameToolbar.vue`：sticky 顶栏、占据布局空间、位于游戏区域之外。
共享组件类：`lg-btn` / `lg-card` / `lg-badge` / `lg-source` / `lg-notice` / `lg-modal` / `lg-segment` / `lg-switch` / `lg-field`。

## 🛠️ 技术栈

- **前端**：Vue 3 + Vue Router + Vite
- **后端**：Node.js + Express + ws (WebSocket)
- **AI**：任意 OpenAI 兼容接口，默认阿里百炼 qwen-plus

## 🌐 部署

```bash
npm install
npm run build
AI_API_KEY=你的密钥 node server/index.js
```

服务器默认监听 3000 端口，HTTP 和 WebSocket 共用同一端口。

### 使用 PM2

```bash
npm install -g pm2
AI_API_KEY=你的密钥 pm2 start server/index.js --name lover-games
pm2 save
pm2 startup
```

## ⚙️ AI 配置（可选）

AI 为可选能力，**未配置时全部游戏自动使用本地题库，功能完整可玩**。

密钥只通过环境变量提供给服务端，前端源码与构建产物中都不含密钥：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_API_KEY` | 空 | 模型接口密钥（也接受 `DASHSCOPE_API_KEY`） |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 兼容接口地址 |
| `AI_MODEL` | `qwen-plus` | 模型名 |
| `AI_TIMEOUT_MS` | `20000` | 单次调用超时 |

换供应商只改 `AI_BASE_URL` + `AI_MODEL`，例如：

```bash
# DeepSeek
AI_BASE_URL=https://api.deepseek.com/v1 AI_MODEL=deepseek-chat AI_API_KEY=... npm start

# 本地 Ollama
AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=llama3.1 AI_API_KEY=ollama npm start
```

### 内容尺度与 AI 的关系

飞行棋的**亲密档不接 AI**，只使用本地精编题库 —— 主流供应商的内容审核会拒绝生成该类内容，
与其让用户遇到莫名失败，不如在设计上就不发起请求。AI 只服务温馨档与真心话大冒险的题目生成。

任何一次降级都会在界面上如实标注来源（`🤖 AI 生成` / `📦 本地题库`）并说明原因，
不会把本地内容伪装成 AI 结果。

## 📚 内容库

所有游戏的条目都来自 `server/shared/content-library.js`，**不再各自维护一份**。每条是结构化记录：

```js
{ id: 'c-27', text: '轻舔对方的耳垂10秒钟', tier: 'couple', dimension: 'sensory', intensity: 3, props: [] }
```

| 字段 | 说明 |
|------|------|
| `id` | 稳定 ID，愿望清单与阶梯进度按它引用，**不要改已有 ID** |
| `tier` | `basic`（温馨档）/ `couple`（亲密档） |
| `dimension` | `express` 表达与注视 / `touch` 肢体触碰 / `kiss` 亲吻 / `sensory` 感官探索 / `power` 主导与服从 / `display` 展示与暴露 / `play` 趣味与情境 / `intimate` 亲密行为 |
| `intensity` | 1-5，升温阶梯按它分级 |
| `props` | 需要的道具；默契解锁可一键排除有道具要求的条目 |
| `public` | 标记户外/公共场合条目，**默认不参与任何随机抽取**，需显式 `includePublic: true` |

`dimension` 和 `intensity` 是数据不是代码 —— 觉得标得不准直接改数字，游戏按字段消费，不用动代码。

当前 180 条（温馨档 58 / 亲密档非户外 120），维度分布：`touch` 35、`express` 31、`play` 26、`kiss` 25、
`power` 18、`sensory` 17、`display` 16、`intimate` 12；强度分布 1/2/3/4/5 = 37/56/37/35/15。
调 `GET /api/couple/content/meta` 可以看到实时的 `stats`，按缺口补内容最有效率。

有两个格子是**刻意留空**的，不要"顺手补上"：

- `touch` 的强度 5 —— 直接性化的触碰按定义归 `intimate`，塞进 `touch` 会破坏维度语义
- `intimate` 的强度 2/3 —— 那是档位边界，补了会让温馨档漏出亲密内容

两个硬性下限，补内容时要盯住：

- **升温阶梯每级的可抽池必须 ≥3**，否则该级抽不满（尤其 L7 只用强度 5 的条目）
- **默契解锁每个强度带必须 ≥4**，否则该强度带无法组成一张四选项卡

档位边界也要守住：`basic` 档不得出现 `intimate` 维度、强度不得 >2，否则温馨档会漏出亲密内容。

飞行棋的本地抽取是**一轮内不重复**的：抽过的 ID 记在会话里并排除，整轮抽完才重置。
温馨档 58 条 / 亲密档 120 条（非户外），一局约抽 22 次，所以单局内不会看到重复任务。

补内容时优先看**维度 × 强度矩阵**而不是总数 —— 阶梯是按「档位 + 强度带」抽的，
某个维度在某个强度带是 0，那个维度在那一级就永远不会出现。
调 `GET /api/couple/content/meta` 拿 `stats`，或直接读 `content-library.js` 顶部的分块注释。

**ID 一经分配就不要复用或改含义**：愿望清单和阶梯进度都按 ID 引用。
要修一条内容就直接改它的 `text`，不要删掉再把 ID 给别人。

## 💾 数据文件

身体地图标注、阶梯进度、愿望清单存在 **`data/couple.json`**（可用 `DATA_FILE` 环境变量改路径）。

- 这是**两人共享的长期资产**，与按访客隔离的临时状态（内容尺度、AI 任务池）分属两套机制，别混用
- 写入是「临时文件 + rename」原子替换，并用进程内写队列串行化，不会写坏
- **服务运行时不要手改这个文件**：进程内有缓存，外部改动会被下一次写入覆盖。要改先停服务
- 文件损坏（多半是手动编辑 JSON 改坏了）会自动备份为 `*.corrupt-<时间戳>` 并从空数据继续，服务不会挂
- 内容是私密个人数据，已加入 `.gitignore`，**任何情况下都不要提交或分享**

## 🧪 内置诊断面板

进入游戏「真心话大冒险 → 🧪 诊断面板」，可就地检测：

- **服务端**：运行时长、活跃房间数、在线连接数
- **WebSocket**：实连测试房间、验证无房间号会被拒绝
- **AI 服务**：读取配置（不含密钥），并可实测调用一次模型，用于区分「Key 配错」与「网络/审核不通」

## 🔒 多访客隔离

内容尺度、AI 任务池等按访客保存的状态，都由 `server/shared/session-store.js` 按浏览器会话隔离
（前端自动生成会话 ID，随 `X-Session-Id` 头发送）。**新增游戏时不要再用模块级 `let` 变量存访客状态**，
否则任一路人都能改掉其他所有人的设置。

## 🛡️ 隐私边界

`/api/couple/*` 存的是身体地图、阶梯答案这类私密数据，而且**没有任何鉴权**（个人本地使用，不该有登录）。
安全性完全靠下面两道边界，改动前请先读完：

**1. 不发任何 CORS 头。** 前端与接口永远同源（开发走 vite 代理，生产由同一进程发静态文件），
所以根本不需要 `cors()`。一旦加上，用户浏览器里打开的任何网页都能跨源读走身体地图原文——
这一条是实测过的：加 `cors()` 时 `Access-Control-Allow-Origin: *` 会让恶意页面拿到完整响应体。
`server/index.js` 里那段注释就是这个意思，别删。

**2. 写操作必须带 `X-Session-Id` 头。** 光靠第 1 条只堵住了「读」和需要预检的请求；
不需要 JSON body 的**简单请求**仍能盲发，例如 `POST /ladder/reset` 配 `Content-Type: text/plain`
就能跨源清空整个阶梯进度（同样实测过）。要求一个自定义头会强制触发预检，预检必然失败，口子就堵上了。
前端 `src/shared/api.js` 的 `api()` 给每个请求都带了这个头，所以功能无感。

注意这道校验**只认请求头，不认 `?sid=`** —— 查询串仍属于简单请求，认了就等于没设防。
新增写接口时挂在 `couple` 路由下就自动受保护；若另起路由前缀，记得把同样的检查加上。

**另外**：服务监听 `0.0.0.0`（联机房间需要两台设备连同一地址），启动横幅会把真实局域网地址打出来。
接口无鉴权，**同网任何人都能访问**，所以公共 Wi-Fi（咖啡馆/酒店/机场）下不要启动。

## ➕ 添加新游戏

只需 4 步：

### 1. 注册游戏元数据

编辑 `server/games-registry.js`，在 `GAMES` 数组中添加（**不含颜色**，颜色在第 4 步的 CSS 里）：

```js
{
  id: 'your-game',
  name: '游戏名称',
  description: '游戏描述',
  icon: '🎯',
  route: '/your-game'
}
```

### 2. 添加后端 API

在 `server/` 下创建游戏目录和路由文件，然后在 `server/index.js` 中挂载：

```js
import yourGameRouter from './your-game/api.js'
app.use('/api/your-game', yourGameRouter)
```

需要按访客保存状态时用共享会话存储：

```js
import { createSessionStore, readSessionId } from '../shared/session-store.js'

const sessions = createSessionStore({ create: () => ({ score: 0 }) })

router.get('/state', (req, res) => {
  res.json(sessions.ensure(readSessionId(req)))
})
```

需要调用 AI 时用共享客户端（自带超时与结构化错误）：

```js
import { chat, isConfigured } from '../shared/ai-client.js'
```

前端请求统一走 `src/shared/api.js`，它会自动带上会话 ID：

```js
import { apiJSON, postJSON } from '../../shared/api.js'
```

### 3. 添加前端路由

在 `src/router/index.js` 中添加：

```js
{
  path: '/your-game',
  component: () => import('../games/your-game/YourGame.vue')
}
```

游戏选择页会自动从 `/api/games` 读取列表并渲染卡片。

### 4. 添加主题色

在 `src/shared/styles.css` 中添加一个主题块，页面根元素挂上对应 class：

```css
.theme-your-game {
  --lg-accent: #ff6b9d;
  --lg-accent-2: #ff8a80;
  --lg-gradient: linear-gradient(135deg, #ff6b9d 0%, #ff8a80 100%);
}
```

```html
<div class="lg-shell theme-your-game">
  <GameToolbar title="游戏名称" icon="🎯" />
  <div class="lg-body"><!-- 复用 lg-card / lg-btn / lg-modal 等共享类 --></div>
</div>
```

## 📄 许可证

MIT License
