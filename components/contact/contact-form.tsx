"use client"

import { useId, useState, type FormEvent } from "react"

import { CONTACT_KINDS, CONTACT_MESSAGE_MAX, type ContactKind } from "@/lib/contact/contact-schema"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

type Status = "idle" | "sending" | "sent" | "error"

/**
 * お問い合わせ・サービス改善要望のフォーム。LP とアプリの「お問い合わせ」から同じものを開く。
 * 送った内容は /api/contact が運営者のメールへ転送する。
 */
export function ContactForm({ initialKind = "inquiry" }: { initialKind?: ContactKind }) {
  const uid = useId()
  const [kind, setKind] = useState<ContactKind>(initialKind)
  const [message, setMessage] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [errorText, setErrorText] = useState("")

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === "sending") return
    setStatus("sending")
    setErrorText("")
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, email, website }),
      })
      if (response.ok) {
        setStatus("sent")
        setMessage("")
        setEmail("")
        return
      }
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setErrorText(data?.error ?? "送信に失敗しました。時間をおいて、もう一度お試しください")
      setStatus("error")
    } catch {
      setErrorText("通信に失敗しました。電波のよいところで、もう一度お試しください")
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div role="status" data-testid="contact-sent" className="space-y-3">
        <p className="font-bold">送信しました。ありがとうございます。</p>
        <p>
          内容は運営者に届きました。返信先のメールアドレスを書いていただいた場合は、順番にご連絡します(お返事までに日数がかかることがあります)。
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className={`min-h-11 rounded-full border px-5 text-sm font-bold ${tankenTokens.cls.focus}`}
          style={{ borderColor: C.primary, color: C.primaryStrong }}
        >
          続けてもう1件送る
        </button>
      </div>
    )
  }

  const fieldClass = `mt-1 block w-full rounded-xl border bg-white px-3 py-2 text-base ${tankenTokens.cls.focus}`
  const fieldStyle = { borderColor: tankenTokens.border.faint, color: C.ink }

  return (
    <form onSubmit={onSubmit} className="space-y-5" data-testid="contact-form">
      <fieldset>
        <legend className="font-bold">種類</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(CONTACT_KINDS) as ContactKind[]).map((value) => (
            <label
              key={value}
              className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border p-3 ${kind === value ? "font-bold" : ""}`}
              style={{
                borderColor: kind === value ? C.primary : tankenTokens.border.faint,
                background: kind === value ? C.primarySoft : "#fff",
              }}
            >
              <input
                type="radio"
                name={`${uid}-kind`}
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="mt-1"
              />
              <span>
                {CONTACT_KINDS[value].label}
                <span className="block text-xs font-normal" style={{ color: C.inkSoft }}>
                  {CONTACT_KINDS[value].hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${uid}-message`} className="font-bold">
          内容<span className="ml-1 text-xs font-normal" style={{ color: C.danger }}>(必須)</span>
        </label>
        <textarea
          id={`${uid}-message`}
          required
          rows={7}
          maxLength={CONTACT_MESSAGE_MAX}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
        <p className="mt-1 text-xs" style={{ color: C.inkSoft }}>
          {message.length} / {CONTACT_MESSAGE_MAX}字
        </p>
      </div>

      <div>
        <label htmlFor={`${uid}-email`} className="font-bold">
          返信先のメールアドレス<span className="ml-1 text-xs font-normal" style={{ color: C.inkSoft }}>(任意)</span>
        </label>
        <input
          id={`${uid}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
          style={fieldStyle}
        />
        <p className="mt-1 text-xs" style={{ color: C.inkSoft }}>
          お返事がほしいときだけ書いてください。書かなくても送れます。返信以外には使いません。
        </p>
      </div>

      {/* ボット対策の罠。人には見えず、キーボードでも止まらない */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          ウェブサイト
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      <p className="text-xs" style={{ color: C.inkSoft }}>
        お子さまのお名前・ご住所・写真など、個人を特定できる情報は書かないでください。
      </p>

      {status === "error" && (
        <p role="alert" className="rounded-xl p-3 font-bold" style={{ background: C.dangerSoft, color: C.danger }}>
          {errorText}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending" || message.trim().length === 0}
        className={`min-h-12 rounded-full px-8 font-bold text-white disabled:opacity-50 ${tankenTokens.cls.focus}`}
        style={{ background: C.primary }}
      >
        {status === "sending" ? "送信しています…" : "送信する"}
      </button>
    </form>
  )
}
