import type React from "react"
import "./lp.css"

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <div className="lp-root">{children}</div>
}
