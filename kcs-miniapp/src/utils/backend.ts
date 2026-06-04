export const AUTH_API = 'https://120.25.106.168'

export async function apiRequest(path: string, options: any = {}) {
  const token = uni.getStorageSync('kcs_token')
  const url = path.startsWith('http') ? path : `${AUTH_API}${path}`
  const headers: any = { 'Content-Type': 'application/json', ...options.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return new Promise<any>((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
      header: headers,
      data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`))
        }
      },
      fail: (err: any) => reject(err),
    })
  })
}

export async function login(studentId: string, password: string) {
  return apiRequest('/api/login', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, password }),
  })
}

export async function getUserInfo() {
  const token = uni.getStorageSync('kcs_token')
  if (!token) return null
  return apiRequest(`/api/user?token=${encodeURIComponent(token)}`)
}

export async function syncSchedule(studentId: string) {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest(`/api/education/schedule?student_id=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token || '')}`)
}

export async function getClassrooms() {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest(`/api/education/classrooms?token=${encodeURIComponent(token || '')}`)
}

export async function getClassroomDetail(id: string, date: string) {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest(`/api/education/classroom-detail?token=${encodeURIComponent(token || '')}&id=${encodeURIComponent(id)}&date=${date}`)
}

export async function applyRoom(roomId: string, date: string, period: string, reason: string, contact: string) {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest('/api/education/apply-room', {
    method: 'POST',
    body: JSON.stringify({ token, room_id: roomId, date, period, reason, contact }),
  })
}

export async function getAvailableCourses(page: number = 1, keyword: string = '', dept: string = '') {
  const token = uni.getStorageSync('kcs_token')
  const studentId = uni.getStorageSync('kcs_student_id')
  let url = `/api/ss-available-courses?student_id=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token || '')}&page=${page}`
  if (keyword) url += `&kw=${encodeURIComponent(keyword)}`
  if (dept) url += `&dept=${encodeURIComponent(dept)}`
  return apiRequest(url)
}

export async function selectCourse(courseId: string) {
  const token = uni.getStorageSync('kcs_token')
  const studentId = uni.getStorageSync('kcs_student_id')
  return apiRequest(`/api/ss-select-course?student_id=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token || '')}&id=${encodeURIComponent(courseId)}`)
}

export async function dropCourse(courseId: string) {
  const token = uni.getStorageSync('kcs_token')
  const studentId = uni.getStorageSync('kcs_student_id')
  return apiRequest(`/api/ss-drop-course?student_id=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token || '')}&id=${encodeURIComponent(courseId)}`)
}

export async function getWindows() {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest(`/api/windows?token=${encodeURIComponent(token || '')}`)
}

export async function getDepartments() {
  const token = uni.getStorageSync('kcs_token')
  return apiRequest(`/api/departments?token=${encodeURIComponent(token || '')}`)
}

export async function getStudentInfo() {
  const token = uni.getStorageSync('kcs_token')
  const studentId = uni.getStorageSync('kcs_student_id')
  return apiRequest(`/api/student-info?student_id=${encodeURIComponent(studentId)}&token=${encodeURIComponent(token || '')}`)
}
