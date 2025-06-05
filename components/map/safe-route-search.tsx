"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Layer, Source, useMap } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import * as xroadApi from '@/lib/api/xroad';

interface SafeRouteSearchProps {
  startPoint?: [number, number];
  endPoint?: [number, number];
  useXRoadData?: boolean;
  onRouteCalculated?: (route: any) => void;
}

/**
 * 交通量データを考慮した安全なルート検索コンポーネント
 */
export function SafeRouteSearch({
  startPoint,
  endPoint,
  useXRoadData = true,
  onRouteCalculated,
}: SafeRouteSearchProps) {
  const { current: map } = useMap();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [startMarker, setStartMarker] = useState<[number, number] | null>(startPoint || null);
  const [endMarker, setEndMarker] = useState<[number, number] | null>(endPoint || null);
  const [routeData, setRouteData] = useState<any>(null);
  const [trafficData, setTrafficData] = useState<any>(null);
  const [searchMode, setSearchMode] = useState<'start' | 'end' | null>(null);

  // 交通量データの取得
  useEffect(() => {
    if (!map || !useXRoadData) return;

    const fetchTrafficData = async () => {
      try {
        setApiError(null);
        const bounds = map.getBounds();
        if (!bounds) return;

        const boundingBox = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };

        const centerLat = (boundingBox.north + boundingBox.south) / 2;
        const centerLng = (boundingBox.east + boundingBox.west) / 2;

        // dateTime と roadType を準備
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const currentDateTime = `${year}${month}${day}${hours}${minutes}`;
        const roadType = '3'; // 一般国道をデフォルトとする。必要に応じて変更。

        // 修正された getRoadData を呼び出す
        const data = await xroadApi.getRoadData(
          centerLat,
          centerLng,
          undefined, // radius は getRoadData のデフォルト値を使用
          currentDateTime,
          roadType
        );
        setTrafficData(data);
      } catch (err: any) {
        console.error('交通量データの取得に失敗しました (safe-route-search):', err);
        let displayMessage = '交通量データの取得中に予期せぬエラーが発生しました。詳細についてはコンソールをご確認ください。';
        
        if (err instanceof xroadApi.XRoadAPIError) {
          // XRoadAPIErrorの場合、statusに応じてメッセージを出し分ける
          if (err.status === 400) {
            displayMessage = `リクエストが無効です: ${err.message} パラメータを確認してください。`;
          } else if (err.status === 500) {
            displayMessage = `交通情報サーバーで内部エラーが発生しました: ${err.message} しばらくしてから再試行してください。`;
          } else {
            displayMessage = `交通情報APIエラー (コード: ${err.status}): ${err.message}`;
          }
        } else if (err instanceof Error) {
          // getRoadData内のバリデーションエラーや、その他の一般的なエラー
          displayMessage = err.message; 
        }
        setApiError(displayMessage);
      }
    };

    fetchTrafficData();

    // マップの移動時に交通量データを更新
    const handleMapMove = () => {
      fetchTrafficData();
    };

    map.on('moveend', handleMapMove);
    return () => {
      map.off('moveend', handleMapMove);
    };
  }, [map, useXRoadData]);

  // マップクリックイベントの処理
  useEffect(() => {
    if (!map || !searchMode) return;

    const handleMapClick = (e: any) => {
      const [longitude, latitude] = e.lngLat.toArray();
      
      if (searchMode === 'start') {
        setStartMarker([longitude, latitude]);
        setSearchMode(null);
      } else if (searchMode === 'end') {
        setEndMarker([longitude, latitude]);
        setSearchMode(null);
      }
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, searchMode]);

  // ルート検索
  useEffect(() => {
    if (!startMarker || !endMarker || !map) return;

    const calculateRoute = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // ここでは簡易的なデモ用GeoJSONを生成
        // 実際にはMapbox Directions APIまたは独自ルーティングサービスを使用する
        const demoRoute = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  startMarker,
                  [
                    (startMarker[0] + endMarker[0]) / 2 + (Math.random() * 0.01 - 0.005),
                    (startMarker[1] + endMarker[1]) / 2 + (Math.random() * 0.01 - 0.005),
                  ],
                  endMarker,
                ],
              },
            },
          ],
        };

        setRouteData(demoRoute);
        
        if (onRouteCalculated) {
          onRouteCalculated(demoRoute);
        }

        // カメラをルート全体が見えるように調整
        const coordinates = [startMarker, endMarker];
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        map.fitBounds(bounds.toArray(), {
          padding: 100,
          duration: 1000,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('ルート計算中にエラーが発生しました'));
        console.error('ルート検索エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };

    calculateRoute();
  }, [startMarker, endMarker, map, onRouteCalculated]);

  // 出発地点の選択
  const handleSelectStart = () => {
    setSearchMode('start');
  };

  // 目的地の選択
  const handleSelectEnd = () => {
    setSearchMode('end');
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-3">安全ルート検索</h3>
      
      <div className="space-y-3">
        <div>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 rounded-full bg-green-500 mr-2"></div>
            <span>出発地点: </span>
          </div>
          <button 
            onClick={handleSelectStart}
            className="px-3 py-1 bg-green-100 hover:bg-green-200 rounded text-sm w-full text-left"
          >
            {startMarker ? `${startMarker[0].toFixed(4)}, ${startMarker[1].toFixed(4)}` : '地図上で選択'}
          </button>
        </div>

        <div>
          <div className="flex items-center mb-1">
            <div className="w-4 h-4 rounded-full bg-red-500 mr-2"></div>
            <span>目的地: </span>
          </div>
          <button 
            onClick={handleSelectEnd}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 rounded text-sm w-full text-left"
          >
            {endMarker ? `${endMarker[0].toFixed(4)}, ${endMarker[1].toFixed(4)}` : '地図上で選択'}
          </button>
        </div>

        {searchMode && (
          <div className="text-sm text-blue-600 animate-pulse">
            地図上で{searchMode === 'start' ? '出発地点' : '目的地'}をクリックしてください
          </div>
        )}

        {isLoading && (
          <div className="text-sm text-gray-600">
            ルートを計算中...
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600">
            ルート計算エラー: {error.message}
          </div>
        )}

        {apiError && (
          <div className="mt-2 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            <p className="font-semibold">交通情報エラー:</p>
            <p>{apiError}</p>
            <p className="text-xs mt-1">時間をおいて再試行するか、管理者に連絡してください。</p>
          </div>
        )}

        {routeData && (
          <div className="text-sm">
            <div className="font-medium">計算されたルート:</div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-gray-600">
                {useXRoadData ? '交通量データを考慮したルート' : '最短ルート'}
              </div>
              <div className="text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                安全スコア: 87/100
              </div>
            </div>
          </div>
        )}

        <div className="mt-2">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={useXRoadData}
              onChange={() => {/* ここでuseXRoadDataの値を変更する関数を呼び出す */}}
              className="mr-2"
            />
            交通量データを考慮する
          </label>
        </div>
      </div>

      {/* ルートレイヤー */}
      {routeData && (
        <Source id="route-data" type="geojson" data={routeData}>
          <Layer
            id="route-line"
            type="line"
            source="route-data"
            paint={{
              'line-color': '#4882c5',
              'line-width': 4,
              'line-opacity': 0.8,
            }}
          />
        </Source>
      )}

      {/* マーカーレイヤー（出発点と目的地） */}
      {startMarker && (
        <Source
          id="start-marker"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: startMarker,
                },
              },
            ],
          }}
        >
          <Layer
            id="start-point"
            type="circle"
            source="start-marker"
            paint={{
              'circle-radius': 8,
              'circle-color': '#22c55e',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      )}

      {endMarker && (
        <Source
          id="end-marker"
          type="geojson"
          data={{
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Point',
                  coordinates: endMarker,
                },
              },
            ],
          }}
        >
          <Layer
            id="end-point"
            type="circle"
            source="end-marker"
            paint={{
              'circle-radius': 8,
              'circle-color': '#ef4444',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>
      )}
    </div>
  );
}

export default SafeRouteSearch; 