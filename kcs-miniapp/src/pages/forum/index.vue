<template>
  <view class="forum-page">
    <!-- 顶部 -->
    <view class="header">
      <view class="header-top">
        <text class="title">🦊 狐说校园</text>
        <view class="header-btns">
          <view class="hdr-btn" @tap="toggleSearch">🔍</view>
          <view class="hdr-btn hot-btn" @tap="loadHotPosts">🔥</view>
          <view v-if="userStore.isLoggedIn" class="hdr-btn fav-btn" @tap="loadFavPosts">⭐</view>
          <view class="post-btn" @tap="goCreate">+ 发帖</view>
        </view>
      </view>

      <!-- 搜索框 -->
      <view v-if="showSearch" class="search-bar">
        <input class="search-input" v-model="searchText" placeholder="搜索帖子标题或内容..." />
        <text v-if="searchText" class="search-clear" @tap="searchText = ''">✕</text>
      </view>

      <!-- 标签过滤 -->
      <scroll-view scroll-x class="tag-scroll">
        <view class="tag-list">
          <view v-for="t in FTAGS" :key="t" class="tag-pill" :class="{ active: activeTag === t && !searchText }" @tap="selectTag(t)">{{ t }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 搜索结果提示 -->
    <view v-if="searchText" class="search-hint">
      <text class="search-hint-text">🔍 搜索「{{ searchText }}」的结果</text>
    </view>

    <!-- 帖子列表 -->
    <scroll-view scroll-y class="post-scroll" :style="{ height: scrollHeight + 'px' }" @scrolltolower="loadMore">
      <view v-if="loading" class="loading">
        <text class="loading-icon">⏳</text>
        <text class="loading-text">加载中...</text>
      </view>
      <view v-else-if="displayPosts.length === 0" class="empty">
        <text class="empty-emoji">{{ searchText ? '🔍' : showFav ? '⭐' : '💬' }}</text>
        <text class="empty-title">{{ searchText ? '没有找到相关帖子' : showFav ? '还没有收藏' : '还没有帖子' }}</text>
        <text class="empty-sub">{{ searchText ? '换个关键词试试' : showFav ? '收藏帖子后在这里显示' : '来发第一帖吧！' }}</text>
      </view>
      <view v-else class="post-list">
        <view v-for="(p, i) in displayPosts" :key="p.id" class="post-card" @tap="goDetail(p)">
          <view class="post-row">
            <view class="post-avatar">{{ p.avatar || '🦊' }}</view>
            <view class="post-body">
              <view class="post-meta">
                <text class="post-nick">{{ p.nickname || '匿名' }}</text>
                <text class="post-tag" :style="{ background: getTagColor(p.tag) + '22', color: getTagColor(p.tag), borderColor: getTagColor(p.tag) + '44' }">{{ p.tag }}</text>
                <text class="post-time">{{ formatTime(p.created_at) }}</text>
              </view>
              <text class="post-title">{{ p.title }}</text>
              <text class="post-content">{{ p.content }}</text>
              <view class="post-actions">
                <view class="action-btn" @tap.stop="handleLike(p)">
                  <text :class="{ liked: (likeCounts[p.id] || 0) > 0 }">{{ (likeCounts[p.id] || 0) > 0 ? '❤️' : '🤍' }} {{ p.likes || 0 }}</text>
                </view>
                <view class="action-btn" @tap.stop="goDetail(p)">
                  <text>💬 {{ p.comments || 0 }}</text>
                </view>
                <view class="action-btn" @tap.stop="handleFav(p)">
                  <text :class="{ faved: favIds.has(p.id) }">{{ favIds.has(p.id) ? '⭐' : '☆' }} 收藏</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 热度排行 -->
    <view v-if="showHot" class="modal-mask" @tap="showHot = false">
      <view class="modal-sheet" @tap.stop>
        <view class="modal-handle" />
        <view class="modal-title-row"><text class="modal-title">🔥 热度排行榜</text></view>
        <view v-for="(p, i) in hotPosts" :key="p.id" class="rank-item">
          <view class="rank-num" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">{{ i + 1 }}</view>
          <view class="rank-info">
            <text class="rank-title">{{ p.title }}</text>
            <text class="rank-stat">❤️ {{ p.likes || 0 }} · 💬 {{ p.comments || 0 }}</text>
          </view>
          <text class="rank-tag" :style="{ background: getTagColor(p.tag) + '22', color: getTagColor(p.tag) }">{{ p.tag }}</text>
        </view>
      </view>
    </view>

    <!-- 收藏夹 -->
    <view v-if="showFav" class="modal-mask" @tap="showFav = false">
      <view class="modal-sheet" @tap.stop>
        <view class="modal-handle" />
        <view class="modal-title-row"><text class="modal-title">⭐ 我的收藏</text></view>
        <view v-if="favPosts.length === 0" class="empty-modal">还没有收藏的帖子</view>
        <view v-for="p in favPosts" :key="p.id" class="rank-item" @tap="goDetail(p)">
          <view class="rank-info">
            <text class="rank-title">{{ p.title }}</text>
            <text class="rank-stat">❤️ {{ p.likes || 0 }} · 💬 {{ p.comments || 0 }}</text>
          </view>
          <text class="rank-tag" :style="{ background: getTagColor(p.tag) + '22', color: getTagColor(p.tag) }">{{ p.tag }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'
import { formatTime } from '../../utils/format'

const userStore = useUserStore()

const FTAGS = ['全部', '学习', '生活', '技术', '社团', '美食', '失物']
const FC: Record<string, string> = { '学习': '#4DD0E1', '生活': '#F0A500', '技术': '#64B5F6', '社团': '#F06292', '美食': '#FF6B6B', '失物': '#CE93D8' }

const getTagColor = (tag: string) => FC[tag] || '#4DD0E1'

const activeTag = ref('全部')
const posts = ref<any[]>([])
const loading = ref(true)
const searchText = ref('')
const showSearch = ref(false)
const showHot = ref(false)
const hotPosts = ref<any[]>([])
const showFav = ref(false)
const favPosts = ref<any[]>([])

const sysInfo = uni.getSystemInfoSync()
const scrollHeight = sysInfo.windowHeight - 220
const favIds = ref(new Set<string>())
const likeCounts = ref<Record<string, number>>({})

const displayPosts = computed(() => showFav.value ? favPosts.value : posts.value)

const loadPosts = async () => {
  loading.value = true
  try {
    let q: string
    if (searchText.value.trim()) {
      q = `posts?or=(title.ilike.*${encodeURIComponent(searchText.value.trim())}*,content.ilike.*${encodeURIComponent(searchText.value.trim())}*)&order=created_at.desc&limit=30`
    } else if (activeTag.value === '全部') {
      q = 'posts?order=created_at.desc&limit=30'
    } else {
      q = `posts?tag=eq.${encodeURIComponent(activeTag.value)}&order=created_at.desc&limit=30`
    }
    posts.value = (await sb(q)) || []
  } catch (e) { posts.value = [] }
  loading.value = false
}

const loadHotPosts = async () => {
  showHot.value = true
  try { hotPosts.value = (await sb('posts?order=likes.desc,comments.desc&limit=20')) || [] } catch (e) {}
}

const loadFavPosts = async () => {
  showFav.value = true
  const u = userStore.user
  if (!u) return
  try {
    const favs = (await sb(`favorites?user_id=eq.${u.id}&order=created_at.desc&select=post_id`)) || []
    const ids = favs.map((f: any) => f.post_id)
    if (ids.length === 0) { favPosts.value = []; return }
    favPosts.value = (await sb(`posts?id=in.(${ids.join(',')})&order=created_at.desc`)) || []
  } catch (e) {}
}

const selectTag = (t: string) => { activeTag.value = t; searchText.value = ''; showFav.value = false; loadPosts() }

const loadUserLikesAndFavs = async () => {
  const u = userStore.user
  if (!u) return
  try {
    const likes = (await sb(`post_likes?user_id=eq.${u.id}&select=post_id,count`)) || []
    const counts: Record<string, number> = {}
    likes.forEach((r: any) => { counts[r.post_id] = r.count || 0 })
    likeCounts.value = counts
    const favs = (await sb(`favorites?user_id=eq.${u.id}&select=post_id`)) || []
    favIds.value = new Set(favs.map((r: any) => r.post_id))
  } catch (e) {}
}

const handleLike = async (post: any) => {
  const u = userStore.user
  if (!u) { uni.navigateTo({ url: '/pages/login/index' }); return }
  const cur = likeCounts.value[post.id] || 0
  if (cur >= 10) { uni.showToast({ title: '每帖最多点赞10次', icon: 'none' }); return }
  const newCount = cur + 1
  likeCounts.value = { ...likeCounts.value, [post.id]: newCount }
  posts.value = posts.value.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p)
  try {
    const existing = (await sb(`post_likes?user_id=eq.${u.id}&post_id=eq.${post.id}&select=id`)) || []
    if (existing.length > 0) {
      await sb(`post_likes?id=eq.${existing[0].id}`, { method: 'PATCH', body: JSON.stringify({ count: newCount }), prefer: 'return=minimal' })
    } else {
      await sb('post_likes', { method: 'POST', body: JSON.stringify({ user_id: u.id, post_id: post.id, count: newCount }), prefer: 'return=minimal' })
    }
    const row = (await sb(`posts?id=eq.${post.id}&select=likes`)) || []
    const curLikes = row?.[0]?.likes || 0
    await sb(`posts?id=eq.${post.id}`, { method: 'PATCH', body: JSON.stringify({ likes: curLikes + 1 }), prefer: 'return=minimal' })
  } catch (e) {}
}

const handleFav = async (post: any) => {
  const u = userStore.user
  if (!u) { uni.navigateTo({ url: '/pages/login/index' }); return }
  const isFav = favIds.value.has(post.id)
  if (isFav) {
    favIds.value = new Set([...favIds.value].filter(id => id !== post.id))
    try { await sb(`favorites?user_id=eq.${u.id}&post_id=eq.${post.id}`, { method: 'DELETE', prefer: 'return=minimal' }) } catch (e) { favIds.value = new Set([...favIds.value, post.id]) }
  } else {
    favIds.value = new Set([...favIds.value, post.id])
    try { await sb('favorites', { method: 'POST', body: JSON.stringify({ user_id: u.id, post_id: post.id }) }) } catch (e) { favIds.value = new Set([...favIds.value].filter(id => id !== post.id)) }
  }
}

const goCreate = () => {
  if (!userStore.isLoggedIn) { uni.navigateTo({ url: '/pages/login/index' }); return }
  uni.navigateTo({ url: '/pages/forum/create' })
}

const goDetail = (p: any) => {
  uni.navigateTo({ url: `/pages/forum/detail?id=${p.id}` })
}

const toggleSearch = () => { showSearch.value = !showSearch.value; searchText.value = '' }
const loadMore = () => {}

onMounted(() => { loadPosts(); loadUserLikesAndFavs() })
</script>

<style scoped>
.forum-page { min-height: 100vh; background: #0d1117; padding-bottom: 100px; }
.header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 20px 16px 14px; }
.header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.title { color: #fff; font-size: 22px; font-weight: 800; }
.header-btns { display: flex; gap: 8px; align-items: center; }
.hdr-btn { background: #ffffff1a; color: #fff; padding: 8px 12px; border-radius: 20px; font-size: 13px; }
.hot-btn { background: #FF8A6522; border: 1px solid #FF8A6544; color: #FF8A65; }
.fav-btn { background: #FFD54F22; border: 1px solid #FFD54F44; color: #FFD54F; }
.post-btn { background: #4DD0E1; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; }

.search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.search-input { flex: 1; background: #ffffff15; border: 1px solid #ffffff22; border-radius: 20px; padding: 8px 16px; color: #fff; font-size: 13px; }
.search-clear { color: #aaa; font-size: 13px; padding: 8px; }

.tag-scroll { white-space: nowrap; }
.tag-list { display: flex; gap: 8px; }
.tag-pill { padding: 6px 14px; border-radius: 20px; background: #ffffff22; color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.tag-pill.active { background: #4DD0E1; }

.search-hint { background: #16213e; padding: 8px 16px; border-bottom: 1px solid #ffffff0d; }
.search-hint-text { color: #4DD0E1; font-size: 12px; }

.post-scroll { height: calc(100vh - 220px); }
.loading { text-align: center; padding: 40px; color: #555; }
.loading-icon { font-size: 30px; display: block; animation: spin 1s linear infinite; }
.loading-text { font-size: 13px; margin-top: 10px; display: block; }
.empty { text-align: center; padding: 50px 20px; }
.empty-emoji { font-size: 40px; display: block; margin-bottom: 10px; }
.empty-title { color: #ccc; font-size: 15px; font-weight: 700; display: block; }
.empty-sub { color: #666; font-size: 13px; margin-top: 6px; display: block; }

.post-list { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.post-card { background: #1e2a3a; border-radius: 18px; padding: 16px; animation: slideIn 0.3s ease both; }
.post-row { display: flex; gap: 10px; }
.post-avatar { width: 40px; height: 40px; border-radius: 12px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.post-body { flex: 1; min-width: 0; }
.post-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.post-nick { color: #fff; font-size: 13px; font-weight: 700; }
.post-tag { border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 600; border: 1px solid transparent; }
.post-time { color: #555; font-size: 11px; margin-left: auto; }
.post-title { color: #fff; font-size: 15px; font-weight: 700; margin-bottom: 5px; display: block; }
.post-content { color: #aaa; font-size: 13px; line-height: 1.5; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.post-actions { display: flex; gap: 16px; align-items: center; }
.action-btn { color: #888; font-size: 13px; }
.action-btn .liked { color: #FF6B6B; }
.action-btn .faved { color: #FFD54F; }

.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; background: rgba(0,0,0,0.7); display: flex; align-items: flex-end; justify-content: center; }
.modal-sheet { width: 100%; max-width: 430px; max-height: 75vh; background: #1e2a3a; border-radius: 28px 28px 0 0; padding: 20px 20px 40px; overflow-y: auto; }
.modal-handle { width: 40px; height: 4px; background: #ffffff22; border-radius: 2px; margin: 0 auto 16px; }
.modal-title-row { margin-bottom: 16px; }
.modal-title { color: #fff; font-size: 18px; font-weight: 800; }
.empty-modal { color: #555; font-size: 13px; text-align: center; padding: 30px 0; }

.rank-item { display: flex; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid #ffffff0a; }
.rank-num { width: 28px; height: 28px; border-radius: 8px; background: #2a3a4a; display: flex; align-items: center; justify-content: center; color: #888; font-size: 13px; font-weight: 800; flex-shrink: 0; }
.rank-num.gold { background: #FFD700; color: #111; }
.rank-num.silver { background: #C0C0C0; color: #111; }
.rank-num.bronze { background: #CD7F32; color: #111; }
.rank-info { flex: 1; min-width: 0; }
.rank-title { color: #fff; font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.rank-stat { color: #888; font-size: 11px; margin-top: 2px; display: block; }
.rank-tag { border-radius: 20px; padding: 2px 8px; font-size: 10px; font-weight: 600; flex-shrink: 0; }
</style>
