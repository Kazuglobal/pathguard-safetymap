"use client"

import Link from "next/link"
import Image from "next/image"
import { MapIcon, ShieldCheckIcon, AlertTriangleIcon, UsersIcon, ChartBarIcon, GamepadIcon, CalendarDays, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* ヘッダー */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md shadow-sm z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <ShieldCheckIcon className="h-8 w-8 text-sky-600" />
            <h1 className="text-2xl font-bold">
              <span className="text-sky-600">Path</span>Guardian
            </h1>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a href="#features" className="text-gray-600 hover:text-sky-600 transition-colors">機能</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-sky-600 transition-colors">使い方</a>
            <a href="#safety" className="text-gray-600 hover:text-sky-600 transition-colors">安全性</a>
            <a href="#news" className="text-gray-600 hover:text-sky-600 transition-colors">お知らせ</a>
          </nav>
          <div className="flex space-x-2 flex-shrink-0 mt-2 sm:mt-0">
            <Link href="/login">
              <Button variant="outline" size="sm" className="flex-shrink-0">ログイン</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-sky-600 hover:bg-sky-700 flex-shrink-0" size="sm">新規登録</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="pt-32 sm:pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl font-bold text-gray-900 mb-6">
                子どもたちの
                <span className="text-sky-600">安全な通学路</span>を
                <br />AIがサポート
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                PathGuardianは、AIと地域の力で子どもたちの通学路を守る次世代の安全マップサービスです。
                危険箇所の可視化、安全ルートの提案、コミュニティでの情報共有を通じて、
                すべての子どもが安心して通学できる環境を実現します。
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/map">
                  <Button size="lg" className="bg-sky-600 hover:bg-sky-700 text-lg px-8 py-6">
                    安全マップを見る
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                    無料で始める
                  </Button>
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/landing/map-preview.png"
                  alt="PathGuardian マッププレビュー"
                  width={600}
                  height={400}
                  className="w-full h-auto"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
              </div>
              <div className="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full font-semibold shadow-lg transform rotate-12">
                AI搭載
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 機能紹介セクション */}
      {/* お知らせセクション */}
      <section id="news" className="py-16 px-4 bg-white/60">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">最新のお知らせ</h3>
            <p className="text-lg text-gray-600">PathGuardianの活動情報をお届けします。</p>
          </div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">ワークショップ開催のお知らせ</CardTitle>
              <CardDescription className="flex flex-col gap-1 text-gray-600">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-sky-600" />
                  2025年9月11日・12日
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-sky-600" />
                  青森県八戸市立白鷗小学校（対象：1年生・4年生）
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                2025年9月11日、12日 青森県八戸市立白鷗小学校の1年生と4年生でワークショップを開催。
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="features" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">
              PathGuardianの主な機能
            </h3>
            <p className="text-xl text-gray-600">
              最新のAI技術と地域の知恵を組み合わせた、革新的な安全対策ツール
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <MapIcon className="h-12 w-12 text-sky-600 mb-4" />
                <CardTitle>AIリアルタイムマップ</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  AIが交通量データと事故履歴を分析し、危険度をリアルタイムで可視化。
                  時間帯や天候に応じた安全ルートを自動提案します。
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <AlertTriangleIcon className="h-12 w-12 text-amber-600 mb-4" />
                <CardTitle>危険箇所レポート</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  保護者や地域住民が発見した危険箇所を簡単に報告・共有。
                  写真付きレポートで具体的な状況を把握できます。
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <UsersIcon className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle>コミュニティ連携</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  学校、PTA、自治体が連携して情報を共有。
                  地域全体で子どもたちの安全を見守る仕組みを構築します。
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <ChartBarIcon className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle>安全度スコアリング</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  各通学路の安全度をAIが数値化。
                  改善が必要な箇所を優先順位付けして対策を支援します。
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <GamepadIcon className="h-12 w-12 text-pink-600 mb-4" />
                <CardTitle>ゲーミフィケーション</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  危険予測ゲームやクイズで楽しく交通安全を学習。
                  ポイントやバッジで継続的な参加を促進します。
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <ShieldCheckIcon className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle>24時間監視システム</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  AIが24時間体制で危険パターンを検知。
                  緊急時には関係者へ即座にアラートを送信します。
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section id="how-it-works" className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h3 className="text-4xl font-bold text-gray-900 mb-4">
              簡単3ステップで始める
            </h3>
            <p className="text-xl text-gray-600">
              今すぐ無料で、子どもたちの安全を守る活動に参加しましょう
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                1
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">アカウント登録</h4>
                <p className="text-gray-600">
                  メールアドレスだけで簡単登録。保護者、教育関係者、地域住民、どなたでも無料で利用できます。
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                2
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">地域を設定</h4>
                <p className="text-gray-600">
                  お住まいの地域や学校を設定すると、周辺の安全情報が自動的に表示されます。
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-12 h-12 bg-sky-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                3
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-2">情報を共有・活用</h4>
                <p className="text-gray-600">
                  危険箇所の報告、安全ルートの確認、コミュニティでの情報交換など、様々な機能を活用できます。
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link href="/register">
              <Button size="lg" className="bg-sky-600 hover:bg-sky-700 text-lg px-8 py-6">
                無料で始める
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 安全性セクション */}
      <section id="safety" className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <Image
                  src="/landing/images/safety-pattern.jpg"
                  alt="安全パターン分析"
                  width={600}
                  height={400}
                  className="w-full h-auto"
                />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <h3 className="text-4xl font-bold text-gray-900 mb-6">
                データに基づく
                <span className="text-sky-600">確かな安全性</span>
              </h3>
              <div className="space-y-6">
                <div>
                  <h4 className="text-xl font-semibold mb-2">交通事故データの分析</h4>
                  <p className="text-gray-600">
                    過去10年分の交通事故データをAIが分析し、危険パターンを特定します。
                  </p>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2">リアルタイム交通量監視</h4>
                  <p className="text-gray-600">
                    時間帯別の交通量を常時モニタリングし、混雑時間帯を避けるルートを提案します。
                  </p>
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2">地域の声を反映</h4>
                  <p className="text-gray-600">
                    実際に通学路を利用する保護者や子どもたちの声を集約し、現場の実情を反映します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA セクション */}
      <section className="py-20 px-4 bg-gradient-to-r from-sky-600 to-blue-600">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-4xl font-bold text-white mb-6">
            今すぐPathGuardianを始めましょう
          </h3>
          <p className="text-xl text-sky-100 mb-8">
            子どもたちの安全な通学路づくりに、あなたの力を貸してください
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-sky-600 hover:bg-gray-100 text-lg px-8 py-6">
                無料アカウント作成
              </Button>
            </Link>
            <Link href="/map">
              <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white/10 text-lg px-8 py-6">
                デモを見る
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-12 px-4 bg-gray-900">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <ShieldCheckIcon className="h-8 w-8 text-sky-400" />
                <h4 className="text-xl font-bold text-white">PathGuardian</h4>
              </div>
              <p className="text-gray-400">
                AIと地域の力で、子どもたちの安全を守る
              </p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">サービス</h5>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/map" className="hover:text-sky-400">安全マップ</Link></li>
                <li><Link href="/hazard-game" className="hover:text-sky-400">危険予測ゲーム</Link></li>
                <li><Link href="/dashboard" className="hover:text-sky-400">ダッシュボード</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">サポート</h5>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-sky-400">ヘルプセンター</a></li>
                <li><a href="#" className="hover:text-sky-400">お問い合わせ</a></li>
                <li><a href="#" className="hover:text-sky-400">プライバシーポリシー</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">コミュニティ</h5>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-sky-400">ブログ</a></li>
                <li><a href="#" className="hover:text-sky-400">イベント</a></li>
                <li><a href="#" className="hover:text-sky-400">パートナー</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; 2025 PathGuardian. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
} 