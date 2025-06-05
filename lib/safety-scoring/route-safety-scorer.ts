/**
 * 通学路の安全度スコアリングモジュール
 * xROADデータとユーザー報告を組み合わせて安全度を評価
 */

// 安全度スコアの重み付け係数
const WEIGHT_TRAFFIC_VOLUME = 0.4; // 交通量の重み
const WEIGHT_RESTRICTIONS = 0.2;   // 規制情報の重み
const WEIGHT_USER_REPORTS = 0.3;   // ユーザー報告の重み
const WEIGHT_INFRASTRUCTURE = 0.1; // インフラ（信号、横断歩道など）の重み

// 危険度レベルの閾値
const DANGER_LEVEL_HIGH = 70;
const DANGER_LEVEL_MEDIUM = 40;

// 時間帯の係数（登下校時間帯は重要度が高い）
const TIME_FACTOR: Record<string, number> = {
  'morning': 1.2,  // 7:00-9:00
  'noon': 0.8,     // 11:00-13:00
  'afternoon': 1.1 // 14:00-16:00
};

// 道路タイプの係数
const ROAD_TYPE_FACTOR: Record<string, number> = {
  'primary': 1.5,    // 幹線道路
  'secondary': 1.2,  // 準幹線道路
  'residential': 0.8,// 住宅街道路
  'footway': 0.3     // 歩道
};

export interface RouteSegment {
  id: string;
  coordinates: [number, number][];
  roadType?: string;
  trafficVolume?: number;
  restrictions?: any[];
  dangerReports?: any[];
  infrastructures?: any[];
}

export interface SafetyScore {
  overallScore: number;
  dangerLevel: 'high' | 'medium' | 'low';
  segmentScores: {
    segmentId: string;
    score: number;
    factors: {
      trafficVolume: number;
      restrictions: number;
      userReports: number;
      infrastructure: number;
    };
  }[];
  recommendations: string[];
}

/**
 * 指定された通学路の安全度スコアを計算
 */
export async function calculateRouteSafetyScore(
  routeSegments: RouteSegment[],
  timeOfDay: 'morning' | 'noon' | 'afternoon' = 'morning'
): Promise<SafetyScore> {
  // 各セグメントのスコアを計算
  const segmentScores = await Promise.all(
    routeSegments.map(async segment => {
      // 交通量データのスコアリング（xROADデータを使用）
      const trafficScore = await calculateTrafficScore(segment, timeOfDay);
      
      // 規制情報のスコアリング
      const restrictionScore = calculateRestrictionScore(segment);
      
      // ユーザー報告に基づくスコアリング
      const userReportScore = calculateUserReportScore(segment);
      
      // インフラ状況に基づくスコアリング
      const infrastructureScore = calculateInfrastructureScore(segment);
      
      // 総合スコアの計算（0-100、高いほど危険）
      const weightedScore = 
        trafficScore * WEIGHT_TRAFFIC_VOLUME +
        restrictionScore * WEIGHT_RESTRICTIONS +
        userReportScore * WEIGHT_USER_REPORTS +
        infrastructureScore * WEIGHT_INFRASTRUCTURE;
      
      return {
        segmentId: segment.id,
        score: Math.min(Math.round(weightedScore), 100),
        factors: {
          trafficVolume: trafficScore,
          restrictions: restrictionScore,
          userReports: userReportScore,
          infrastructure: infrastructureScore
        }
      };
    })
  );
  
  // ルート全体の総合スコアを計算
  const overallScore = Math.round(
    segmentScores.reduce((sum, segment) => sum + segment.score, 0) / segmentScores.length
  );
  
  // 危険度レベルの判定
  let dangerLevel: 'high' | 'medium' | 'low';
  if (overallScore >= DANGER_LEVEL_HIGH) {
    dangerLevel = 'high';
  } else if (overallScore >= DANGER_LEVEL_MEDIUM) {
    dangerLevel = 'medium';
  } else {
    dangerLevel = 'low';
  }
  
  // 安全性向上のための推奨事項を生成
  const recommendations = generateSafetyRecommendations(segmentScores, timeOfDay);
  
  return {
    overallScore,
    dangerLevel,
    segmentScores,
    recommendations
  };
}

/**
 * 交通量に基づくスコアを計算（高いほど危険）
 */
async function calculateTrafficScore(segment: RouteSegment, timeOfDay: string): Promise<number> {
  // 既にセグメントに交通量データがある場合はそれを使用
  if (segment.trafficVolume !== undefined) {
    // 交通量の正規化（例: 0-2000台を0-100のスコアに変換）
    let score = Math.min(segment.trafficVolume / 20, 100);
    
    // 道路タイプによる調整
    if (segment.roadType && ROAD_TYPE_FACTOR[segment.roadType]) {
      score *= ROAD_TYPE_FACTOR[segment.roadType];
    }
    
    // 時間帯による調整
    if (TIME_FACTOR[timeOfDay]) {
      score *= TIME_FACTOR[timeOfDay];
    }
    
    return Math.min(Math.round(score), 100);
  }
  
  // セグメントに交通量データがない場合はxROAD APIから取得（デモでは固定値を返す）
  try {
    // 実際のロジックではこの部分でAPIリクエストを行う
    // ここではサンプルとして固定値を返す
    const baseScore = 
      segment.roadType === 'primary' ? 75 :
      segment.roadType === 'secondary' ? 60 :
      segment.roadType === 'residential' ? 30 : 20;
    
    return Math.min(Math.round(baseScore * (TIME_FACTOR[timeOfDay] || 1)), 100);
  } catch (error) {
    console.error('交通量スコア計算エラー:', error);
    return 50; // デフォルト値
  }
}

/**
 * 規制情報に基づくスコアを計算（高いほど危険）
 */
function calculateRestrictionScore(segment: RouteSegment): number {
  if (!segment.restrictions || segment.restrictions.length === 0) {
    return 0; // 規制なし
  }
  
  // 規制タイプごとの危険度
  const restrictionDanger = {
    'roadClosure': 100,        // 通行止め
    'laneRestriction': 70,     // 車線規制
    'speedRestriction': 50,    // 速度制限
    'constructionWork': 80,    // 工事
    'temporaryEvent': 60       // 一時的なイベント
  };
  
  // 最も危険な規制のスコアを使用
  return Math.max(
    ...segment.restrictions.map((r: any) => {
      const type = r.type || 'temporaryEvent';
      return restrictionDanger[type as keyof typeof restrictionDanger] || 50;
    })
  );
}

/**
 * ユーザー報告に基づくスコアを計算（高いほど危険）
 */
function calculateUserReportScore(segment: RouteSegment): number {
  if (!segment.dangerReports || segment.dangerReports.length === 0) {
    return 0; // 報告なし
  }
  
  // 報告のタイプと件数を考慮した重み付けスコアリング
  const typeDanger = {
    'traffic': 80,      // 交通関連の危険
    'crime': 90,        // 犯罪関連の危険
    'infrastructure': 70, // インフラ関連の問題
    'other': 50         // その他
  };
  
  // 報告の深刻度と件数による加重平均
  const totalWeight = segment.dangerReports.length;
  const weightedSum = segment.dangerReports.reduce((sum, report: any) => {
    const type = report.type || 'other';
    const baseScore = typeDanger[type as keyof typeof typeDanger] || 50;
    const severityMultiplier = report.severity === 'high' ? 1.5 : 
                              report.severity === 'medium' ? 1.0 : 0.7;
    
    return sum + (baseScore * severityMultiplier);
  }, 0);
  
  return Math.min(Math.round(weightedSum / totalWeight), 100);
}

/**
 * インフラ状況に基づくスコアを計算（高いほど危険）
 */
function calculateInfrastructureScore(segment: RouteSegment): number {
  if (!segment.infrastructures || segment.infrastructures.length === 0) {
    return 50; // デフォルト値（インフラ情報なし）
  }
  
  // 安全インフラの存在を考慮してスコア減算
  let baseScore = 70; // デフォルトのスコア
  
  // インフラごとの安全性向上効果
  segment.infrastructures.forEach((infra: any) => {
    switch (infra.type) {
      case 'trafficLight':
        baseScore -= 30; // 信号機は安全性を高める
        break;
      case 'crosswalk':
        baseScore -= 20; // 横断歩道は安全性を高める
        break;
      case 'guardrail':
        baseScore -= 15; // ガードレールは安全性を高める
        break;
      case 'sidewalk':
        baseScore -= 25; // 歩道は安全性を高める
        break;
      case 'schoolZone':
        baseScore -= 35; // スクールゾーンは安全性を高める
        break;
    }
  });
  
  return Math.max(Math.round(baseScore), 0);
}

/**
 * 安全性向上のための推奨事項を生成
 */
function generateSafetyRecommendations(segmentScores: any[], timeOfDay: string): string[] {
  const recommendations: string[] = [];
  
  // 危険性の高いセグメントを特定
  const dangerousSegments = segmentScores.filter(s => s.score >= DANGER_LEVEL_HIGH);
  
  if (dangerousSegments.length > 0) {
    recommendations.push(`通学路内に${dangerousSegments.length}箇所の高リスクエリアがあります。可能であれば代替ルートの検討をお勧めします。`);
  }
  
  // 交通量に関する推奨事項
  const highTrafficSegments = segmentScores.filter(s => s.factors.trafficVolume >= 70);
  if (highTrafficSegments.length > 0) {
    recommendations.push(`交通量が多いエリアでは特に注意が必要です。特に${timeOfDay === 'morning' ? '朝の登校時' : timeOfDay === 'afternoon' ? '下校時' : '昼間'}は交通量が増加します。`);
  }
  
  // 規制情報に関する推奨事項
  const restrictedSegments = segmentScores.filter(s => s.factors.restrictions > 0);
  if (restrictedSegments.length > 0) {
    recommendations.push('通行規制や工事情報を定期的に確認してください。迂回路が必要になる場合があります。');
  }
  
  // インフラに関する推奨事項
  const poorInfraSegments = segmentScores.filter(s => s.factors.infrastructure >= 60);
  if (poorInfraSegments.length > 0) {
    recommendations.push('横断歩道や信号機のある安全な場所で道路を横断してください。');
  }
  
  // 基本的な安全推奨事項を追加
  recommendations.push('常に周囲の状況に注意し、交通ルールを守って通行してください。');
  
  if (timeOfDay === 'morning' || timeOfDay === 'afternoon') {
    recommendations.push('可能であれば集団登下校を利用してください。');
  }
  
  return recommendations;
}

export default {
  calculateRouteSafetyScore,
}; 