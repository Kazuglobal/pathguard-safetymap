# PathGuardian 統合実装ガイド v4

## 最新状況（2025/02/20時点）

### DB: traffic_accidents テーブル（153万件, 2019-2023年, 72カラム）
- PostGIS GIST空間インデックス付き
- `get_nearby_accident_stats()` v3 関数デプロイ済み（半径検索 <100ms）

### DB関数 v3 が返すデータ:
```
基本統計: total_accidents, total_fatalities, total_injuries, child_involved, pedestrian_involved, fatal_accidents
年度別: by_year
時間帯別: by_time_of_day (通学/下校/夕方/その他)
天候別: by_weather
事故類型別: by_accident_type
★NEW 当事者種別: by_party_type (普通車/軽自動車/自転車/歩行者等、A+B合算)
★NEW 路面状態: by_road_surface (乾燥/湿潤/凍結/積雪)
★NEW 地形: by_terrain (市街地/非市街地)
★NEW 損傷程度: injury_analysis { by_injury_level, severe_ratio }
道路環境: road_environment { by_road_shape, by_sidewalk, intersection_ratio, no_sidewalk_ratio }
当事者分析: party_analysis { by_age_group, elderly_ratio, young_ratio }
時間分析: time_analysis { by_hour(24h), by_month(12m), peak_hour, peak_month }
状況サマリー: situation_summary (自然言語テキスト7項目)
事故詳細: nearest_accidents (最寄り10件、当事者種別/損傷程度/路面状態含む)
リスクスコア: risk_score (0-100)
```

---

## フロントエンド配置ファイル（4ファイル）

```
src/
├── lib/
│   └── traffic-accident-data.ts    ← v4型定義 + RPC呼び出し
├── hooks/
│   └── use-accident-stats.ts       ← React Hook（状態管理）
└── components/
    └── accident-stats-panel.tsx     ← v4 UI（6タブ: 概要/道路環境/当事者/安全分析/時間帯/事故詳細）
```

## Claude Codeへのプロンプト

```
pathguard-safetymapリポジトリに交通事故統計データの表示機能を統合してください。

## 配置するファイル（Claude.aiからダウンロード済み）

1. src/lib/traffic-accident-data.ts - Supabase RPC呼び出し＋型定義（v4）
2. src/hooks/use-accident-stats.ts - React Hook
3. src/components/accident-stats-panel.tsx - 統計表示パネル（v4、6タブ）

## 統合箇所

### A. 地図ページ（地点クリック時に事故統計表示）
```tsx
import { useAccidentStats } from "@/hooks/use-accident-stats";
import AccidentStatsPanel from "@/components/accident-stats-panel";

const { stats, fetchStats, hasData, isLoading } = useAccidentStats();

// 地図クリック時
fetchStats({ latitude: lat, longitude: lng, radiusMeters: 300, years: 5 });

// JSX
{isLoading && <p>事故データ取得中...</p>}
{hasData && stats && <AccidentStatsPanel stats={stats} mode="full" />}
```

### B. 危険箇所レポートフォーム（位置選択時に事故統計自動取得）
```tsx
{hasData && stats && <AccidentStatsPanel stats={stats} mode="compact" />}
```

## 重要な注意点
- 既存のコードスタイル（shadcn/ui, Tailwind, "use client"）に従う
- 既存の機能（Gemini画像生成、VLM分析、災害シミュレーション等）は一切変更しない
- supabaseクライアントは既存の `@/lib/supabase/client` を使う
- 分析パネルの6タブ: 概要 / 道路環境 / 当事者 / 安全分析(NEW) / 時間帯 / 事故詳細
- 安全分析タブ: 当事者種別別グラフ、損傷程度グラフ（色分け）、路面状態グラフ、地形区分
```

---

## DB構造（参考）

### traffic_accidents テーブル主要カラム:
基本: id, source_year, source_pref_code, latitude, longitude, location(PostGIS)
事故情報: severity_code, fatalities, injuries, accident_type_label, weather_label
道路環境: road_shape_label, sidewalk_label, road_surface_label, terrain_label
当事者A: party_a_type_label, party_a_age, injury_level_a, vehicle_shape_a, speed_limit_a
当事者B: party_b_type_label, party_b_type_code, party_b_age, injury_level_b

### VLM関連テーブル（既存）:
- vlm_hazard_analyses: 画像AI分析結果
- hazard_categories: 15種類の危険カテゴリ

### Edge Function（既存）:
- analyze-hazard: Claude Haiku 4.5 Vision による画像分析

## 確認項目
1. `npm run build` がエラーなく通ること
2. 地図クリック → 事故統計パネルが表示されること
3. 6タブすべてが正常に表示されること（特に安全分析タブ）
4. compact modeでサイドバー内に収まること
5. 事故0件エリアで「事故なし」表示が出ること
