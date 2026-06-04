const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string

export async function sb(path: string, options: any = {}) {
  const authToken = uni.getStorageSync('kcs_auth_token')
  return new Promise<any>((resolve, reject) => {
    uni.request({
      url: `${SUPABASE_URL}/rest/v1/${path}`,
      method: options.method || 'GET',
      header: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${authToken || SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': options.prefer || 'return=representation',
        ...(options.headers || {}),
      },
      data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      success: (res: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          reject(new Error(JSON.stringify(res.data)))
        }
      },
      fail: (err: any) => reject(err),
    })
  })
}

export { SUPABASE_URL, SUPABASE_KEY }
