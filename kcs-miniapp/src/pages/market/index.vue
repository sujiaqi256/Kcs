<template>
  <view class="market-page">
    <!-- 顶部 -->
    <view class="header">
      <view class="header-top">
        <view class="header-left">
          <text class="title">二手集市</text>
          <text class="subtitle">闲置流通，环保共享</text>
        </view>
        <view class="header-btns">
          <view class="msg-btn" @tap="goChatList">💬</view>
          <view class="publish-btn" @tap="goPublish">+ 卖东西</view>
        </view>
      </view>
      <view class="search-bar">
        <text class="search-icon">🔍</text>
        <input class="search-input" v-model="searchText" placeholder="搜索商品..." />
        <text v-if="searchText" class="search-clear" @tap="searchText = ''">✕</text>
      </view>
      <scroll-view scroll-x class="tag-scroll">
        <view class="tag-list">
          <view v-for="t in MTAGS" :key="t" class="tag-pill" :class="{ active: tag === t }" @tap="tag = t">{{ t }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 商品网格 -->
    <view v-if="loading" class="loading">加载中...</view>
    <view v-else-if="filtered.length === 0" class="empty">
      <text class="empty-emoji">📦</text>
      <text class="empty-title">{{ searchText ? '没有找到匹配的商品' : '暂无商品' }}</text>
      <text class="empty-sub">{{ searchText ? '换个关键词试试' : '发布第一件闲置吧！' }}</text>
    </view>
    <view v-else class="grid">
      <view v-for="(item, i) in filtered" :key="item.id" class="grid-item" :style="{ animationDelay: i * 0.07 + 's' }" @tap="goDetail(item)">
        <view class="item-img" :style="{ background: `linear-gradient(135deg, ${MC[item.category] || '#F06292'}33, #2a3a4a)` }">
          <text class="item-emoji">{{ item.emoji || '📦' }}</text>
          <view class="item-tag" :style="{ background: (MC[item.category] || '#F06292') + '22', color: MC[item.category] || '#F06292' }">{{ item.category }}</view>
        </view>
        <view class="item-info">
          <text class="item-title">{{ item.title }}</text>
          <text class="item-desc">{{ item.description || '暂无描述' }}</text>
          <view class="item-price-row">
            <text class="item-price">¥{{ item.price }}</text>
            <text v-if="item.original_price" class="item-orig">¥{{ item.original_price }}</text>
          </view>
          <view class="item-footer">
            <text class="item-nick">{{ item.nickname || '匿名' }}</text>
            <text class="item-cond">{{ item.condition }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'

const userStore = useUserStore()
const MTAGS = ['全部', '数码', '书籍', '出行', '生活', '运动']
const MC: Record<string, string> = { '数码': '#64B5F6', '书籍': '#F0A500', '出行': '#2ECC71', '生活': '#CE93D8', '运动': '#FF6B6B' }

const items = ref<any[]>([])
const loading = ref(true)
const tag = ref('全部')
const searchText = ref('')

const filtered = computed(() => items.value.filter(m => {
  if (tag.value !== '全部' && m.category !== tag.value) return false
  if (searchText.value.trim()) {
    const s = searchText.value.trim().toLowerCase()
    return m.title.toLowerCase().includes(s) || (m.description || '').toLowerCase().includes(s)
  }
  return true
}))

const loadItems = async (silent = false) => {
  if (!silent) loading.value = true
  try { items.value = (await sb('market_items?status=eq.active&order=created_at.desc&limit=50')) || [] } catch (e) {}
  if (!silent) loading.value = false
}

const goPublish = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  uni.navigateTo({ url: '/pages/market/publish' })
}
const goDetail = (item: any) => uni.navigateTo({ url: `/pages/market/detail?id=${item.id}` })
const goChatList = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  uni.navigateTo({ url: '/pages/chat/list' })
}

let pollTimer: any = null
onMounted(() => {
  loadItems()
  pollTimer = setInterval(() => loadItems(true), 30000)
})
import { onUnmounted } from 'vue'
onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })
</script>

<style scoped>
.market-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.header { background: linear-gradient(135deg, #1a0a2e, #2d1b4e); padding: 20px 16px 14px; }
.header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.title { color: #fff; font-size: 22px; font-weight: 800; display: block; }
.subtitle { color: #aaa; font-size: 12px; margin-top: 2px; display: block; }
.header-btns { display: flex; gap: 8px; align-items: center; }
.msg-btn { background: #ffffff15; color: #fff; width: 38px; height: 38px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.publish-btn { background: #F06292; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; }
.search-bar { background: #ffffff15; border-radius: 14px; padding: 10px 14px; display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
.search-icon { font-size: 14px; }
.search-input { flex: 1; background: none; border: none; color: #fff; font-size: 13px; }
.search-clear { color: #888; font-size: 14px; }
.tag-scroll { white-space: nowrap; }
.tag-list { display: flex; gap: 8px; }
.tag-pill { padding: 6px 14px; border-radius: 20px; background: #ffffff22; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.tag-pill.active { background: #F06292; }

.loading { text-align: center; padding: 40px; color: #555; }
.empty { text-align: center; padding: 50px 20px; }
.empty-emoji { font-size: 44px; display: block; margin-bottom: 10px; }
.empty-title { color: #ccc; font-size: 15px; font-weight: 700; display: block; }
.empty-sub { color: #666; font-size: 13px; margin-top: 6px; display: block; }

.grid { padding: 14px 16px; display: flex; flex-wrap: wrap; gap: 12px; }
.grid-item { width: calc(50% - 6px); background: #1e2a3a; border-radius: 18px; overflow: hidden; animation: slideIn 0.3s ease both; }
.item-img { height: 108px; display: flex; align-items: center; justify-content: center; position: relative; }
.item-emoji { font-size: 42px; }
.item-tag { position: absolute; top: 8px; left: 8px; border-radius: 20px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
.item-info { padding: 10px 10px 12px; }
.item-title { color: #fff; font-size: 12px; font-weight: 700; margin-bottom: 3px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.item-desc { color: #888; font-size: 10px; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.item-price-row { display: flex; align-items: baseline; gap: 5px; margin-bottom: 6px; }
.item-price { color: #F06292; font-size: 16px; font-weight: 800; }
.item-orig { color: #555; font-size: 10px; text-decoration: line-through; }
.item-footer { display: flex; justify-content: space-between; align-items: center; }
.item-nick { color: #888; font-size: 10px; }
.item-cond { color: #555; font-size: 9px; }
</style>
