"use client"

import { useState, useEffect, ReactNode } from 'react';
import Map from 'react-map-gl/mapbox';
import MapContainer from './map-container';

interface MapWrapperProps {
  children?: ReactNode;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  mapStyle?: string;
}

/**
 * MapコンテナとReact Map GLを連携するラッパーコンポーネント
 */
export function MapWrapper({
  children,
  initialViewState,
  mapStyle = "mapbox://styles/mapbox/streets-v12"
}: MapWrapperProps) {
  const [mapToken, setMapToken] = useState<string>('');
  
  useEffect(() => {
    // 環境変数からマップボックストークンを取得
    if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
      setMapToken(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
    }
  }, []);

  // マップボックストークンがロードされるまで待機
  if (!mapToken) {
    return <div className="w-full h-screen flex items-center justify-center">マップデータを読み込み中...</div>;
  }

  return (
    <Map
      mapboxAccessToken={mapToken}
      initialViewState={initialViewState || {
        longitude: 139.7530, // 東京を中心に表示
        latitude: 35.6844,
        zoom: 12,
      }}
      style={{ width: '100%', height: '100vh' }}
      mapStyle={mapStyle}
    >
      {children}
    </Map>
  );
}

export default MapWrapper; 