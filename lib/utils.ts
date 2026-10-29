import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return ""

  // ほかの人の報告は日付だけ(YYYY-MM-DD)で届く。時刻は付けない(付けると 09:00 になる)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" })
      .format(new Date(`${dateString}T00:00:00Z`))
  }

  const date = new Date(dateString)
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
