# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

情侣游戏合集平台，基于 Vue 3 + Node.js，支持多游戏扩展。定位是情侣关系升温，含成人向亲密内容。

- 游戏选择页为首页，自动从 `/api/games` 读取游戏列表
- 新增游戏 4 步：注册元数据 → 挂 API 路由 → 加前端路由 → 加 `.theme-<id>` 主题色块

## 常用命令

```bash
npm install         # 安装依赖（需 Node 18+）
npm start           # 构建 + 启动生产服务器（端口 3000）
npm run server      # 仅启动后端服务器（端口 3000）
npm run dev         # 仅启动 Vite 前端（端口 5173，需另开终端跑 npm run server）
npm run build       # 仅构建前端
```

`npm run dev` **不会**顺带启动后端。开发时要两个终端：`npm run server` + `npm run dev`。
（旧写法 `node server/index.js & vite` 在 Windows cmd 下 `&` 是顺序符，vite 永不启动，已改掉。）

`npm start` 是跨平台的，不要再加 `.bat` / `.sh` 启动脚本。

## 架构

### 服务器（单端口 3000）

Express + WebSocket 共用同一 HTTP server：
- `server/index.js` — 主入口，挂载游戏路由 + `/api/diagnostics/*` 诊断接口
- `server/games-registry.js` — 游戏元数据注册表（**不含颜色**），`GET /api/games` 从这里读取
- `server/shared/session-store.js` — **平台级**按访客隔离的**临时**状态（TTL + 容量上限）
- `server/shared/store.js` — **平台级**两人共享的**长期**资产（JSON 落盘、原子写入、写队列）
- `server/shared/content-library.js` — **平台级**结构化内容库（维度 + 强度 + 道具），所有游戏共用
- `server/shared/ai-client.js` — **平台级**统一 AI 代理（密钥只在服务端、强制超时、结构化错误码）
- `server/couple/api.js` — 默契解锁 / 升温阶梯 / 身体地图 / 限时主导权 的共享后端（`/api/couple/*`）
- `server/truth-or-dare/api.js` — 出题 API（prompt 与相似度去重都在服务端）
- `server/truth-or-dare/ws-handler.js` — WebSocket 房间管理（`/ws`，2 人上限、心跳探活、消息校验）
- `server/flight-chess/api.js` — 飞行棋 REST API（`/api/flight-chess/*`）

### 前端

Vue Router 懒加载，每个游戏独立目录：
- `src/shared/styles.css` — **设计令牌 + 共享组件类 + 各游戏主题色的唯一来源**
- `src/shared/api.js` — 统一请求客户端，自动生成并携带 `X-Session-Id`
- `src/shared/GameToolbar.vue` — 顶部 sticky 工具条，所有游戏共用
- `src/shared/HandoverMask.vue` — 交设备时的遮挡屏，三个同屏游戏共用
- `src/shared/body-zones.js` — 23 个身体分区定义 + 叠加分类规则，身体地图与限时主导权共用
- `src/views/GameSelector.vue` — 游戏选择首页（深色大厅）
- `src/games/truth-or-dare/` — views(Home/LocalGame/Room/TestTools) / services / data / composables
- `src/games/truth-or-dare/composables/useQuestionEngine.js` — 出题引擎，本地对局与联机房间共用
- `src/games/flight-chess/FlightChess.vue`
- `src/games/secret-match/SecretMatch.vue` — 默契解锁
- `src/games/warmup-ladder/WarmupLadder.vue` — 升温阶梯
- `src/games/body-map/BodyMap.vue` — 身体地图
- `src/games/power-play/PowerPlay.vue` — 限时主导权

真心话有两种开局：`/truth-or-dare/local`（同屏轮流 + 遮题，不连 WS）和
`/truth-or-dare/room/:id`（联机）。两者的出题逻辑都走 `useQuestionEngine`，不要各写一份。

默契解锁 / 升温阶梯 / 身体地图都是**同屏轮流 + 遮挡交接**，不连 WS。
限时主导权是同屏但**不需要交接遮挡**：双方在开局简报上各自点确认，两人都点了才能开始。

### AI

配置全部走环境变量，**源码中不写密钥**：`AI_API_KEY`（或 `DASHSCOPE_API_KEY`）、`AI_BASE_URL`、`AI_MODEL`、`AI_TIMEOUT_MS`。
默认阿里百炼 qwen-plus 的 OpenAI 兼容端点；换供应商只改 `AI_BASE_URL` + `AI_MODEL`。

未配置 Key 时自动降级到本地题库，功能完整可玩。

## 必须遵守的几条约定

- **不要用模块级 `let` 存访客状态。** 一律走 `createSessionStore` + `readSessionId(req)`。
  历史上飞行棋的内容尺度就是模块级全局，导致任一路人能把所有人的尺度改成亲密档。
- **分清两套存储。** `session-store` = 按访客隔离的临时状态（重启即失效）；
  `store` = 两人共享的长期资产（落盘）。身体地图、阶梯进度、愿望清单属于后者，
  按访客隔离会让两人各存一份、失去意义。
- **内容一律走 `content-library`。** 不要再往游戏目录里塞题库副本。
  `dimension` / `intensity` 是数据不是代码，改标注不用动游戏逻辑。
  带 `public: true` 的户外条目默认被 `query()` 排除，别绕过它。
- **独立作答类游戏必须服务端遮蔽。** 升温阶梯这类玩法，双方都答完之前
  接口**不得返回任何一方的答案**（`levelState` 里已做），否则后作答的人翻一下
  网络请求就能看到对方选了什么，「独立作答」直接失效。默契解锁同理：
  不匹配时前端不渲染、也不在内存里保留对方的选择。
- **不要加 `cors()`，也不要摘掉写操作的 `X-Session-Id` 校验。** `/api/couple/*` 没有鉴权，
  隐私全靠这两道边界：前端与接口永远同源（开发走 vite 代理），所以不需要 CORS，
  加了就等于让任意网页跨源读走身体地图；而 `couple/api.js` 顶部那道中间件要求写操作带自定义头，
  用来堵「不需要 JSON body 的简单请求」——`POST /ladder/reset` 配 `text/plain` 就能盲发清空进度。
  两条都是实测过的漏洞，不是理论担忧。校验**只认请求头，不认 `?sid=`**。
  新增写接口挂在 `couple` 路由下就自动受保护；另起前缀要自己补同样的检查。
- **降级必须如实标注。** 任何返回内容都要带 `source: 'ai' | 'local'`；用不上 AI 时给 `notice` 说明原因。
  禁止把本地题库结果标成 AI 生成。
- **亲密档不接 AI。** 主流供应商的内容审核会拒绝，`server/flight-chess/api.js` 的 `AI_LEVELS` 只含 `basic`。
  亲密档内容量取决于 `content.js` 里的人工积累。
- **移动端布局有几处刻意为之的写法，别当冗余清掉**：
  - `100vh` 后面总跟一行 `100dvh`。iOS 的 `100vh` 是地址栏收起时的大视口，
    单用它会让页面比可见区域高一个工具条；第二行是新浏览器生效、旧浏览器丢掉的正确回退链。
    合并成一行就是引入 bug。
  - `:hover` 规则一律包在 `@media (hover: hover) and (pointer: fine)` 里。
    iOS 点完会把 `:hover` 粘在元素上，卡片会僵在抬起位置、身体地图格子点完一直发暗；
    触屏反馈由 `:active` 负责。
  - `.lg-field` 字号固定 `16px`（不用 `--lg-fs-md`，那是 15px）。
    iOS Safari 聚焦小于 16px 的文本框会强制放大整页且不缩回。
  - `index.html` 的 `viewport-fit=cover` 是 `env(safe-area-inset-*)` 的前置条件，
    去掉它所有安全区 padding 都会静默失效。
  - 主导权的叫停按钮包在 `.pp-stopbar`（`position: sticky; bottom: 0`）里。
    它是唯一的撤回同意入口，必须不滚动就能按到；实测横屏下未钉底时按钮落在折叠线以下
    （bottom 462 / 视口 350）。不要改成普通流式按钮。
- **ESM 模块**（`"type": "module"`），生产部署必须包含完整项目（后端 API 不可分离）。
- WebSocket 路径 `/ws`，连接带 `?room=ROOM_ID`；第三人会被以 1013 拒绝，缺房间号以 1008 拒绝。
- 飞行棋 API 前缀是 `/api/flight-chess/`，不是 `/api/`。
- Express 固定在 4.x：`server/index.js` 的 SPA 兜底用了 `app.get('*')`，升 Express 5 会报错。
- **前端防回播要按值比对，不要用同步标志位。** Vue 的 `watch` 默认异步 flush，
  「置位 → 改值 → 复位」的守卫在回调执行时早已失效（Room.vue 的设置同步踩过这个坑），
  改成记录最后一次广播的指纹、值相同就不发。

## 界面约定

`.claude/frontend-rules.md` 是前端视觉规范的唯一来源，要点：

- 设计令牌集中在 `src/shared/styles.css` 的 `:root`，组件内不写死颜色/圆角/阴影/间距/字号
- 主题色只由 CSS 的 `.theme-<游戏id>` 类提供，`games-registry.js` 不存颜色
- 导航统一走 `src/shared/GameToolbar.vue`（sticky 顶栏，在游戏区域之外），不要把返回按钮绝对定位进画布
- 优先复用共享类：`lg-btn` / `lg-card` / `lg-badge` / `lg-source` / `lg-notice` / `lg-modal` / `lg-segment` / `lg-switch` / `lg-field`
