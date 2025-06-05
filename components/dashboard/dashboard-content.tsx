"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/providers/supabase-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Eye,
  ImageIcon,
} from "lucide-react"
import DashboardCharts from "./dashboard-charts"
import ReportDetailModal from "./report-detail-modal"

export default function DashboardContent() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { toast } = useToast()

  const [pendingReports, setPendingReports] = useState<DangerReport[]>([])
  const [approvedReports, setApprovedReports] = useState<DangerReport[]>([])
  const [resolvedReports, setResolvedReports] = useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<DangerReport | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  /**
   * --------------------------
   *  フェッチ処理
   * --------------------------
   */
  const fetchReports = async () => {
    setIsLoading(true)
    try {
      /* 審査待ち */
      const { data: pendingData, error: pendingError } = await supabase
        .from("danger_reports")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })

      if (pendingError) {
        console.error("Error fetching pending reports:", pendingError)
        setPendingReports([])
      } else {
        setPendingReports(pendingData || [])
      }

      /* 承認済み */
      const { data: approvedData, error: approvedError } = await supabase
        .from("danger_reports")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false })

      if (approvedError) {
        console.error("Error fetching approved reports:", approvedError)
        setApprovedReports([])
      } else {
        setApprovedReports(approvedData || [])
      }

      /* 解決済み */
      const { data: resolvedData, error: resolvedError } = await supabase
        .from("danger_reports")
        .select("*")
        .eq("status", "resolved")
        .order("created_at", { ascending: false })

      if (resolvedError) {
        console.error("Error fetching resolved reports:", resolvedError)
        setResolvedReports([])
      } else {
        setResolvedReports(resolvedData || [])
      }
    } catch (error) {
      console.error("Error in fetchReports:", error)
      toast({
        title: "エラー",
        description: "データの取得中にエラーが発生しました。",
        variant: "destructive",
      })
      setPendingReports([])
      setApprovedReports([])
      setResolvedReports([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [supabase, toast])

  // 報告詳細が更新されたときに最新データを取得するための処理
  const handleReportUpdate = async () => {
    // 選択中の報告がある場合、その最新データを取得
    if (selectedReport) {
      try {
        const { data, error } = await supabase
          .from("danger_reports")
          .select("*")
          .eq("id", selectedReport.id)
          .single();

        if (error) {
          console.error("Error fetching updated report:", error);
          throw error;
        }

        if (data) {
          // 選択中の報告を最新データで更新
          setSelectedReport(data);

          // リスト内の報告も更新
          if (data.status === "pending") {
            setPendingReports(pendingReports.map(r => 
              r.id === data.id ? data : r
            ));
          } else if (data.status === "approved") {
            setApprovedReports(approvedReports.map(r => 
              r.id === data.id ? data : r
            ));
          } else if (data.status === "resolved") {
            setResolvedReports(resolvedReports.map(r => 
              r.id === data.id ? data : r
            ));
          }
        }
      } catch (error) {
        console.error("Error updating report data:", error);
        toast({
          title: "エラー",
          description: "報告データの更新中にエラーが発生しました。",
          variant: "destructive",
        });
      }
    }
  };

  /**
   * --------------------------
   *  アクションハンドラー
   * --------------------------
   */
  const handleApprove = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("danger_reports")
        .update({ status: "approved" })
        .eq("id", reportId)

      if (error) throw error

      const updated = pendingReports.find((r) => r.id === reportId)
      if (updated) {
        setPendingReports(pendingReports.filter((r) => r.id !== reportId))
        setApprovedReports([{ ...updated, status: "approved" }, ...approvedReports])
      }

      toast({
        title: "承認完了",
        description: "危険箇所報告が承認されました。",
      })
    } catch (error) {
      console.error("Error approving report:", error)
      toast({
        title: "エラー",
        description: "報告の承認中にエラーが発生しました。",
        variant: "destructive",
      })
    }
  }

  const handleReject = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("danger_reports")
        .delete()
        .eq("id", reportId)

      if (error) throw error

      setPendingReports(pendingReports.filter((r) => r.id !== reportId))

      toast({
        title: "拒否完了",
        description: "危険箇所報告が拒否されました。",
      })
    } catch (error) {
      console.error("Error rejecting report:", error)
      toast({
        title: "エラー",
        description: "報告の拒否中にエラーが発生しました。",
        variant: "destructive",
      })
    }
  }

  const handleResolve = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("danger_reports")
        .update({ status: "resolved" })
        .eq("id", reportId)

      if (error) throw error

      const updated = approvedReports.find((r) => r.id === reportId)
      if (updated) {
        setApprovedReports(approvedReports.filter((r) => r.id !== reportId))
        setResolvedReports([{ ...updated, status: "resolved" }, ...resolvedReports])
      }

      toast({
        title: "解決完了",
        description: "危険箇所が解決済みとしてマークされました。",
      })
    } catch (error) {
      console.error("Error resolving report:", error)
      toast({
        title: "エラー",
        description: "報告の解決中にエラーが発生しました。",
        variant: "destructive",
      })
    }
  }

  const handleViewDetails = (report: DangerReport) => {
    setSelectedReport(report)
    setIsDetailModalOpen(true)
  }

  /**
   * --------------------------
   *  表示用ユーティリティ
   * --------------------------
   */
  const getDangerTypeLabel = (type: string) => {
    switch (type) {
      case "traffic":
        return "交通危険"
      case "crime":
        return "犯罪危険"
      case "disaster":
        return "災害危険"
      case "other":
        return "その他"
      default:
        return type
    }
  }

  /**
   * `image_url` (単数) または `processed_image_urls` (複数) に
   * 少なくとも 1 枚でも画像があるか判定
   */
  const hasImages = (report: DangerReport) => {
    if (report.image_url) return true
    if (Array.isArray(report.processed_image_urls)) {
      return report.processed_image_urls.length > 0
    }
    return false
  }

  /**
   * --------------------------
   *  JSX
   * --------------------------
   */
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">管理ダッシュボード</h1>
        <Button variant="outline" onClick={() => router.push("/map")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          マップに戻る
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 審査待ち */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>審査待ち</CardTitle>
            <CardDescription>承認が必要な報告</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReports.length}</div>
          </CardContent>
        </Card>

        {/* 承認済み */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>承認済み</CardTitle>
            <CardDescription>公開中の危険箇所</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{approvedReports.length}</div>
          </CardContent>
        </Card>

        {/* 解決済み */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>解決済み</CardTitle>
            <CardDescription>解決された危険箇所</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resolvedReports.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* チャート */}
      <DashboardCharts
        pendingCount={pendingReports.length}
        approvedCount={approvedReports.length}
        resolvedCount={resolvedReports.length}
        allReports={[
          ...pendingReports,
          ...approvedReports,
          ...resolvedReports,
        ]}
      />

      {/* タブ */}
      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            審査待ち ({pendingReports.length})
          </TabsTrigger>
          <TabsTrigger value="approved">
            承認済み ({approvedReports.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            解決済み ({resolvedReports.length})
          </TabsTrigger>
        </TabsList>

        {/* ---------- 審査待ち ---------- */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>審査待ちの報告</CardTitle>
              <CardDescription>承認または拒否してください</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  審査待ちの報告はありません
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>危険タイプ</TableHead>
                      <TableHead>危険度</TableHead>
                      <TableHead>報告日</TableHead>
                      <TableHead>画像</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.title}
                        </TableCell>
                        <TableCell>
                          {getDangerTypeLabel(report.danger_type)}
                        </TableCell>
                        <TableCell>{report.danger_level}</TableCell>
                        <TableCell>{formatDate(report.created_at)}</TableCell>
                        <TableCell>
                          {hasImages(report) ? (
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                          ) : (
                            <span className="text-gray-400">なし</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(report)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              詳細
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(report.id)}
                            >
                              <CheckCircle className="mr-1 h-4 w-4" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(report.id)}
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              拒否
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- 承認済み ---------- */}
        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>承認済みの報告</CardTitle>
              <CardDescription>公開中の危険箇所</CardDescription>
            </CardHeader>
            <CardContent>
              {approvedReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  承認済みの報告はありません
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>危険タイプ</TableHead>
                      <TableHead>危険度</TableHead>
                      <TableHead>報告日</TableHead>
                      <TableHead>画像</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.title}
                        </TableCell>
                        <TableCell>
                          {getDangerTypeLabel(report.danger_type)}
                        </TableCell>
                        <TableCell>{report.danger_level}</TableCell>
                        <TableCell>{formatDate(report.created_at)}</TableCell>
                        <TableCell>
                          {hasImages(report) ? (
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                          ) : (
                            <span className="text-gray-400">なし</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewDetails(report)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              詳細
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResolve(report.id)}
                            >
                              解決済み
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- 解決済み ---------- */}
        <TabsContent value="resolved">
          <Card>
            <CardHeader>
              <CardTitle>解決済みの報告</CardTitle>
              <CardDescription>解決された危険箇所</CardDescription>
            </CardHeader>
            <CardContent>
              {resolvedReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  解決済みの報告はありません
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>危険タイプ</TableHead>
                      <TableHead>危険度</TableHead>
                      <TableHead>報告日</TableHead>
                      <TableHead>解決日</TableHead>
                      <TableHead>画像</TableHead>
                      <TableHead>アクション</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resolvedReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.title}
                        </TableCell>
                        <TableCell>
                          {getDangerTypeLabel(report.danger_type)}
                        </TableCell>
                        <TableCell>{report.danger_level}</TableCell>
                        <TableCell>{formatDate(report.created_at)}</TableCell>
                        <TableCell>{formatDate(report.updated_at)}</TableCell>
                        <TableCell>
                          {hasImages(report) ? (
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                          ) : (
                            <span className="text-gray-400">なし</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDetails(report)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            詳細
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 詳細モーダル */}
      <ReportDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        report={selectedReport}
        onApprove={handleApprove}
        onReject={handleReject}
        onResolve={handleResolve}
        onReportUpdate={handleReportUpdate}
      />
    </div>
  )
}
