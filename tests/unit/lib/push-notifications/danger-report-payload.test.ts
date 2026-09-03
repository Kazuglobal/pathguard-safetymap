import { describe, expect, it } from 'vitest'

import { buildDangerReportPushPayload } from '@/lib/notifications/builders'

describe('buildDangerReportPushPayload', () => {
  it('uses only server-owned labels for the lock-screen text', () => {
    const payload = buildDangerReportPushPayload({
      reportId: 'report-1',
      dangerType: 'traffic',
      prefecture: '東京都',
    })

    expect(payload.title).toBe('近隣の通学路に危険報告')
    expect(payload.body).toBe('交通危険に関する新しい報告が公開されました。')
    expect(payload.tag).toBe('danger-report-report-1')
    expect(payload.data.url).toBe('/map?reportId=report-1')
  })

  it('does not copy unknown type, fake region, or legacy free text into the payload', () => {
    const attack = '<script>任意の通知文</script>'
    const payload = buildDangerReportPushPayload({
      reportId: 'report-2',
      dangerType: attack,
      prefecture: `東京都${attack}`,
      reportTitle: attack,
      routeName: attack,
    } as Parameters<typeof buildDangerReportPushPayload>[0] & {
      reportTitle: string
      routeName: string
    })

    expect(payload.title).toBe('近隣の通学路に危険報告')
    expect(payload.body).toBe('通学路の危険に関する新しい報告が公開されました。')
    expect(JSON.stringify(payload)).not.toContain(attack)
  })
})
