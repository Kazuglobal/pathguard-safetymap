import { getCloudflareContext } from '@opennextjs/cloudflare'

/** Cloudflare Email Routing で認証済みの運営者宛先アドレス（Workers Free で無料送信可能） */
export const OPERATOR_EMAIL_TO = 'globalbunny77@gmail.com'
/** Email Sending にオンボードした送信元ドメインのアドレス */
export const OPERATOR_EMAIL_FROM_ADDRESS = 'noreply@path-guardian.com'
export const OPERATOR_EMAIL_FROM_NAME = 'PathGuardian'

export interface OperatorEmailAddress {
  email: string
  name: string
}

export interface OperatorEmailPayload {
  from: string | OperatorEmailAddress
  to: string | OperatorEmailAddress | Array<string | OperatorEmailAddress>
  replyTo?: string | OperatorEmailAddress
  subject: string
  text: string
  html: string
}

export interface OperatorEmailBinding {
  send(message: OperatorEmailPayload): Promise<{ messageId?: string } | void>
}

export type OperatorEmailResult =
  | { status: 'sent'; messageId?: string }
  | { status: 'skipped'; reason: 'binding_unavailable' }
  | { status: 'failed'; error: string }

export interface SendOperatorEmailInput {
  subject: string
  text: string
  html?: string
  replyTo?: string
  fromName?: string
}

export interface SendOperatorEmailOptions {
  binding?: OperatorEmailBinding | null
  to?: string
  fromAddress?: string
  fromName?: string
}

/** HTML エスケープ（プレーンテキストから安全に HTML 本文を生成するため） */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** プレーンテキストから読みやすい最小限の HTML 本文を生成する */
export function buildPlainTextHtml(subject: string, text: string): string {
  const escapedTitle = escapeHtml(subject)
  const escapedBody = escapeHtml(text).replaceAll('\n', '<br />')
  return [
    '<!doctype html>',
    '<html lang="ja">',
    '<body style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;color:#111827;background:#f9fafb;padding:20px;">',
    '<div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">',
    `<h2 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escapedTitle}</h2>`,
    `<div style="font-size:14px;line-height:1.7;white-space:normal;word-break:break-word;">${escapedBody}</div>`,
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />',
    '<p style="margin:0;font-size:12px;color:#6b7280;">PathGuardian (path-guardian.com) Cloudflare Email Sending</p>',
    '</div>',
    '</body>',
    '</html>',
  ].join('')
}

/**
 * 現在の Cloudflare Workers コンテキストから OPERATOR_EMAIL バインディングを取得する。
 * ローカルテストや非 Workers 環境では例外を投げずに undefined を返す。
 */
export function getOperatorEmailBinding(): OperatorEmailBinding | undefined {
  try {
    const context = getCloudflareContext()
    const env = context.env as unknown as { OPERATOR_EMAIL?: OperatorEmailBinding }
    if (env?.OPERATOR_EMAIL && typeof env.OPERATOR_EMAIL.send === 'function') {
      return env.OPERATOR_EMAIL
    }
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Cloudflare Email Sending バインディングで運営者（globalbunny77@gmail.com）へメールを送る。
 * 例外は投げず、結果を返す（呼び出し元の本処理を止めない設計）。
 */
export async function sendOperatorEmail(
  input: SendOperatorEmailInput,
  options: SendOperatorEmailOptions = {},
): Promise<OperatorEmailResult> {
  const binding = options.binding === undefined ? getOperatorEmailBinding() : options.binding
  if (!binding) {
    return { status: 'skipped', reason: 'binding_unavailable' }
  }

  const to = options.to?.trim() || OPERATOR_EMAIL_TO
  const fromAddress = options.fromAddress?.trim() || OPERATOR_EMAIL_FROM_ADDRESS
  const fromName = input.fromName?.trim() || options.fromName?.trim() || OPERATOR_EMAIL_FROM_NAME
  const html = input.html ?? buildPlainTextHtml(input.subject, input.text)

  const payload: OperatorEmailPayload = {
    from: { email: fromAddress, name: fromName },
    to,
    subject: input.subject,
    text: input.text,
    html,
    ...(input.replyTo?.trim() ? { replyTo: input.replyTo.trim() } : {}),
  }

  try {
    const response = await binding.send(payload)
    const messageId =
      response && typeof response === 'object' && 'messageId' in response && typeof response.messageId === 'string'
        ? response.messageId
        : undefined
    return { status: 'sent', ...(messageId ? { messageId } : {}) }
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error && typeof (error as { code?: unknown }).code === 'string'
        ? (error as { code: string }).code
        : undefined
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'failed', error: code ? `${code}: ${message}` : message }
  }
}

export interface OperatorAlertInput {
  category: string
  title: string
  severity?: 'error' | 'warning'
  details: Record<string, string | number | boolean | null | undefined>
  occurredAt?: string
}

/** 異常・監視アラートを運営者へ送信する */
export async function sendOperatorAlert(
  input: OperatorAlertInput,
  options?: SendOperatorEmailOptions,
): Promise<OperatorEmailResult> {
  const severity = input.severity ?? 'error'
  const badge = severity === 'error' ? '異常' : '警告'
  const occurredAt = input.occurredAt ?? new Date().toISOString()
  const detailLines = Object.entries(input.details)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `- ${key}: ${value === null ? '(なし)' : String(value)}`)

  const subject = `【PathGuardian ${badge}】${input.title}`
  const text = [
    `種別: ${input.category}`,
    `重要度: ${badge} (${severity})`,
    `発生時刻(UTC): ${occurredAt}`,
    '',
    '--- 詳細 ---',
    ...detailLines,
  ].join('\n')

  return sendOperatorEmail({ subject, text }, options)
}

export interface AbuseReportNotificationInput {
  targetReportId: string
  reporterUserId: string
  reason?: string
  reportedAt?: string
}

/** 不適切投稿の通報を即座に運営者へ通知する */
export async function sendAbuseReportNotification(
  input: AbuseReportNotificationInput,
  options?: SendOperatorEmailOptions,
): Promise<OperatorEmailResult> {
  const reportedAt = input.reportedAt ?? new Date().toISOString()
  const subject = `【PathGuardian 通報】投稿が通報されました (${input.targetReportId.slice(0, 8)})`
  const text = [
    `対象レポートID: ${input.targetReportId}`,
    `通報者ユーザーID: ${input.reporterUserId}`,
    `受付時刻(UTC): ${reportedAt}`,
    `理由: ${input.reason?.trim() || '(理由の記入なし)'}`,
    '',
    '管理画面: https://path-guardian.com/admin',
  ].join('\n')

  return sendOperatorEmail({ subject, text }, options)
}

export interface CiDeployNotificationInput {
  status: 'success' | 'failure' | 'cancelled'
  workflow: string
  ref: string
  sha: string
  actor: string
  runUrl?: string
  summary?: string
}

/** GitHub Actions の本番デプロイ結果を運営者へ通知する */
export async function sendCiDeployNotification(
  input: CiDeployNotificationInput,
  options?: SendOperatorEmailOptions,
): Promise<OperatorEmailResult> {
  const label = input.status === 'success' ? '成功' : input.status === 'cancelled' ? 'キャンセル' : '失敗'
  const shortSha = input.sha.slice(0, 7)
  const subject = `【PathGuardian デプロイ${label}】${input.workflow} (${shortSha})`
  const text = [
    `ステータス: ${label} (${input.status})`,
    `ワークフロー: ${input.workflow}`,
    `ブランチ/Ref: ${input.ref}`,
    `コミット: ${input.sha}`,
    `実行者: ${input.actor}`,
    ...(input.runUrl ? [`実行ログ: ${input.runUrl}`] : []),
    ...(input.summary ? ['', '--- メモ ---', input.summary] : []),
  ].join('\n')

  return sendOperatorEmail({ subject, text }, options)
}
