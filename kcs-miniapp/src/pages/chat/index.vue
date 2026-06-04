<template>
  <view class="chat-page">
    <!-- 顶部栏 -->
    <view class="chat-header">
      <view class="other-avatar">{{ otherAvatar }}</view>
      <view class="other-info">
        <text class="other-name">{{ otherName }}</text>
        <text class="other-route">{{ fromPlace }} → {{ toPlace }}</text>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view scroll-y class="msg-list" :scroll-into-view="scrollTarget" scroll-with-animation>
      <view v-if="messages.length === 0" class="empty-msg">开始聊天吧～</view>
      <view v-for="(m, i) in messages" :key="i" :id="'msg-' + i" class="msg-item">
        <view class="msg-bubble" :class="{ mine: m.sender_id === userStore.user?.id }">
          <text class="msg-text">{{ m.content }}</text>
          <text class="msg-time">{{ formatTime(m.created_at) }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 输入框 -->
    <view class="input-bar">
      <input class="msg-input" v-model="inputText" placeholder="输入消息..." @confirm="handleSend" />
      <view class="send-btn" :class="{ disabled: !inputText.trim() }" @tap="handleSend">发送</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatTime } from '../../utils/format'

const userStore = useUserStore()
const messages = ref<any[]>([])
const inputText = ref('')
const scrollTarget = ref('')
const otherId = ref('')
const otherName = ref('')
const otherAvatar = ref('🦊')
const fromPlace = ref('')
const toPlace = ref('')

onLoad((options: any) => {
  otherId.value = options?.receiver_id || ''
  otherName.value = decodeURIComponent(options?.nickname || '用户')
  otherAvatar.value = decodeURIComponent(options?.avatar || '🦊')
  fromPlace.value = decodeURIComponent(options?.from_place || '')
  toPlace.value = decodeURIComponent(options?.to_place || '')
})

const loadMessages = async () => {
  const u = userStore.user
  if (!u || !otherId.value) return
  try {
    const data = await sb(`carpool_messages?or=(and(sender_id.eq.${u.id},receiver_id.eq.${otherId.value}),and(sender_id.eq.${otherId.value},receiver_id.eq.${u.id}))&order=created_at.asc&limit=100`)
    messages.value = data || []
    await nextTick()
    scrollTarget.value = messages.value.length > 0 ? `msg-${messages.value.length - 1}` : ''
    // Mark as read
    await sb(`carpool_messages?sender_id=eq.${otherId.value}&receiver_id=eq.${u.id}&is_read=eq.false`, { method: 'PATCH', body: JSON.stringify({ is_read: true }), prefer: 'return=minimal' })
  } catch (e) {}
}

const handleSend = async () => {
  if (!inputText.value.trim() || !userStore.user) return
  const content = inputText.value.trim()
  inputText.value = ''
  try {
    const u = userStore.user
    const res = await sb('carpool_messages', { method: 'POST', body: JSON.stringify({ sender_id: u.id, receiver_id: otherId.value, content }), prefer: 'return=minimal' })
    messages.value = [...messages.value, res[0]]
    await nextTick()
    scrollTarget.value = `msg-${messages.value.length - 1}`
  } catch (e) {}
}

let pollTimer: any = null
onMounted(() => {
  loadMessages()
  pollTimer = setInterval(loadMessages, 15000)
})
import { onUnmounted } from 'vue'
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.chat-page { min-height: 100vh; background: #0d1117; display: flex; flex-direction: column; }
.chat-header { background: #1a1a2e; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #ffffff0d; flex-shrink: 0; }
.other-avatar { width: 36px; height: 36px; border-radius: 10px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.other-info { flex: 1; }
.other-name { color: #fff; font-size: 15px; font-weight: 600; display: block; }
.other-route { color: #888; font-size: 11px; display: block; margin-top: 2px; }

.msg-list { flex: 1; padding: 16px; }
.empty-msg { color: #555; font-size: 13px; text-align: center; padding: 60px 0; }
.msg-item { margin-bottom: 8px; display: flex; }
.msg-bubble { max-width: 75%; padding: 10px 14px; border-radius: 16px 16px 16px 4px; background: #1e2a3a; color: #ddd; }
.msg-bubble.mine { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: #4DD0E1; color: #000; }
.msg-text { font-size: 13px; line-height: 1.5; word-break: break-word; display: block; }
.msg-time { font-size: 9px; color: #666; margin-top: 4px; text-align: right; display: block; }
.msg-bubble.mine .msg-time { color: #ffffff88; }

.input-bar { padding: 10px 16px 28px; border-top: 1px solid #ffffff0d; background: #1a1a2e; display: flex; gap: 8px; flex-shrink: 0; }
.msg-input { flex: 1; background: #2a3a4a; border: 1px solid #ffffff11; border-radius: 20px; padding: 10px 14px; color: #fff; font-size: 13px; }
.send-btn { background: #4DD0E1; border-radius: 20px; padding: 10px 16px; color: #000; font-size: 13px; font-weight: 700; }
.send-btn.disabled { opacity: 0.5; }
</style>
