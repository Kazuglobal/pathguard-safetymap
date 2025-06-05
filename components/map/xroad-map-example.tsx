import { useState } from 'react';
import MapWrapper from './map-wrapper';
import XRoadLayer from './xroad-layer';

/**
 * xROAD API連携マップの例示コンポーネント
 */
export function XRoadMapExample() {
  // レイヤーの表示・非表示を管理する状態
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
    <div className="relative w-full h-screen">
      {/* MapWrapperを使用 */}
      <MapWrapper
        initialViewState={{
          longitude: 139.7530,  // 東京を中心に表示
          latitude: 35.6844,
          zoom: 12,
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        {/* 道路データレイヤー */}
        <XRoadLayer
          layerId="xroad-roads"
          dataType="roads"
          visible={visibleLayers.roads}
          layerOptions={{
            paint: {
              'line-color': '#3388ff',
              'line-width': 2,
            },
          }}
        />

        {/* 規制情報レイヤー */}
        <XRoadLayer
          layerId="xroad-restrictions"
          dataType="restrictions"
          visible={visibleLayers.restrictions}
        />

        {/* 交通量データレイヤー（特定の道路IDが必要） */}
        <XRoadLayer
          layerId="xroad-traffic"
          dataType="traffic"
          roadId="example-road-id" // 実際の道路IDに変更が必要
          visible={visibleLayers.traffic}
        />
      </MapWrapper>

      {/* レイヤー切替コントロール */}
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-md z-10">
        <h3 className="text-lg font-semibold mb-2">xROADデータレイヤー</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={visibleLayers.roads}
              onChange={() => toggleLayer('roads')}
              className="rounded text-blue-500"
            />
            <span>道路データ</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={visibleLayers.restrictions}
              onChange={() => toggleLayer('restrictions')}
              className="rounded text-red-500"
            />
            <span>規制情報</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={visibleLayers.traffic}
              onChange={() => toggleLayer('traffic')}
              className="rounded text-orange-500"
            />
            <span>交通量データ</span>
          </label>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          <p>※ xROAD APIは実際の利用に際してAPIキー取得が必要です</p>
          <p>※ APIエンドポイントは公式仕様に合わせて調整してください</p>
        </div>
      </div>
    </div>
  );
}

export default XRoadMapExample; 