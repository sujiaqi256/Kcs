import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    semesterStart: null as Date | null,
    semesterWeekRange: { min: 1, max: 20 },
  }),
  actions: {
    setSemesterStart(dateStr: string) {
      this.semesterStart = new Date(dateStr)
      uni.setStorageSync('kcs_semester_start', dateStr)
    },
    loadFromStorage() {
      try {
        const stored = uni.getStorageSync('kcs_semester_start')
        if (stored) this.semesterStart = new Date(stored)
      } catch (e) {}
    },
  },
})
