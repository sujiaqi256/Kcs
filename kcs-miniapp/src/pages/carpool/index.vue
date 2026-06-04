<template>
  <view class="carpool-page">
    <!-- 顶部 -->
    <view class="header">
      <view class="header-top">
        <view class="header-left">
          <text class="title">校园拼车</text>
          <text class="subtitle">省钱·安全·顺风</text>
        </view>
        <view class="header-btns">
          <view class="msg-btn" @tap="goChatList">
            💬
            <view v-if="unreadCount > 0" class="badge">{{ unreadCount }}</view>
          </view>
          <view class="publish-btn" @tap="goPublish">+ 发起拼车</view>
        </view>
      </view>
      <!-- 搜索 -->
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input class="search-input" v-model="searchText" placeholder="搜索出发地或目的地..." />
        <text v-if="searchText" class="search-clear" @tap="searchText = ''">✕</text>
      </view>
      <!-- 分类 -->
      <scroll-view scroll-x class="tag-scroll">
        <view class="tag-list">
          <view v-for="t in ROUTE_TYPES" :key="t" class="tag-pill" :class="{ active: activeType === t }" @tap="activeType = t">{{ t }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 统计 -->
    <view class="stats">
      <view class="stat-card">
        <text class="stat-icon">🚗</text>
        <text class="stat-num">{{ todayCount }}趟</text>
        <text class="stat-label">今日发车</text>
      </view>
      <view class="stat-card">
        <text class="stat-icon">👥</text>
        <text class="stat-num">{{ totalSuccess }}次</text>
        <text class="stat-label">已拼成功</text>
      </view>
      <view class="stat-card" @tap="showRouteRank = true">
        <text class="stat-icon">📍</text>
        <text class="stat-route">{{ topRouteStr }}</text>
        <text class="stat-label">热门路线 ›</text>
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="loading" class="loading">
      <text class="loading-icon">⏳</text>
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="filtered.length === 0" class="empty">
      <text class="empty-emoji">🚗</text>
      <text class="empty-title">{{ searchText ? '没有找到匹配的拼车' : '暂无拼车信息' }}</text>
      <text class="empty-sub">{{ searchText ? '换个关键词试试' : '发起第一趟拼车吧！' }}</text>
    </view>
    <view v-else class="ride-list">
      <view v-for="(r, i) in filtered" :key="r.id" class="ride-card" :style="{ animationDelay: i * 0.05 + 's' }" @tap="goDetail(r)">
        <!-- 顶部 -->
        <view class="ride-top">
          <view class="ride-user">
            <view class="ride-avatar">{{ r.avatar || '🦊' }}</view>
            <view class="ride-user-info">
              <view class="ride-nick-row">
                <text class="ride-nick">{{ r.nickname || '匿名' }}</text>
                <text v-if="r.user_id === userStore.user?.id" class="mine-badge">我发布的</text>
              </view>
              <text class="ride-date">{{ formatDate(r.ride_date) }}</text>
            </view>
          </view>
          <view class="ride-price">
            <text class="price-num">¥{{ r.price }}</text>
            <text class="price-label">每人</text>
          </view>
        </view>
        <!-- 时间 -->
        <view class="time-bar">
          <text class="time-icon">🕐</text>
          <text class="time-text">{{ r.ride_time?.includes('-') ? r.ride_time : r.ride_time?.slice(0, 5) || '' }}</text>
        </view>
        <!-- 路线 -->
        <view class="route-bar">
          <view class="route-from">{{ r.from_place }}</view>
          <text class="route-arrow">→</text>
          <view class="route-to">{{ r.to_place }}</view>
        </view>
        <!-- 底部 -->
        <view class="ride-bottom">
          <text class="seat-tag" :class="{ full: r.seats_taken >= r.seats_total }">
            {{ r.seats_taken >= r.seats_total ? '已满' : `💺 剩${r.seats_total - r.seats_taken}座` }}
          </text>
          <text class="type-tag">{{ r.route_type }}</text>
          <view class="seat-bar">
            <view class="seat-fill" :style="{ width: Math.round((r.seats_taken / r.seats_total) * 100) + '%', background: r.seats_taken >= r.seats_total ? '#FF6B6B' : '#F0A500' }" />
          </view>
        </view>
      </view>
    </view>

    <!-- 路线热度 -->
    <view v-if="showRouteRank" class="modal-mask" @tap="showRouteRank = false">
      <view class="modal-sheet" @tap.stop>
        <view class="modal-handle" />
        <view class="modal-title-row"><text class="modal-title">🔥 路线热度排名</text></view>
        <view v-for="(item, i) in rankedRoutes" :key="item.route" class="rank-item">
          <view class="rank-num" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">{{ i + 1 }}</view>
          <view class="rank-info">
            <text class="rank-title">{{ item.route }}</text>
            <view class="rank-bar"><view class="rank-fill" :style="{ width: (item.count / maxRouteCount) * 100 + '%' }" /></view>
          </view>
          <text class="rank-count">{{ item.count }}次</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatDate } from '../../utils/format'

const userStore = useUserStore()
const ROUTE_TYPES = ['全部', '校区往返', '高铁站', '城际']

const rides = ref<any[]>([])
const loading = ref(true)
const searchText = ref('')
const activeType = ref('全部')
const unreadCount = ref(0)
const showRouteRank = ref(false)

const filtered = computed(() => rides.value.filter(r => {
  if (activeType.value !== '全部' && r.route_type !== activeType.value) return false
  if (searchText.value.trim()) {
    const s = searchText.value.trim().toLowerCase()
    return r.from_place.toLowerCase().includes(s) || r.to_place.toLowerCase().includes(s)
  }
  return true
}))

const todayStr = new Date().toISOString().slice(0, 10)
const todayCount = computed(() => rides.value.filter(r => r.ride_date === todayStr).length)
const totalSuccess = computed(() => rides.value.reduce((s, r) => s + (r.seats_taken || 0), 0))

const rankedRoutes = computed(() => {
  const routeCount: Record<string, number> = {}
  rides.value.forEach(r => { const k = `${r.from_place} → ${r.to_place}`; routeCount[k] = (routeCount[k] || 0) + 1 })
  return Object.entries(routeCount).sort((a, b) => b[1] - a[1]).map(([route, count]) => ({ route, count }))
})
const maxRouteCount = computed(() => rankedRoutes.value[0]?.count || 1)
const topRouteStr = computed(() => rankedRoutes.value[0]?.route || '暂无数据')

const loadRides = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const data = (await sb(`carpool?ride_date=gte.${todayStr}&order=ride_date.asc,ride_time.asc&limit=50`)) || []
    rides.value = data.map((r: any) => ({ ...r, status: r.seats_taken >= r.seats_total ? 'full' : r.status }))
  } catch (e) {}
  if (!silent) loading.value = false
}

const loadUnread = async () => {
  const u = userStore.user
  if (!u) return
  try {
    const data = (await sb(`carpool_messages?receiver_id=eq.${u.id}&is_read=eq.false&select=id`)) || []
    unreadCount.value = data.length
  } catch (e) {}
}

const goPublish = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  uni.navigateTo({ url: '/pages/carpool/publish' })
}
const goDetail = (r: any) => uni.navigateTo({ url: `/pages/carpool/detail?id=${r.id}` })
const goChatList = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  uni.navigateTo({ url: '/pages/chat/list' })
}

let pollTimer: any = null
onMounted(() => {
  loadRides()
  loadUnread()
  pollTimer = setInterval(() => { loadRides(true); loadUnread() }, 30000)
})
import { onUnmounted } from 'vue'
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.carpool-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.header { background: linear-gradient(135deg, #0d2137, #1a3a5c); padding: 20px 16px 16px; }
.header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.header-left { }
.title { color: #fff; font-size: 22px; font-weight: 800; display: block; }
.subtitle { color: #aaa; font-size: 12px; margin-top: 2px; display: block; }
.header-btns { display: flex; gap: 8px; align-items: center; }
.msg-btn { position: relative; background: #ffffff15; color: #fff; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #FF6B6B; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.publish-btn { background: #F0A500; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; }

.search-bar { background: #ffffff15; border-radius: 14px; padding: 10px 14px; display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.search-icon { font-size: 14px; }
.search-input { flex: 1; background: none; border: none; color: #fff; font-size: 13px; }
.search-clear { color: #888; font-size: 14px; }
.tag-scroll { white-space: nowrap; }
.tag-list { display: flex; gap: 8px; }
.tag-pill { padding: 5px 14px; border-radius: 20px; background: #ffffff22; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.tag-pill.active { background: #F0A500; }

.stats { padding: 14px 16px; display: flex; gap: 8px; }
.stat-card { flex: 1; background: #1e2a3a; border-radius: 12px; padding: 10px 8px; text-align: center; }
.stat-icon { font-size: 16px; display: block; margin-bottom: 2px; }
.stat-num { color: #F0A500; font-size: 14px; font-weight: 800; display: block; }
.stat-label { color: #888; font-size: 9px; margin-top: 1px; display: block; }
.stat-route { color: #F0A500; font-size: 11px; font-weight: 800; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }

.loading { text-align: center; padding: 40px; color: #555; }
.loading-icon { font-size: 30px; display: block; animation: spin 1s linear infinite; }
.loading-text { font-size: 13px; margin-top: 10px; display: block; }
.empty { text-align: center; padding: 50px 20px; }
.empty-emoji { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-title { color: #ccc; font-size: 15px; font-weight: 700; display: block; }
.empty-sub { color: #666; font-size: 13px; margin-top: 6px; display: block; }

.ride-list { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
.ride-card { background: #1e2a3a; border-radius: 18px; padding: 16px; animation: slideIn 0.3s ease both; }
.ride-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ride-user { display: flex; gap: 10px; align-items: center; }
.ride-avatar { width: 40px; height: 40px; border-radius: 12px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.ride-user-info { }
.ride-nick-row { display: flex; align-items: center; gap: 6px; }
.ride-nick { color: #fff; font-size: 13px; font-weight: 700; }
.mine-badge { background: #4DD0E122; color: #4DD0E1; border-radius: 10px; padding: 1px 6px; font-size: 9px; font-weight: 600; }
.ride-date { color: #888; font-size: 11px; display: block; }
.ride-price { text-align: right; }
.price-num { color: #F0A500; font-size: 20px; font-weight: 800; display: block; }
.price-label { color: #aaa; font-size: 10px; display: block; }

.time-bar { background: #F0A50015; border: 1px solid #F0A50033; border-radius: 10px; padding: 8px 12px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
.time-icon { font-size: 16px; }
.time-text { color: #F0A500; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }

.route-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.route-from { flex: 1; background: #2ECC7122; color: #2ECC71; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; text-align: center; }
.route-arrow { color: #F0A500; font-size: 16px; font-weight: 900; }
.route-to { flex: 1; background: #4DD0E122; color: #4DD0E1; padding: 6px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; text-align: center; }

.ride-bottom { display: flex; gap: 8px; align-items: center; }
.seat-tag { background: #CE93D822; color: #CE93D8; border: 1px solid #CE93D844; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
.seat-tag.full { background: #FF6B6B22; color: #FF6B6B; border-color: #FF6B6B44; }
.type-tag { background: #ffffff0d; color: #888; border-radius: 20px; padding: 2px 8px; font-size: 10px; }
.seat-bar { margin-left: auto; width: 60px; height: 4px; background: #ffffff11; border-radius: 2px; overflow: hidden; }
.seat-fill { height: 100%; border-radius: 2px; transition: width 0.3s; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; }
.modal-sheet { width: 100%; max-width: 430px; background: #1e2a3a; border-radius: 28px 28px 0 0; padding-bottom: 40px; }
.modal-handle { width: 40px; height: 4px; background: #ffffff22; border-radius: 2px; margin: 10px auto 0; }
.modal-title-row { padding: 16px 22px 12px; }
.modal-title { color: #fff; font-size: 18px; font-weight: 800; }
.rank-item { display: flex; align-items: center; gap: 12px; padding: 12px 22px; border-bottom: 1px solid #ffffff0d; }
.rank-num { width: 24px; height: 24px; border-radius: 8px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; color: #888; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.rank-num.gold { background: #FFD700; color: #000; }
.rank-num.silver { background: #C0C0C0; color: #000; }
.rank-num.bronze { background: #CD7F32; color: #000; }
.rank-info { flex: 1; min-width: 0; }
.rank-title { color: #fff; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.rank-bar { margin-top: 4px; height: 4px; background: #ffffff11; border-radius: 2px; overflow: hidden; }
.rank-fill { height: 100%; background: linear-gradient(90deg, #F0A500, #FF8A65); border-radius: 2px; }
.rank-count { color: #F0A500; font-size: 14px; font-weight: 800; flex-shrink: 0; }
</style>
