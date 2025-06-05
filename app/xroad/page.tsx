"use client"

import { useState } from 'react';
import MapWrapper from '@/components/map/map-wrapper';
import XRoadLayer from '@/components/map/xroad-layer';
import SafeRouteSearch from '@/components/map/safe-route-search';
import SchoolTrafficDashboard from '@/components/map/school-traffic-dashboard';
import RestrictionAlerts from '@/components/map/restriction-alerts';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { ExternalLink, MapPin } from 'lucide-react';

/**
 * xROADデータプラットフォーム統合マップページ
 * すべての追加機能を含む完全版
 */
export default function XRoadIntegratedPage() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [visibleLayers, setVisibleLayers] = useState({
    roads: true,
    restrictions: false,
    traffic: false,
  });

  // レイヤーの表示・非表示を切り替える関数
  const toggleLayer = (layerName: 'roads' | 'restrictions' | 'traffic') => {
    setVisibleLayers((prev) => ({
      ...prev,
      [layerName]: !prev[layerName],
    }));
  };

  return (
    <div className="container py-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">xROAD 道路データ統合</CardTitle>
          <CardDescription>
            国土交通省道路データプラットフォーム（xROAD）の機能を統合した学校安全マップシステム
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            このページでは、学校安全マップの機能と国土交通省の道路データを組み合わせた様々な機能を体験することができます。
            下記のデモから各機能を試してみてください。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            <DemoCard 
              title="道路データ表示"
              description="xROADから取得した道路データをマップ上に表示します。"
              icon={<MapPin className="h-8 w-8 text-blue-500" />}
              href="#map"
            />
            
            <DemoCard 
              title="安全ルート検索"
              description="交通量データを考慮した安全な通学路を検索します。"
              icon={<MapPin className="h-8 w-8 text-green-500" />}
              href="#map"
            />
            
            <DemoCard 
              title="通学路の安全度評価"
              description="交通量と危険報告を統合した安全性評価を表示します。"
              icon={<MapPin className="h-8 w-8 text-yellow-500" />}
              href="#map"
            />
            
            <DemoCard 
              title="規制情報アラート"
              description="通学路周辺の道路規制情報をリアルタイムで確認できます。"
              icon={<MapPin className="h-8 w-8 text-red-500" />}
              href="#map"
            />
            
            <DemoCard 
              title="学校周辺交通状況"
              description="学校周辺の交通量データをダッシュボードで表示します。"
              icon={<MapPin className="h-8 w-8 text-purple-500" />}
              href="#map"
            />
            
            <DemoCard 
              title="小学校周辺の交通量表示"
              description="小学校周辺の交通量データを地図上に可視化します。"
              icon={<MapPin className="h-8 w-8 text-indigo-500" />}
              href="/xroad/example-page"
              isExternal
            />
          </div>
        </CardContent>
      </Card>

      <div id="map" className="mb-6">
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="map">マップ表示</TabsTrigger>
            <TabsTrigger value="layers">レイヤー設定</TabsTrigger>
            <TabsTrigger value="info">使い方</TabsTrigger>
          </TabsList>
          
          <TabsContent value="map" className="h-[600px] relative">
            <MapWrapper>
              {visibleLayers.roads && <XRoadLayer 
                layerId="xroad-roads"
                dataType="roads"
                visible={true}
                layerOptions={{
                  paint: {
                    'line-color': '#3388ff',
                    'line-width': 2,
                  },
                }}
              />}
              {visibleLayers.restrictions && <RestrictionAlerts 
                userRoutes={[
                  {
                    id: 'route-1',
                    name: '自宅-学校ルート',
                    bounds: {
                      north: 35.7844,
                      south: 35.5844,
                      east: 139.8530,
                      west: 139.6530,
                    }
                  }
                ]}
              />}
              {visibleLayers.traffic && <SchoolTrafficDashboard 
                schoolId="school-1"
                schoolName="サンプル小学校"
                schoolLocation={[139.7530, 35.6844]}
                radius={500}
              />}
              <SafeRouteSearch />
            </MapWrapper>
          </TabsContent>
          
          <TabsContent value="layers">
            <Card>
              <CardHeader>
                <CardTitle>レイヤー設定</CardTitle>
                <CardDescription>表示するデータレイヤーを選択してください</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">道路データ</span>
                  <Button 
                    variant={visibleLayers.roads ? "default" : "outline"} 
                    onClick={() => toggleLayer('roads')}
                  >
                    {visibleLayers.roads ? '表示中' : '非表示'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium">規制情報</span>
                  <Button 
                    variant={visibleLayers.restrictions ? "default" : "outline"} 
                    onClick={() => toggleLayer('restrictions')}
                  >
                    {visibleLayers.restrictions ? '表示中' : '非表示'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="font-medium">交通量データ</span>
                  <Button 
                    variant={visibleLayers.traffic ? "default" : "outline"} 
                    onClick={() => toggleLayer('traffic')}
                  >
                    {visibleLayers.traffic ? '表示中' : '非表示'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="info">
            <Card>
              <CardHeader>
                <CardTitle>使い方</CardTitle>
                <CardDescription>xROADデータプラットフォーム統合マップの使い方</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">1. マップの操作</h3>
                  <p className="text-sm text-muted-foreground">マップはドラッグで移動、スクロールでズームイン/アウトできます。</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">2. レイヤーの切り替え</h3>
                  <p className="text-sm text-muted-foreground">「レイヤー設定」タブで表示するデータを選択できます。</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">3. 安全ルート検索</h3>
                  <p className="text-sm text-muted-foreground">マップ左側のパネルから出発地と目的地を入力し、「ルート検索」ボタンをクリックします。</p>
                </div>
                
                <div>
                  <h3 className="font-semibold">4. 交通量データの表示</h3>
                  <p className="text-sm text-muted-foreground">「交通量データ」レイヤーを有効にすると、学校周辺の交通量が表示されます。</p>
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  このサービスは、交通量API機能を使用していますが、サービスの内容は国土交通省によって保証されたものではありません。
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// デモカードコンポーネント
interface DemoCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  isExternal?: boolean;
}

function DemoCard({ title, description, icon, href, isExternal = false }: DemoCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
      <CardFooter className="pt-2">
        {isExternal ? (
          <Link href={href} className="w-full">
            <Button variant="outline" className="w-full">
              <span>詳細を見る</span>
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Link href={href} className="w-full">
            <Button variant="outline" className="w-full">
              表示する
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
} 