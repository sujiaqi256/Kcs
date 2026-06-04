import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getStoredToken,
  getStoredStudentId,
  storeAuth,
  clearAuth,
  getUser,
  setUser,
  AUTH_API,
} from '../auth'

describe('auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('AUTH_API', () => {
    it('should be defined', () => {
      expect(AUTH_API).toBeDefined()
      expect(typeof AUTH_API).toBe('string')
    })
  })

  describe('getStoredToken', () => {
    it('should return null when no token stored', () => {
      localStorage.getItem.mockReturnValue(null)
      expect(getStoredToken()).toBeNull()
    })

    it('should return stored token', () => {
      localStorage.getItem.mockReturnValue('test-token')
      expect(getStoredToken()).toBe('test-token')
    })
  })

  describe('getStoredStudentId', () => {
    it('should return null when no student id stored', () => {
      localStorage.getItem.mockReturnValue(null)
      expect(getStoredStudentId()).toBeNull()
    })

    it('should return stored student id', () => {
      localStorage.getItem.mockReturnValue('202410012234')
      expect(getStoredStudentId()).toBe('202410012234')
    })
  })

  describe('storeAuth', () => {
    it('should store token and student id', () => {
      storeAuth('test-token', '202410012234')
      expect(localStorage.setItem).toHaveBeenCalledWith('kcs_token', 'test-token')
      expect(localStorage.setItem).toHaveBeenCalledWith('kcs_student_id', '202410012234')
    })
  })

  describe('clearAuth', () => {
    it('should remove token and student id', () => {
      clearAuth()
      expect(localStorage.removeItem).toHaveBeenCalledWith('kcs_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('kcs_student_id')
    })
  })

  describe('getUser / setUser', () => {
    it('should return null initially', () => {
      expect(getUser()).toBeNull()
    })

    it('should set and get user', () => {
      const testUser = { id: '123', nickname: '测试用户' }
      setUser(testUser)
      expect(getUser()).toEqual(testUser)
    })

    it('should clear user with null', () => {
      setUser({ id: '123' })
      setUser(null)
      expect(getUser()).toBeNull()
    })
  })
})
