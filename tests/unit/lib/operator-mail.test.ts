import { describe, expect, it, vi } from 'vitest'

import { buildDailyOpsReportMail, type DailyOpsMetrics } from '@/lib/email/daily-ops-report'
import {
  OPERATOR_EMAIL_FROM_ADDRESS,
  OPERATOR_EMAIL_TO,
  sendAbuseReportNotification,
  sendCiDeployNotification,
  sendOperatorAlert,
  sendOperatorEmail,
} from '@/lib/email/operator-mail'

describe('operator-mail (Cloudflare Email Sending)', () => {
  it('バインディング未設定なら例外を投げず skipped を返す', async () => {
    await expect(
      sendOperatorEmail({ subject: 'テスト', text: '本文' }, { binding: null }),
    ).resolves.toEqual({ status: 'skipped', reason: 'binding_unavailable' })
  })

  it('sendOperatorEmail は text とエスケープ済み html の両方を globalbunny77@gmail.com へ送る', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'cf-msg-1' })
    const result = await sendOperatorEmail(
      { subject: 'テスト <alert>', text: '1行目\n<script>x</script>' },
      { binding: { send } },
    )
    expect(result).toEqual({ status: 'sent', messageId: 'cf-msg-1' })
    const payload = send.mock.calls[0][0]
    expect(payload.to).toBe(OPERATOR_EMAIL_TO)
    expect(payload.from).toEqual({ email: OPERATOR_EMAIL_FROM_ADDRESS, name: 'PathGuardian' })
    expect(payload.html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(payload.html).not.toContain('<script>')
  })

  it('送信エラー時にエラーコードを含めて failed を返す', async () => {
    const err = Object.assign(new Error('recipient not allowed'), { code: 'E_RECIPIENT_NOT_ALLOWED' })
    const send = vi.fn().mockRejectedValue(err)
    await expect(
      sendOperatorAlert(
        { category: 'cron', title: 'Cron失敗', details: { route: '/api/cron/test' } },
        { binding: { send } },
      ),
    ).resolves.toEqual({
      status: 'failed',
      error: 'E_RECIPIENT_NOT_ALLOWED: recipient not allowed',
    })
  })

  it('通報通知とCIデプロイ通知の件名・本文が正しく組み立てられる', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: 'ok' })
    await sendAbuseReportNotification(
      { targetReportId: '12345678-aaaa-bbbb-cccc-1234567890ab', reporterUserId: 'u-1', reason: 'スパム投稿' },
      { binding: { send } },
    )
    expect(send.mock.calls[0][0].subject).toContain('通報')
    expect(send.mock.calls[0][0].text).toContain('スパム投稿')

    await sendCiDeployNotification(
      {
        status: 'failure',
        workflow: 'Cloudflare Production',
        ref: 'refs/heads/main',
        sha: 'abcdef1234567',
        actor: 'Kazuglobal',
        runUrl: 'https://github.com/Kazuglobal/pathguard-safetymap/actions/runs/1',
      },
      { binding: { send } },
    )
    expect(send.mock.calls[1][0].subject).toContain('デプロイ失敗')
    expect(send.mock.calls[1][0].subject).toContain('abcdef1')
    expect(send.mock.calls[1][0].text).toContain('https://github.com/Kazuglobal/pathguard-safetymap/actions/runs/1')
  })
})

describe('buildDailyOpsReportMail', () => {
  const baseMetrics: DailyOpsMetrics = {
    generatedAt: '2026-11-26T23:00:00.000Z',
    yearMonth: '2026-11',
    newDangerReports24h: 3,
    pendingModerationReports: 1,
    failedModerationReports: 0,
    newAbuseReports24h: 0,
    newContactMessages24h: 1,
    failedContactDeliveries24h: 0,
    newLocalSafetyAlerts24h: 5,
    failedApiCalls24h: 0,
    providers: [
      {
        provider: 'gemini',
        totalCostUsd: 1.5,
        requestCount: 40,
        monthlyBudgetUsd: 10,
        alertThresholdPercent: 80,
        usagePercent: 15,
        alert: false,
      },
    ],
    totalMonthlyCostUsd: 1.5,
    backup: {
      latestKey: 'd1/2026-11-26.sql.gz',
      sizeBytes: 204800,
      uploadedAt: '2026-11-26T18:05:00.000Z',
      stale: false,
    },
  }

  it('異常が無いときは「異常なし」件名になり、予算アラート対象は空', () => {
    const mail = buildDailyOpsReportMail(baseMetrics)
    expect(mail.hasWarnings).toBe(false)
    expect(mail.budgetAlertProviders).toEqual([])
    expect(mail.subject).toContain('異常なし')
    expect(mail.text).toContain('新規危険報告: 3 件')
    expect(mail.text).toContain('d1/2026-11-26.sql.gz')
  })

  it('バックアップ遅延やAPI予算超過があると「要確認」件名になり警告が並ぶ', () => {
    const mail = buildDailyOpsReportMail({
      ...baseMetrics,
      failedModerationReports: 2,
      backup: { ...baseMetrics.backup, stale: true },
      providers: [
        {
          provider: 'openai',
          totalCostUsd: 8.5,
          requestCount: 120,
          monthlyBudgetUsd: 10,
          alertThresholdPercent: 80,
          usagePercent: 85,
          alert: true,
        },
      ],
    })
    expect(mail.hasWarnings).toBe(true)
    expect(mail.budgetAlertProviders).toHaveLength(1)
    expect(mail.subject).toContain('要確認(3件)')
    expect(mail.text).toContain('AIモデレーション失敗の報告が 2 件')
    expect(mail.text).toContain('26時間以上更新されていません')
    expect(mail.text).toContain('APIコスト予算超過警告 (openai)')
  })
})
