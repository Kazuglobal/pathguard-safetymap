import { useEffect, useState } from 'react';
import { Layer, Source } from 'react-map-gl/mapbox';
import { useXRoadData } from '@/hooks/use-xroad-data';

interface XRoadLayerProps {
  layerId: string;
  dataType: 'roads' | 'traffic' | 'restrictions';
  roadId?: string;
  visible?: boolean;
  layerOptions?: any;
  sourceOptions?: any;
}

/**
 * xROADデータを表示するマップレイヤーコンポーネント
 */
export function XRoadLayer({
  layerId,
  dataType,
  roadId,
  visible = true,
  layerOptions = {},
  sourceOptions = {},
}: XRoadLayerProps) {
  // APIからデータを取得
  const { data, isLoading, error } = useXRoadData({
    dataType,
    roadId,
    enabled: visible,
  });

  // GeoJSONデータの状態管理
  const [geoJsonData, setGeoJsonData] = useState<any>({
    type: 'FeatureCollection',
    features: [],
  });

  // レイヤーの色を決定
  const getLayerColor = () => {
    switch (dataType) {
      case 'roads':
        return '#3388ff';
      case 'traffic':
        return '#ff8800';
      case 'restrictions':
        return '#ff3333';
      default:
        return '#888888';
    }
  };

  // データが更新されたらGeoJSONを更新
  useEffect(() => {
    if (data && !isLoading) {
      // 取得したデータがすでにGeoJSON形式であれば直接使用
      // そうでない場合は変換が必要（APIの仕様に合わせて調整）
      if (data.type === 'FeatureCollection') {
        setGeoJsonData(data);
      } else {
        // ここでAPIレスポンスをGeoJSON形式に変換する処理が必要
        // 実際のAPI仕様に合わせて実装する
        console.warn('データをGeoJSON形式に変換する必要があります');
      }
    }
  }, [data, isLoading]);

  // エラー発生時のログ出力
  useEffect(() => {
    if (error) {
      console.error('xROADデータレイヤーエラー:', error);
    }
  }, [error]);

  // データ読み込み中またはエラー時は何も表示しない
  if (!visible || !data) {
    return null;
  }

  return (
    <Source
      id={`${layerId}-source`}
      type="geojson"
      data={geoJsonData}
      {...sourceOptions}
    >
      {/* 道路データの場合はライン形式で表示 */}
      {dataType === 'roads' && (
        <Layer
          id={`${layerId}-line`}
          type="line"
          source={`${layerId}-source`}
          paint={{
            'line-color': getLayerColor(),
            'line-width': 2,
            ...layerOptions?.paint,
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
            ...layerOptions?.layout,
          }}
        />
      )}

      {/* 規制情報の場合はアイコンとシンボルで表示 */}
      {dataType === 'restrictions' && (
        <>
          <Layer
            id={`${layerId}-circle`}
            type="circle"
            source={`${layerId}-source`}
            paint={{
              'circle-radius': 6,
              'circle-color': getLayerColor(),
              'circle-stroke-width': 1,
              'circle-stroke-color': '#ffffff',
              ...layerOptions?.paint,
            }}
          />
          <Layer
            id={`${layerId}-symbol`}
            type="symbol"
            source={`${layerId}-source`}
            layout={{
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Regular'],
              'text-offset': [0, 0.8],
              'text-size': 12,
              ...layerOptions?.layout,
            }}
            paint={{
              'text-color': '#333333',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1,
              ...layerOptions?.textPaint,
            }}
          />
        </>
      )}

      {/* 交通量データの場合は色分けされたライン表示 */}
      {dataType === 'traffic' && (
        <Layer
          id={`${layerId}-line`}
          type="line"
          source={`${layerId}-source`}
          paint={{
            'line-color': [
              'step',
              ['get', 'volume'],
              '#4CBB17', // 交通量少
              1000, '#FFCC00', // 交通量中
              5000, '#FF3333', // 交通量多
            ],
            'line-width': 3,
            ...layerOptions?.paint,
          }}
          layout={{
            'line-join': 'round',
            'line-cap': 'round',
            ...layerOptions?.layout,
          }}
        />
      )}
    </Source>
  );
}

export default XRoadLayer; 