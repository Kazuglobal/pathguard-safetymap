"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Shield,
  Brain,
  Route,
  Users,
  Camera,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Wind,
  Thermometer,
  Droplets,
  Volume2,
  ArrowLeft,
  FileText,
  Building2,
  TreePine,
  Gauge,
  Eye,
  Accessibility,
  Star,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SafeRouteAnalysis } from "@/lib/ai/safe-route-advisor"
import type { ParentSafetyReport } from "@/lib/ai/parent-safety-report"
import type { InfrastructureAssessment } from "@/lib/ai/infrastructure-analyzer"

type AnalysisState =
  | { type: "idle" }
  | { type: "loading"; analysisType: string }
  | { type: "route-result"; data: SafeRouteAnalysis }
  | { type: "parent-result"; data: ParentSafetyReport }
  | { type: "infra-result"; data: InfrastructureAssessment }
  | { type: "error"; message: string }

function GradeCircle({ grade, size = "lg" }: { grade: string; size?: "sm" | "lg" }) {
  const colors: Record<string, string> = {
    A: "bg-emerald-500 text-white",
    B: "bg-sky-500 text-white",
    C: "bg-amber-500 text-white",
    D: "bg-orange-500 text-white",
    F: "bg-red-500 text-white",
  }
  const sizeClass = size === "lg" ? "w-20 h-20 text-3xl" : "w-10 h-10 text-lg"
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${colors[grade] ?? "bg-gray-400 text-white"}`}>
      {grade}
    </div>
  )
}

function ScoreBar({ score, label, color }: { score: number; label: string; color?: string }) {
  const barColor = color ?? (score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500")
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    critical: { label: "緊急", variant: "destructive" },
    high: { label: "高", variant: "default" },
    medium: { label: "中", variant: "secondary" },
    low: { label: "低", variant: "outline" },
    immediate: { label: "即座", variant: "destructive" },
    short_term: { label: "短期", variant: "default" },
    long_term: { label: "長期", variant: "secondary" },
  }
  const item = map[urgency] ?? { label: urgency, variant: "outline" as const }
  return <Badge variant={item.variant}>{item.label}</Badge>
}

function RiskLevelIcon({ level }: { level: string }) {
  if (level === "high") return <AlertTriangle className="h-4 w-4 text-red-500" />
  if (level === "medium") return <AlertTriangle className="h-4 w-4 text-amber-500" />
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
}

// --- Route Safety Result ---
function RouteSafetyResult({ data }: { data: SafeRouteAnalysis }) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-6">
        <GradeCircle grade={data.overallSafetyGrade} />
        <div>
          <h3 className="text-xl font-bold">総合安全評価: {data.overallSafetyGrade}</h3>
          <p className="text-muted-foreground">{data.summary}</p>
        </div>
      </div>

      {/* Safe System Pillars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-600" />
            セーフシステムアプローチ 5つの柱
          </CardTitle>
          <CardDescription>WHO推奨のセーフシステム基準に基づく評価</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.safeSystemPillars.map((pillar, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{pillar.name} <span className="text-xs text-muted-foreground">({pillar.nameEn})</span></h4>
                <UrgencyBadge urgency={pillar.urgency} />
              </div>
              <ScoreBar score={pillar.score} label="" />
              {pillar.findings.length > 0 && (
                <div className="text-sm space-y-1 mt-2">
                  {pillar.findings.map((f, j) => (
                    <p key={j} className="text-muted-foreground flex items-start gap-1">
                      <span className="text-sky-500 mt-0.5">&#8226;</span> {f}
                    </p>
                  ))}
                </div>
              )}
              {pillar.recommendations.length > 0 && (
                <div className="text-sm space-y-1 mt-2 bg-sky-50 rounded p-2">
                  <p className="font-medium text-sky-700 text-xs">推奨事項:</p>
                  {pillar.recommendations.map((r, j) => (
                    <p key={j} className="text-sky-600">{r}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Speed 30 Zone */}
      {data.speed30Zone.recommended && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Gauge className="h-6 w-6 text-amber-600 mt-1" />
              <div>
                <h4 className="font-bold text-amber-800">30km/h速度制限ゾーンの設置を推奨</h4>
                <p className="text-sm text-amber-700 mt-1">{data.speed30Zone.reason}</p>
                <p className="text-xs text-amber-600 mt-1">
                  現在の推定走行速度: {data.speed30Zone.currentEstimatedSpeed}km/h
                  {data.speed30Zone.currentEstimatedSpeed > 30 && " (研究: 速度1km/h増で死亡リスク11%増加)"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environmental Risks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Wind className="h-5 w-5 text-teal-600" />
            環境・健康リスク
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.environmentalRisks.map((risk, i) => {
              const icons: Record<string, React.ReactNode> = {
                air_pollution: <Wind className="h-4 w-4" />,
                heat: <Thermometer className="h-4 w-4" />,
                flood: <Droplets className="h-4 w-4" />,
                storm: <AlertTriangle className="h-4 w-4" />,
                noise: <Volume2 className="h-4 w-4" />,
              }
              return (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    {icons[risk.type]}
                    <span className="font-medium text-sm">{risk.description}</span>
                    <RiskLevelIcon level={risk.level} />
                  </div>
                  <p className="text-xs text-red-600">{risk.healthImpact}</p>
                  <p className="text-xs text-emerald-700">{risk.mitigation}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Child Perspective */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            子どもの視点分析
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <ScoreBar score={data.childPerspective.walkability} label="歩きやすさ" />
            <ScoreBar score={data.childPerspective.perceivedSafety} label="体感安全性" />
            <ScoreBar score={data.childPerspective.parentConfidence} label="保護者安心度" />
          </div>
          {data.childPerspective.keyBarriers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">課題:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {data.childPerspective.keyBarriers.map((b, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-400 mt-1 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.childPerspective.encouragingFactors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-1">良い点:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {data.childPerspective.encouragingFactors.map((f, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 mt-1 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            アクションプラン
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.actionPlan.immediate.length > 0 && (
            <div>
              <p className="text-sm font-bold text-red-600 mb-1">今すぐできること:</p>
              <ul className="text-sm space-y-1">
                {data.actionPlan.immediate.map((a, i) => <li key={i} className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-1 text-red-400" />{a}</li>)}
              </ul>
            </div>
          )}
          {data.actionPlan.shortTerm.length > 0 && (
            <div>
              <p className="text-sm font-bold text-amber-600 mb-1">1〜3ヶ月以内:</p>
              <ul className="text-sm space-y-1">
                {data.actionPlan.shortTerm.map((a, i) => <li key={i} className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-1 text-amber-400" />{a}</li>)}
              </ul>
            </div>
          )}
          {data.actionPlan.longTerm.length > 0 && (
            <div>
              <p className="text-sm font-bold text-sky-600 mb-1">半年〜長期:</p>
              <ul className="text-sm space-y-1">
                {data.actionPlan.longTerm.map((a, i) => <li key={i} className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-1 text-sky-400" />{a}</li>)}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// --- Parent Report Result ---
function ParentReportResult({ data }: { data: ParentSafetyReport }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <GradeCircle grade={data.overallGrade} />
        <div>
          <h3 className="text-xl font-bold">{data.routeName} - 保護者安全レポート</h3>
          <p className="text-muted-foreground">{data.overallMessage}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Traffic Safety */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Route className="h-4 w-4 text-sky-600" />
                交通安全
              </CardTitle>
              <GradeCircle grade={data.trafficSafety.grade} size="sm" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreBar score={data.trafficSafety.score} label="安全スコア" />
            <p className="text-xs text-muted-foreground">{data.trafficSafety.speedEnvironment}</p>
            {data.trafficSafety.parentAdvice.map((a, i) => (
              <p key={i} className="text-sm text-sky-700 bg-sky-50 rounded p-2">{a}</p>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-600" />
                防犯評価
              </CardTitle>
              <GradeCircle grade={data.securityAssessment.grade} size="sm" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ScoreBar score={data.securityAssessment.score} label="防犯スコア" />
            <p className="text-xs"><span className="font-medium">照明:</span> {data.securityAssessment.lightingStatus}</p>
            <p className="text-xs"><span className="font-medium">人通り:</span> {data.securityAssessment.pedestrianTraffic}</p>
            {data.securityAssessment.safeHavens.length > 0 && (
              <div className="bg-emerald-50 rounded p-2">
                <p className="text-xs font-medium text-emerald-700">緊急避難先:</p>
                {data.securityAssessment.safeHavens.map((s, i) => (
                  <p key={i} className="text-xs text-emerald-600">{s}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Environmental Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TreePine className="h-5 w-5 text-emerald-600" />
            環境・健康
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "大気質", level: data.environmentalHealth.airQualityRisk, icon: <Wind className="h-4 w-4" /> },
              { label: "騒音", level: data.environmentalHealth.noiseLevel, icon: <Volume2 className="h-4 w-4" /> },
              { label: "熱中症", level: data.environmentalHealth.heatRisk, icon: <Thermometer className="h-4 w-4" /> },
              { label: "浸水", level: data.environmentalHealth.floodRisk, icon: <Droplets className="h-4 w-4" /> },
            ].map((item, i) => (
              <div key={i} className="border rounded-lg p-3 text-center space-y-1">
                <div className="flex justify-center">{item.icon}</div>
                <p className="text-sm font-medium">{item.label}</p>
                <RiskLevelIcon level={item.level} />
              </div>
            ))}
          </div>
          {data.environmentalHealth.healthTips.length > 0 && (
            <div className="mt-3 space-y-1">
              {data.environmentalHealth.healthTips.map((t, i) => (
                <p key={i} className="text-sm text-emerald-700 bg-emerald-50 rounded p-2">{t}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            推奨アクション
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: "保護者ができること", items: data.recommendedActions.forParents, color: "sky" },
              { title: "学校への提案", items: data.recommendedActions.forSchool, color: "violet" },
              { title: "地域への提案", items: data.recommendedActions.forCommunity, color: "emerald" },
              { title: "行政への要望", items: data.recommendedActions.forAuthority, color: "amber" },
            ].map((section, i) => (
              <div key={i} className={`bg-${section.color}-50 rounded-lg p-3 space-y-1`}>
                <p className={`text-sm font-bold text-${section.color}-700`}>{section.title}</p>
                {section.items.map((item, j) => (
                  <p key={j} className="text-sm flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-1 shrink-0" /> {item}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Companion Walking Guide */}
      <Card className="border-sky-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-600" />
            付き添い歩行ガイド
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.companionWalkingGuide.dangerousSpots.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-600 mb-1">注意箇所:</p>
              {data.companionWalkingGuide.dangerousSpots.map((s, i) => (
                <p key={i} className="text-sm text-red-700 bg-red-50 rounded p-1 mb-1">{s}</p>
              ))}
            </div>
          )}
          {data.companionWalkingGuide.suggestedCheckpoints.length > 0 && (
            <div>
              <p className="text-sm font-medium text-sky-600 mb-1">チェックポイント:</p>
              {data.companionWalkingGuide.suggestedCheckpoints.map((s, i) => (
                <p key={i} className="text-sm">{i + 1}. {s}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            緊急連絡先: {data.companionWalkingGuide.emergencyContacts}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// --- Infrastructure Result ---
function InfraResult({ data }: { data: InfrastructureAssessment }) {
  const categoryIcons: Record<string, React.ReactNode> = {
    pedestrianFacilities: <Users className="h-4 w-4" />,
    crossingFacilities: <Route className="h-4 w-4" />,
    speedManagement: <Gauge className="h-4 w-4" />,
    visibility: <Eye className="h-4 w-4" />,
    bufferZones: <TreePine className="h-4 w-4" />,
    accessibility: <Accessibility className="h-4 w-4" />,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <GradeCircle grade={data.overallGrade} />
        <div>
          <h3 className="text-xl font-bold">インフラ安全評価: {data.overallGrade}</h3>
          <p className="text-muted-foreground">セーフシステム準拠スコア: {data.safeSystemCompliance.complianceScore}/100</p>
        </div>
      </div>

      {/* Safe System Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-600" />
            セーフシステム準拠チェック
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "30km/h速度制限", ok: data.safeSystemCompliance.speed30Zone },
              { label: "歩車分離", ok: data.safeSystemCompliance.separatedWalkway },
              { label: "保護された横断施設", ok: data.safeSystemCompliance.protectedCrossings },
              { label: "速度抑制装置", ok: data.safeSystemCompliance.trafficCalming },
              { label: "十分な照明", ok: data.safeSystemCompliance.adequateLighting },
            ].map((item, i) => (
              <div key={i} className={`border rounded-lg p-3 flex items-center gap-2 ${item.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                {item.ok
                  ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  : <AlertTriangle className="h-5 w-5 text-red-600" />}
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">カテゴリ別評価</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(data.categories).map(([key, cat]) => (
            <div key={key} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {categoryIcons[key]}
                <span className="font-medium">{cat.name}</span>
                <Badge variant={cat.status === "excellent" || cat.status === "good" ? "default" : cat.status === "fair" ? "secondary" : "destructive"}>
                  {cat.status}
                </Badge>
              </div>
              <ScoreBar score={cat.score} label="" />
              {cat.details.map((d, i) => (
                <p key={i} className="text-sm text-muted-foreground">{d}</p>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Missing Infrastructure */}
      {data.missingInfrastructure.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              不足しているインフラ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.missingInfrastructure.map((m, i) => (
              <div key={i} className="border rounded p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.type}</span>
                  <UrgencyBadge urgency={m.importance} />
                </div>
                <p className="text-sm text-muted-foreground">{m.description}</p>
                <p className="text-xs text-emerald-600">導入効果: {m.expectedBenefit}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Priority Improvements */}
      {data.priorityImprovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-600" />
              改善優先順位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.priorityImprovements.map((p) => (
              <div key={p.rank} className="border rounded p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                  {p.rank}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.title}</span>
                    <UrgencyBadge urgency={p.urgency} />
                  </div>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="flex gap-2 text-xs">
                    <span>影響: {p.expectedImpact === "high" ? "大" : p.expectedImpact === "medium" ? "中" : "小"}</span>
                    <span>コスト: {p.estimatedCost === "high" ? "高" : p.estimatedCost === "medium" ? "中" : "低"}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {data.estimatedRiskReduction && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6">
            <p className="text-sm text-emerald-800">
              <span className="font-bold">推定リスク低減効果:</span> {data.estimatedRiskReduction}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// --- Main Page ---
export default function AISafetyPage() {
  const router = useRouter()
  const [state, setState] = useState<AnalysisState>({ type: "idle" })
  const [activeTab, setActiveTab] = useState("route")

  // Route form
  const [startAddress, setStartAddress] = useState("")
  const [endAddress, setEndAddress] = useState("")
  const [timeOfDay, setTimeOfDay] = useState<string>("morning")

  // Parent report form
  const [routeName, setRouteName] = useState("")
  const [childGrade, setChildGrade] = useState("")
  const [pStartAddress, setPStartAddress] = useState("")
  const [pEndAddress, setPEndAddress] = useState("")

  // Infra form
  const [infraImage, setInfraImage] = useState<string | null>(null)

  const handleAnalyze = async (analysisType: string, body: Record<string, unknown>) => {
    setState({ type: "loading", analysisType })
    try {
      const res = await fetch("/api/ai-safety/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisType, ...body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "分析に失敗しました")

      if (analysisType === "route-safety") {
        setState({ type: "route-result", data: json.data })
      } else if (analysisType === "parent-report") {
        setState({ type: "parent-result", data: json.data })
      } else if (analysisType === "infrastructure") {
        setState({ type: "infra-result", data: json.data })
      }
    } catch (err) {
      setState({ type: "error", message: err instanceof Error ? err.message : "分析エラー" })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setInfraImage(reader.result as string)
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-32 md:pb-16">
        {/* Header */}
        <header className="mb-8">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> 戻る
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-violet-600 rounded-xl flex items-center justify-center">
              <Brain className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI安全分析センター</h1>
              <p className="text-muted-foreground">AIが通学路を多角的に分析し、セーフシステムアプローチに基づく改善提案を行います</p>
            </div>
          </div>
        </header>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
          <Card className="border-sky-200 bg-sky-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Route className="h-4 w-4 text-sky-600" />
                <span className="text-sm font-bold text-sky-800">ルート安全分析</span>
              </div>
              <p className="text-xs text-sky-600">5つの柱に基づく包括評価 + 環境リスク + 子どもの視点</p>
            </CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-violet-600" />
                <span className="text-sm font-bold text-violet-800">保護者レポート</span>
              </div>
              <p className="text-xs text-violet-600">交通・防犯・健康の包括レポートを自動生成</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Camera className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-800">インフラ評価</span>
              </div>
              <p className="text-xs text-emerald-600">写真からインフラの安全性をWHO基準で評価</p>
            </CardContent>
          </Card>
        </div>

        {/* Analysis Forms */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="route" className="text-xs sm:text-sm">
              <Route className="h-4 w-4 mr-1 hidden sm:inline" />
              ルート分析
            </TabsTrigger>
            <TabsTrigger value="parent" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 mr-1 hidden sm:inline" />
              保護者レポート
            </TabsTrigger>
            <TabsTrigger value="infra" className="text-xs sm:text-sm">
              <Camera className="h-4 w-4 mr-1 hidden sm:inline" />
              インフラ評価
            </TabsTrigger>
          </TabsList>

          <TabsContent value="route" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>AI通学路安全分析</CardTitle>
                <CardDescription>出発地と目的地を入力すると、AIがセーフシステムアプローチの5つの柱、環境リスク、子どもの視点から包括的に分析します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start">出発地（自宅付近）</Label>
                    <Input id="start" placeholder="例: 東京都世田谷区桜丘1-1" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="end">目的地（学校）</Label>
                    <Input id="end" placeholder="例: 世田谷区立桜丘小学校" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />
                  </div>
                </div>
                <div className="w-48">
                  <Label>時間帯</Label>
                  <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">朝（登校時）</SelectItem>
                      <SelectItem value="afternoon">午後（下校時）</SelectItem>
                      <SelectItem value="evening">夕方</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!startAddress || !endAddress || state.type === "loading"}
                  onClick={() => handleAnalyze("route-safety", { startAddress, endAddress, timeOfDay })}
                >
                  {state.type === "loading" && state.analysisType === "route-safety"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />AI分析中...</>
                    : <><Brain className="h-4 w-4 mr-2" />AI安全分析を実行</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parent" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>保護者向け安全レポート生成</CardTitle>
                <CardDescription>お子様の通学路について、交通安全・防犯・環境健康の包括レポートをAIが自動生成します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="routeName">ルート名</Label>
                  <Input id="routeName" placeholder="例: 自宅から桜丘小学校" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="pStart">出発地</Label>
                    <Input id="pStart" placeholder="例: 世田谷区桜丘1-1" value={pStartAddress} onChange={(e) => setPStartAddress(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="pEnd">目的地</Label>
                    <Input id="pEnd" placeholder="例: 桜丘小学校" value={pEndAddress} onChange={(e) => setPEndAddress(e.target.value)} />
                  </div>
                </div>
                <div className="w-48">
                  <Label>お子様の学年</Label>
                  <Select value={childGrade} onValueChange={setChildGrade}>
                    <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="小学1年生">小学1年生</SelectItem>
                      <SelectItem value="小学2年生">小学2年生</SelectItem>
                      <SelectItem value="小学3年生">小学3年生</SelectItem>
                      <SelectItem value="小学4年生">小学4年生</SelectItem>
                      <SelectItem value="小学5年生">小学5年生</SelectItem>
                      <SelectItem value="小学6年生">小学6年生</SelectItem>
                      <SelectItem value="中学生">中学生</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!routeName || !pStartAddress || !pEndAddress || state.type === "loading"}
                  onClick={() => handleAnalyze("parent-report", {
                    routeName,
                    startAddress: pStartAddress,
                    endAddress: pEndAddress,
                    childGrade,
                  })}
                >
                  {state.type === "loading" && state.analysisType === "parent-report"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />レポート生成中...</>
                    : <><FileText className="h-4 w-4 mr-2" />保護者レポートを生成</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="infra" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>AIインフラ安全評価</CardTitle>
                <CardDescription>通学路の写真をアップロードすると、歩道・横断歩道・速度制限・照明などのインフラをWHO基準で評価します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="infraImg">通学路の写真</Label>
                  <Input id="infraImg" type="file" accept="image/*" onChange={handleImageUpload} />
                </div>
                {infraImage && (
                  <div className="rounded-lg overflow-hidden border max-h-64">
                    <img src={infraImage} alt="アップロード画像" className="w-full h-full object-cover" />
                  </div>
                )}
                <Button
                  className="w-full"
                  disabled={!infraImage || state.type === "loading"}
                  onClick={() => handleAnalyze("infrastructure", { imageBase64: infraImage })}
                >
                  {state.type === "loading" && state.analysisType === "infrastructure"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />インフラ評価中...</>
                    : <><Building2 className="h-4 w-4 mr-2" />インフラ安全評価を実行</>}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {state.type === "loading" && (
          <Card className="mb-8">
            <CardContent className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-sky-500 mb-4" />
              <p className="text-lg font-medium">AIが分析中です...</p>
              <p className="text-sm text-muted-foreground mt-1">セーフシステムアプローチに基づく包括的な分析を実行しています</p>
            </CardContent>
          </Card>
        )}

        {state.type === "error" && (
          <Card className="mb-8 border-red-200">
            <CardContent className="py-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">{state.message}</span>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setState({ type: "idle" })}>
                再試行
              </Button>
            </CardContent>
          </Card>
        )}

        {state.type === "route-result" && <RouteSafetyResult data={state.data} />}
        {state.type === "parent-result" && <ParentReportResult data={state.data} />}
        {state.type === "infra-result" && <InfraResult data={state.data} />}

        {/* Research Context Footer */}
        <Card className="mt-8 bg-gray-50">
          <CardContent className="pt-6">
            <h4 className="text-sm font-bold mb-2">この分析の科学的根拠</h4>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- WHO「セーフシステムアプローチ」: 学校周辺30km/h制限で歩行者死亡リスクを大幅低減</p>
              <p>- UNICEF報告: 交通事故は5-19歳の主要死因、低中所得国で死亡率が3倍</p>
              <p>- 大気汚染研究: 排気ガス・タイヤ摩耗粒子が子どもの呼吸器疾患・ADHD・発達障害リスクを増加</p>
              <p>- 気候変動影響: 2024年、2.42億人の学生が気候関連災害で教育機会を喪失</p>
              <p>- 建成環境研究: 街路樹等の緩衝帯が安全感向上と速度抑制に効果</p>
              <p>- 福岡調査: 子どもは暗い道・人通りの少ない場所を避ける傾向</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
