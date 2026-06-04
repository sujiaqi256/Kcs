<template>
  <view class="chat-list-page">
    <view class="header">
      <text class="title">消息列表</text>
    </view>
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="conversations.length === 0" class="empty">
      <text class="empty-icon">💬</text>
      <text class="empty-text">暂无消息</text>
      <text class="empty-hint">点击拼车或集市的"联系TA"开始聊天</text>
    </view>
    <view v-else class="conv-list">
      <view v-for="c in conversations" :key="c.otherId" class="conv-item" @tap="goChat(c)">
        <view class="conv-avatar">
          <text>{{ c.avatar }}</text>
          <view v-if="c.unread > 0" class="badge">{{ c.unread }}</view>
        </view>
        <view class="conv-body">
          <view class="conv-top">
            <text class="conv-name">{{ c.nickname }}</text>
            <text class="conv-time">{{ formatTime(c.lastMsg.created_at) }}</text>
          </view>
          <text class="conv-preview">{{ c.lastMsg.content }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatTime } from '../../utils/format'

const userStore = useUserStore()
const loading = ref(true)
const conversations = ref<any[]>([])

const loadConversations = async () => {
  const u = userStore.user
  if (!u) { loading.value = false; return }
  try {
    const data = await sb(`carpool_messages?or=(sender_id.eq.${u.id},receiver_id.eq.${u.id})&order=created_at.desc&limit=200`)
    const map: Record<string, any> = {}
    for (const m of (data || [])) {
      const otherId = m.sender_id === u.id ? m.receiver_id : m.sender_id
      if (!map[otherId]) {
        map[otherId] = { otherId, lastMsg: m, unread: m.receiver_id === u.id && !m.is_read ? 1 : 0 }
      } else {
        if (new Date(m.created_at) > new Date(map[otherId].lastMsg.created_at)) {
          map[otherId].lastMsg = m
        }
        if (m.receiver_id === u.id && !m.is_read) {
          map[otherId].unread++
        }
      }
    }
    // Fetch user info for each conversation
    const ids = Object.keys(map)
    if (ids.length > 0) {
      const users = await sb(`users?id=in.(${ids.join(',')})&select=id,nickname,avatar`)
      for (const user of (users || [])) {
        if (map[user.id]) {
          map[user.id].nickname = user.nickname || '用户'
          map[user.id].avatar = user.avatar || '🦊'
        }
      }
    }
    conversations.value = Object.values(map).sort((a: any, b: any) =>
      new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime()
    )
  } catch (e) {}
  loading.value = false
}

const goChat = (c: any) => {
  uni.navigateTo({
    url: `/pages/chat/index?receiver_id=${c.otherId}&nickname=${encodeURIComponent(c.nickname)}&avatar=${encodeURIComponent(c.avatar)}&from_place=&to_place=`
  })
}

onMounted(() => { loadConversations() })
</script>

<style scoped>
.chat-list-page { min-height: 100vh; background: #0d1117; }
.header { background: #1a1a2e; padding: 16px; }
.title { color: #fff; font-size: 18px; font-weight: 700; }
.loading { color: #888; font-size: 13px; text-align: center; padding: 60px 0; }
.empty { text-align: center; padding: 80px 20px; }
.empty-icon { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-text { color: #ccc; font-size: 15px; font-weight: 700; display: block; }
.empty-hint { color: #666; font-size: 13px; display: block; margin-top: 6px; }

.conv-list { padding: 0 16px; }
.conv-item { display: flex; gap: 12px; align-items: center; padding: 14px 0; border-bottom: 1px solid #ffffff0d; }
.conv-avatar { width: 44px; height: 44px; border-radius: 12px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; position: relative; }
.badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; border-radius: 9px; background: #FF6B6B; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; padding: 0 4px; }
.conv-body { flex: 1; min-width: 0; }
.conv-top { display: flex; justify-content: space-between; align-items: center; }
.conv-name { color: #fff; font-size: 14px; font-weight: 600; }
.conv-time { color: #555; font-size: 11px; flex-shrink: 0; }
.conv-preview { color: #888; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; display: block; }
</style>
