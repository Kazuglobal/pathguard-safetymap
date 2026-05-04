export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}): void {
  if (typeof window === "undefined") return

  const analyticsWindow = window as typeof window & {
    posthog?: { capture?: (eventName: string, properties?: AnalyticsProperties) => void }
    gtag?: (command: "event", eventName: string, properties?: AnalyticsProperties) => void
  }

  analyticsWindow.posthog?.capture?.(eventName, properties)
  analyticsWindow.gtag?.("event", eventName, properties)
}
