"use client"

import Link from "next/link"
import { Shield } from "lucide-react"

const footerLinks = [
  {
    title: "サービス",
    links: [
      { label: "AIハザードマップ", href: "/map" },
      { label: "ヒヤリハット報告", href: "/report" },
      { label: "AI分析ゲーム", href: "/hazard-game" },
      { label: "通学路管理", href: "/routes" },
      { label: "SAFE MAGAZINE", href: "/safe-magazine" },
    ],
  },
  {
    title: "サポート",
    links: [
      { label: "利用ガイド", href: "#" },
      { label: "よくある質問", href: "#" },
      { label: "お問い合わせ", href: "#" },
      { label: "コミュニティ", href: "#" },
    ],
  },
  {
    title: "会社情報",
    links: [
      { label: "運営会社", href: "#" },
      { label: "利用規約", href: "#" },
      { label: "プライバシーポリシー", href: "#" },
      { label: "特定商取引法表記", href: "#" },
    ],
  },
]

export function LPFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl">
                <Shield className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-lg font-bold text-white">
                PathGuardian
              </span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              AI × コミュニティで守る
              <br />
              子どもの通学路安全プラットフォーム
            </p>
            {/* Social icons (placeholder) */}
            <div className="flex gap-3">
              {["X", "FB", "IG", "YT"].map((s) => (
                <div
                  key={s}
                  className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-white mb-4">
                {group.title}
              </h4>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            &copy; {currentYear} PathGuardian. All rights reserved.
          </p>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <span>Made with</span>
            <span className="text-red-500">&#9829;</span>
            <span>for children&apos;s safety</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
