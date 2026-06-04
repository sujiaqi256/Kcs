<template>
  <view class="publish-page">
    <view class="form">
      <text class="section-label">路线</text>
      <view class="route-row">
        <input class="route-input" v-model="fromPlace" placeholder="出发地" />
        <text class="swap-btn" @tap="swap">⇄</text>
        <input class="route-input" v-model="toPlace" placeholder="目的地" />
      </view>

      <text class="section-label">日期</text>
      <picker :range="dateLabels" @change="onDateChange">
        <view class="picker-display">{{ rideDate ? dateLabels[dateIdx] : '选择日期' }}</view>
      </picker>

      <view class="time-row">
        <view class="time-col">
          <text class="section-label">最早出发</text>
          <picker mode="time" @change="e => rideTimeStart = e.detail.value">
            <view class="picker-display">{{ rideTimeStart || '选择时间' }}</view>
          </picker>
        </view>
        <view class="time-col">
          <text class="section-label">最晚出发（选填）</text>
          <picker mode="time" @change="e => rideTimeEnd = e.detail.value">
            <view class="picker-display">{{ rideTimeEnd || '选择时间' }}</view>
          </picker>
        </view>
      </view>

      <view class="time-row">
        <view class="time-col">
          <text class="section-label">座位数</text>
          <view class="seat-row">
            <view v-for="n in [1,2,3,4,5,6]" :key="n" class="seat-btn" :class="{ active: seats === n }" @tap="seats = n">{{ n }}</view>
          </view>
        </view>
        <view class="time-col">
          <text class="section-label">每人价格（元）</text>
          <input class="price-input" v-model="price" type="number" placeholder="¥" />
        </view>
      </view>

      <text class="section-label">路线类型</text>
      <view class="type-row">
        <view v-for="t in ['校区往返','高铁站','城际']" :key="t" class="type-btn" :class="{ active: routeType === t }" @tap="routeType = t">{{ t }}</view>
      </view>

      <text class="section-label">备注（选填）</text>
      <textarea class="textarea" v-model="note" placeholder="如：途经广州南站、可放行李..." :maxlength="100" />

      <text class="section-label">联系方式</text>
      <input class="input" v-model="contact" placeholder="微信号或手机号" :maxlength="30" />

      <text v-if="error" class="error">{{ error }}</text>
      <button class="submit-btn" :loading="loading" @tap="handlePublish">{{ loading ? '发布中...' : '发布拼车' }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../../stores/user'
import { sb } from '../../utils/supabase'

const userStore = useUserStore()
const PLACES = ['广州应用科技学院（二期）-西南门','广州应用科技学院（一期）-东南门','肇庆东站','鼎湖东站','四会','莲花镇','广州南站','肇庆站']

const fromPlace = ref('')
const toPlace = ref('')
const rideDate = ref('')
const rideTimeStart = ref('')
const rideTimeEnd = ref('')
const seats = ref(3)
const price = ref('')
const routeType = ref('校区往返')
const note = ref('')
const contact = ref('')
const loading = ref(false)
const error = ref('')
const dateIdx = ref(0)

const dateOptions = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i)
  return { value: d.toISOString().slice(0, 10), label: `${d.getMonth() + 1}/${d.getDate()} 周${'日一二三四五六'[d.getDay()]}` }
})
const dateLabels = dateOptions.map(d => d.label)

const onDateChange = (e: any) => {
  dateIdx.value = e.detail.value
  rideDate.value = dateOptions[e.detail.value].value
}

const swap = () => { const t = fromPlace.value; fromPlace.value = toPlace.value; toPlace.value = t }

const handlePublish = async () => {
  if (!fromPlace.value) { error.value = '请选择出发地'; return }
  if (!toPlace.value) { error.value = '请选择目的地'; return }
  if (fromPlace.value === toPlace.value) { error.value = '出发地和目的地不能相同'; return }
  if (!rideDate.value) { error.value = '请选择日期'; return }
  if (!rideTimeStart.value) { error.value = '请选择出发时间'; return }
  if (!price.value || isNaN(Number(price.value))) { error.value = '请输入正确的价格'; return }
  loading.value = true
  try {
    const u = userStore.user!
    const rideTime = rideTimeEnd.value ? `${rideTimeStart.value}-${rideTimeEnd.value}` : rideTimeStart.value
    await sb('carpool', { method: 'POST', body: JSON.stringify({
      user_id: u.id, nickname: u.nickname, avatar: u.avatar,
      from_place: fromPlace.value, to_place: toPlace.value,
      ride_date: rideDate.value, ride_time: rideTime,
      seats_total: seats.value, seats_taken: 0,
      price: Number(price.value), route_type: routeType.value, note: note.value, contact: contact.value, status: 'active'
    }), prefer: 'return=minimal' })
    uni.showToast({ title: '发布成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 1000)
  } catch (e: any) { error.value = '发布失败: ' + (e.message || '请重试') }
  loading.value = false
}
</script>

<style scoped>
.publish-page { min-height: 100vh; background: #0d1117; padding: 20px 16px; }
.form { }
.section-label { color: #888; font-size: 12px; margin-bottom: 6px; display: block; margin-top: 12px; }
.section-label:first-child { margin-top: 0; }
.route-row { display: flex; gap: 8px; align-items: center; margin-bottom: 4px; }
.route-input { flex: 1; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; }
.swap-btn { color: #F0A500; font-size: 18px; flex-shrink: 0; }
.picker-display { background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; }
.time-row { display: flex; gap: 10px; margin-bottom: 4px; }
.time-col { flex: 1; }
.seat-row { display: flex; gap: 6px; }
.seat-btn { flex: 1; background: #2a3a4a; border-radius: 10px; padding: 8px 0; color: #fff; font-size: 13px; font-weight: 600; text-align: center; }
.seat-btn.active { background: #F0A500; }
.price-input { background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; width: 100%; box-sizing: border-box; }
.type-row { display: flex; gap: 8px; }
.type-btn { padding: 6px 14px; border-radius: 20px; background: #2a3a4a; color: #fff; font-size: 12px; font-weight: 600; }
.type-btn.active { background: #F0A500; }
.input { width: 100%; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; box-sizing: border-box; margin-bottom: 8px; }
.textarea { width: 100%; background: #2a3a4a; border: 1px solid #ffffff22; border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 13px; min-height: 60px; box-sizing: border-box; }
.error { color: #FF6B6B; font-size: 12px; margin-bottom: 8px; display: block; }
.submit-btn { width: 100%; background: linear-gradient(135deg, #F0A500, #FF8A65); border: none; border-radius: 16px; padding: 14px; color: #fff; font-size: 16px; font-weight: 700; margin-top: 16px; }
</style>
