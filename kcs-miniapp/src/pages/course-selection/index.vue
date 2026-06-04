<template>
  <view class="cs-page">
    <!-- 搜索栏 -->
    <view class="search-bar">
      <input class="search-input" v-model="keyword" placeholder="搜索课程名称或教师..." @confirm="search" />
      <view class="search-btn" @tap="search">搜索</view>
    </view>

    <!-- 课程类型 -->
    <view class="type-bar">
      <view class="type-btn" :class="{ active: courseType === 'gx' }" @tap="courseType = 'gx'; loadCourses()">公选课</view>
      <view class="type-btn" :class="{ active: courseType === 'bx' }" @tap="courseType = 'bx'; loadCourses()">必修课</view>
    </view>

    <!-- 课程列表 -->
    <view v-if="loading" class="loading">
      <text class="loading-icon">⏳</text>
      <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="courses.length === 0" class="empty">
      <text class="empty-emoji">📚</text>
      <text class="empty-title">暂无可选课程</text>
      <text class="empty-sub">{{ keyword ? '换个关键词试试' : '请搜索课程' }}</text>
    </view>
    <scroll-view v-else scroll-y class="course-scroll">
      <view v-for="c in courses" :key="c.id" class="course-card">
        <view class="course-info">
          <text class="course-name">{{ c.name }}</text>
          <text class="course-teacher">{{ c.teacher }}</text>
          <view class="course-meta">
            <text class="meta-item">学时: {{ c.hours }}</text>
            <text class="meta-item">学分: {{ c.credit }}</text>
          </view>
          <view class="capacity-bar">
            <view class="capacity-fill" :style="{ width: c.capacity > 0 ? Math.round(((c.capacity - c.remaining) / c.capacity) * 100) + '%' : '0%' }" />
          </view>
          <text class="capacity-text">已选 {{ c.capacity - c.remaining }}/{{ c.capacity }}</text>
        </view>
        <view class="course-action">
          <view v-if="c.selected" class="selected-badge">已选</view>
          <view v-else class="select-btn" :class="{ selecting: selectingId === c.id }" @tap="selectCourse(c)">
            {{ selectingId === c.id ? '选课中...' : '选课' }}
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 反馈 toast -->
    <view v-if="toast" class="toast" :class="toast.type">{{ toast.msg }}</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { getAvailableCourses, selectCourse as apiSelectCourse, dropCourse as apiDropCourse } from '../../utils/backend'

const userStore = useUserStore()
const keyword = ref('')
const courseType = ref<'gx' | 'bx'>('gx')
const courses = ref<any[]>([])
const loading = ref(false)
const selectingId = ref('')
const toast = ref<{ msg: string; type: string } | null>(null)

const showToast = (msg: string, type = 'success') => {
  toast.value = { msg, type }
  setTimeout(() => { toast.value = null }, 2500)
}

const loadCourses = async (page = 1) => {
  if (!userStore.isLoggedIn) { uni.showToast({ title: '请先登录', icon: 'none' }); return }
  loading.value = true
  try {
    const data = await getAvailableCourses(page, keyword.value, courseType.value)
    courses.value = data?.courses || []
  } catch (e) {
    if (String(e).includes('401')) { showToast('会话已过期，请重新登录', 'error'); return }
    courses.value = []
  }
  loading.value = false
}

const search = () => { loadCourses() }

const selectCourse = async (c: any) => {
  if (selectingId.value) return
  selectingId.value = c.id
  try {
    const data = await apiSelectCourse(c.id)
    if (data?.ok) {
      showToast(data.message || '选课成功')
      c.selected = true
    } else {
      showToast(data?.message || '选课失败', 'error')
    }
  } catch (e) {
    if (String(e).includes('401')) { showToast('会话已过期，请重新登录', 'error') }
    else showToast('网络错误', 'error')
  }
  selectingId.value = ''
}

onMounted(() => { if (userStore.isLoggedIn) loadCourses() })
</script>

<style scoped>
.cs-page { min-height: 100vh; background: #0d1117; }
.search-bar { padding: 12px 16px; display: flex; gap: 8px; background: #1a1a2e; }
.search-input { flex: 1; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 14px; color: #fff; font-size: 13px; }
.search-btn { background: #4DD0E1; border-radius: 12px; padding: 10px 16px; color: #fff; font-size: 13px; font-weight: 700; }

.type-bar { display: flex; gap: 8px; padding: 10px 16px; background: #1a1a2e; border-bottom: 1px solid #ffffff0d; }
.type-btn { padding: 6px 16px; border-radius: 20px; background: #ffffff22; color: #fff; font-size: 13px; font-weight: 600; }
.type-btn.active { background: #4DD0E1; }

.loading { text-align: center; padding: 50px; color: #555; }
.loading-icon { font-size: 28px; display: block; animation: spin 1s linear infinite; }
.loading-text { font-size: 12px; margin-top: 8px; display: block; }
.empty { text-align: center; padding: 50px 20px; }
.empty-emoji { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-title { color: #ccc; font-size: 15px; font-weight: 700; display: block; }
.empty-sub { color: #666; font-size: 13px; margin-top: 6px; display: block; }

.course-scroll { height: calc(100vh - 140px); }
.course-card { background: #1e2a3a; border-radius: 16px; padding: 16px; margin: 10px 16px; display: flex; align-items: center; gap: 14px; }
.course-info { flex: 1; min-width: 0; }
.course-name { color: #fff; font-size: 15px; font-weight: 700; display: block; margin-bottom: 4px; }
.course-teacher { color: #888; font-size: 12px; display: block; margin-bottom: 6px; }
.course-meta { display: flex; gap: 12px; margin-bottom: 8px; }
.meta-item { color: #aaa; font-size: 11px; }
.capacity-bar { height: 4px; background: #ffffff11; border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
.capacity-fill { height: 100%; background: #4DD0E1; border-radius: 2px; transition: width 0.3s; }
.capacity-text { color: #888; font-size: 10px; }

.course-action { flex-shrink: 0; }
.selected-badge { background: #2ECC7122; color: #2ECC71; border: 1px solid #2ECC7144; border-radius: 20px; padding: 8px 16px; font-size: 12px; font-weight: 600; }
.select-btn { background: linear-gradient(135deg, #4DD0E1, #64B5F6); border-radius: 20px; padding: 8px 16px; color: #fff; font-size: 12px; font-weight: 700; }
.select-btn.selecting { opacity: 0.6; }

.toast { position: fixed; top: 40%; left: 50%; transform: translateX(-50%); background: #1e2a3a; color: #fff; padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; z-index: 999; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.toast.error { background: #FF6B6B; }
.toast.success { background: #2ECC71; }
</style>
