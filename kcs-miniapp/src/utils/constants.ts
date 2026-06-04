const SEMESTER_KEY = 'kcs_semester_start'

export function getSemesterStart(): Date | null {
  try {
    const stored = uni.getStorageSync(SEMESTER_KEY)
    if (stored) return new Date(stored)
  } catch (e) {}
  return null
}

export function setSemesterStart(dateStr: string) {
  try { uni.setStorageSync(SEMESTER_KEY, dateStr) } catch (e) {}
}

export function calcSemesterWeek(semStartDate: Date, targetDate: Date): number | null {
  if (!semStartDate) return null
  const monday = new Date(semStartDate)
  const day = monday.getDay()
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  const diff = target.getTime() - monday.getTime()
  return Math.floor(diff / (7 * 24 * 3600 * 1000)) + 1
}

export function getTargetDate(offset: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + offset * 7)
  return d
}

export const COLORS = [
  { color: '#FF8A65', light: '#FFF3EE' },
  { color: '#4DD0E1', light: '#E0FAFC' },
  { color: '#64B5F6', light: '#E3F2FD' },
  { color: '#81C784', light: '#E8F5E9' },
  { color: '#CE93D8', light: '#F3E5F5' },
  { color: '#FFD54F', light: '#FFFDE7' },
  { color: '#4DB6AC', light: '#E0F2F1' },
  { color: '#F06292', light: '#FCE4EC' },
  { color: '#4FC3F7', light: '#E1F5FE' },
  { color: '#A5D6A7', light: '#E8F5E9' },
  { color: '#FFCC80', light: '#FFF8E1' },
  { color: '#EF9A9A', light: '#FFEBEE' },
]

export function getCourseColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export const NODE_ROW: Record<string, number> = { '1-2': 0, '3-4': 1, '5-6': 2, '7-8': 3, '9-10': 4, '9-11': 4, '11-12': 5, '11': 5 }

export const TIME_ROWS = [
  { node: '1-2', label: '1-2', start: '08:20', end: '09:55' },
  { node: '3-4', label: '3-4', start: '10:15', end: '11:50' },
  { node: '5-6', label: '5-6', start: '14:30', end: '16:05' },
  { node: '7-8', label: '7-8', start: '16:25', end: '18:00' },
  { node: '9-11', label: '9-11', start: '19:00', end: '20:35' },
  { node: '11-12', label: '11-12', start: '20:40', end: '21:25' },
]

export const PERIOD_TIMES = [
  { period: 1, label: '第1节', start: '08:20', end: '09:00' },
  { period: 2, label: '第2节', start: '09:10', end: '09:55' },
  { period: 3, label: '第3节', start: '10:15', end: '11:00' },
  { period: 4, label: '第4节', start: '11:00', end: '11:50' },
  { period: 5, label: '第5节', start: '14:30', end: '15:15' },
  { period: 6, label: '第6节', start: '15:25', end: '16:05' },
  { period: 7, label: '第7节', start: '16:25', end: '17:10' },
  { period: 8, label: '第8节', start: '17:10', end: '18:00' },
  { period: 9, label: '第9节', start: '19:00', end: '19:45' },
  { period: 10, label: '第10节', start: '19:55', end: '20:35' },
  { period: 11, label: '第11节', start: '20:40', end: '21:25' },
]

export function getNodeTime(node: string): string {
  if (!node) return ''
  if (node === '9-11') return '19:00 - 21:25'
  const row = TIME_ROWS[NODE_ROW[node]]
  return row ? `${row.start} - ${row.end}` : ''
}

export const DAYS = ['日', '一', '二', '三', '四', '五', '六']
export const DAY_INDEX: Record<string, number> = { '周日': 0, '周一': 1, '周二': 2, '周三': 3, '周四': 4, '周五': 5, '周六': 6, '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7 }

export function getRealWeekNum(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
}

export function getWeekDates(weekOffset: number = 0) {
  const today = new Date()
  const sunday = new Date(today)
  sunday.setDate(today.getDate() - today.getDay() + weekOffset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return { month: d.getMonth() + 1, date: d.getDate(), full: d }
  })
}
