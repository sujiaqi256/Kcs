<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useUserStore } from './stores/user'
import { useAppStore } from './stores/app'

onLaunch(() => {
  const userStore = useUserStore()
  const appStore = useAppStore()
  userStore.loadFromStorage()
  appStore.loadFromStorage()
})
</script>

<style>
page {
  background: #0d1117;
  color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

/* 全局滚动条隐藏 */
::-webkit-scrollbar {
  display: none;
}

/* 通用动画 */
@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
