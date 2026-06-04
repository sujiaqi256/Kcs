<template>
  <view class="login-page">
    <view class="header">
      <text class="title">绑定学号</text>
      <text class="subtitle">登录教务系统验证身份</text>
    </view>

    <view class="form">
      <input
        class="input"
        v-model="studentId"
        placeholder="学号"
        :maxlength="20"
        type="number"
      />
      <view class="pwd-wrap">
        <input
          class="input pwd-input"
          v-model="password"
          :password="!showPwd"
          placeholder="教务系统密码"
          :maxlength="30"
        />
        <text class="eye" @tap="showPwd = !showPwd">{{ showPwd ? '🙈' : '👁️' }}</text>
      </view>

      <text v-if="error" class="error">{{ error }}</text>

      <button class="btn-login" :loading="loading" :disabled="loading" @tap="handleLogin">
        {{ loading ? '验证中...' : '登录验证' }}
      </button>

      <text class="skip" @tap="goBack">稍后再说</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../../utils/backend'
import { useUserStore } from '../../stores/user'

const studentId = ref('')
const password = ref('')
const showPwd = ref(false)
const error = ref('')
const loading = ref(false)
const userStore = useUserStore()

const handleLogin = async () => {
  if (!studentId.value.trim()) { error.value = '请输入学号'; return }
  if (!password.value.trim()) { error.value = '请输入密码'; return }
  error.value = ''
  loading.value = true
  try {
    const data = await login(studentId.value.trim(), password.value.trim())
    if (!data.ok) { error.value = data.error || '登录失败'; loading.value = false; return }
    userStore.login(data.token, data.student_id, data.auth_token, {
      id: data.user_id,
      student_id: data.student_id,
      nickname: data.nickname,
      avatar: data.avatar,
    })
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e: any) {
    error.value = '网络错误，请检查服务器是否启动'
  }
  loading.value = false
}

const goBack = () => uni.navigateBack()
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #0d1117;
  padding: 60px 24px 40px;
  display: flex;
  flex-direction: column;
}
.header { text-align: center; margin-bottom: 40px; }
.title { font-size: 26px; font-weight: 800; color: #fff; }
.subtitle { font-size: 13px; color: #888; margin-top: 8px; display: block; }
.form { flex: 1; }
.input {
  width: 100%;
  background: #2a3a4a;
  border: 1px solid #ffffff22;
  border-radius: 12px;
  padding: 14px 16px;
  color: #fff;
  font-size: 16px;
  margin-bottom: 12px;
  box-sizing: border-box;
}
.pwd-wrap { position: relative; margin-bottom: 8px; }
.pwd-input { padding-right: 44px; margin-bottom: 0; }
.eye {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: #888;
}
.error { color: #FF6B6B; font-size: 12px; margin-bottom: 10px; display: block; }
.btn-login {
  width: 100%;
  background: linear-gradient(135deg, #4DD0E1, #64B5F6);
  border: none;
  border-radius: 16px;
  padding: 15px;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  margin-top: 16px;
}
.btn-login[disabled] { opacity: 0.6; }
.skip {
  display: block;
  text-align: center;
  margin-top: 16px;
  color: #888;
  font-size: 14px;
}
</style>
