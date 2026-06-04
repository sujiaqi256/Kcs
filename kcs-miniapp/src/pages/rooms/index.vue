<template>
  <view class="rooms-page">
    <!-- 楼栋选择 -->
    <view class="building-bar">
      <text class="page-title">空教室查询</text>
      <scroll-view scroll-x class="bld-scroll">
        <view class="bld-list">
          <view v-for="b in buildings" :key="b" class="bld-pill" :class="{ active: bld === b }" @tap="bld = b">{{ b }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 日期选择 -->
    <scroll-view scroll-x class="date-scroll">
      <view class="date-list">
        <view v-for="d in dateList" :key="d.dateStr" class="date-item" :class="{ active: selectedDate === d.dateStr }" @tap="selectedDate = d.dateStr">
          <text class="date-day" :class="{ active: selectedDate === d.dateStr }">周{{ d.day }}</text>
          <text class="date-num" :class="{ active: selectedDate === d.dateStr }">{{ d.date }}</text>
          <text v-if="d.isToday" class="date-today" :class="{ active: selectedDate === d.dateStr }">今天</text>
        </view>
      </view>
    </scroll-view>

    <!-- 图例 -->
    <view class="legend">
      <view class="legend-item"><view class="legend-dot" style="background:#2ECC71" /><text class="legend-text">空闲</text></view>
      <view class="legend-item"><view class="legend-dot" style="background:#FF6B6B" /><text class="legend-text">占用</text></view>
      <text class="legend-note">上午·下午·晚上</text>
    </view>

    <!-- 教室列表 -->
    <view v-if="loading" class="loading">
      <text class="loading-icon">⏳</text>
      <text class="loading-text">查询中...</text>
    </view>
    <view v-else-if="rooms.length === 0" class="empty">
      <text class="empty-text">暂无数据</text>
    </view>
    <view v-else class="room-list">
      <view v-for="(r, i) in rooms" :key="r.id || i" class="room-card">
        <view class="room-info">
          <text class="room-name">{{ r.name }}</text>
          <text class="room-free">今日空闲 {{ (r.free_periods || []).length }} 节</text>
        </view>
        <view class="period-bars">
          <view v-for="(grp, gi) in PERIOD_GROUPS" :key="gi" class="period-group">
            <view v-if="gi > 0" class="period-sep" />
            <view v-for="(node, ni) in grp.nodes" :key="ni" class="period-bar" :class="{ free: (r.free_periods || []).includes(node) }" />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { sb } from '../../utils/supabase'

const buildings = ['J1', 'J2', 'J3', 'J4', 'S1', 'S2', 'S3', 'S4']
const PERIOD_GROUPS = [
  { label: '上午', nodes: [1, 2, 3, 4] },
  { label: '下午', nodes: [5, 6, 7, 8] },
  { label: '晚上', nodes: [9, 10, 11] },
]

const bld = ref('J1')
const rooms = ref<any[]>([])
const loading = ref(true)
const selectedDate = ref(new Date().toISOString().slice(0, 10))

const dateList = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return {
    dateStr: d.toISOString().slice(0, 10),
    month: d.getMonth() + 1,
    date: d.getDate(),
    day: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
    isToday: i === 0,
  }
})

const loadRooms = async () => {
  loading.value = true
  try {
    const data = await sb(`empty_rooms?building=eq.${bld.value}&date=eq.${selectedDate.value}&order=name.asc&limit=200`)
    rooms.value = data || []
  } catch (e) {
    rooms.value = []
  }
  loading.value = false
}

onMounted(() => { loadRooms() })

import { watch } from 'vue'
watch([bld, selectedDate], () => { loadRooms() })
</script>

<style scoped>
.rooms-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.building-bar { background: linear-gradient(135deg, #0f3460, #16213e); padding: 20px 16px 14px; }
.page-title { color: #fff; font-size: 22px; font-weight: 800; margin-bottom: 14px; display: block; }
.bld-scroll { white-space: nowrap; }
.bld-list { display: flex; gap: 8px; }
.bld-pill { padding: 6px 16px; border-radius: 20px; background: #ffffff22; color: #fff; font-weight: 600; font-size: 13px; flex-shrink: 0; }
.bld-pill.active { background: #4DD0E1; }

.date-scroll { background: #16213e; padding: 10px 0; border-bottom: 1px solid #ffffff0d; white-space: nowrap; }
.date-list { display: flex; gap: 8px; padding: 0 16px; }
.date-item { flex-shrink: 0; text-align: center; padding: 8px 12px; border-radius: 12px; }
.date-item.active { background: #4DD0E1; border: 1px solid #4DD0E1; }
.date-day { font-size: 10px; color: #888; display: block; }
.date-day.active { color: #fff; }
.date-num { font-size: 14px; font-weight: 700; color: #ccc; display: block; margin-top: 2px; }
.date-num.active { color: #fff; }
.date-today { font-size: 9px; color: #4DD0E1; display: block; margin-top: 1px; }
.date-today.active { color: #fff; }

.legend { background: #16213e; padding: 10px 16px; display: flex; gap: 20px; align-items: center; border-bottom: 1px solid #ffffff0d; }
.legend-item { display: flex; gap: 6px; align-items: center; }
.legend-dot { width: 12px; height: 12px; border-radius: 3px; }
.legend-text { color: #aaa; font-size: 12px; }
.legend-note { color: #555; font-size: 11px; margin-left: auto; }

.loading { text-align: center; padding: 50px; color: #555; }
.loading-icon { font-size: 28px; display: block; animation: spin 1s linear infinite; }
.loading-text { font-size: 12px; margin-top: 8px; display: block; }
.empty { text-align: center; padding: 50px; color: #666; font-size: 14px; }

.room-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
.room-card { background: #1e2a3a; border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
.room-info { flex: 1; min-width: 0; }
.room-name { font-size: 15px; font-weight: 700; color: #fff; display: block; }
.room-free { font-size: 11px; color: #888; margin-top: 2px; display: block; }
.period-bars { display: flex; gap: 5px; align-items: center; flex-shrink: 0; }
.period-group { display: flex; gap: 2px; align-items: center; }
.period-sep { width: 1px; height: 22px; background: #ffffff22; margin-right: 3px; }
.period-bar { width: 7px; height: 22px; border-radius: 3px; background: #FF6B6B; opacity: 0.9; }
.period-bar.free { background: #2ECC71; }
</style>
