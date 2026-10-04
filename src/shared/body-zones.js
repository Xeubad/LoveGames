/**
 * 身体分区定义
 *
 * 放在 shared/ 而不是 games/body-map/ 下，因为限时主导权也要用分区标签
 * （把接收方标为禁区的身区分区显示成这一轮的硬边界）。
 *
 * 刻意用抽象矩形色块而不是写实人体轮廓：
 * 一来点击区域干净不重叠，二来这是个「偏好地图」而非解剖图。
 * 坐标基于 viewBox 0 0 200 440，左右对称的成对部位合并成一个区
 * （区分左臂右臂对偏好标注没有实际意义）。
 */

const mirror = (x, y, w, h, rx) => [
  { x, y, w, h, rx },
  { x: 200 - x - w, y, w, h, rx }
]

export const VIEWS = {
  front: {
    label: '正面',
    zones: [
      { id: 'hair', label: '头发', shapes: [{ x: 70, y: 12, w: 60, h: 36, rx: 18 }] },
      { id: 'face', label: '脸与唇', shapes: [{ x: 76, y: 50, w: 48, h: 36, rx: 16 }] },
      { id: 'neckF', label: '颈前', shapes: [{ x: 88, y: 88, w: 24, h: 16, rx: 6 }] },
      { id: 'chest', label: '胸', shapes: [{ x: 64, y: 106, w: 72, h: 52, rx: 14 }] },
      { id: 'belly', label: '腹', shapes: [{ x: 68, y: 160, w: 64, h: 42, rx: 12 }] },
      { id: 'waist', label: '腰侧', shapes: [{ x: 70, y: 204, w: 60, h: 26, rx: 10 }] },
      { id: 'hip', label: '髋', shapes: [{ x: 66, y: 232, w: 68, h: 36, rx: 12 }] },
      { id: 'armIn', label: '手臂内侧', shapes: mirror(40, 110, 22, 104, 11) },
      { id: 'palm', label: '手掌', shapes: mirror(38, 218, 24, 26, 10) },
      { id: 'thighF', label: '大腿前', shapes: mirror(68, 272, 28, 76, 12) },
      { id: 'kneeF', label: '膝', shapes: mirror(70, 352, 24, 16, 8) },
      { id: 'calfF', label: '小腿前', shapes: mirror(70, 372, 24, 48, 10) },
      { id: 'footF', label: '脚背', shapes: mirror(68, 424, 28, 14, 6) }
    ]
  },
  back: {
    label: '背面',
    zones: [
      { id: 'headB', label: '后脑', shapes: [{ x: 70, y: 12, w: 60, h: 74, rx: 26 }] },
      { id: 'nape', label: '后颈', shapes: [{ x: 88, y: 88, w: 24, h: 16, rx: 6 }] },
      { id: 'shoulderBlade', label: '肩胛', shapes: [{ x: 64, y: 106, w: 72, h: 38, rx: 12 }] },
      { id: 'upperBack', label: '上背', shapes: [{ x: 66, y: 146, w: 68, h: 42, rx: 12 }] },
      { id: 'lowerBack', label: '下背与后腰', shapes: [{ x: 70, y: 190, w: 60, h: 40, rx: 12 }] },
      { id: 'butt', label: '臀', shapes: [{ x: 66, y: 232, w: 68, h: 40, rx: 14 }] },
      { id: 'armB', label: '手臂后侧', shapes: mirror(40, 110, 22, 104, 11) },
      { id: 'handB', label: '手背', shapes: mirror(38, 218, 24, 26, 10) },
      { id: 'thighB', label: '大腿后', shapes: mirror(68, 272, 28, 104, 12) },
      { id: 'calfB', label: '小腿后', shapes: mirror(70, 380, 24, 40, 10) }
    ]
  }
}

export const MARK_VALUES = [
  { value: 'like', label: '喜欢', icon: '💗' },
  { value: 'ok', label: '一般', icon: '😐' },
  { value: 'no', label: '禁区', icon: '🚫' }
]

export const ALL_ZONES = [...VIEWS.front.zones, ...VIEWS.back.zones]

export const ZONE_LABELS = Object.fromEntries(ALL_ZONES.map((z) => [z.id, z.label]))

/** 点击循环：未标注 → 喜欢 → 一般 → 禁区 → 未标注 */
export function nextMark(current) {
  const order = [null, 'like', 'ok', 'no']
  const index = order.indexOf(current || null)
  return order[(index + 1) % order.length]
}

/**
 * 叠加两人标注，给出每个区的关系类别。
 * @returns {{zoneId:string, label:string, category:string}[]}
 */
export function overlayMarks(marksA, marksB) {
  return ALL_ZONES.map((zone) => {
    const a = marksA[zone.id] || null
    const b = marksB[zone.id] || null
    return { zoneId: zone.id, label: zone.label, a, b, category: categorize(a, b) }
  })
}

export const CATEGORIES = {
  consensus: { label: '共识区', icon: '💞', hint: '双方都喜欢', tone: 'accent' },
  mutualOk: { label: '都可以', icon: '🙂', hint: '双方都觉得一般', tone: 'muted' },
  mutualNo: { label: '共同禁区', icon: '🚫', hint: '双方都标了禁区', tone: 'danger' },
  talk: { label: '沟通区', icon: '🗣️', hint: '一方喜欢，另一方一般或拒绝 —— 值得聊一次', tone: 'warn' },
  oneSided: { label: '单方标注', icon: '·', hint: '只有一方标了', tone: 'faint' },
  unset: { label: '未标注', icon: '·', hint: '双方都没标', tone: 'faint' }
}

function categorize(a, b) {
  if (!a && !b) return 'unset'
  if (!a || !b) return 'oneSided'
  if (a === 'like' && b === 'like') return 'consensus'
  if (a === 'no' && b === 'no') return 'mutualNo'
  if (a === 'ok' && b === 'ok') return 'mutualOk'
  if (a === 'like' || b === 'like') return 'talk'
  return 'mutualOk'
}
