import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../../App'

// Mock the child components
vi.mock('../ScheduleTab', () => ({
  default: ({ refreshKey, onManualRefresh }) => (
    <div data-testid="schedule-tab">Schedule Tab {refreshKey}</div>
  ),
}))

vi.mock('../RoomsTab', () => ({
  default: () => <div data-testid="rooms-tab">Rooms Tab</div>,
}))

vi.mock('../ForumTab', () => ({
  default: ({ refreshKey }) => <div data-testid="forum-tab">Forum Tab {refreshKey}</div>,
}))

vi.mock('../CarpoolTab', () => ({
  default: ({ refreshKey }) => <div data-testid="carpool-tab">Carpool Tab {refreshKey}</div>,
}))

vi.mock('../MarketTab', () => ({
  default: ({ refreshKey }) => <div data-testid="market-tab">Market Tab {refreshKey}</div>,
}))

vi.mock('../ProfileTab', () => ({
  default: ({ onSyncSchedule, lastSyncTime, syncing }) => (
    <div data-testid="profile-tab">Profile Tab</div>
  ),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock fetch for token restoration
    global.fetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ ok: false }),
    })
  })

  it('should render without crashing', () => {
    render(<App />)
    expect(screen.getByText('课表')).toBeInTheDocument()
  })

  it('should show schedule tab by default', () => {
    render(<App />)
    expect(screen.getByTestId('schedule-tab')).toBeInTheDocument()
  })

  it('should switch tabs when clicking tab buttons', async () => {
    render(<App />)

    // Click on rooms tab
    fireEvent.click(screen.getByText('空教室'))
    expect(screen.getByTestId('rooms-tab')).toBeInTheDocument()

    // Click on forum tab
    fireEvent.click(screen.getByText('广场'))
    expect(screen.getByTestId('forum-tab')).toBeInTheDocument()
  })

  it('should display time in header', () => {
    render(<App />)
    // Check for time display (format: HH:MM)
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument()
  })

  it('should have 6 tab buttons', () => {
    render(<App />)
    const tabButtons = screen.getAllByRole('button').filter(
      button => button.textContent.match(/课表|空教室|广场|拼车|集市|我的/)
    )
    expect(tabButtons.length).toBe(6)
  })
})
