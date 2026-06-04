<template>
  <view class="detail-page">
    <!-- 帖子内容 -->
    <view v-if="post" class="post-section">
      <view class="post-header">
        <view class="post-avatar">{{ post.avatar || '🦊' }}</view>
        <view class="post-meta">
          <view class="meta-row">
            <text class="post-nick">{{ post.nickname || '匿名' }}</text>
            <text class="post-tag" :style="{ background: getTagColor(post.tag) + '22', color: getTagColor(post.tag) }">{{ post.tag }}</text>
          </view>
          <text class="post-time">{{ formatTime(post.created_at) }}</text>
        </view>
      </view>
      <text class="post-title">{{ post.title }}</text>
      <text class="post-content">{{ post.content }}</text>
      <view class="post-stats">
        <text class="stat">❤️ {{ post.likes || 0 }}</text>
        <text class="stat">💬 {{ comments.length }}</text>
      </view>
    </view>

    <!-- 评论区 -->
    <view class="comment-section">
      <text class="comment-header">评论 {{ comments.length > 0 ? `(${comments.length})` : '' }}</text>
      <view v-if="comments.length === 0" class="no-comment">暂无评论，来说点什么吧</view>
      <view v-for="(c, i) in comments" :key="i" class="comment-item">
        <view class="comment-avatar">{{ c.avatar || '🦊' }}</view>
        <view class="comment-body">
          <view class="comment-meta">
            <text class="comment-nick">{{ c.nickname }}</text>
            <text class="comment-time">{{ formatTime(c.created_at) }}</text>
          </view>
          <text class="comment-text">{{ c.content }}</text>
        </view>
      </view>
    </view>

    <!-- 底部输入框 -->
    <view v-if="userStore.isLoggedIn" class="input-bar">
      <input class="msg-input" v-model="inputText" placeholder="说点什么..." @confirm="handleSend" />
      <view class="send-btn" :class="{ disabled: !inputText.trim() }" @tap="handleSend">发送</view>
    </view>
    <view v-else class="login-hint">绑定学号后才能评论</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatTime } from '../../utils/format'

const userStore = useUserStore()
const FC: Record<string, string> = { '学习': '#4DD0E1', '生活': '#F0A500', '技术': '#64B5F6', '社团': '#F06292', '美食': '#FF6B6B', '失物': '#CE93D8' }
const getTagColor = (tag: string) => FC[tag] || '#4DD0E1'

const postId = ref('')
const post = ref<any>(null)
const comments = ref<any[]>([])
const inputText = ref('')

onLoad((options: any) => { postId.value = options?.id || '' })

const loadPost = async () => {
  if (!postId.value) return
  try {
    const data = await sb(`posts?id=eq.${postId.value}`)
    post.value = data?.[0] || null
    if (post.value) uni.setNavigationBarTitle({ title: post.value.title })
  } catch (e) {}
}

const loadComments = async () => {
  if (!postId.value) return
  try {
    comments.value = (await sb(`comments?post_id=eq.${postId.value}&order=created_at.asc`)) || []
  } catch (e) {}
}

const handleSend = async () => {
  if (!inputText.value.trim() || !userStore.user) return
  const content = inputText.value.trim()
  inputText.value = ''
  try {
    const u = userStore.user
    const res = await sb('comments', { method: 'POST', body: JSON.stringify({ post_id: postId.value, user_id: u.id, nickname: u.nickname, avatar: u.avatar, content }) })
    comments.value = [...comments.value, res[0]]
    const newCount = (post.value?.comments || 0) + 1
    await sb(`posts?id=eq.${postId.value}`, { method: 'PATCH', body: JSON.stringify({ comments: newCount }), prefer: 'return=minimal' })
    if (post.value) post.value.comments = newCount
  } catch (e) {}
}

onMounted(() => { loadPost(); loadComments() })
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #0d1117; padding-bottom: 80px; }
.post-section { padding: 16px 20px; border-bottom: 1px solid #ffffff0d; }
.post-header { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
.post-avatar { width: 42px; height: 42px; border-radius: 12px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.post-meta { flex: 1; }
.meta-row { display: flex; align-items: center; gap: 8px; }
.post-nick { color: #fff; font-size: 14px; font-weight: 700; }
.post-tag { border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
.post-time { color: #555; font-size: 11px; display: block; margin-top: 2px; }
.post-title { color: #fff; font-size: 18px; font-weight: 800; line-height: 1.4; margin-bottom: 8px; display: block; }
.post-content { color: #ccc; font-size: 14px; line-height: 1.7; white-space: pre-wrap; display: block; margin-bottom: 12px; }
.post-stats { display: flex; gap: 20px; padding-top: 12px; border-top: 1px solid #ffffff0a; }
.stat { color: #888; font-size: 12px; }

.comment-section { padding: 16px 20px; }
.comment-header { color: #aaa; font-size: 13px; font-weight: 600; margin-bottom: 14px; display: block; }
.no-comment { color: #555; font-size: 13px; text-align: center; padding: 30px 0; }
.comment-item { display: flex; gap: 10px; margin-bottom: 14px; }
.comment-avatar { width: 36px; height: 36px; border-radius: 10px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.comment-body { flex: 1; background: #1e2a3a; border-radius: 12px; padding: 10px 12px; }
.comment-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.comment-nick { color: #4DD0E1; font-size: 12px; font-weight: 700; }
.comment-time { color: #555; font-size: 10px; }
.comment-text { color: #ddd; font-size: 13px; line-height: 1.5; }

.input-bar { position: fixed; bottom: 0; left: 0; right: 0; padding: 10px 16px 28px; border-top: 1px solid #ffffff0d; background: #1a1a2e; display: flex; gap: 10px; }
.msg-input { flex: 1; background: #2a3a4a; border: 1px solid #ffffff11; border-radius: 20px; padding: 10px 14px; color: #fff; font-size: 13px; }
.send-btn { background: #4DD0E1; border-radius: 20px; padding: 10px 16px; color: #fff; font-size: 13px; font-weight: 700; }
.send-btn.disabled { opacity: 0.5; }
.login-hint { padding: 12px 16px 28px; color: #888; font-size: 13px; text-align: center; background: #1a1a2e; border-top: 1px solid #ffffff0d; }
</style>
