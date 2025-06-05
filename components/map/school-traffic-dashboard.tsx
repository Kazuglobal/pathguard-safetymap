"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layer, Source, useMap } from 'react-map-gl/mapbox';
import * as xroadApi from '@/lib/api/xroad';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Clock, MapPin, CircleAlert, Info } from 'lucide-react';

interface SchoolTrafficDashboardProps {
  schoolId: string;
  schoolName?: string;
  schoolLocation?: [number, number];
  radius?: number; // メートル単位
  showTrafficVolume?: boolean;
  showRestrictions?: boolean;
}

/**
 * 学校周辺の交通状況ダッシュボードコンポーネント
 */
export function SchoolTrafficDashboard({
  schoolId,
  schoolName = '学校名',
  schoolLocation = [139.7530, 35.6844], // デフォルトは東京
  radius = 500, // デフォルト500m
  showTrafficVolume = true,
  showRestrictions = true,
}: SchoolTrafficDashboardProps) {
  const { current: map } = useMap();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [restrictionData, setRestrictionData] = useState<any>(null);
  const [trafficStats, setTrafficStats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'traffic' | 'restrictions'>('traffic');
  const [showSchoolRadius, setShowSchoolRadius] = useState<boolean>(true);

  // xROADデータの取得
  useEffect(() => {
    if (!map || !schoolLocation) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // スクールの位置を中心にしたバウンディングボックスを計算
        // 簡易的な計算のため、正確な円形エリアではなく矩形エリアを使用
        const metersToLongitude = (meters: number, latitude: number) => {
          return meters / (111111 * Math.cos(latitude * Math.PI / 180));
        };
        
        const metersToLatitude = (meters: number) => {
          return meters / 111111;
        };
        
        const [lon, lat] = schoolLocation;
        const lonOffset = metersToLongitude(radius, lat);
        const latOffset = metersToLatitude(radius);
        
        const boundingBox = {
          north: lat + latOffset,
          south: lat - latOffset,
          east: lon + lonOffset,
          west: lon - lonOffset,
        };

        // 交通量データと規制情報の取得
        if (showTrafficVolume) {
          // 中心点と現在時刻を用いてgetRoadDataを呼び出し
          const [centerLon, centerLat] = schoolLocation;
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          const currentDateTime = `${year}${month}${day}${hours}${minutes}`;
          const roadType = '3'; // 一般国道をデフォルトとする

          const trafficResult = await xroadApi.getRoadData(
            centerLat,
            centerLon,
            radius,
            currentDateTime,
            roadType
          );
          setTrafficData(trafficResult);
          
          // 交通量統計データの生成（デモ用）
          const timeSlots = ['7:00', '8:00', '9:00', '12:00', '15:00', '16:00', '17:00', '18:00'];
          const demoStats = timeSlots.map(time => {
            const isRushHour = time === '8:00' || time === '17:00';
            const volume = isRushHour 
              ? Math.floor(Math.random() * 500) + 1000 
              : Math.floor(Math.random() * 300) + 200;
              
            return {
              time,
              volume,
              danger: volume > 800 ? '高' : volume > 400 ? '中' : '低',
            };
          });
          
          setTrafficStats(demoStats);
        }
        
        if (showRestrictions) {
          // getRoadRestrictionDataは未実装のため一時的にコメントアウト
          // const restrictionResult = await xroadApi.getRoadRestrictionData(boundingBox);
          // setRestrictionData(restrictionResult);
          console.warn("規制情報の取得機能は現在開発中です");
        }

        // マップを学校位置に移動
        map.flyTo({
          center: schoolLocation,
          zoom: 15,
          duration: 1000,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('データ取得中にエラーが発生しました'));
        console.error('交通データ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [map, schoolLocation, radius, showTrafficVolume, showRestrictions]);

  // 危険度に基づく色を取得
  const getDangerColor = (level: string) => {
    switch (level) {
      case '高': return '#ef4444';
      case '中': return '#f97316';
      case '低': return '#22c55e';
      default: return '#3b82f6';
    }
  };

  // 学校位置と半径をGeoJSONで表現
  const schoolRadiusData = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        properties: {
          schoolId,
          schoolName,
          radius,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: schoolLocation,
        },
      },
    ],
  };

  return (
    <div className="absolute bottom-4 right-4 z-10 bg-white rounded-lg shadow-md w-80 max-h-[calc(100vh-120px)] overflow-auto">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold">{schoolName}周辺の交通状況</h3>
        <div className="text-sm text-gray-500 flex items-center mt-1">
          <MapPin size={14} className="mr-1" /> 
          半径: {radius}m
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'traffic' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('traffic')}
        >
          交通量データ
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'restrictions' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('restrictions')}
        >
          規制情報
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          データを読み込み中...
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500">
          <AlertTriangle size={24} className="mx-auto mb-2" />
          {error.message}
        </div>
      ) : (
        <div className="p-4">
          {activeTab === 'traffic' && (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Clock size={16} className="mr-1" />
                  時間帯別交通量
                </h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trafficStats}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" fontSize={10} />
                      <YAxis fontSize={10} />
                      <Tooltip 
                        formatter={(value, name) => [value, '交通量']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Bar 
                        dataKey="volume" 
                        name="交通量" 
                        fill="#3b82f6" 
                        barSize={20}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mb-3">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <CircleAlert size={16} className="mr-1" />
                  危険度評価
                </h4>
                <div className="space-y-2">
                  {trafficStats
                    .filter(stat => stat.danger === '高')
                    .map((stat, index) => (
                      <div 
                        key={index}
                        className="flex items-center justify-between p-2 bg-red-50 rounded-md border border-red-100"
                      >
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                          <span className="text-sm">{stat.time}</span>
                        </div>
                        <div className="text-xs font-medium px-2 py-0.5 bg-red-100 rounded-full text-red-800">
                          危険度: 高
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="text-xs text-gray-500 mt-3 flex items-start">
                <Info size={14} className="mr-1 mt-0.5 flex-shrink-0" />
                <span>
                  下校時間帯（15:00-16:00）の交通量が多いため、通学路の安全確保が必要です。
                </span>
              </div>
            </>
          )}

          {activeTab === 'restrictions' && (
            <>
              <div className="mb-3">
                <h4 className="text-sm font-medium mb-2">学校周辺の規制情報</h4>
                {restrictionData?.features?.length > 0 ? (
                  <div className="space-y-2">
                    {/* 実際のデータがない場合はデモデータを表示 */}
                    <div className="p-2 bg-yellow-50 rounded-md border border-yellow-100">
                      <div className="text-sm font-medium">通行止め</div>
                      <div className="text-xs text-gray-600 mt-1">
                        地点: 学校北側道路<br />
                        期間: 2023/10/15 - 2023/11/15<br />
                        理由: 道路工事
                      </div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded-md border border-blue-100">
                      <div className="text-sm font-medium">一方通行</div>
                      <div className="text-xs text-gray-600 mt-1">
                        地点: 学校東側道路<br />
                        時間: 終日<br />
                        詳細: 南向き一方通行
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-center text-gray-500 py-2">
                    現在、学校周辺に規制情報はありません
                  </div>
                )}
              </div>

              <div className="text-xs text-gray-500 mt-3 flex items-start">
                <Info size={14} className="mr-1 mt-0.5 flex-shrink-0" />
                <span>
                  通学路の工事情報は定期的に更新されます。最新情報を確認してください。
                </span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-3 border-t">
        <label className="flex items-center text-xs text-gray-600">
          <input
            type="checkbox"
            checked={showSchoolRadius}
            onChange={() => setShowSchoolRadius(!showSchoolRadius)}
            className="mr-2"
          />
          学校周辺エリアを表示
        </label>
      </div>

      {/* 学校位置と半径の表示 */}
      {showSchoolRadius && (
        <>
          <Source
            id="school-location"
            type="geojson"
            data={schoolRadiusData}
          >
            <Layer
              id="school-point"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#3b82f6',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              }}
            />
            <Layer
              id="school-radius"
              type="circle"
              paint={{
                'circle-radius': ['/', radius, 0.3],
                'circle-color': 'rgba(59, 130, 246, 0.1)',
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(59, 130, 246, 0.5)',
              }}
            />
          </Source>
        </>
      )}
    </div>
  );
}

export default SchoolTrafficDashboard; 