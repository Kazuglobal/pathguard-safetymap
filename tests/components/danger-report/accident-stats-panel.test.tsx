import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccidentStatsPanel, {
  AccidentStatsLoading,
  AccidentStatsEmpty,
} from '@/components/danger-report/accident-stats-panel'
import type { AccidentStats } from '@/lib/traffic-accident-data'

function createStats(overrides: Partial<AccidentStats> = {}): AccidentStats {
  return {
    total_accidents: 12,
    total_fatalities: 1,
    total_injuries: 11,
    child_involved: 2,
    pedestrian_involved: 4,
    fatal_accidents: 1,
    by_year: { '2024': 5, '2025': 7 },
    by_time_of_day: {},
    by_weather: { 晴: 8, 雨: 4 },
    by_accident_type: { 人対車両: 4, 追突: 3 },
    by_party_type: { 歩行者: 4, 自転車: 2 },
    by_road_surface: { 乾燥: 9, 湿潤: 3 },
    by_terrain: { 平坦: 10, 坂: 2 },
    injury_analysis: {
      by_injury_level: { 軽傷: 9, 重傷: 2 },
      severe_ratio: 17,
    },
    road_environment: {
      by_road_shape: { 交差点: 7, 単路: 5 },
      by_sidewalk: { 区分あり: 8, 区分なし: 4 },
      intersection_ratio: 58,
      no_sidewalk_ratio: 33,
    },
    party_analysis: {
      by_age_group: { '24歳以下': 3, '65-74歳': 2 },
      elderly_ratio: 22,
      young_ratio: 25,
    },
    time_analysis: {
      by_hour: { '7': 2, '8': 3, '14': 4, '16': 1 },
      by_month: { '1': 2, '4': 5, '9': 3 },
      peak_hour: 14,
      peak_month: 4,
    },
    situation_summary: {
      total_text: '過去5年で12件の事故が発生しています',
      severity_text: '死亡事故1件が確認されています',
      pedestrian_text: '歩行者が関与した事故が4件あります',
      weather_risk_text: '雨天時の事故に注意が必要です',
      road_text: '交差点周辺での事故が目立ちます',
      surface_text: '湿潤路面での事故が一定数あります',
      elderly_text: '高齢者が関与した事故も見られます',
    },
    nearest_accidents: [
      {
        distance_m: 45,
        year: 2025,
        occurred_at: '2025-01-15T08:00:00Z',
        type: '人対車両',
        severity: 'fatal',
        fatalities: 1,
        injuries: 0,
        involved_child: true,
        involved_pedestrian: true,
        weather: '雨',
        road_shape: '交差点',
        sidewalk: '区分なし',
        road_surface: '湿潤',
        terrain: '平坦',
        party_a_type: '歩行者',
        party_b_type: '普通車',
        injury_a: '死亡',
        injury_b: 'なし',
        party_a_age: 12,
        party_b_age: 45,
        latitude: 35.6598,
        longitude: 139.7008,
      },
      {
        distance_m: 80,
        year: 2024,
        occurred_at: null,
        type: '追突',
        severity: 'injury',
        fatalities: 0,
        injuries: 2,
        involved_child: false,
        involved_pedestrian: false,
        weather: '晴',
        road_shape: '単路',
        sidewalk: '区分あり',
        road_surface: '乾燥',
        terrain: '平坦',
        party_a_type: '普通車',
        party_b_type: '普通車',
        injury_a: '軽傷',
        injury_b: '軽傷',
        party_a_age: 35,
        party_b_age: 40,
        latitude: 35.66,
        longitude: 139.701,
      },
    ],
    risk_score: 85,
    search_params: {
      latitude: 35.6595,
      longitude: 139.7004,
      radius_meters: 300,
      years: 5,
    },
    ...overrides,
  }
}

describe('AccidentStatsPanel', () => {
  it('renders the current full-mode overview contract', () => {
    render(<AccidentStatsPanel stats={createStats()} />)

    expect(screen.getByText('交通事故データ')).toBeInTheDocument()
    expect(screen.getByText(/非常に危険/)).toBeInTheDocument()
    expect(screen.getByText('事故リスクスコア')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
    expect(screen.getByText('事故件数')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('死亡事故')).toBeInTheDocument()
    expect(screen.getByText(/この地点の事故状況/)).toBeInTheDocument()
  })

  it('switches tabs and renders time/weather content', async () => {
    const user = userEvent.setup()
    render(<AccidentStatsPanel stats={createStats()} />)

    await user.click(screen.getByRole('button', { name: /時間帯/ }))

    expect(screen.getByText('最多発生時間')).toBeInTheDocument()
    expect(screen.getByText('14時台')).toBeInTheDocument()
    expect(screen.getByText(/天候別/)).toBeInTheDocument()
    expect(screen.getByText(/雨 4件/)).toBeInTheDocument()
  })

  it('shows commute alert when school-route hours exceed 25% even if a different single hour is the peak', () => {
    render(
      <AccidentStatsPanel
        stats={createStats({
          total_accidents: 20,
          time_analysis: {
            by_hour: { '7': 3, '8': 3, '10': 4, '14': 2 },
            by_month: { '1': 2, '4': 5, '9': 3 },
            peak_hour: 10,
            peak_month: 4,
          },
        })}
      />,
    )

    expect(screen.getByText(/登校時間帯（7〜8時）に集中: 6件（全体の30%）/)).toBeInTheDocument()
  })

  it('keeps injury severity and terrain details in the integrated factors tab', async () => {
    const user = userEvent.setup()
    render(<AccidentStatsPanel stats={createStats()} />)

    await user.click(screen.getByRole('button', { name: /危険要因/ }))

    expect(screen.getByText(/損傷程度/)).toBeInTheDocument()
    expect(screen.getByText(/重傷以上: 17%/)).toBeInTheDocument()
    expect(screen.getByText('軽傷')).toBeInTheDocument()
    expect(screen.getByText(/地形区分/)).toBeInTheDocument()
    expect(screen.getByText(/平坦: 10件/)).toBeInTheDocument()
    expect(screen.getByText(/坂: 2件/)).toBeInTheDocument()
  })

  it('shows expandable accident detail rows on the detail tab', async () => {
    const user = userEvent.setup()
    render(<AccidentStatsPanel stats={createStats()} />)

    await user.click(screen.getByRole('button', { name: /事故詳細/ }))

    expect(screen.getByText(/近隣事故 2件/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /45m/ }))

    expect(screen.getByText(/死亡（1名）/)).toBeInTheDocument()
    expect(screen.getByText(/雨/)).toBeInTheDocument()
  })

  it('renders compact mode with summary copy and without tabs', () => {
    render(<AccidentStatsPanel stats={createStats()} mode="compact" />)

    expect(screen.getByText('事故リスクスコア')).toBeInTheDocument()
    expect(screen.getByText(/死亡事故1件が確認されています/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /概要/ })).not.toBeInTheDocument()
  })

  it('renders the empty state for zero accidents', () => {
    render(
      <AccidentStatsPanel
        stats={createStats({
          total_accidents: 0,
          total_fatalities: 0,
          total_injuries: 0,
          child_involved: 0,
          pedestrian_involved: 0,
          fatal_accidents: 0,
          risk_score: 0,
          nearest_accidents: [],
        })}
      />
    )

    expect(screen.getByText(/半径300m以内に交通事故の記録はありません/)).toBeInTheDocument()
  })

  it('renders the exported loading and empty helpers', () => {
    const { container, rerender } = render(<AccidentStatsLoading />)

    expect(container.querySelector('.animate-pulse')).toBeTruthy()

    rerender(<AccidentStatsEmpty radius={500} />)

    expect(screen.getByText(/半径500m以内に交通事故の記録はありません/)).toBeInTheDocument()
  })
})
