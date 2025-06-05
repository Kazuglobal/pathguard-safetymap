"use client"

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Bell, BellOff, Check, X, ExternalLink, MapPin } from 'lucide-react';
import * as xroadApi from '@/lib/api/xroad';

interface RouteInfo {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

interface RestrictionAlert {
  id: string;
  routeId: string;
  routeName: string;
  type: string;
  location: string;
  startDate: string;
  endDate: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  isNew: boolean;
  coordinates: [number, number];
}

interface RestrictionAlertsProps {
  userRoutes: RouteInfo[];
  notifyOnChanges?: boolean;
  checkInterval?: number; // ミリ秒
  onAlertClick?: (alert: RestrictionAlert) => void;
}

/**
 * 通学路の規制情報アラートコンポーネント
 */
export function RestrictionAlerts({
  userRoutes,
  notifyOnChanges = true,
  checkInterval = 3600000, // デフォルトは1時間ごと
  onAlertClick,
}: RestrictionAlertsProps) {
  const [alerts, setAlerts] = useState<RestrictionAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(notifyOnChanges);
  const [showDismissedAlerts, setShowDismissedAlerts] = useState<boolean>(false);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // アラートの取得
  const fetchAlerts = useCallback(async () => {
    if (userRoutes.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const newAlerts: RestrictionAlert[] = [];
      
      // 各ルートの規制情報を取得
      for (const route of userRoutes) {
        // getRoadRestrictionDataは未実装のため一時的にコメントアウト
        // const restrictionData = await xroadApi.getRoadRestrictionData(route.bounds);
        console.warn("規制情報の取得機能は現在開発中です");
        
        // デモデータの生成（実際のAPIの戻り値に合わせて調整）
        if (route.id === userRoutes[0].id) {
          // デモデータ: 最初のルートに規制情報がある想定
          newAlerts.push({
            id: `restr-${Date.now()}-1`,
            routeId: route.id,
            routeName: route.name,
            type: '通行止め',
            location: `${route.name}の北側交差点付近`,
            startDate: '2023-11-01',
            endDate: '2023-11-30',
            description: '道路舗装工事のため全面通行止め',
            severity: 'high',
            isNew: true,
            coordinates: [
              (route.bounds.east + route.bounds.west) / 2,
              (route.bounds.north + route.bounds.south) / 2 + 0.001
            ],
          });
          
          newAlerts.push({
            id: `restr-${Date.now()}-2`,
            routeId: route.id,
            routeName: route.name,
            type: '車線規制',
            location: `${route.name}の西側エリア`,
            startDate: '2023-11-05',
            endDate: '2023-11-20',
            description: '電気工事のため片側交互通行',
            severity: 'medium',
            isNew: true,
            coordinates: [
              (route.bounds.east + route.bounds.west) / 2 - 0.001,
              (route.bounds.north + route.bounds.south) / 2
            ],
          });
        }
      }
      
      // 新旧アラートの統合（実際は前回との差分チェックが必要）
      setAlerts(prev => {
        const existingIds = prev.map(a => a.id);
        const newFilteredAlerts = newAlerts.filter(a => !existingIds.includes(a.id));
        
        // 古いアラートの isNew フラグを更新
        const updatedOldAlerts = prev.map(a => ({...a, isNew: false}));
        
        return [...updatedOldAlerts, ...newFilteredAlerts];
      });
      
      setLastChecked(new Date());
      
      // ブラウザ通知（新規アラートがあり、通知が許可されている場合）
      if (notificationsEnabled && newAlerts.length > 0 && Notification.permission === 'granted') {
        new Notification('通学路に新しい規制情報があります', {
          body: `${newAlerts.length}件の新しい規制情報が検出されました。`,
          icon: '/favicon.ico'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('規制情報の取得中にエラーが発生しました'));
      console.error('規制情報アラートのエラー:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userRoutes, notificationsEnabled]);

  // 初期ロードと定期チェック
  useEffect(() => {
    // 初回データ取得
    fetchAlerts();
    
    // 定期的なデータ更新
    const intervalId = setInterval(fetchAlerts, checkInterval);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [fetchAlerts, checkInterval]);

  // 通知許可の取得
  useEffect(() => {
    if (notificationsEnabled && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, [notificationsEnabled]);

  // アラートの手動更新
  const handleRefresh = () => {
    fetchAlerts();
  };

  // アラートの既読/非表示化
  const handleDismissAlert = (alertId: string) => {
    setDismissedAlertIds(prev => [...prev, alertId]);
  };

  // アラートの表示フィルタリング
  const filteredAlerts = alerts.filter(alert => 
    showDismissedAlerts || !dismissedAlertIds.includes(alert.id)
  );

  // アラートの深刻度に基づく色を取得
  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-800', icon: 'text-red-500' };
      case 'medium': return { bg: 'bg-orange-50', border: 'border-orange-100', text: 'text-orange-800', icon: 'text-orange-500' };
      case 'low': return { bg: 'bg-yellow-50', border: 'border-yellow-100', text: 'text-yellow-800', icon: 'text-yellow-500' };
    }
  };

  return (
    <div className="fixed right-4 top-20 z-50">
      {/* メインボタン */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center space-x-2 px-4 py-2 rounded-full shadow-md ${
          alerts.some(a => a.isNew && !dismissedAlertIds.includes(a.id)) 
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-white text-gray-700'
        }`}
      >
        <AlertCircle size={18} />
        <span className="font-medium">
          {alerts.some(a => a.isNew && !dismissedAlertIds.includes(a.id)) 
            ? `新規規制情報 (${alerts.filter(a => a.isNew && !dismissedAlertIds.includes(a.id)).length})` 
            : '規制情報'}
        </span>
      </button>

      {/* 展開パネル */}
      {isExpanded && (
        <div className="mt-2 w-80 bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="flex justify-between items-center p-3 bg-blue-600 text-white">
            <h3 className="font-medium">通学路規制情報アラート</h3>
            <button onClick={() => setIsExpanded(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="flex justify-between items-center p-2 bg-gray-50 border-b">
            <div className="flex items-center text-xs text-gray-500">
              {lastChecked ? (
                <>最終更新: {lastChecked.toLocaleTimeString()}</>
              ) : (
                <>読み込み中...</>
              )}
            </div>
            <div className="flex space-x-2">
              <button 
                className="p-1 hover:bg-gray-200 rounded"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  className={`${isLoading ? 'animate-spin text-blue-500' : 'text-gray-500'}`}
                >
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
              </button>
              <button 
                className="p-1 hover:bg-gray-200 rounded"
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              >
                {notificationsEnabled ? (
                  <Bell size={16} className="text-blue-500" />
                ) : (
                  <BellOff size={16} className="text-gray-500" />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <div className="p-4 text-center text-red-500 text-sm">
              <AlertCircle size={24} className="mx-auto mb-2" />
              {error.message}
            </div>
          ) : (
            <>
              {filteredAlerts.length > 0 ? (
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {filteredAlerts.map(alert => {
                    const severityColors = getSeverityColor(alert.severity);
                    return (
                      <div 
                        key={alert.id}
                        className={`p-3 border-b ${severityColors.bg} ${severityColors.border} ${alert.isNew ? 'border-l-4 border-l-red-500' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => onAlertClick && onAlertClick(alert)}
                          >
                            <div className="font-medium flex items-center">
                              {alert.type}
                              {alert.isNew && (
                                <span className="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                                  新規
                                </span>
                              )}
                            </div>
                            <div className="text-xs mt-1 flex items-center">
                              <MapPin size={12} className="mr-1" />
                              {alert.location}
                            </div>
                            <div className="text-xs mt-1 text-gray-500">
                              期間: {alert.startDate} 〜 {alert.endDate}
                            </div>
                            <div className="text-xs mt-1">
                              {alert.description}
                            </div>
                          </div>
                          <button 
                            className="p-1 hover:bg-gray-200 rounded ml-2"
                            onClick={() => handleDismissAlert(alert.id)}
                          >
                            <Check size={16} className="text-gray-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  {dismissedAlertIds.length > 0 && !showDismissedAlerts ? (
                    <>
                      <div className="text-sm mb-2">表示されている規制情報はありません</div>
                      <button 
                        className="text-xs text-blue-500 hover:underline"
                        onClick={() => setShowDismissedAlerts(true)}
                      >
                        既読の規制情報を表示
                      </button>
                    </>
                  ) : (
                    <div className="text-sm">
                      現在、通学路に規制情報はありません
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="p-2 border-t bg-gray-50 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {dismissedAlertIds.length > 0 && (
                <button 
                  className="hover:underline"
                  onClick={() => setShowDismissedAlerts(!showDismissedAlerts)}
                >
                  {showDismissedAlerts ? '既読を非表示' : '既読を表示'} ({dismissedAlertIds.length})
                </button>
              )}
            </div>
            <a 
              href="https://www.xroad.mlit.go.jp/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-500 flex items-center hover:underline"
            >
              詳細情報
              <ExternalLink size={12} className="ml-1" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default RestrictionAlerts; 