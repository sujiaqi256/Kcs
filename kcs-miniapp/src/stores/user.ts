import { defineStore } from 'pinia'

interface UserInfo {
  id: string
  student_id: string
  nickname: string
  avatar: string
  [key: string]: any
}

export const useUserStore = defineStore('user', {
  state: () => ({
    user: null as UserInfo | null,
    token: '',
    authToken: '',
    studentId: '',
    isLoggedIn: false,
  }),
  actions: {
    login(token: string, studentId: string, authToken: string, userInfo: UserInfo) {
      this.token = token
      this.studentId = studentId
      this.authToken = authToken
      this.user = userInfo
      this.isLoggedIn = true
      uni.setStorageSync('kcs_token', token)
      uni.setStorageSync('kcs_student_id', studentId)
      if (authToken) uni.setStorageSync('kcs_auth_token', authToken)
      uni.setStorageSync('kcs_user', JSON.stringify(userInfo))
    },
    logout() {
      this.token = ''
      this.studentId = ''
      this.authToken = ''
      this.user = null
      this.isLoggedIn = false
      uni.removeStorageSync('kcs_token')
      uni.removeStorageSync('kcs_student_id')
      uni.removeStorageSync('kcs_auth_token')
      uni.removeStorageSync('kcs_user')
    },
    updateUser(partial: Partial<UserInfo>) {
      if (this.user) {
        this.user = { ...this.user, ...partial }
        uni.setStorageSync('kcs_user', JSON.stringify(this.user))
      }
    },
    loadFromStorage() {
      try {
        const token = uni.getStorageSync('kcs_token')
        const studentId = uni.getStorageSync('kcs_student_id')
        const authToken = uni.getStorageSync('kcs_auth_token')
        const userStr = uni.getStorageSync('kcs_user')
        if (token && studentId) {
          this.token = token
          this.studentId = studentId
          this.authToken = authToken || ''
          this.user = userStr ? JSON.parse(userStr) : null
          this.isLoggedIn = true
        }
      } catch (e) {}
    },
  },
})
