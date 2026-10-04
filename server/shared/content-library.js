/**
 * 平台级内容库
 *
 * 所有游戏的条目都从这里取，不再各自维护一份。
 * 亲密档（couple）只能来自人工积累 —— 主流大模型的内容审核会拒绝生成该类内容，
 * 所以设计上就不接 AI。AI 仅用于温馨档的扩充，见 server/shared/ai-client.js。
 *
 * 关于 dimension / intensity：
 * 这两个字段是**数据不是代码**。下面是我按保守口径打的初标，
 * 觉得不准直接改这里的数字即可，三个游戏都按字段消费，改数据不用动代码。
 *
 * intensity 口径：
 *   1 = 日常亲密，无性意味        2 = 明确浪漫/亲密
 *   3 = 情欲意味明显但非直接      4 = 直接的性相关行为
 *   5 = 明确的性行为或高强度
 */

export const DIMENSIONS = {
  express: { label: '表达与注视', icon: '💬' },
  touch: { label: '肢体触碰', icon: '🤲' },
  kiss: { label: '亲吻', icon: '💋' },
  sensory: { label: '感官探索', icon: '🌡️' },
  power: { label: '主导与服从', icon: '👑' },
  display: { label: '展示与暴露', icon: '🎭' },
  play: { label: '趣味与情境', icon: '🎈' },
  intimate: { label: '亲密行为', icon: '🔥' }
}

export const TIERS = {
  basic: { label: '温馨档', icon: '💕', maxIntensity: 2 },
  couple: { label: '亲密档', icon: '🔥', maxIntensity: 5 }
}

/**
 * props = 需要准备的道具；requireNoProps 的查询会把这些排除掉，
 * 免得抽到「用冰块…」结果家里没有冰块。
 */
const LIBRARY = [
  // ============ 温馨档 basic ============
  { id: 'b-01', text: '学猫叫三声', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-02', text: '一起恶搞自拍', tier: 'basic', dimension: 'play', intensity: 1, props: ['手机'] },
  { id: 'b-03', text: '给对方说悄悄话', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-04', text: '给对方按小腿1分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-05', text: '对视5秒', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-06', text: '喂对方喝水', tier: 'basic', dimension: 'touch', intensity: 1, props: ['水杯'] },
  { id: 'b-07', text: '手牵手30秒', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-08', text: '拥抱30秒', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-09', text: '尝试接吻的感觉', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'b-10', text: '说说初次见面的感受', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-11', text: '牵着对方的手，用拇指慢慢摩挲手背一分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-12', text: '对方闭上眼睛给你涂口红', tier: 'basic', dimension: 'play', intensity: 2, props: ['口红'] },
  { id: 'b-13', text: '面对面互相按摩对方的太阳穴一分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-14', text: '猪八戒背媳妇', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-15', text: '摸对方耳朵2秒', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },
  { id: 'b-16', text: '摸对方头10秒', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-17', text: '给对方唱首歌', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-18', text: '一起喝一杯水', tier: 'basic', dimension: 'play', intensity: 1, props: ['水杯'] },
  { id: 'b-19', text: '拍一段表白的视频留作纪念', tier: 'basic', dimension: 'express', intensity: 1, props: ['手机'] },
  { id: 'b-20', text: '给对方梳头发', tier: 'basic', dimension: 'touch', intensity: 1, props: ['梳子'] },
  { id: 'b-21', text: '对方站着自己跪着喂食物', tier: 'basic', dimension: 'power', intensity: 2, props: ['食物'] },
  { id: 'b-22', text: '给对方按摩捶背1分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-23', text: '亲吻对方手背30秒', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'b-24', text: '紧紧拥抱对方，把呼吸调到同一个节奏，持续一分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-25', text: '亲吻一下对方的手', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'b-26', text: '【惩罚】被挠痒痒30秒', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-27', text: '从背后抱对方1分钟', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },
  { id: 'b-28', text: '亲吻对方额头', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },

  // ---- 表达与注视（原 basic 只有 5 条，这一维才是「关系升温」的主力）----
  { id: 'b-29', text: '看着对方的眼睛，说出三个你欣赏TA的具体细节', tier: 'basic', dimension: 'express', intensity: 2, props: [] },
  { id: 'b-30', text: '用一分钟告诉对方你今天最想感谢TA的一件事', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-31', text: '闭眼听对方说30秒话，然后复述你听到的重点', tier: 'basic', dimension: 'express', intensity: 2, props: [] },
  { id: 'b-32', text: '说出你们第一次约会时你心里真实的第一印象', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-33', text: '一起编一句只属于你们两人的暗号，并解释含义', tier: 'basic', dimension: 'express', intensity: 2, props: [] },
  { id: 'b-34', text: '对视一分钟，先笑的人要接受一个小惩罚', tier: 'basic', dimension: 'express', intensity: 1, props: [] },
  { id: 'b-35', text: '说出一件你一直想夸却没好意思夸的事', tier: 'basic', dimension: 'express', intensity: 2, props: [] },

  // ---- 趣味与情境 ----
  { id: 'b-36', text: '用对方的口头禅说三句话', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-37', text: '玩一局石头剪刀布，输的人满足赢的人一个小要求', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-38', text: '模仿对方的走路姿势，让对方猜你模仿的是谁', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-39', text: '一起玩一局双人手机游戏，输的人接受惩罚', tier: 'basic', dimension: 'play', intensity: 1, props: ['手机'] },
  { id: 'b-40', text: '一人一句接龙讲一个属于你们的故事，讲满十句', tier: 'basic', dimension: 'play', intensity: 1, props: [] },
  { id: 'b-41', text: '互相给对方取一个新昵称，接下来一小时只能用昵称称呼', tier: 'basic', dimension: 'play', intensity: 2, props: [] },

  // ---- 肢体触碰 ----
  { id: 'b-42', text: '十指交扣，安静地坐着不说话一分钟', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },
  { id: 'b-43', text: '帮对方揉肩颈两分钟', tier: 'basic', dimension: 'touch', intensity: 1, props: [] },
  { id: 'b-44', text: '把对方的手放在自己心口，一起深呼吸五次', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },
  { id: 'b-45', text: '用指尖在对方背上写一句话，让TA猜写了什么', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },
  { id: 'b-46', text: '抱着对方，同时说出你此刻的一个真实感受', tier: 'basic', dimension: 'touch', intensity: 2, props: [] },

  // ---- 亲吻 ----
  { id: 'b-47', text: '亲吻对方的鼻尖', tier: 'basic', dimension: 'kiss', intensity: 1, props: [] },
  { id: 'b-48', text: '在对方脸颊上亲三下，每一下说一个理由', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'b-49', text: '慢慢接吻十秒，不许笑场', tier: 'basic', dimension: 'kiss', intensity: 2, props: [] },

  // ---- 感官探索（basic 原本完全没有这一维）----
  { id: 'b-50', text: '蒙上眼睛，只靠触摸猜对方递给你的是什么东西', tier: 'basic', dimension: 'sensory', intensity: 1, props: ['眼罩或布条'] },
  { id: 'b-51', text: '蒙上眼睛，靠味觉猜对方喂给你的是什么食物', tier: 'basic', dimension: 'sensory', intensity: 1, props: ['眼罩或布条', '食物'] },
  { id: 'b-52', text: '闭上眼，让对方用不同方式触碰你的手背，猜是哪一种', tier: 'basic', dimension: 'sensory', intensity: 2, props: [] },
  { id: 'b-53', text: '关掉大灯只留一点光，安静靠在一起听完一首歌', tier: 'basic', dimension: 'sensory', intensity: 1, props: [] },

  // ---- 展示（basic 原本完全没有这一维，这里是最轻的版本）----
  { id: 'b-54', text: '走一段台步给对方看，姿势由对方指定', tier: 'basic', dimension: 'display', intensity: 1, props: [] },
  { id: 'b-55', text: '展示你今天的穿搭，并说出为什么这么搭', tier: 'basic', dimension: 'display', intensity: 1, props: [] },
  { id: 'b-56', text: '摆一个你觉得最好看的姿势，让对方拍下来', tier: 'basic', dimension: 'display', intensity: 2, props: ['手机'] },

  // ---- 主导与服从（basic 原本只有 1 条，这里是不涉及亲密的轻量版）----
  { id: 'b-57', text: '接下来五分钟，对方说的三个指令你都要照做', tier: 'basic', dimension: 'power', intensity: 2, props: [] },
  { id: 'b-58', text: '由对方决定你接下来一分钟的表情，你要一直保持', tier: 'basic', dimension: 'power', intensity: 1, props: [] },

  // ============ 亲密档 couple ============
  { id: 'c-01', text: '轻轻的在对方耳朵边吹气10下', tier: 'couple', dimension: 'sensory', intensity: 3, props: [] },
  { id: 'c-02', text: '在镜子前拥吻', tier: 'couple', dimension: 'kiss', intensity: 3, props: ['镜子'] },
  { id: 'c-03', text: '依次亲吻对方脸、脖子、锁骨', tier: 'couple', dimension: 'kiss', intensity: 3, props: [] },
  { id: 'c-04', text: '让对方躺下，做一遍从头到脚的全身按摩，持续五分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-05', text: '将对方压在身下做十个俯卧撑', tier: 'couple', dimension: 'play', intensity: 3, props: [] },
  { id: 'c-06', text: '两人钻进被窝里亲亲', tier: 'couple', dimension: 'kiss', intensity: 3, props: [] },
  { id: 'c-07', text: '双方对视20秒', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-08', text: '当天一起洗澡', tier: 'couple', dimension: 'sensory', intensity: 4, props: [] },
  { id: 'c-09', text: '撅起臀，让对方打10下', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-10', text: '隔着内衣裤抚摸对方30秒', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-11', text: '互相拥抱一分钟，同时轻抚对方的臀', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-12', text: '男生公主抱女生，并坚持15秒', tier: 'couple', dimension: 'play', intensity: 2, props: [] },
  { id: 'c-13', text: '闭上眼睛，让对方为所欲为1分钟', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-14', text: '亲吻对方的脸颊', tier: 'couple', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'c-15', text: '与对方舌吻30秒', tier: 'couple', dimension: 'kiss', intensity: 3, props: [] },
  { id: 'c-16', text: '用指腹轻揉对方的臀，画圈十次，力度由TA口头调整', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-17', text: '脱掉对方指定的衣服', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-18', text: '用整个手掌贴着对方的后背慢慢画圈30秒', tier: 'couple', dimension: 'touch', intensity: 3, props: [] },
  { id: 'c-19', text: '和对方法式湿吻20秒', tier: 'couple', dimension: 'kiss', intensity: 4, props: [] },
  { id: 'c-20', text: '脱掉一件衣服', tier: 'couple', dimension: 'display', intensity: 3, props: [] },
  { id: 'c-21', text: '单膝下跪亲吻对方的手', tier: 'couple', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'c-22', text: '抚摸对方的大腿30秒', tier: 'couple', dimension: 'touch', intensity: 3, props: [] },
  { id: 'c-23', text: '亲吻对方的胸部30秒', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-24', text: '背对对方扭动屁股', tier: 'couple', dimension: 'display', intensity: 3, props: [] },
  { id: 'c-25', text: '买一个情趣用品', tier: 'couple', dimension: 'play', intensity: 3, props: [] },
  { id: 'c-26', text: '什么都不做', tier: 'couple', dimension: 'play', intensity: 1, props: [] },
  { id: 'c-27', text: '轻舔对方的耳垂10秒钟', tier: 'couple', dimension: 'sensory', intensity: 3, props: [] },
  { id: 'c-28', text: '用冰块在对方身上轻轻滑动，直到融化', tier: 'couple', dimension: 'sensory', intensity: 3, props: ['冰块'] },
  { id: 'c-29', text: '给对方一个轻柔的脚部按摩，持续2分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-30', text: '展示一种性感的舞蹈，持续1分钟', tier: 'couple', dimension: 'display', intensity: 3, props: [] },
  { id: 'c-31', text: '用丝巾或眼罩绑住对方的眼睛，进行一个感官探索游戏', tier: 'couple', dimension: 'sensory', intensity: 4, props: ['眼罩或丝巾'] },
  { id: 'c-32', text: '一起观看一部情色电影或阅读一本情趣小说，然后聊聊感受', tier: 'couple', dimension: 'play', intensity: 3, props: ['影片或书'] },
  { id: 'c-33', text: '制作一份属于你们两人的亲密指南，写下喜好、愿望和界限', tier: 'couple', dimension: 'express', intensity: 4, props: ['纸笔'] },
  { id: 'c-34', text: '使用食物进行亲吻和舔舐，例如巧克力酱或水果', tier: 'couple', dimension: 'sensory', intensity: 4, props: ['食物'] },
  { id: 'c-35', text: '和对方一起尝试新的姿势或技巧', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-36', text: '用舌尖轻轻刺激对方耳朵', tier: 'couple', dimension: 'sensory', intensity: 3, props: [] },
  { id: 'c-37', text: '轻轻咬住对方的耳垂', tier: 'couple', dimension: 'sensory', intensity: 3, props: [] },
  { id: 'c-38', text: '为对方做一个放松的肩部按摩', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-39', text: '直接抚摸对方下体，力度和节奏由TA口头调整', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-40', text: '由对方决定你接下来一分钟只能使用哪一只手', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-41', text: '温柔地抚摸对方的胸部30秒', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-42', text: '相互用手掌轻轻触摸对方的敏感部位', tier: 'couple', dimension: 'intimate', intensity: 4, props: [] },
  { id: 'c-43', text: '用口红在对方身上写下甜蜜的留言', tier: 'couple', dimension: 'display', intensity: 3, props: ['口红'] },
  { id: 'c-44', text: '穿上情趣内衣，给对方一个私密的表演时刻', tier: 'couple', dimension: 'display', intensity: 4, props: ['情趣内衣'] },
  { id: 'c-45', text: '为对方唱一首歌或朗诵一段情诗', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-46', text: '模仿对方的声音和样子，玩起角色扮演游戏', tier: 'couple', dimension: 'play', intensity: 3, props: [] },
  { id: 'c-47', text: '本局结束前一直戴着眼罩', tier: 'couple', dimension: 'sensory', intensity: 3, props: ['眼罩'] },

  // ============ 主导与服从（原缺口：只有 5 条） ============
  // 这一维度的安全性写在条目本身：先约定安全词、先约定停/继续规则，
  // 而不是事后挂一个警告标签 —— 机制内建比提示有效。
  { id: 'c-50', text: '接下来10分钟由你决定做什么，对方只能答应', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-51', text: '用领带或丝巾松松地绑住对方双手5分钟，期间由你主导', tier: 'couple', dimension: 'power', intensity: 4, props: ['领带或丝巾'] },
  { id: 'c-52', text: '对方跪坐在你面前，听你说出三个指令并逐一执行', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-53', text: '先约定一个安全词，然后15分钟内一方完全听从另一方', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-54', text: '由你指定一个姿势，对方保持2分钟不动', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-55', text: '用命令的语气说出你想让对方做的三件事', tier: 'couple', dimension: 'power', intensity: 3, props: [] },
  { id: 'c-56', text: '对方每做一个动作前都要先开口请求你的允许，连续三轮', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-57', text: '交换主导权：平时更主动的一方这次完全被动10分钟', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-58', text: '由主导方决定这一轮接吻的节奏与时长，另一方只能配合', tier: 'couple', dimension: 'power', intensity: 4, props: [] },
  { id: 'c-59', text: '你说「停」对方必须立刻停下，说「继续」才能继续，玩三轮', tier: 'couple', dimension: 'power', intensity: 3, props: [] },

  // ============ 展示与暴露（原缺口：只有 6 条） ============
  { id: 'c-60', text: '在只亮一盏灯房间里，慢慢走一圈给对方看', tier: 'couple', dimension: 'display', intensity: 4, props: [] },
  { id: 'c-61', text: '穿上对方挑的一件衣服（或不穿），走一段台步', tier: 'couple', dimension: 'display', intensity: 4, props: [] },
  { id: 'c-62', text: '用浴巾遮住自己，由对方决定什么时候揭开', tier: 'couple', dimension: 'display', intensity: 4, props: ['浴巾'] },
  { id: 'c-63', text: '对着镜子，告诉对方你最喜欢自己身体的哪一处', tier: 'couple', dimension: 'display', intensity: 3, props: ['镜子'] },
  { id: 'c-64', text: '让对方闭眼，你摆一个姿势，然后让TA睁眼猜你想表达什么', tier: 'couple', dimension: 'display', intensity: 3, props: [] },
  { id: 'c-65', text: '说出一件你想尝试但一直没敢说出口的装扮或情境', tier: 'couple', dimension: 'display', intensity: 3, props: [] },

  // ============ 强度 5（原缺口：非户外只有 2 条，L7 抽不满 3 条） ============
  { id: 'c-66', text: '由一方全程主导一次完整的性行为，另一方只负责配合', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-67', text: '尝试一个你们都没有试过的体位', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-68', text: '用口给对方快感，直到对方示意停下', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-69', text: '蒙眼并松松束缚双手，全程由对方决定怎么进行', tier: 'couple', dimension: 'power', intensity: 5, props: ['眼罩', '丝巾'] },
  { id: 'c-70', text: '一起洗澡，并在浴室里完成一次完整的亲密行为', tier: 'couple', dimension: 'intimate', intensity: 5, props: [] },
  { id: 'c-71', text: '在对方注视下自我抚慰，然后交换角色', tier: 'couple', dimension: 'display', intensity: 5, props: [] },

  // ============ 亲密档强度 2：过渡带 ============
  // 这是「初步越界」的入口档（升温阶梯 L3 只用这一带）。
  // 比温馨档更亲密、更裸露情绪，但不涉及直接的性相关行为 —— 那是强度 3 以上的事。
  // 亲密档原本几乎没有表达类和轻柔触碰类，会让阶梯从 L2 跳到 L4 时断层，
  // 所以这里专门补这两个维度。
  { id: 'c-72', text: '让对方躺在你腿上，你轻轻抚摸TA的头发五分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-73', text: '让对方背对你坐着，你用额头轻靠TA的后背一分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-74', text: '帮对方按摩手掌和每一根手指，持续三分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-75', text: '用指尖沿着对方的手臂内侧慢慢划过，来回三次', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-76', text: '面对面坐着，把双手贴在对方脸颊上停留一分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-77', text: '帮对方涂身体乳，顺手按摩肩颈和手臂', tier: 'couple', dimension: 'touch', intensity: 2, props: ['身体乳'] },
  { id: 'c-78', text: '让对方枕在你胸口躺三分钟，期间谁都不说话', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-79', text: '握住对方的手腕，安静感受TA的脉搏一分钟', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-80', text: '用指尖从对方的额头慢慢划到下巴，重复三次', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-81', text: '把对方的手贴在自己脸上，让TA感受你说话时的表情', tier: 'couple', dimension: 'touch', intensity: 2, props: [] },
  { id: 'c-82', text: '说出一个你在关系里一直没说出口的不安', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-83', text: '说出对方身上最让你心动的一处，以及是从什么时候开始的', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-84', text: '说出一个你希望两人一起尝试的小改变，不解释原因也可以', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-85', text: '描述一个你希望两人共度的夜晚，从进门到入睡', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-86', text: '告诉对方你最喜欢TA看你时的哪一种眼神', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-87', text: '说出你今天最想被对方怎样对待', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-88', text: '回忆一次你们身体接触时你最心动的瞬间，说给对方听', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-89', text: '用三句话告诉对方你为什么选择TA', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-90', text: '说出一个你从未告诉过任何人的、关于自己的小事', tier: 'couple', dimension: 'express', intensity: 2, props: [] },
  { id: 'c-91', text: '告诉对方TA做的哪件小事让你觉得被爱', tier: 'couple', dimension: 'express', intensity: 2, props: [] },

  // ============ 亲吻补强 ============
  // 原来 i4 只有 1 条、i5 是 0 —— L6 几乎抽不到亲吻类，L7 完全没有。
  { id: 'c-92', text: '亲吻对方的手腕内侧，左右各一次', tier: 'couple', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'c-93', text: '用嘴唇轻碰对方的睫毛，然后亲一下眼角', tier: 'couple', dimension: 'kiss', intensity: 2, props: [] },
  { id: 'c-94', text: '闭眼接吻一分钟，期间谁都不许说话', tier: 'couple', dimension: 'kiss', intensity: 3, props: [] },
  { id: 'c-95', text: '隔着衣服亲吻对方的胸口，感受TA的心跳', tier: 'couple', dimension: 'kiss', intensity: 3, props: [] },
  { id: 'c-96', text: '一边深吻一边慢慢脱掉对方的一件衣服', tier: 'couple', dimension: 'kiss', intensity: 4, props: [] },
  { id: 'c-97', text: '把对方抵在墙上接吻，持续一分钟', tier: 'couple', dimension: 'kiss', intensity: 4, props: [] },
  { id: 'c-98', text: '从嘴唇一路向下亲吻到腹部', tier: 'couple', dimension: 'kiss', intensity: 4, props: [] },
  { id: 'c-99', text: '深吻两分钟，同时把手探入对方衣服下摆', tier: 'couple', dimension: 'kiss', intensity: 4, props: [] },
  { id: 'c-100', text: '从开始到结束一直保持接吻，中间不分开', tier: 'couple', dimension: 'kiss', intensity: 5, props: [] },
  { id: 'c-101', text: '用嘴从对方的颈侧一路向下，经过胸口直到大腿内侧', tier: 'couple', dimension: 'kiss', intensity: 5, props: [] },

  // ============ 趣味与情境补强 ============
  // 原来 i4/i5 都是 0 —— L6、L7 完全没有这一维，阶梯到高档就只剩亲密行为。
  // 带赌注/道具的条目把「事先约定上限」写进条目本身，边界是玩法的一部分。
  { id: 'c-102', text: '用只有你们两个人懂的方式调情三分钟，不许把话说明白', tier: 'couple', dimension: 'play', intensity: 2, props: [] },
  { id: 'c-103', text: '互相喂对方吃一样东西，全程不许用手', tier: 'couple', dimension: 'play', intensity: 2, props: ['食物'] },
  { id: 'c-104', text: '抽一个情境即兴演两分钟小剧场，题材由对方指定', tier: 'couple', dimension: 'play', intensity: 3, props: [] },
  { id: 'c-105', text: '玩「谁先笑谁输」：轮流说情话或做鬼脸，先笑的人接受一个惩罚', tier: 'couple', dimension: 'play', intensity: 3, props: [] },
  { id: 'c-106', text: '玩一局脱衣猜拳，每输一局脱一件，事先约定好脱到第几件为止', tier: 'couple', dimension: 'play', intensity: 4, props: [] },
  { id: 'c-107', text: '用骰子决定接下来做什么：1到6对应你们事先写好的六个选项', tier: 'couple', dimension: 'play', intensity: 4, props: ['骰子', '纸笔'] },
  { id: 'c-108', text: '闭眼从面前几样东西里摸一样，摸到什么就用什么', tier: 'couple', dimension: 'play', intensity: 4, props: ['眼罩'] },
  { id: 'c-109', text: '各自写下一个关于今晚的具体要求，同时翻开，两人都要照做', tier: 'couple', dimension: 'play', intensity: 5, props: ['纸笔'] },

  // ============ 触碰 / 表达 / 感官 补强 ============
  // 原来 L6（强度4）完全没有 touch，L7（强度5）没有 express / touch / sensory，
  // 高档位只剩亲密行为一种节奏。这里把缺的格子补上。
  // 注意：touch 的强度5 是**刻意留空**的 —— 直接性化的触碰归 intimate，
  // 硬塞进 touch 会破坏维度语义。
  { id: 'c-110', text: '把手伸进对方衣服里，贴着皮肤抚摸腰腹两分钟', tier: 'couple', dimension: 'touch', intensity: 4, props: [] },
  { id: 'c-111', text: '让对方趴着，从后颈沿脊柱一路轻抚到尾椎，来回三次', tier: 'couple', dimension: 'touch', intensity: 4, props: [] },
  { id: 'c-112', text: '用指尖沿对方大腿内侧慢慢上移，停在TA示意的位置', tier: 'couple', dimension: 'touch', intensity: 4, props: [] },
  { id: 'c-113', text: '说出你今天最想被对方触碰的地方，直接说不绕弯', tier: 'couple', dimension: 'express', intensity: 3, props: [] },
  { id: 'c-114', text: '描述一个你想和对方尝试的具体场景，说满一分钟', tier: 'couple', dimension: 'express', intensity: 3, props: [] },
  { id: 'c-115', text: '告诉对方TA在亲密时刻做的哪一件事最让你有感觉', tier: 'couple', dimension: 'express', intensity: 3, props: [] },
  { id: 'c-116', text: '说出一个你一直想试却从没提过的亲密行为', tier: 'couple', dimension: 'express', intensity: 4, props: [] },
  { id: 'c-117', text: '告诉对方你身体最敏感的一处，并示范你想要的力度', tier: 'couple', dimension: 'express', intensity: 4, props: [] },
  { id: 'c-118', text: '在过程中实时说出你此刻最想要的下一步', tier: 'couple', dimension: 'express', intensity: 5, props: [] },
  { id: 'c-119', text: '蒙上眼睛，让对方用不同材质的东西轻触你的手臂，猜是什么', tier: 'couple', dimension: 'sensory', intensity: 2, props: ['眼罩或布条'] },
  { id: 'c-120', text: '关掉灯，只靠触觉找到对方的手并握住一分钟', tier: 'couple', dimension: 'sensory', intensity: 2, props: [] },
  { id: 'c-121', text: '蒙眼状态下完成一次完整的亲密行为，中途不许摘下', tier: 'couple', dimension: 'sensory', intensity: 5, props: ['眼罩'] },
  { id: 'c-122', text: '用温热的按摩油和冰块交替触碰对方，由对方决定何时结束', tier: 'couple', dimension: 'sensory', intensity: 5, props: ['按摩油', '冰块'] },

  // ============ 户外/公共场合类，单独标记 ============
  // 这两条在自家之外的场所执行有法律与隐私风险，默认不参与随机抽取，
  // 需要用 includePublic: true 显式开启。
  { id: 'c-48', text: '在户外找一个安静的地方，亲吻对方', tier: 'couple', dimension: 'kiss', intensity: 4, props: [], public: true },
  { id: 'c-49', text: '在阳台或花园里短暂裸露，享受自然的触感', tier: 'couple', dimension: 'display', intensity: 5, props: [], public: true }
]

export const ITEM_COUNT = LIBRARY.length

export function getById(id) {
  return LIBRARY.find((item) => item.id === id) || null
}

/**
 * 条件查询。所有条件都是可选的，取交集。
 * @param {object} [filter]
 * @param {string} [filter.tier]                 限定档位
 * @param {string[]} [filter.dimensions]         限定维度（任一命中）
 * @param {number} [filter.minIntensity]         强度下限（含）
 * @param {number} [filter.maxIntensity]         强度上限（含）
 * @param {string[]} [filter.excludeIds]         排除的条目 ID
 * @param {boolean} [filter.requireNoProps]      true 时排除需要道具的条目
 * @param {boolean} [filter.includePublic]       true 时才包含户外/公共场合条目
 */
export function query(filter = {}) {
  const {
    tier,
    dimensions,
    minIntensity = 1,
    maxIntensity = 5,
    excludeIds,
    requireNoProps = false,
    includePublic = false
  } = filter

  const excluded = new Set(excludeIds || [])
  const wanted = dimensions ? new Set(dimensions) : null

  return LIBRARY.filter((item) => {
    if (tier && item.tier !== tier) return false
    if (wanted && !wanted.has(item.dimension)) return false
    if (item.intensity < minIntensity || item.intensity > maxIntensity) return false
    if (excluded.has(item.id)) return false
    if (requireNoProps && item.props.length > 0) return false
    if (item.public && !includePublic) return false
    return true
  })
}

export function pickRandom(items, count) {
  const pool = [...items]
  const picked = []
  while (pool.length > 0 && picked.length < count) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
  }
  return picked
}

/** 按维度分组，用于「各维度还剩多少内容」的缺口报告 */
export function groupByDimension(items) {
  const groups = {}
  for (const key of Object.keys(DIMENSIONS)) groups[key] = []
  for (const item of items) groups[item.dimension].push(item)
  return groups
}

/** 内容量统计：总数、按档位、按维度、按强度 */
export function stats() {
  const byTier = {}
  const byDimension = {}
  const byIntensity = {}

  for (const item of LIBRARY) {
    byTier[item.tier] = (byTier[item.tier] || 0) + 1
    byDimension[item.dimension] = (byDimension[item.dimension] || 0) + 1
    byIntensity[item.intensity] = (byIntensity[item.intensity] || 0) + 1
  }

  return {
    total: LIBRARY.length,
    byTier,
    byDimension: Object.fromEntries(
      Object.keys(DIMENSIONS).map((key) => [key, { label: DIMENSIONS[key].label, count: byDimension[key] || 0 }])
    ),
    byIntensity: Object.fromEntries([1, 2, 3, 4, 5].map((n) => [n, byIntensity[n] || 0]))
  }
}
