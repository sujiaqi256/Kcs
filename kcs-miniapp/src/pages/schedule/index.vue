<template>
  <view class="schedule-page">
    <!-- 顶部控制栏 -->
    <view class="header">
      <view class="week-nav">
        <view class="nav-btn" @tap="prevWeek">‹</view>
        <view class="week-info">
          <text class="week-num">第{{ displaySemesterWeek }}周</text>
          <text class="year-week">年内第{{ displayYearWeek }}周</text>
        </view>
        <view class="nav-btn" @tap="nextWeek">›</view>
      </view>
      <view class="header-right">
        <view v-if="weekOffset !== 0" class="back-today" @tap="goToday">回今天</view>
        <view class="month-badge">{{ monthStr }}</view>
        <view class="view-toggle" :class="{ active: weekView }" @tap="weekView = !weekView">
          {{ weekView ? '日视图' : '周视图' }}
        </view>
      </view>
    </view>

    <!-- 日期选择栏 -->
    <view class="day-bar">
      <view
        v-for="(d, i) in DAYS.slice(0)"
        :key="i"
        class="day-item"
        :class="{ selected: i === selDay && !weekView, today: i === todayDayOfWeek && weekOffset === 0 }"
        @tap="selectDay(i)"
      >
        <text class="day-label">周{{ d }}</text>
        <view class="day-num" :class="{ todaycircle: i === todayDayOfWeek && weekOffset === 0 && i !== selDay }">
          {{ weekDates[i]?.date }}
        </view>
        <view v-if="i === todayDayOfWeek && weekOffset === 0 && i !== selDay" class="today-dot" />
      </view>
    </view>

    <!-- 周视图 -->
    <view v-if="weekView" class="week-grid-container">
      <scroll-view scroll-x class="week-scroll">
        <view class="week-grid" :style="{ width: gridWidth + 'px' }">
          <!-- 星期头 -->
          <view class="grid-row grid-header">
            <view class="time-col" />
            <view v-for="(d, i) in DAYS.slice(0)" :key="i" class="grid-day" :class="{ today: i === todayDayOfWeek && weekOffset === 0 }">
              <text class="grid-day-text">周{{ d }}</text>
              <view class="grid-day-num" :class="{ todaycircle: i === todayDayOfWeek && weekOffset === 0 }">
                {{ weekDates[i]?.date }}
              </view>
            </view>
          </view>
          <!-- 课程网格 -->
          <view v-for="(tr, rowIdx) in TIME_ROWS" :key="rowIdx" class="grid-row">
            <view class="time-col">
              <text class="time-start">{{ tr.start }}</text>
              <text class="time-label">节{{ tr.label }}</text>
              <text class="time-end">{{ tr.end }}</text>
            </view>
            <view
              v-for="(dayCol, di) in weekGrid"
              :key="di"
              class="grid-cell"
              :class="{ hidden: isHiddenCell(rowIdx, di) }"
              :style="{ height: cellHeight(rowIdx, di) + 'px' }"
              @tap="onCourseTap(dayCol[rowIdx])"
            >
              <view v-if="!isHiddenCell(rowIdx, di) && dayCol[rowIdx]" class="course-cell" :style="{ borderLeftColor: getColor(dayCol[rowIdx].name).color, background: getColor(dayCol[rowIdx].name).color + '2e' }">
                <text class="cell-name">{{ (dayCol[rowIdx].name || '').slice(0, 6) }}</text>
                <text class="cell-room" :style="{ color: getColor(dayCol[rowIdx].name).color }">@{{ dayCol[rowIdx].room }}</text>
              </view>
              <view v-else-if="!isHiddenCell(rowIdx, di)" class="empty-cell" />
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="week-hint">
        <text class="hint-text">{{ weekOffset - 1 >= minOffset ? '← 左滑上一周' : '← 已是第一周' }}</text>
        <text class="hint-week">第{{ displaySemesterWeek }}周</text>
        <text class="hint-text">{{ weekOffset + 1 <= maxOffset ? '右滑下一周 →' : '已是最后一周 →' }}</text>
      </view>
    </view>

    <!-- 日视图 -->
    <view v-else class="day-view">
      <view class="day-header">
        <text class="day-info">{{ selDay === todayDayOfWeek && weekOffset === 0 ? '今天 · ' : '' }}{{ weekDates[selDay]?.month }}/{{ weekDates[selDay]?.date }} · {{ dayCourses.length }} 门课</text>
      </view>
      <view class="day-courses">
        <view v-if="dayCourses.length === 0" class="empty-day">
          <text class="empty-emoji">🎉</text>
          <text class="empty-title">这天没有课</text>
          <text class="empty-sub">好好休息或自习吧～</text>
        </view>
        <view v-for="(c, i) in dayCourses" :key="i" class="course-card" :style="{ borderLeftColor: getColor(c.name).color, animationDelay: i * 0.08 + 's' }" @tap="onCourseTap(c)">
          <view class="course-icon" :style="{ background: getColor(c.name).light }">📖</view>
          <view class="course-info">
            <text class="course-name">{{ c.name }}</text>
            <view class="course-tags">
              <text class="tag" :style="{ background: getColor(c.name).color + '22', color: getColor(c.name).color, borderColor: getColor(c.name).color + '44' }">🏫 {{ c.room }}</text>
              <text class="tag tag-time">🕐 {{ c.node }}节 · {{ getNodeTime(c.node) }}</text>
            </view>
          </view>
          <text class="arrow">›</text>
        </view>
      </view>
      <view class="time-table">
        <view class="tt-header">📋 节次时间表</view>
        <view v-for="(t, i) in PERIOD_TIMES" :key="i" class="tt-row">
          <text class="tt-label">{{ t.label }}</text>
          <text class="tt-time">{{ t.start }} — {{ t.end }}</text>
        </view>
      </view>
    </view>

    <!-- 课程详情弹窗 -->
    <view v-if="selectedCourse" class="modal-mask" @tap="selectedCourse = null">
      <view class="modal-sheet" @tap.stop>
        <view class="modal-handle" />
        <view class="modal-header">
          <view class="modal-icon" :style="{ background: getColor(selectedCourse.name).light }">📚</view>
          <view class="modal-title-wrap">
            <text class="modal-title">{{ selectedCourse.name }}</text>
            <text class="modal-weeks" :style="{ color: getColor(selectedCourse.name).color }">第 {{ selectedCourse.weeks }} 周上课</text>
          </view>
        </view>
        <view class="modal-rows">
          <view class="modal-row"><text class="mr-icon">📍</text><text class="mr-label">上课地点</text><text class="mr-val">{{ selectedCourse.room }}</text></view>
          <view class="modal-row"><text class="mr-icon">🗓️</text><text class="mr-label">上课周次</text><text class="mr-val">第 {{ selectedCourse.weeks }} 周</text></view>
          <view class="modal-row"><text class="mr-icon">🕐</text><text class="mr-label">上课节次</text><text class="mr-val">第 {{ selectedCourse.node }} 节 · {{ getNodeTime(selectedCourse.node) }}</text></view>
          <view class="modal-row"><text class="mr-icon">👤</text><text class="mr-label">任课教师</text><text class="mr-val">{{ selectedCourse.teacher }}</text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { useAppStore } from '../../stores/app'
import { sb } from '../../utils/supabase'
import { DAYS, DAY_INDEX, TIME_ROWS, NODE_ROW, PERIOD_TIMES, getNodeTime, getWeekDates, getRealWeekNum, getCourseColor, calcSemesterWeek, getTargetDate } from '../../utils/constants'

const userStore = useUserStore()
const appStore = useAppStore()

watch(() => userStore.isLoggedIn, (v) => { if (v) loadCourses() })

const weekView = ref(false)
const weekOffset = ref(0)
const selDay = ref(new Date().getDay())
const courses = ref<any[]>([])
const loading = ref(true)
const selectedCourse = ref<any>(null)
const todayDayOfWeek = new Date().getDay()

const timeColWidth = 38
const colWidth = 50
const gridWidth = computed(() => timeColWidth + 7 * colWidth + 16)

const yearWeekNow = getRealWeekNum()
const displayYearWeek = computed(() => yearWeekNow + weekOffset.value)
const displaySemesterWeek = computed(() => {
  if (!appStore.semesterStart) return '?'
  const w = calcSemesterWeek(appStore.semesterStart, getTargetDate(weekOffset.value))
  return w ?? '?'
})
const weekDates = computed(() => getWeekDates(weekOffset.value))
const monthStr = computed(() => {
  const d = getTargetDate(weekOffset.value)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const getColor = getCourseColor

let minOffset = -30
let maxOffset = 30

const loadCourses = async () => {
  loading.value = true
  const sid = userStore.studentId
  if (!sid) { courses.value = []; loading.value = false; return }
  try {
    const data = await sb(`schedule?student_id=eq.${encodeURIComponent(sid)}&order=day.asc,node.asc&limit=500`)
    courses.value = (data || []).map((item: any) => ({
      ...item,
      weeks: item.weeks != null ? String(item.weeks) : '',
      day: item.day != null ? String(item.day) : '',
      node: item.node != null ? String(item.node) : '',
    }))
    let minSem = Infinity, maxSem = 0
    courses.value.forEach((item: any) => {
      if (!item.weeks) return
      const parts = item.weeks.split('-').map((n: string) => parseInt(n, 10)).filter((n: number) => !isNaN(n))
      if (parts.length === 2) { minSem = Math.min(minSem, parts[0]); maxSem = Math.max(maxSem, parts[1]) }
      else if (parts.length === 1) { minSem = Math.min(minSem, parts[0]); maxSem = Math.max(maxSem, parts[0]) }
    })
    if (minSem === Infinity || maxSem === 0) { minSem = 1; maxSem = 20 }
    appStore.semesterWeekRange = { min: minSem, max: maxSem }

    if (courses.value.length > 0) {
      const startDates = courses.value.map((c: any) => c.start_date).filter(Boolean).sort()
      if (startDates.length > 0) {
        const earliest = new Date(startDates[0])
        const day = earliest.getDay()
        const diff = day === 0 ? -6 : 1 - day
        earliest.setDate(earliest.getDate() + diff)
        const dateStr = earliest.toISOString().slice(0, 10)
        appStore.setSemesterStart(dateStr)
      } else if (!appStore.semesterStart) {
        appStore.setSemesterStart('2026-03-02')
      }
    }
  } catch (e) {
    console.error('加载课程失败:', e)
  }
  loading.value = false
}

const isInWeek = (weeksStr: string, semWeek: number) => {
  if (!weeksStr || semWeek == null) return false
  return weeksStr.split(',').some((seg: string) => {
    seg = seg.trim()
    const parts = seg.split('-')
    if (parts.length === 2) return semWeek >= parseInt(parts[0]) && semWeek <= parseInt(parts[1])
    return parseInt(seg) === semWeek
  })
}

const dayCourses = computed(() => {
  const semWeek = typeof displaySemesterWeek.value === 'number' ? displaySemesterWeek.value : null
  return courses.value.filter((c: any) => DAY_INDEX[c.day] === selDay.value && semWeek !== null && isInWeek(c.weeks, semWeek))
})

const weekGrid = computed(() => {
  const semWeek = typeof displaySemesterWeek.value === 'number' ? displaySemesterWeek.value : null
  const grid: any[][] = Array.from({ length: 7 }, () => Array(6).fill(null))
  if (semWeek === null || semWeek < appStore.semesterWeekRange.min || semWeek > appStore.semesterWeekRange.max) return grid
  courses.value.forEach((c: any) => {
    if (isInWeek(c.weeks, semWeek)) {
      const di = DAY_INDEX[c.day]
      const ri = NODE_ROW[c.node]
      if (di !== undefined && ri !== undefined && !grid[di][ri]) grid[di][ri] = c
    }
  })
  return grid
})

const isHiddenCell = (rowIdx: number, di: number) => {
  if (rowIdx === 5) {
    const cell4 = weekGrid.value[di]?.[4]
    return cell4 && cell4.node === '9-11'
  }
  return false
}

const cellHeight = (rowIdx: number, di: number) => {
  const cell = weekGrid.value[di]?.[rowIdx]
  if (cell && cell.node === '9-11' && rowIdx === 4) return 72 * 2 + 3
  return 72
}

const prevWeek = () => { if (weekOffset.value - 1 >= minOffset) weekOffset.value-- }
const nextWeek = () => { if (weekOffset.value + 1 <= maxOffset) weekOffset.value++ }
const goToday = () => { weekOffset.value = 0; selDay.value = todayDayOfWeek }
const selectDay = (i: number) => { selDay.value = i; weekView.value = false }
const onCourseTap = (c: any) => { if (c && c.name) selectedCourse.value = c }

onShow(() => { loadCourses() })
</script>

<style scoped>
.schedule-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.header { background: linear-gradient(160deg, #1a1a2e, #16213e); padding: 14px 16px 0; display: flex; align-items: center; justify-content: space-between; }
.week-nav { display: flex; align-items: center; gap: 8px; }
.nav-btn { background: #ffffff22; border: 1px solid #ffffff22; color: #4DD0E1; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.week-info { text-align: center; min-width: 72px; }
.week-num { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
.year-week { font-size: 10px; color: #4DD0E188; display: block; margin-top: 2px; }
.header-right { display: flex; gap: 6px; align-items: center; margin-left: auto; }
.back-today { background: #FF8A6522; border: 1px solid #FF8A6544; border-radius: 20px; padding: 4px 10px; color: #FF8A65; font-size: 11px; font-weight: 700; }
.month-badge { color: #4DD0E1; font-size: 12px; background: #4DD0E118; padding: 4px 10px; border-radius: 20px; border: 1px solid #4DD0E133; }
.view-toggle { background: #ffffff1a; border: 1px solid #ffffff22; border-radius: 20px; padding: 4px 12px; color: #fff; font-size: 11px; font-weight: 700; }
.view-toggle.active { background: #4DD0E1; border-color: #4DD0E1; }

.day-bar { display: flex; background: #16213e; padding: 8px 12px; gap: 1px; }
.day-item { flex: 1; text-align: center; padding: 6px 0; border-radius: 12px; }
.day-item.selected { background: #ffffff20; }
.day-item.today .day-num { background: #4DD0E1; color: #fff; }
.day-label { font-size: 10px; color: #777; display: block; }
.day-num { width: 26px; height: 26px; border-radius: 9px; margin: 2px auto 0; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #ccc; }
.day-num.todaycircle { background: #4DD0E1; color: #fff; }
.today-dot { width: 4px; height: 4px; background: #4DD0E1; border-radius: 50%; margin: 3px auto 0; }

.week-grid-container { padding: 8px 0; }
.week-scroll { white-space: nowrap; }
.week-grid { display: inline-block; }
.grid-header { margin-bottom: 4px; }
.grid-day { width: 50px; flex-shrink: 0; text-align: center; padding: 0 2px; box-sizing: border-box; }
.grid-day-text { font-size: 10px; color: #777; display: block; }
.grid-day-num { width: 26px; height: 26px; border-radius: 9px; margin: 2px auto 0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #bbb; }
.grid-day.today .grid-day-num, .grid-day-num.todaycircle { background: #4DD0E1; color: #fff; }

.grid-row { display: flex; margin-bottom: 3px; }
.grid-header { margin-bottom: 4px; }
.time-col { width: 38px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; padding-right: 4px; }
.time-start { font-size: 9px; color: #4DD0E1; font-weight: 700; }
.time-label { font-size: 8px; color: #555; }
.time-end { font-size: 9px; color: #555; }
.grid-cell { width: 50px; flex-shrink: 0; padding: 0 2px; }
.grid-cell.hidden { display: none; }
.course-cell { height: 100%; border-radius: 11px; border-left: 3px solid; padding: 5px 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
.cell-name { font-size: 10px; font-weight: 700; color: #fff; line-height: 1.3; word-break: break-all; }
.cell-room { font-size: 9px; line-height: 1.2; margin-top: 2px; }
.empty-cell { height: 100%; border-radius: 10px; background: #1c2535; }
.week-hint { display: flex; justify-content: center; gap: 5px; padding: 6px 0 2px; }
.hint-text { color: #555; font-size: 10px; }
.hint-week { color: #4DD0E1; font-size: 10px; font-weight: 700; }

.day-view { }
.day-header { background: #16213e; padding: 10px 16px; border-bottom: 1px solid #ffffff0d; }
.day-info { color: #4DD0E1; font-size: 13px; font-weight: 600; }
.day-courses { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.empty-day { text-align: center; padding: 50px 20px; }
.empty-emoji { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-title { color: #ccc; font-size: 16px; font-weight: 700; display: block; }
.empty-sub { font-size: 13px; color: #666; margin-top: 6px; display: block; }

.course-card { background: #1e2a3a; border-radius: 18px; padding: 14px 16px; border-left: 4px solid; display: flex; align-items: center; gap: 14px; animation: slideIn 0.3s ease both; }
.course-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.course-info { flex: 1; min-width: 0; }
.course-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 6px; display: block; }
.course-tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tag { border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; border: 1px solid transparent; }
.tag-time { background: #ffffff0d; color: #999; border: none; }
.arrow { color: #444; font-size: 18px; }

.time-table { margin: 0 16px 16px; background: #1e2a3a; border-radius: 16px; padding: 16px; }
.tt-header { color: #aaa; font-size: 12px; margin-bottom: 10px; font-weight: 600; }
.tt-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ffffff08; }
.tt-label { color: #4DD0E1; font-size: 12px; font-weight: 600; }
.tt-time { color: #ccc; font-size: 12px; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; }
.modal-sheet { width: 100%; max-width: 430px; background: #fff; border-radius: 28px 28px 0 0; padding-bottom: 40px; }
.modal-handle { width: 40px; height: 4px; background: #e0e0e0; border-radius: 2px; margin: 10px auto 0; }
.modal-header { display: flex; gap: 14px; align-items: center; padding: 18px 22px 16px; border-bottom: 1px solid #f2f2f2; }
.modal-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; }
.modal-title-wrap { flex: 1; }
.modal-title { font-size: 17px; font-weight: 800; color: #111; line-height: 1.3; display: block; }
.modal-weeks { font-size: 12px; margin-top: 4px; font-weight: 600; display: block; }
.modal-rows { }
.modal-row { display: flex; align-items: center; gap: 14px; padding: 14px 22px; border-bottom: 1px solid #f8f8f8; }
.mr-icon { font-size: 20px; }
.mr-label { font-size: 11px; color: #bbb; margin-bottom: 2px; display: block; }
.mr-val { font-size: 15px; font-weight: 700; color: #222; display: block; }
</style>
