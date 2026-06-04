<template>
  <view class="publish-page">
    <view class="form">
      <text class="section-label">图标</text>
      <view class="emoji-grid">
        <view v-for="e in EMOJIS" :key="e" class="emoji-btn" :class="{ active: emoji === e }" @tap="emoji = e">{{ e }}</view>
      </view>

      <text class="section-label">商品名称</text>
      <input class="input" v-model="title" placeholder="如：九成新 MacBook Air" :maxlength="30" />

      <text class="section-label">描述</text>
      <textarea class="textarea" v-model="desc" placeholder="商品描述、成色、购买时间等..." :maxlength="200" />

      <text class="section-label">分类</text>
      <view class="tag-row">
        <view v-for="t in MTAGS.filter(t => t !== '全部')" :key="t" class="tag-btn" :class="{ active: category === t }" @tap="category = t">{{ t }}</view>
      </view>

      <text class="section-label">成色</text>
      <view class="tag-row">
        <view v-for="c in ['全新','九成新','八成新','二手']" :key="c" class="tag-btn" :class="{ active: condition === c }" @tap="condition = c">{{ c }}</view>
      </view>

      <view class="price-row">
        <view class="price-col">
          <text class="section-label">售价（元）</text>
          <input class="price-input" v-model="price" type="number" placeholder="¥" />
        </view>
        <view class="price-col">
          <text class="section-label">原价（选填）</text>
          <input class="price-input" v-model="originalPrice" type="number" placeholder="¥" />
        </view>
      </view>

      <text class="section-label">联系方式</text>
      <input class="input" v-model="contact" placeholder="微信号或手机号" :maxlength="30" />

      <text v-if="error" class="error">{{ error }}</text>
      <button class="submit-btn" :loading="loading" @tap="handlePublish">{{ loading ? '发布中...' : '发布商品' }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'

const userStore = useUserStore()
const MTAGS = ['全部', '数码', '书籍', '出行', '生活', '运动']
const EMOJIS = ['💻','📚','🚲','💡','💪','🎮','🏀','🎨','📎','🎵','📱','🎧','⌨️','📷','🧸','🍎','☕','🖊️']

const title = ref('')
const desc = ref('')
const category = ref('数码')
const condition = ref('九成新')
const price = ref('')
const originalPrice = ref('')
const contact = ref('')
const emoji = ref('💻')
const loading = ref(false)
const error = ref('')

const handlePublish = async () => {
  if (!title.value.trim()) { error.value = '请输入商品名称'; return }
  if (!price.value || isNaN(Number(price.value))) { error.value = '请输入正确的价格'; return }
  loading.value = true
  try {
    const u = userStore.user!
    await sb('market_items', { method: 'POST', body: JSON.stringify({
      user_id: u.id, nickname: u.nickname, avatar: u.avatar,
      title: title.value.trim(), description: desc.value.trim(),
      price: Number(price.value), original_price: originalPrice.value ? Number(originalPrice.value) : null,
      category: category.value, condition: condition.value, contact: contact.value, emoji: emoji.value, status: 'active'
    }), prefer: 'return=minimal' })
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e: any) { error.value = '发布失败: ' + (e.message || '请重试') }
  loading.value = false
}
</script>

<style scoped>
.publish-page { min-height: 100vh; background: #0d1117; padding: 20px 16px; }
.section-label { color: #888; font-size: 12px; margin-bottom: 6px; display: block; margin-top: 14px; }
.section-label:first-child { margin-top: 0; }
.emoji-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
.emoji-btn { width: 36px; height: 36px; border-radius: 10px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.emoji-btn.active { background: #F06292; }
.input { width: 100%; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; box-sizing: border-box; }
.textarea { width: 100%; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; min-height: 80px; box-sizing: border-box; }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; }
.tag-btn { padding: 5px 12px; border-radius: 20px; background: #2a3a4a; color: #fff; font-size: 11px; font-weight: 600; }
.tag-btn.active { background: #F06292; }
.price-row { display: flex; gap: 10px; }
.price-col { flex: 1; }
.price-input { width: 100%; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; box-sizing: border-box; }
.error { color: #FF6B6B; font-size: 12px; margin-bottom: 10px; display: block; margin-top: 12px; }
.submit-btn { width: 100%; background: linear-gradient(135deg, #F06292, #9C27B0); border: none; border-radius: 16px; padding: 14px; color: #fff; font-size: 16px; font-weight: 700; margin-top: 16px; }
</style>
