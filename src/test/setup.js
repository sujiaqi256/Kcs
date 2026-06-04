import '@testing-library/jest-dom'

// Mock import.meta.env
Object.defineProperty(import.meta, 'env', {
  value: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_KEY: 'test-key',
    VITE_AUTH_API: 'http://localhost:5000',
  },
})

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock fetch
global.fetch = vi.fn()

// Mock navigator.getBattery
Object.defineProperty(navigator, 'getBattery', {
  value: () => Promise.resolve({
    level: 0.8,
    charging: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
})

// Mock navigator.connection
Object.defineProperty(navigator, 'connection', {
  value: {
    type: 'wifi',
    effectiveType: '4g',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
})
