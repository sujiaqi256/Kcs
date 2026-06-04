<template>
  <view class="detail-page" v-if="ride">
    <!-- 发布者 -->
    <view class="user-section">
      <view class="user-avatar">{{ ride.avatar || '🦊' }}</view>
      <view class="user-info">
        <text class="user-name">{{ ride.nickname || '匿名' }}</text>
        <text class="user-date">{{ formatDate(ride.ride_date) }} · {{ ride.ride_time?.includes('-') ? ride.ride_time : ride.ride_time?.slice(0, 5) }}出发</text>
      </view>
      <view class="price-block">
        <text class="price-num">¥{{ ride.price }}</text>
        <text class="price-label">每人</text>
      </view>
    </view>

    <!-- 路线 -->
    <view class="route-section">
      <view class="route-item">
        <view class="route-dot from" />
        <view class="route-text">
          <text class="route-label">出发地</text>
          <text class="route-val">{{ ride.from_place }}</text>
        </view>
      </view>
      <view class="route-line" />
      <view class="route-item">
        <view class="route-dot to" />
        <view class="route-text">
          <text class="route-label">目的地</text>
          <text class="route-val">{{ ride.to_place }}</text>
        </view>
      </view>
    </view>

    <!-- 信息 -->
    <view class="info-section">
      <view class="info-row"><text class="info-icon">💺</text><view class="info-text"><text class="info-label">座位</text><text class="info-val">{{ ride.seats_taken }}/{{ ride.seats_total }} 已报名</text></view></view>
      <view class="info-row"><text class="info-icon">🏷️</text><view class="info-text"><text class="info-label">类型</text><text class="info-val">{{ ride.route_type || '校区往返' }}</text></view></view>
      <view class="info-row"><text class="info-icon">📝</text><view class="info-text"><text class="info-label">备注</text><text class="info-val">{{ ride.note || '无' }}</text></view></view>
    </view>

    <!-- 联系方式 -->
    <view v-if="ride.contact" class="contact-bar">
      <text class="contact-icon">📱</text>
      <view class="contact-info">
        <text class="contact-label">联系方式</text>
        <text class="contact-val">{{ ride.contact }}</text>
      </view>
      <view class="copy-btn" @tap="copyContact">复制</view>
    </view>

    <!-- 按钮 -->
    <view class="btn-row">
      <view v-if="ride.user_id === userStore.user?.id" class="delete-btn" @tap="handleDelete">删除拼车</view>
      <template v-else>
        <view class="contact-btn" :class="{ disabled: ride.seats_taken >= ride.seats_total }" @tap="goChat">💬 联系 TA</view>
        <view v-if="ride.contact" class="phone-btn" @tap="copyContact">📱</view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatDate } from '../../utils/format'

const userStore = useUserStore()
const ride = ref<any>(null)
const rideId = ref('')

onLoad((options: any) => { rideId.value = options?.id || '' })

const loadRide = async () => {
  if (!rideId.value) return
  try {
    const data = await sb(`carpool?id=eq.${rideId.value}`)
    ride.value = data?.[0] || null
  } catch (e) {}
}

const goChat = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  if (ride.value.seats_taken >= ride.value.seats_total) { uni.showToast({ title: '已满员', icon: 'none' }); return }
  const r = ride.value
  const params = `receiver_id=${r.user_id}&nickname=${encodeURIComponent(r.nickname || '')}&avatar=${encodeURIComponent(r.avatar || '')}&from_place=${encodeURIComponent(r.from_place)}&to_place=${encodeURIComponent(r.to_place)}`
  uni.navigateTo({ url: `/pages/chat/index?${params}` })
}

const copyContact = () => {
  uni.setClipboardData({ data: ride.value.contact, success: () => uni.showToast({ title: '已复制', icon: 'success' }) })
}

const handleDelete = () => {
  uni.showModal({
    title: '删除拼车',
    content: '确定删除这条拼车？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await sb(`carpool?id=eq.${rideId.value}`, { method: 'DELETE', prefer: 'return=minimal' })
          uni.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1000)
        } catch (e) { uni.showToast({ title: '删除失败', icon: 'none' }) }
      }
    }
  })
}

onMounted(() => { loadRide() })
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.user-section { display: flex; gap: 12px; align-items: center; padding: 18px 22px 16px; border-bottom: 1px solid #ffffff0d; }
.user-avatar { width: 48px; height: 48px; border-radius: 14px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
.user-info { flex: 1; }
.user-name { color: #fff; font-size: 16px; font-weight: 700; display: block; }
.user-date { color: #888; font-size: 12px; display: block; margin-top: 2px; }
.price-block { text-align: right; }
.price-num { color: #F0A500; font-size: 24px; font-weight: 800; display: block; }
.price-label { color: #aaa; font-size: 11px; display: block; }

.route-section { padding: 16px 22px; border-bottom: 1px solid #ffffff0d; }
.route-item { display: flex; align-items: center; gap: 12px; }
.route-dot { width: 10px; height: 10px; border-radius: 5px; }
.route-dot.from { background: #2ECC71; }
.route-dot.to { background: #FF6B6B; }
.route-text { flex: 1; }
.route-label { color: #888; font-size: 11px; display: block; }
.route-val { color: #fff; font-size: 15px; font-weight: 600; display: block; }
.route-line { width: 1px; height: 24px; background: #ffffff15; margin: 4px 0 4px 4px; }

.info-section { padding: 0 22px; }
.info-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #ffffff08; }
.info-icon { font-size: 18px; }
.info-text { flex: 1; }
.info-label { color: #888; font-size: 11px; display: block; margin-bottom: 2px; }
.info-val { color: #fff; font-size: 14px; font-weight: 600; display: block; }

.contact-bar { margin: 16px 22px; padding: 14px 16px; background: #4DD0E115; border: 1px solid #4DD0E133; border-radius: 14px; display: flex; align-items: center; gap: 10px; }
.contact-icon { font-size: 20px; }
.contact-info { flex: 1; }
.contact-label { color: #888; font-size: 11px; display: block; margin-bottom: 2px; }
.contact-val { color: #4DD0E1; font-size: 15px; font-weight: 700; word-break: break-all; display: block; }
.copy-btn { background: #4DD0E122; border-radius: 10px; padding: 8px 12px; color: #4DD0E1; font-size: 12px; font-weight: 600; }

.btn-row { padding: 16px 22px 0; display: flex; gap: 10px; }
.delete-btn { flex: 1; background: #FF6B6B22; border: 1px solid #FF6B6B44; border-radius: 14px; padding: 13px; color: #FF6B6B; font-size: 14px; font-weight: 700; text-align: center; }
.contact-btn { flex: 1; background: linear-gradient(135deg, #4DD0E1, #64B5F6); border-radius: 14px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; text-align: center; }
.contact-btn.disabled { background: #333; color: #fff; opacity: 0.5; }
.phone-btn { background: #ffffff11; border: 1px solid #ffffff22; border-radius: 14px; padding: 13px 16px; color: #aaa; font-size: 13px; font-weight: 600; }
</style>
