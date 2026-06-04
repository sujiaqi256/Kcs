<template>
  <view class="profile-page">
    <!-- 用户卡片 -->
    <view class="user-card">
      <view v-if="userStore.isLoggedIn && userStore.user" class="user-info">
        <view class="avatar">{{ userStore.user.avatar || '🦊' }}</view>
        <view class="user-text">
          <text class="nickname">{{ userStore.user.nickname || '未设置昵称' }}</text>
          <text class="sid">学号 {{ userStore.user.student_id }}</text>
        </view>
        <view class="edit-btn" @tap="goEdit">编辑 ›</view>
      </view>
      <view v-else class="guest-info" @tap="goLogin">
        <view class="avatar guest-avatar">🦊</view>
        <view class="user-text">
          <text class="nickname">游客</text>
          <text class="sid">点击绑定学号</text>
        </view>
        <text class="login-arrow">›</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-section">
      <view class="menu-item" @tap="goSchedule">
        <text class="menu-icon">📅</text>
        <text class="menu-label">我的课表</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goCourses">
        <text class="menu-icon">📚</text>
        <text class="menu-label">已选课程</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goRooms">
        <text class="menu-icon">🏫</text>
        <text class="menu-label">空教室查询</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goGrades">
        <text class="menu-icon">📊</text>
        <text class="menu-label">成绩查询</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goCourseSelection">
        <text class="menu-icon">🎯</text>
        <view class="menu-text-wrap">
          <text class="menu-label">选课系统</text>
          <text class="menu-sub">点击进入</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <view class="menu-section">
      <view class="menu-item" @tap="syncSchedule">
        <text class="menu-icon">🔄</text>
        <text class="menu-label">同步教务课表</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="clearCache">
        <text class="menu-icon">🗑️</text>
        <text class="menu-label">清除缓存</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @tap="goAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-label">关于</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 快捷服务 -->
    <view class="section-title">校园服务</view>
    <view class="services-grid">
      <view class="service-item" @tap="goSchedule">
        <text class="service-icon">📋</text>
        <text class="service-text">课表</text>
      </view>
      <view class="service-item" @tap="goCourseSelection">
        <text class="service-icon">🎯</text>
        <text class="service-text">选课</text>
      </view>
      <view class="service-item" @tap="goGrades">
        <text class="service-icon">📊</text>
        <text class="service-text">成绩</text>
      </view>
      <view class="service-item" @tap="goRooms">
        <text class="service-icon">🏫</text>
        <text class="service-text">空教室</text>
      </view>
      <view class="service-item" @tap="syncSchedule">
        <text class="service-icon">🔄</text>
        <text class="service-text">同步</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view v-if="userStore.isLoggedIn" class="logout-btn" @tap="handleLogout">
      <text class="logout-text">退出登录</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '../../stores/user'
import { syncSchedule as apiSyncSchedule } from '../../utils/backend'

const userStore = useUserStore()
const user = computed(() => userStore.user)

const goLogin = () => uni.navigateTo({ url: '/pages/login/index' })
const goEdit = () => uni.showToast({ title: '编辑资料功能开发中', icon: 'none' })
const goSchedule = () => uni.switchTab({ url: '/pages/schedule/index' })
const goCourses = () => uni.showToast({ title: '已选课程功能开发中', icon: 'none' })
const goGrades = () => uni.showToast({ title: '成绩查询功能开发中', icon: 'none' })
const goRooms = () => uni.navigateTo({ url: '/pages/rooms/index' })
const goCourseSelection = () => {
  if (!userStore.isLoggedIn) { goLogin(); return }
  uni.navigateTo({ url: '/pages/course-selection/index' })
}
const goAbout = () => uni.showToast({ title: '校园助手 v1.0.0', icon: 'none' })

const syncSchedule = async () => {
  if (!userStore.isLoggedIn) { goLogin(); return }
  uni.showLoading({ title: '同步中...' })
  try {
    const data = await apiSyncSchedule(userStore.studentId)
    if (data?.ok) {
      uni.showToast({ title: '同步成功', icon: 'success' })
    } else {
      uni.showToast({ title: data?.error || '同步失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '网络错误', icon: 'none' })
  }
  uni.hideLoading()
}

const clearCache = () => {
  uni.showModal({
    title: '清除缓存',
    content: '确定清除所有缓存数据？',
    success: (res) => {
      if (res.confirm) {
        try {
          const token = uni.getStorageSync('kcs_token')
          const sid = uni.getStorageSync('kcs_student_id')
          const auth = uni.getStorageSync('kcs_auth_token')
          const u = uni.getStorageSync('kcs_user')
          uni.clearStorageSync()
          if (token) uni.setStorageSync('kcs_token', token)
          if (sid) uni.setStorageSync('kcs_student_id', sid)
          if (auth) uni.setStorageSync('kcs_auth_token', auth)
          if (u) uni.setStorageSync('kcs_user', u)
          uni.showToast({ title: '已清除', icon: 'success' })
        } catch (e) {
          uni.showToast({ title: '清除失败', icon: 'none' })
        }
      }
    }
  })
}

const handleLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
        uni.showToast({ title: '已退出', icon: 'success' })
      }
    }
  })
}
</script>

<style scoped>
.profile-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }

.user-card { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 24px 20px; margin-bottom: 12px; }
.user-info, .guest-info { display: flex; align-items: center; gap: 14px; }
.avatar { width: 60px; height: 60px; border-radius: 18px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 30px; flex-shrink: 0; }
.guest-avatar { opacity: 0.5; }
.user-text { flex: 1; }
.nickname { font-size: 18px; font-weight: 700; color: #fff; display: block; }
.sid { font-size: 12px; color: #888; margin-top: 4px; display: block; }
.edit-btn { color: #4DD0E1; font-size: 13px; background: #4DD0E122; padding: 6px 12px; border-radius: 20px; }
.login-arrow { color: #888; font-size: 22px; }

.menu-section { background: #1a1a2e; margin: 0 0 12px; border-top: 1px solid #ffffff0d; border-bottom: 1px solid #ffffff0d; }
.menu-item { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid #ffffff08; }
.menu-item:last-child { border-bottom: none; }
.menu-icon { font-size: 20px; margin-right: 14px; flex-shrink: 0; }
.menu-label { flex: 1; font-size: 15px; color: #fff; }
.menu-sub { font-size: 11px; color: #4DD0E1; margin-top: 2px; display: block; }
.menu-text-wrap { flex: 1; }
.menu-arrow { color: #555; font-size: 18px; }

.section-title { color: #888; font-size: 12px; font-weight: 600; padding: 16px 20px 8px; }
.services-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 0 16px 16px; }
.service-item { background: #1e2a3a; border-radius: 14px; padding: 16px 8px; text-align: center; }
.service-icon { font-size: 26px; display: block; margin-bottom: 6px; }
.service-text { font-size: 12px; color: #aaa; }

.logout-btn { margin: 24px 16px; background: #FF6B6B22; border: 1px solid #FF6B6B44; border-radius: 14px; padding: 14px; text-align: center; }
.logout-text { color: #FF6B6B; font-size: 15px; font-weight: 600; }
</style>
