import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sb, SUPABASE_URL, SUPABASE_KEY } from '../supabase'

describe('supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch.mockReset()
  })

  describe('config', () => {
    it('should have SUPABASE_URL defined', () => {
      expect(SUPABASE_URL).toBeDefined()
      expect(typeof SUPABASE_URL).toBe('string')
    })

    it('should have SUPABASE_KEY defined', () => {
      expect(SUPABASE_KEY).toBeDefined()
      expect(typeof SUPABASE_KEY).toBe('string')
    })
  })

  describe('sb function', () => {
    it('should make GET request by default', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('[{"id":1}]'),
      })

      await sb('test_table')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test_table'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          }),
        })
      )
    })

    it('should make POST request with body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('{"id":1}'),
      })

      await sb('test_table', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test_table'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        })
      )
    })

    it('should throw error on failed response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve('Not found'),
      })

      await expect(sb('nonexistent')).rejects.toThrow('Not found')
    })

    it('should return parsed JSON', async () => {
      const testData = [{ id: 1, name: 'test' }]
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(testData)),
      })

      const result = await sb('test_table')
      expect(result).toEqual(testData)
    })

    it('should return null for empty response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })

      const result = await sb('test_table')
      expect(result).toBeNull()
    })
  })
})
