<template>
  <view class="detail-page" v-if="item">
    <view class="item-hero" :style="{ background: `linear-gradient(135deg, ${MC[item.category] || '#F06292'}33, #2a3a4a)` }">
      <text class="hero-emoji">{{ item.emoji || '📦' }}</text>
      <view class="hero-tag" :style="{ background: (MC[item.category] || '#F06292') + '22', color: MC[item.category] || '#F06292' }">{{ item.category }}</view>
      <view class="hero-cond">{{ item.condition }}</view>
    </view>

    <view class="item-body">
      <text class="item-title">{{ item.title }}</text>
      <view class="price-row">
        <text class="item-price">¥{{ item.price }}</text>
        <text v-if="item.original_price" class="item-orig">¥{{ item.original_price }}</text>
      </view>
      <text v-if="item.description" class="item-desc">{{ item.description }}</text>

      <view class="seller-bar">
        <view class="seller-avatar">{{ item.avatar || '🦊' }}</view>
        <view class="seller-info">
          <text class="seller-name">{{ item.nickname || '匿名' }}</text>
          <text class="seller-time">{{ formatTime(item.created_at) }}</text>
        </view>
      </view>

      <view v-if="item.contact" class="contact-bar">
        <text class="contact-icon">📱</text>
        <text class="contact-val">{{ item.contact }}</text>
        <view class="copy-btn" @tap="copyContact">复制</view>
      </view>

      <view class="btn-row">
        <view v-if="item.user_id === userStore.user?.id" class="delete-btn" @tap="handleDelete">下架商品</view>
        <template v-else>
          <view class="chat-btn" @tap="goChat">💬 联系卖家</view>
          <view v-if="item.contact" class="phone-btn" @tap="copyContact">📱</view>
        </template>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatTime } from '../../utils/format'

const userStore = useUserStore()
const MC: Record<string, string> = { '数码': '#64B5F6', '书籍': '#F0A500', '出行': '#2ECC71', '生活': '#CE93D8', '运动': '#FF6B6B' }
const item = ref<any>(null)
const itemId = ref('')

onLoad((options: any) => { itemId.value = options?.id || '' })

const loadItem = async () => {
  if (!itemId.value) return
  try {
    const data = await sb(`market_items?id=eq.${itemId.value}`)
    item.value = data?.[0] || null
  } catch (e) {}
}

const goChat = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  const params = `receiver_id=${item.value.user_id}&nickname=${encodeURIComponent(item.value.nickname || '')}&avatar=${encodeURIComponent(item.value.avatar || '')}&from_place=${encodeURIComponent(item.value.title)}`
  uni.navigateTo({ url: `/pages/chat/index?${params}` })
}

const copyContact = () => {
  uni.setClipboardData({ data: item.value.contact, success: () => uni.showToast({ title: '已复制', icon: 'success' }) })
}

const handleDelete = () => {
  uni.showModal({
    title: '下架商品', content: '确定下架这件商品？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await sb(`market_items?id=eq.${itemId.value}`, { method: 'DELETE', prefer: 'return=minimal' })
          uni.showToast({ title: '已下架', icon: 'success' })
          setTimeout(() => uni.navigateBack(), 1000)
        } catch (e) { uni.showToast({ title: '操作失败', icon: 'none' }) }
      }
    }
  })
}

onMounted(() => { loadItem() })
</script>

<style scoped>
.detail-page { min-height: 100vh; background: #0d1117; }
.item-hero { height: 200px; display: flex; align-items: center; justify-content: center; position: relative; }
.hero-emoji { font-size: 72px; }
.hero-tag { position: absolute; top: 16px; left: 16px; border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600; }
.hero-cond { position: absolute; top: 16px; right: 16px; background: #ffffff22; color: #fff; border-radius: 20px; padding: 4px 12px; font-size: 12px; }
.item-body { padding: 16px 22px; }
.item-title { color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 8px; display: block; }
.price-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 14px; }
.item-price { color: #F06292; font-size: 26px; font-weight: 800; }
.item-orig { color: #555; font-size: 14px; text-decoration: line-through; }
.item-desc { color: #ccc; font-size: 14px; line-height: 1.6; margin-bottom: 16px; white-space: pre-wrap; display: block; }

.seller-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding: 12px; background: #ffffff08; border-radius: 12px; }
.seller-avatar { width: 40px; height: 40px; border-radius: 10px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.seller-info { flex: 1; }
.seller-name { color: #fff; font-size: 14px; font-weight: 600; display: block; }
.seller-time { color: #888; font-size: 11px; display: block; margin-top: 2px; }

.contact-bar { padding: 10px 14px; background: #F0629215; border: 1px solid #F0629233; border-radius: 12px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
.contact-icon { font-size: 16px; }
.contact-val { color: #F06292; font-size: 13px; font-weight: 600; flex: 1; word-break: break-all; }
.copy-btn { background: #F0629222; border-radius: 8px; padding: 6px 10px; color: #F06292; font-size: 11px; font-weight: 600; }

.btn-row { display: flex; gap: 10px; }
.delete-btn { flex: 1; background: #FF6B6B22; border: 1px solid #FF6B6B44; border-radius: 14px; padding: 13px; color: #FF6B6B; font-size: 14px; font-weight: 700; text-align: center; }
.chat-btn { flex: 1; background: linear-gradient(135deg, #F06292, #9C27B0); border-radius: 14px; padding: 13px; color: #fff; font-size: 14px; font-weight: 700; text-align: center; }
.phone-btn { background: #ffffff11; border: 1px solid #ffffff22; border-radius: 14px; padding: 13px 16px; color: #aaa; font-size: 13px; font-weight: 600; }
</style>
