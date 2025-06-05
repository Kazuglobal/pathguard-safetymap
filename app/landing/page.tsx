"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useEffect, useState } from "react"
import { Shield, MapPin, Users, Smartphone, AlertTriangle, Heart, Star, CheckCircle } from "lucide-react"

export default function LandingPage() {
  const { supabase } = useSupabase()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    
    checkSession()
    
    // セッション変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session)
    })
    
    return () => subscription.unsubscribe()
  }, [supabase])

  const features = [
    {
      icon: <Smartphone className="w-8 h-8" />,
      title: "📱 簡単操作",
      desc: "写真を撮るだけ！AIが自動で危険度を分析します。専門知識は不要です。",
      color: "from-sky-400 to-blue-500",
    },
    {
      icon: <AlertTriangle className="w-8 h-8" />,
      title: "🚨 リアルタイム分析",
      desc: "最新のAI技術で構造物の安全性を即座に評価。5段階で分かりやすく表示。",
      color: "from-red-400 to-orange-500",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "👥 みんなで守る",
      desc: "地域コミュニティが一体となって、安全な街づくりに参加できます。",
      color: "from-emerald-400 to-green-500",
    },
  ]

  const steps = [
    {
      step: "1",
      title: "写真を撮影",
      desc: "気になる場所をスマホで撮影するだけ",
      icon: "📷"
    },
    {
      step: "2", 
      title: "AI分析",
      desc: "AIが自動で危険度を5段階評価",
      icon: "🤖"
    },
    {
      step: "3",
      title: "マップに表示",
      desc: "結果をリアルタイムでマップに反映",
      icon: "🗺️"
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50">
      {/* Hero Section */}
      <motion.section
        className="relative isolate overflow-hidden py-16 sm:py-24 md:py-32"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div 
              className="order-2 lg:order-1"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <div className="text-center lg:text-left">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, duration: 0.8 }}
                  className="mb-6 inline-flex items-center rounded-full bg-gradient-to-r from-blue-100 to-sky-100 px-5 py-2 text-sm font-medium text-blue-800 ring-1 ring-inset ring-blue-200 shadow-sm"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  防災・減災への新しいアプローチ
                </motion.div>
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
                  <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">Path</span>
                  <span className="text-gray-900">Guardian</span>
                </h1>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="mt-6 text-xl sm:text-2xl font-semibold text-sky-700 leading-relaxed"
                >
                  🛡️ いつもの道に潜む危険を<br className="sm:hidden" />
                  <span className="text-blue-600">見える化</span>
                </motion.div>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="mt-6 text-lg leading-8 text-gray-600 max-w-xl"
                >
                  <strong className="text-sky-600">AI</strong> で通学路・通勤路のリスクをシミュレーション<br/>
                  <span className="inline-flex items-center mt-3 text-blue-600 font-medium">
                    <Smartphone className="w-5 h-5 mr-2" />
                    スマホで撮るだけ、防災・減災対策に！
                  </span>
                </motion.p>
                
                <motion.div 
                  className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6, duration: 0.8 }}
                >
                  {isLoggedIn === null ? (
                    <div className="btn-primary opacity-50 cursor-not-allowed w-full sm:w-auto">
                      <div className="loading-spinner mr-2" />
                      読み込み中...
                    </div>
                  ) : isLoggedIn ? (
                    <Link
                      href="/map"
                      className="btn-primary w-full sm:w-auto text-center inline-flex items-center justify-center"
                    >
                      <MapPin className="w-5 h-5 mr-2" />
                      マップを見る
                    </Link>
                  ) : (
                    <Link
                      href="/register"
                      className="btn-primary w-full sm:w-auto text-center inline-flex items-center justify-center"
                    >
                      <Heart className="w-5 h-5 mr-2" />
                      今すぐはじめる
                    </Link>
                  )}
                  
                  <Link 
                    href="#features" 
                    className="btn-ghost inline-flex items-center"
                  >
                    機能を見る
                    <motion.span 
                      className="ml-2"
                      animate={{ x: [0, 5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      →
                    </motion.span>
                  </Link>
                </motion.div>

                {/* 信頼性指標 */}
                <motion.div 
                  className="mt-12 grid grid-cols-3 gap-6 sm:gap-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                >
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-sky-600">1000+</div>
                    <div className="text-sm text-gray-600 mt-1">地点分析済み</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-green-600">95%</div>
                    <div className="text-sm text-gray-600 mt-1">予測精度</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold text-blue-600">24h</div>
                    <div className="text-sm text-gray-600 mt-1">リアルタイム</div>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* メインビジュアル */}
            <motion.div 
              className="order-1 lg:order-2 flex justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 1 }}
            >
              <div className="relative w-full max-w-lg">
                <div className="absolute -inset-1 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 rounded-3xl blur-2xl opacity-75 animate-pulse"></div>
                <div className="relative bg-white p-4 rounded-2xl shadow-2xl ring-1 ring-gray-200">
                  <Image
                    src="/landing/images/safety-pattern.jpg"
                    alt="PathGuardian - AIで通学路のリスクをシミュレーション"
                    width={1200}
                    height={800}
                    className="w-full h-auto rounded-xl"
                    priority
                  />
                  {/* オーバーレイアイコン */}
                  <div className="absolute top-8 right-8 bg-white rounded-full p-3 shadow-lg">
                    <Shield className="w-6 h-6 text-sky-600" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* マッププレビュー - より魅力的に */}
          <motion.div 
            className="relative mt-20 sm:mt-24"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 1 }}
          >
            <div className="text-center mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
                リアルタイムで更新される<span className="text-sky-600">安全マップ</span>
              </h3>
              <p className="text-gray-600 max-w-2xl mx-auto">
                みなさんの報告がマップに反映され、地域全体の安全性向上に貢献します
              </p>
            </div>
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-sky-400 to-blue-500 rounded-2xl blur-xl opacity-25 group-hover:opacity-40 transition-opacity duration-300"></div>
              <Image
                src="/landing/map-preview.png"
                alt="アプリのスクリーンショット"
                width={1364}
                height={866}
                className="relative w-full rounded-xl shadow-2xl ring-1 ring-gray-200"
                priority
              />
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* How it works Section */}
      <motion.section 
        className="py-16 sm:py-20 bg-white"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              <span className="text-sky-600">3つのステップ</span>で簡単安全チェック
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              誰でも簡単に、地域の安全性向上に貢献できます
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.step}
                className="text-center"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
              >
                <div className="relative mb-6">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    {step.step}
                  </div>
                  <div className="text-4xl mt-4">{step.icon}</div>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        id="features"
        className="gradient-bg py-16 sm:py-20 md:py-28"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center mb-16">
            <h2 className="text-base font-semibold leading-7 text-sky-600 uppercase tracking-wide">Features</h2>
            <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              普段の風景の向こうに見える<span className="text-sky-600">リスク</span>
            </p>
            <motion.p 
              className="mt-6 text-lg leading-8 text-gray-600"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              「みちのリスク可視化マップ」は、普段の風景をAIが分析。<br className="hidden sm:inline" />
              地震・災害時に崩れそうな構造物をシミュレーションし、安心・安全を可視化します。
            </motion.p>
          </div>
          
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div 
                key={feature.title}
                className="card-enhanced group"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.6 }}
              >
                <div className={`h-2 bg-gradient-to-r ${feature.color} rounded-t-xl -mt-6 -mx-6 mb-6`}></div>
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        className="py-16 sm:py-20 bg-gradient-to-r from-sky-600 to-blue-600"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              今すぐ始めて、<br className="sm:hidden" />
              <span className="text-sky-200">安全な街づくり</span>に参加しよう
            </h2>
            <p className="text-xl text-sky-100 mb-8 leading-relaxed">
              あなたの一枚の写真が、地域の安全を守る力になります
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isLoggedIn ? (
                <Link
                  href="/map"
                  className="bg-white text-sky-600 hover:bg-sky-50 rounded-xl px-8 py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 w-full sm:w-auto inline-flex items-center justify-center"
                >
                  <MapPin className="w-5 h-5 mr-2" />
                  マップを見る
                </Link>
              ) : (
                <Link
                  href="/register"
                  className="bg-white text-sky-600 hover:bg-sky-50 rounded-xl px-8 py-4 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 w-full sm:w-auto inline-flex items-center justify-center"
                >
                  <Heart className="w-5 h-5 mr-2" />
                  無料で始める
                </Link>
              )}
              <div className="text-sky-200 text-sm">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                登録無料・すぐに利用開始
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-white mb-4">
              <span className="text-sky-400">Path</span>Guardian
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              AIと地域コミュニティの力で、安全な街づくりを支援します
            </p>
            <div className="mt-8 flex justify-center space-x-6">
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
              <Star className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              © 2025 PathGuardian. みんなの安全を守るために.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
} 