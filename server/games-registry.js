/**
 * 游戏注册表
 *
 * 新增游戏只需：
 * 1. 在 GAMES 数组中添加元数据
 * 2. 在 server/index.js 中挂载对应的 API 路由
 * 3. 在 src/router/index.js 中添加前端路由
 * 4. 在 src/shared/styles.css 中添加 .theme-<id> 主题色块
 *
 * 颜色不放在这里：主题色的唯一来源是 styles.css 的 .theme-<id>，
 * 大厅卡片与各游戏页面都通过 class 应用，避免两处配置漂移。
 */
export const GAMES = [
  {
    id: 'truth-or-dare',
    name: '真心话大冒险',
    description: '经典情侣问答，支持本地同屏轮流与实时联机，AI 生成题目',
    icon: '💕',
    route: '/truth-or-dare'
  },
  {
    id: 'flight-chess',
    name: '情侣飞行棋',
    description: '40 格棋盘，每格都有甜蜜任务，率先到达终点获胜',
    icon: '🎲',
    route: '/flight-chess'
  },
  {
    id: 'secret-match',
    name: '默契解锁',
    description: '各自秘密选一项后同时揭晓。选中同一项才显示内容，没对上不会暴露对方选了什么',
    icon: '🎴',
    route: '/secret-match'
  },
  {
    id: 'warmup-ladder',
    name: '升温阶梯',
    description: '七级强度阶梯，双方独立作答，有共识才升级，整级零共识即为天花板。进度长期保存',
    icon: '🪜',
    route: '/warmup-ladder'
  },
  {
    id: 'body-map',
    name: '身体地图',
    description: '各自私密标注喜欢/一般/禁区，双方都标完才叠加，显示共识区与值得聊一次的沟通区',
    icon: '🗺️',
    route: '/body-map'
  },
  {
    id: 'power-play',
    name: '限时主导权',
    description: '抽定谁主导一段时间，接收方标过的禁区自动成为硬边界，指令池取自阶梯共识，随时可叫停',
    icon: '👑',
    route: '/power-play'
  }
]

export function getGameById(id) {
  return GAMES.find((g) => g.id === id)
}
