import { useState, useEffect } from 'react';
import { useMap } from 'react-map-gl/mapbox';
import * as xroadApi from '@/lib/api/xroad';

type XRoadDataType = 'roads' | 'traffic' | 'restrictions';

interface UseXRoadDataProps {
  dataType: XRoadDataType;
  enabled?: boolean;
  roadId?: string; // 交通量データ取得時に使用
}

/**
 * xROAD APIからデータを取得して管理するカスタムフック
 */
export function useXRoadData({
  dataType,
  enabled = true,
  roadId,
}: UseXRoadDataProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  // マップインスタンスを取得
  const { current: map } = useMap();

  useEffect(() => {
    if (!enabled || !map) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // マップの現在の表示範囲を取得
        const bounds = map.getBounds();
        
        // boundsがnullの場合は処理を中断
        if (!bounds) {
          console.warn('マップの表示範囲が取得できませんでした');
          setIsLoading(false);
          return;
        }
        
        const boundingBox = {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        };
        
        let result;
        
        // データタイプに応じたAPI呼び出し
        switch (dataType) {
          case 'roads':
            const centerLatRoads = (boundingBox.north + boundingBox.south) / 2;
            const centerLngRoads = (boundingBox.east + boundingBox.west) / 2;
            
            // dateTime と roadType を準備
            const nowForRoads = new Date();
            const yearRoads = nowForRoads.getFullYear();
            const monthRoads = String(nowForRoads.getMonth() + 1).padStart(2, '0');
            const dayRoads = String(nowForRoads.getDate()).padStart(2, '0');
            const hoursRoads = String(nowForRoads.getHours()).padStart(2, '0');
            const minutesRoads = String(nowForRoads.getMinutes()).padStart(2, '0');
            const currentDateTimeForRoads = `${yearRoads}${monthRoads}${dayRoads}${hoursRoads}${minutesRoads}`;
            const roadTypeForRoads = '3'; // 一般国道をデフォルトとする

            // 修正された getRoadData を呼び出す
            result = await xroadApi.getRoadData(
              centerLatRoads,
              centerLngRoads,
              undefined, // radius は getRoadData のデフォルト値を使用
              currentDateTimeForRoads,
              roadTypeForRoads
            );
            break;
          case 'traffic':
            console.warn("Traffic data fetching is temporarily disabled pending API updates for new specification.");
            break;
          case 'restrictions':
            // result = await xroadApi.getRoadRestrictionData(boundingBox);
            console.warn("getRoadRestrictionData is not implemented yet");
            break;
          default:
            throw new Error('不明なデータタイプです');
        }
        
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('データ取得中にエラーが発生しました'));
        console.error('xROADデータ取得エラー:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
    
    // マップの移動・ズーム時にデータを再取得（交通量データは除く）
    if (dataType !== 'traffic') {
      const handleMapMove = () => {
        fetchData();
      };
      
      map.on('moveend', handleMapMove);
      
      return () => {
        map.off('moveend', handleMapMove);
      };
    }
  }, [dataType, enabled, map, roadId]);

  // データの手動更新関数
  const refetch = async () => {
    if (!map) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const bounds = map.getBounds();
      
      // boundsがnullの場合は処理を中断
      if (!bounds) {
        console.warn('マップの表示範囲が取得できませんでした');
        setIsLoading(false);
        return;
      }
      
      const boundingBox = {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      };
      
      let result;
      
      switch (dataType) {
        case 'roads':
          const centerLatRefetch = (boundingBox.north + boundingBox.south) / 2;
          const centerLngRefetch = (boundingBox.east + boundingBox.west) / 2;

          // dateTime と roadType を準備
          const nowForRefetch = new Date();
          const yearRefetch = nowForRefetch.getFullYear();
          const monthRefetch = String(nowForRefetch.getMonth() + 1).padStart(2, '0');
          const dayRefetch = String(nowForRefetch.getDate()).padStart(2, '0');
          const hoursRefetch = String(nowForRefetch.getHours()).padStart(2, '0');
          const minutesRefetch = String(nowForRefetch.getMinutes()).padStart(2, '0');
          const currentDateTimeForRefetch = `${yearRefetch}${monthRefetch}${dayRefetch}${hoursRefetch}${minutesRefetch}`;
          const roadTypeForRefetch = '3'; // 一般国道をデフォルトとする

          result = await xroadApi.getRoadData(
            centerLatRefetch,
            centerLngRefetch,
            undefined, // radius は getRoadData のデフォルト値を使用
            currentDateTimeForRefetch,
            roadTypeForRefetch
          );
          break;
        case 'traffic':
          console.warn("Traffic data fetching is temporarily disabled pending API updates for new specification.");
          break;
        case 'restrictions':
          // result = await xroadApi.getRoadRestrictionData(boundingBox);
          console.warn("getRoadRestrictionData is not implemented yet");
          break;
        default:
          throw new Error('不明なデータタイプです');
      }
      
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('データ取得中にエラーが発生しました'));
      console.error('xROADデータ取得エラー:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

export default useXRoadData; 