<template>
  <view class="create-page">
    <view class="form">
      <view class="tag-row">
        <view v-for="t in FTAGS.slice(1)" :key="t" class="tag-btn" :class="{ active: tag === t }" @tap="tag = t">{{ t }}</view>
      </view>
      <input class="input" v-model="title" placeholder="标题（最多30字）" :maxlength="30" />
      <textarea class="textarea" v-model="content" placeholder="内容（最多200字）" :maxlength="200" :auto-height="false" />
      <text v-if="error" class="error">{{ error }}</text>
      <button class="submit-btn" :loading="loading" @tap="handlePost">{{ loading ? '发布中...' : '发布' }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'

const userStore = useUserStore()
const FTAGS = ['全部', '学习', '生活', '技术', '社团', '美食', '失物']
const title = ref('')
const content = ref('')
const tag = ref('学习')
const loading = ref(false)
const error = ref('')

const handlePost = async () => {
  if (!title.value.trim()) { error.value = '请输入标题'; return }
  if (!content.value.trim()) { error.value = '请输入内容'; return }
  loading.value = true
  try {
    const u = userStore.user!
    await sb('posts', { method: 'POST', body: JSON.stringify({ user_id: u.id, nickname: u.nickname, avatar: u.avatar, tag: tag.value, title: title.value.trim(), content: content.value.trim(), likes: 0, comments: 0 }) })
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e) { error.value = '发布失败，请重试' }
  loading.value = false
}
</script>

<style scoped>
.create-page { min-height: 100vh; background: #0d1117; padding: 20px 16px; }
.tag-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.tag-btn { padding: 5px 14px; border-radius: 20px; background: #2a3a4a; color: #fff; font-size: 12px; font-weight: 600; }
.tag-btn.active { background: #4DD0E1; }
.input { width: 100%; background: #2a3a4a; border: 1px solid #ffffff11; border-radius: 12px; padding: 11px 14px; color: #fff; font-size: 14px; margin-bottom: 10px; box-sizing: border-box; }
.textarea { width: 100%; background: #2a3a4a; border: 1px solid #ffffff11; border-radius: 12px; padding: 11px 14px; color: #fff; font-size: 14px; margin-bottom: 8px; box-sizing: border-box; min-height: 120px; }
.error { color: #FF6B6B; font-size: 12px; margin-bottom: 8px; display: block; }
.submit-btn { width: 100%; background: linear-gradient(135deg, #4DD0E1, #64B5F6); border: none; border-radius: 16px; padding: 14px; color: #fff; font-size: 16px; font-weight: 700; }
</style>
