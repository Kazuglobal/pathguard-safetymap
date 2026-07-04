"use client"

import { useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import Map, { type MapRef } from 'react-map-gl/mapbox';
import { localizeMapLabels } from '@/lib/hunter/map-labels';

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
 * MapコンテナとReact Map GLを連携するラッパーコンポーネント。
 * ラベルは日本語を優先する(shield系レイヤーは localizeMapLabels 側で除外)。
 */
export function MapWrapper({
  children,
  initialViewState,
  mapStyle = "mapbox://styles/mapbox/streets-v12"
}: MapWrapperProps) {
  const [mapToken, setMapToken] = useState<string>('');
  const mapRef = useRef<MapRef | null>(null);

  useEffect(() => {
    // 環境変数からマップボックストークンを取得
    if (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
      setMapToken(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
    }
  }, []);

  const localize = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    try {
      localizeMapLabels(map);
    } catch {
      // ラベル日本語化に失敗しても地図表示は継続する
    }
  }, []);

  // マップボックストークンがロードされるまで待機
  if (!mapToken) {
    return <div className="w-full h-screen flex items-center justify-center">マップデータを読み込み中...</div>;
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={mapToken}
      initialViewState={initialViewState || {
        longitude: 139.7530, // 東京を中心に表示
        latitude: 35.6844,
        zoom: 12,
      }}
      style={{ width: '100%', height: '100vh' }}
      mapStyle={mapStyle}
      onLoad={localize}
      onStyleData={localize}
    >
      {children}
    </Map>
  );
}

export default MapWrapper;