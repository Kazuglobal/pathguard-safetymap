"use client";

import React from 'react';
import SchoolTrafficViewer from '@/components/map/school-traffic-viewer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * 小学校周辺の交通量表示の例示ページ
 * 交通量API（国土交通省）のデータを活用した表示例
 */
export default function TrafficExamplePage() {
  // 例示用の学校位置情報（東京都立川市の小学校の位置を仮定）
  const exampleSchool = {
    name: "立川第一小学校",
    lat: 35.6975,
    lng: 139.4141
  };

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link href="/xroad" passHref>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>小学校周辺の交通量表示</CardTitle>
          <CardDescription>
            国土交通省の交通量API（xROAD）を活用して、小学校周辺の交通量データを地図上に可視化しています。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4">
            <p>
              このデモでは、交通量API（国土交通省）のデータを使用して、小学校周辺の道路交通量を視覚化しています。
              表示されるデータは参考値であり、国土交通省による正式な交通量の調査結果ではありません。
            </p>
            <p className="mt-2">
              円の大きさは交通量の多さを表し、色は交通量のレベルを示しています。
              各観測地点をクリックすると、詳細情報が表示されます。
            </p>
          </div>

          {/* 小学校周辺の交通量表示コンポーネント */}
          <SchoolTrafficViewer schoolLocation={exampleSchool} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>交通量APIの活用例</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-4">
            <div>
              <h3 className="font-semibold mb-1">1. 通学路の安全評価</h3>
              <p>小学校周辺の交通量データを分析し、通学路の安全性を評価することができます。交通量が多い道路を避けた通学路の設計に役立ちます。</p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">2. 危険地点の特定</h3>
              <p>大型車の通行が多い地点や交通量が集中する時間帯を特定し、見守りが必要な場所を把握できます。</p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">3. 時間帯別の安全マップ作成</h3>
              <p>登下校時間における交通量の変化を分析し、時間帯に応じた安全マップを作成できます。</p>
            </div>

            <div>
              <h3 className="font-semibold mb-1">4. 学校周辺の交通状況モニタリング</h3>
              <p>日々の交通状況をモニタリングし、異常な交通量増加があった場合に警告を発することができます。</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 