"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  HelpCircle, 
  MapPin, 
  MousePointer, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Trophy,
  Car,
  Shield,
  AlertTriangle,
  HelpCircle as OtherIcon
} from "lucide-react"

interface HelpDialogProps {
  children: React.ReactNode
}

export default function HelpDialog({ children }: HelpDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-600" />
            通学路安全マップ 使い方
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">基本操作</TabsTrigger>
            <TabsTrigger value="report">報告方法</TabsTrigger>
            <TabsTrigger value="filter">フィルター</TabsTrigger>
            <TabsTrigger value="points">ポイント</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">マップの基本操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <MousePointer className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">マップの操作</h4>
                    <p className="text-sm text-gray-600">
                      マウスでドラッグしてマップを移動、スクロールでズームイン・アウトできます
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">危険箇所の確認</h4>
                    <p className="text-sm text-gray-600">
                      マップ上の色付きマーカーをクリックすると詳細情報が表示されます
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Search className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">場所の検索</h4>
                    <p className="text-sm text-gray-600">
                      検索バーで住所や施設名を検索して特定の場所に移動できます
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">危険度の見方</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className="text-sm">レベル1-2（軽度）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className="text-sm">レベル3（中度）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className="text-sm">レベル4（高度）</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-500"></div>
                    <span className="text-sm">レベル5（重度）</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="report" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">危険箇所の報告方法</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">1</div>
                    <div>
                      <h4 className="font-medium">「危険箇所を報告」ボタンをクリック</h4>
                      <p className="text-sm text-gray-600">ヘッダーの青いボタンをクリックします</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">2</div>
                    <div>
                      <h4 className="font-medium">地図で位置を選択</h4>
                      <p className="text-sm text-gray-600">危険箇所の正確な位置を地図上でクリックして選択します</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">3</div>
                    <div>
                      <h4 className="font-medium">詳細情報を入力</h4>
                      <p className="text-sm text-gray-600">タイトル、説明、危険度、危険タイプを選択します</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">4</div>
                    <div>
                      <h4 className="font-medium">写真を添付（任意）</h4>
                      <p className="text-sm text-gray-600">危険箇所の写真がある場合は添付できます</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-600">5</div>
                    <div>
                      <h4 className="font-medium">報告を送信</h4>
                      <p className="text-sm text-gray-600">「報告を送信」ボタンをクリックして送信します</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="filter" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">フィルター機能</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Filter className="h-5 w-5 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium">フィルターの使い方</h4>
                    <p className="text-sm text-gray-600">
                      サイドバーの「フィルター」タブで危険タイプ、危険度、期間で絞り込めます
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">危険タイプ</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Car className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">交通危険</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-600" />
                      <span className="text-sm">犯罪危険</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">災害危険</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <OtherIcon className="h-4 w-4 text-gray-600" />
                      <span className="text-sm">その他</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="points" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  ポイントシステム
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">ポイントの獲得方法</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• 危険箇所を報告: +10ポイント</li>
                    <li>• 写真付き報告: +5ポイント（ボーナス）</li>
                    <li>• 詳細な説明: +3ポイント（ボーナス）</li>
                    <li>• 報告が承認される: +20ポイント</li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">ポイントの使い方</h4>
                  <p className="text-sm text-blue-700">
                    ポイントは現在、報告の品質評価に使用されています。
                    将来的には特別な機能のアンロックに使用される予定です。
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
