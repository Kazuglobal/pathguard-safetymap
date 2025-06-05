"use client";

import React, { useState, useEffect } from 'react';
import MapGL, { Source, Layer, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, AlertTriangle } from "lucide-react";

interface SchoolLocation {
  lat: number;
  lng: number;
  name: string;
}

interface TrafficData {
  type: string;
  features: Array<{
    type: string;
    geometry: {
      type: string;
      coordinates: [number, number];
    } | null;
    properties: {
      MSTRKCODE: string;
      YYYYMMDDHHMM: string;
      LANE_NO: number;
      PLACE_NAME: string;
      LONGITUDE: number;
      LATITUDE: number;
      MESHCODE: string;
      TRAFFIC_5MIN: number;
      B1_TRAFFIC?: number;
      B2_TRAFFIC?: number;
      B3_TRAFFIC?: number;
      SMALL_TRAFFIC?: number;
      BIG_TRAFFIC?: number;
      UP_DOWN_CD: number;
    };
  }>;
  totalFeatures: number;
  numberMatched: number;
  numberReturned: number;
  timeStamp: string;
  crs: any;
}

interface SchoolTrafficViewerProps {
  schoolLocation: SchoolLocation;
  mapboxToken?: string;
}

/**
 * 小学校周辺の交通量を表示するコンポーネント
 * 交通量API（国土交通省）からデータを取得し、地図上に表示します
 */
const SchoolTrafficViewer = ({ 
  schoolLocation, 
  mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN 
}: SchoolTrafficViewerProps) => {
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [popupInfo, setPopupInfo] = useState<any | null>(null);
  const [viewport, setViewport] = useState({
    latitude: schoolLocation.lat,
    longitude: schoolLocation.lng,
    zoom: 14,
    bearing: 0,
    pitch: 0
  });

  // 交通量データを取得する関数
  const fetchSchoolTrafficData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // サーバーサイドプロキシを介してAPIを呼び出す
      // 実際の実装ではサーバーサイドで認証情報を管理し、クライアントには公開しない
      const apiUrl = "/api/xroad"; // Next.jsのAPIルート
      
      // 現在時刻と1時間前の時刻を取得
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // YYYYMMDDHHMMの形式に変換
      const formatDateTime = (date: Date) => {
        return date.getFullYear() +
          String(date.getMonth() + 1).padStart(2, '0') +
          String(date.getDate()).padStart(2, '0') +
          String(date.getHours()).padStart(2, '0') +
          String(date.getMinutes()).padStart(2, '0');
      };
      
      const params = new URLSearchParams({
        method: 'getTrafficData',
        latitude: schoolLocation.lat.toString(),
        longitude: schoolLocation.lng.toString(),
        radius: '2000', // 2km圏内
        from: formatDateTime(oneHourAgo),
        to: formatDateTime(now)
      });
      
      const response = await fetch(`${apiUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`交通量API エラー: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTrafficData(data);
    } catch (error) {
      console.error("交通量データの取得に失敗しました:", error);
      setError(error instanceof Error ? error.message : '交通量データの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 初回マウント時にデータを取得
  useEffect(() => {
    fetchSchoolTrafficData();
  }, [schoolLocation]);

  // 交通量に基づいて色を決定
  const getTrafficColor = (volume: number) => {
    if (volume < 20) return '#00ff00'; // 少ない
    if (volume < 50) return '#ffff00'; // 中程度
    if (volume < 100) return '#ff9900'; // 多い
    return '#ff0000'; // 非常に多い
  };

  // 大型車率を計算（大型車数 / 総交通量）
  const getLargeVehicleRatio = (feature: any) => {
    const total = feature.properties.TRAFFIC_5MIN;
    if (!total || total === 0) return 0;
    
    const largeVehicles = feature.properties.BIG_TRAFFIC || 0;
    return (largeVehicles / total) * 100;
  };

  // 上り/下りの表示を取得
  const getDirectionLabel = (upDownCd: number) => {
    return upDownCd === 1 ? '上り' : '下り';
  };

  // GeoJSONデータの作成
  const getGeoJsonData = () => {
    if (!trafficData || !trafficData.features) return null;
    
    return {
      type: 'FeatureCollection' as const,
      features: trafficData.features
        .filter(feature => feature.properties.LATITUDE && feature.properties.LONGITUDE)
        .map(feature => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [feature.properties.LONGITUDE, feature.properties.LATITUDE]
          },
          properties: {
            id: `${feature.properties.MSTRKCODE}-${feature.properties.LANE_NO}`,
            volume: feature.properties.TRAFFIC_5MIN,
            color: getTrafficColor(feature.properties.TRAFFIC_5MIN),
            place: feature.properties.PLACE_NAME,
            time: feature.properties.YYYYMMDDHHMM,
            mstrkCode: feature.properties.MSTRKCODE,
            largeVehicleRatio: getLargeVehicleRatio(feature),
            direction: getDirectionLabel(feature.properties.UP_DOWN_CD),
            ...feature.properties
          }
        }))
    };
  };

  // ポップアップを表示する処理
  const handleClick = (event: any) => {
    const { features } = event;
    if (features && features.length > 0) {
      const feature = features[0];
      setPopupInfo({
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        properties: feature.properties
      });
    }
  };

  const geoJsonData = getGeoJsonData();

  // 日時をフォーマットする関数
  const formatDateTime = (yyyymmddhhmm: string) => {
    if (!yyyymmddhhmm || yyyymmddhhmm.length !== 12) return 'N/A';
    
    const year = yyyymmddhhmm.substring(0, 4);
    const month = yyyymmddhhmm.substring(4, 6);
    const day = yyyymmddhhmm.substring(6, 8);
    const hour = yyyymmddhhmm.substring(8, 10);
    const minute = yyyymmddhhmm.substring(10, 12);
    
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  };

  return (
    <div className="school-traffic-viewer">
      <div className="attribution text-xs text-gray-500 mb-2">
        <p>このサービスは、交通量API機能を使用していますが、サービスの内容は国土交通省によって保証されたものではありません。</p>
      </div>
      
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">{schoolLocation.name}周辺の交通量</h3>
        <Button 
          onClick={fetchSchoolTrafficData} 
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? 'データ取得中...' : 'データを更新'}
        </Button>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>エラーが発生しました</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="map-container h-[500px] relative rounded-lg overflow-hidden border">
        <MapGL
          {...viewport}
          mapboxAccessToken={mapboxToken}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          onMove={evt => setViewport(evt.viewState)}
          interactiveLayerIds={geoJsonData ? ['traffic-points'] : []}
          onClick={handleClick}
        >
          <NavigationControl position="top-right" />
          
          {geoJsonData && (
            <Source id="traffic-data" type="geojson" data={geoJsonData}>
              <Layer
                id="traffic-points"
                type="circle"
                paint={{
                  'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['get', 'volume'],
                    0, 6,
                    100, 15
                  ],
                  'circle-color': ['get', 'color'],
                  'circle-opacity': 0.8,
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#fff'
                }}
              />
            </Source>
          )}
          
          {popupInfo && (
            <Popup
              longitude={popupInfo.longitude}
              latitude={popupInfo.latitude}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeOnClick={false}
              className="custom-popup"
            >
              <div className="popup-content p-2">
                <h4 className="font-bold text-sm">{popupInfo.properties.place}</h4>
                <p className="text-xs mb-1">観測時間: {formatDateTime(popupInfo.properties.time)}</p>
                <div className="text-xs grid grid-cols-2 gap-x-2">
                  <span>交通量:</span>
                  <span className="font-bold">{popupInfo.properties.volume}台/5分</span>
                  
                  <span>大型車率:</span>
                  <span className="font-bold">{popupInfo.properties.largeVehicleRatio.toFixed(1)}%</span>
                  
                  <span>観測方向:</span>
                  <span className="font-bold">{popupInfo.properties.direction}</span>
                </div>
              </div>
            </Popup>
          )}
          
          {/* 学校位置のマーカー */}
          <Source
            id="school-marker"
            type="geojson"
            data={{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [schoolLocation.lng, schoolLocation.lat]
              },
              properties: {
                name: schoolLocation.name
              }
            }}
          >
            <Layer
              id="school-point"
              type="circle"
              paint={{
                'circle-radius': 8,
                'circle-color': '#0000ff',
                'circle-opacity': 0.8,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
              }}
            />
          </Source>
        </MapGL>
      </div>
      
      {/* 凡例表示 */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-md">交通量の凡例</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 mr-2 rounded-full bg-[#00ff00]"></span>
              <span className="text-sm">少ない（0-19台/5分）</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 mr-2 rounded-full bg-[#ffff00]"></span>
              <span className="text-sm">中程度（20-49台/5分）</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 mr-2 rounded-full bg-[#ff9900]"></span>
              <span className="text-sm">多い（50-99台/5分）</span>
            </div>
            <div className="flex items-center">
              <span className="inline-block w-4 h-4 mr-2 rounded-full bg-[#ff0000]"></span>
              <span className="text-sm">非常に多い（100台以上/5分）</span>
            </div>
          </div>
          
          <div className="mt-3 flex items-start text-xs text-gray-500">
            <InfoIcon className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
            <span>円の大きさは交通量に比例します。地点をクリックすると詳細情報が表示されます。</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchoolTrafficViewer; 