# PathGuardian SAM 3 × Gemini 統合 — エージェントチーム定義書

## プロジェクト概要

通学路安全プラットフォーム「PathGuardian」に SAM 3（Meta）による画像セグメンテーションと
Gemini API による高次推論を統合し、定量的な危険度解析システムを構築する。

**TDD駆動**: 全実装は Red → Green → Refactor サイクルで進行。テストは変更しない。

---

## エージェントチーム全体像

```
┌──────────────────────────────────────────────────────────────────┐
│                    PathGuardian Agent Team                        │
│                                                                  │
│  ━━━ 指揮層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  🎯 A0: Project Orchestrator (TDD Workflow統合)                  │
│                                                                  │
│  ━━━ 設計層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  📋 A1: Issue Analyzer        — 要件分析                         │
│  🏗️ A2: Architecture Designer  — アーキテクチャ設計               │
│                                                                  │
│  ━━━ テスト層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  🎯 A3: Test Designer          — テストケース設計 (Opus)          │
│  🧪 A4: Test Implementer       — テストコード実装                 │
│  🔴 A5: Test Runner             — テスト実行・Red/Green確認        │
│                                                                  │
│  ━━━ 実装層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  👁️ A6: Vision Implementer     — SAM 3 検出モジュール実装        │
│  🧠 A7: Think Implementer      — Gemini API 推論モジュール実装   │
│  📊 A8: Score Implementer      — スコアリングエンジン実装         │
│  🗺️ A9: Map Implementer        — 地図可視化モジュール実装         │
│  📝 A10: Report Implementer    — レポート生成モジュール実装       │
│  🔗 A11: Integration Implementer — パイプライン統合実装           │
│                                                                  │
│  ━━━ 品質層 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  🔍 A12: Code Reviewer         — コードレビュー (Opus)            │
│  🔒 A13: Security Auditor      — セキュリティ監査                 │
│  📄 A14: PR Composer            — PR作成・ドキュメント (Opus)      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 各エージェント仕様

### ━━━ 指揮層 ━━━

### A0: Project Orchestrator（プロジェクト指揮者）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet（状態管理・タスクルーティング） |
| **役割** | 全エージェントの調整、TDDサイクル管理、進捗追跡 |
| **責務** | Issue → テスト設計 → Red → 実装 → Green → レビュー → PR の全フロー制御 |

```python
class ProjectOrchestrator:
    """
    TDDワークフローに基づくプロジェクト全体の指揮
    
    フロー:
    1. A1(Issue Analyzer) + A2(Architecture Designer) を並列実行
    2. A3(Test Designer) でテスト設計
    3. A4(Test Implementer) でテストコード実装
    4. A5(Test Runner) で Red確認 — 全テスト失敗を確認
    5. A6-A11(各Implementer) で機能実装
    6. A5(Test Runner) で Green確認 — 全テストパスまでループ
    7. A12(Code Reviewer) + A13(Security Auditor) でレビュー
    8. A14(PR Composer) でPR作成
    """
    
    IMPLEMENTATION_ORDER = [
        "A6:Vision",      # SAM 3コア（他の全モジュールの基盤）
        "A7:Think",       # Gemini推論（Visionの出力を消費）
        "A8:Score",       # スコアリング（Vision+Thinkを統合）
        "A9:Map",         # 地図可視化（Scoreの出力を表示）
        "A10:Report",     # レポート生成（全結果を文書化）
        "A11:Integration" # パイプライン統合（全モジュール接続）
    ]
    
    def get_phase_dependencies(self):
        return {
            "A1+A2": [],                    # 並列・依存なし
            "A3":    ["A1", "A2"],          # 要件+設計が必要
            "A4":    ["A3"],                # テスト設計が必要
            "A5_red": ["A4"],               # テストコードが必要
            "A6":    ["A5_red"],            # Red確認後に実装開始
            "A7":    ["A6"],                # Vision出力の型定義が必要
            "A8":    ["A6", "A7"],          # 両方の出力型が必要
            "A9":    ["A8"],                # スコアデータが必要
            "A10":   ["A8"],                # スコアデータが必要（A9と並列可）
            "A11":   ["A6","A7","A8","A9","A10"],  # 全モジュール完了後
            "A5_green": ["A11"],            # 統合完了後にGreen確認
            "A12+A13": ["A5_green"],        # 全テストパス後にレビュー
            "A14":   ["A12", "A13"]         # レビュー完了後にPR
        }
```

**状態管理:**
```yaml
workflow_state:
  issue_id: int
  current_phase: string
  tdd_cycle:
    red_confirmed: bool           # 全テスト失敗を確認済み
    green_attempts: int           # Green達成の試行回数
    green_confirmed: bool         # 全テストパスを確認済み
    failed_tests_per_attempt: list[int]  # 各試行での失敗テスト数
  module_status:
    vision: pending|implementing|tested|done
    think: pending|implementing|tested|done
    score: pending|implementing|tested|done
    map: pending|implementing|tested|done
    report: pending|implementing|tested|done
    integration: pending|implementing|tested|done
  quality_gates:
    coverage: float               # >= 80%
    all_tests_pass: bool
    lint_pass: bool
    security_pass: bool
    review_approved: bool
```

---

### ━━━ 設計層 ━━━

### A1: Issue Analyzer（要件分析エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **入力** | GitHub Issue / ユーザー要件テキスト |
| **出力** | 構造化された要件定義 |

```yaml
output_schema:
  functional_requirements:
    - id: "FR-001"
      title: "SAM 3テキストプロンプトによる安全設備検出"
      description: "画像入力に対しテキストプロンプトで安全設備を検出しマスクデータを返す"
      acceptance_criteria:
        - "guardrail検出時にマスク面積・位置情報を返すこと"
        - "未検出時にNone/空リストを返すこと"
        - "confidence閾値でフィルタリングできること"
      priority: high
      module: vision
      
  non_functional_requirements:
    - id: "NFR-001"
      title: "画像処理速度"
      description: "1画像あたり5秒以内で全カテゴリの検出を完了"
      
  external_dependencies:
    - name: "ultralytics"
      version: ">=8.3.237"
      purpose: "SAM 3モデル実行"
    - name: "google-generativeai"
      version: ">=0.8.0"
      purpose: "Gemini API呼び出し"
    - name: "opencv-python"
      version: ">=4.8.0"
      purpose: "画像処理・可視化"
      
  module_boundaries:
    - module: vision
      responsibility: "SAM 3による物体検出・セグメンテーション"
      inputs: ["image_path: str", "prompts: list[str]"]
      outputs: ["DetectionResult(masks, boxes, counts, coverage)"]
    - module: think
      responsibility: "Gemini APIによる文脈的リスク推論"
      inputs: ["image_path: str", "vision_data: DetectionResult"]
      outputs: ["ThinkResult(contextual_risks, priorities, latent_risks)"]
    - module: score
      responsibility: "定量的安全スコア算出"
      inputs: ["vision_data: DetectionResult", "think_data: ThinkResult"]
      outputs: ["SafetyScore(score, level, breakdown)"]
    - module: map
      responsibility: "地図上へのスコアマッピング"
      inputs: ["scores: list[SafetyScore]", "gps_coords: list[LatLng]"]
      outputs: ["MapData(markers, heatmap)"]
    - module: report
      responsibility: "目的別レポート生成"
      inputs: ["all_data: AnalysisResult"]
      outputs: ["Report(pdf_path, summary)"]
    - module: integration
      responsibility: "全モジュールのパイプライン接続"
      inputs: ["image_path: str", "config: AnalysisConfig"]
      outputs: ["FullAnalysisResult"]
```

---

### A2: Architecture Designer（アーキテクチャ設計エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | opus 4.6 |
| **入力** | A1の要件定義 |
| **出力** | プロジェクト構造、データ型定義、インターフェース設計 |

```yaml
output_schema:
  project_structure:
    pathguardian/
      __init__.py
      config.py                    # 設定・定数
      types.py                     # 共通データ型（全モジュール共有）
      agents/
        __init__.py
        vision_agent.py            # A6が実装
        think_agent.py             # A7が実装
        score_agent.py             # A8が実装
        map_agent.py               # A9が実装
        report_agent.py            # A10が実装
      pipeline/
        __init__.py
        orchestrator.py            # A11が実装
        config.py                  # パイプライン設定
      utils/
        __init__.py
        image_utils.py             # 画像処理ユーティリティ
        mask_utils.py              # マスク演算ユーティリティ
    tests/
      __init__.py
      conftest.py                  # 共通フィクスチャ
      fixtures/                    # テスト用画像・データ
        sample_school_route.jpg
        sample_detection.json
        expected_scores.json
      unit/
        test_vision_agent.py
        test_think_agent.py
        test_score_agent.py
        test_map_agent.py
        test_report_agent.py
      integration/
        test_vision_think_pipeline.py
        test_full_pipeline.py
      e2e/
        test_single_image_analysis.py

  data_types: |
    # types.py - 全モジュール共通型定義
    
    @dataclass
    class DetectionItem:
        category: str           # "guardrail", "crosswalk", etc.
        count: int
        masks: Optional[np.ndarray]
        boxes: Optional[np.ndarray]
        coverage_ratio: float   # 画像面積に対する割合
        positions: list[dict]   # [{"x": int, "y": int, "w": int, "h": int}]
    
    @dataclass
    class DetectionResult:
        safety_equipment: dict[str, DetectionItem]
        hazards: dict[str, DetectionItem]
        traffic: dict[str, DetectionItem]
        obstructions: dict[str, DetectionItem]
        image_shape: tuple[int, int]
        inference_time_ms: float
    
    @dataclass
    class ContextualRisk:
        description: str
        severity: str           # "high", "medium", "low"
        related_detections: list[str]
    
    @dataclass  
    class ThinkResult:
        contextual_risks: list[ContextualRisk]
        priority_improvements: list[str]
        latent_risks: list[str]
        child_perspective_risks: list[str]
        raw_response: str
    
    @dataclass
    class ScoreBreakdown:
        item: str
        points: int
        reason: str
    
    @dataclass
    class SafetyScore:
        score: int              # 0-100
        level: str              # "safe", "caution", "warning", "danger"
        breakdown: list[ScoreBreakdown]
        detection_summary: dict
        think_summary: dict
    
    @dataclass
    class MapMarker:
        lat: float
        lng: float
        score: SafetyScore
        annotated_image_path: Optional[str]
    
    @dataclass
    class FullAnalysisResult:
        image_path: str
        detection: DetectionResult
        thinking: ThinkResult
        score: SafetyScore
        map_marker: Optional[MapMarker]
        report_path: Optional[str]
        analysis_timestamp: str

  interfaces: |
    # 各モジュールが実装すべきインターフェース（Protocol）
    
    class VisionAgentProtocol(Protocol):
        def analyze_image(self, image_path: str) -> DetectionResult: ...
        def detect_category(self, image_path: str, prompts: list[str]) -> list[DetectionItem]: ...
    
    class ThinkAgentProtocol(Protocol):
        def analyze(self, image_path: str, vision_data: DetectionResult) -> ThinkResult: ...
    
    class ScoreAgentProtocol(Protocol):
        def calculate(self, vision_data: DetectionResult, think_data: ThinkResult) -> SafetyScore: ...
    
    class MapAgentProtocol(Protocol):
        def generate_marker(self, score: SafetyScore, lat: float, lng: float) -> MapMarker: ...
        def generate_heatmap(self, markers: list[MapMarker]) -> dict: ...
    
    class ReportAgentProtocol(Protocol):
        def generate(self, result: FullAnalysisResult, report_type: str) -> str: ...
```

---

### ━━━ テスト層 ━━━

### A3: Test Designer（テスト設計エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | **Opus**（高品質な設計判断） |
| **入力** | A1の要件 + A2のアーキテクチャ |
| **出力** | Given-When-Then形式のテスト計画 |
| **原則** | FIRST原則、テストは**一度書いたら変更しない** |

**設計対象テストスイート:**

```yaml
test_suites:
  # ===== Unit Tests (60-70%) =====
  
  - name: "test_vision_agent"
    file: "tests/unit/test_vision_agent.py"
    cases:
      # --- Happy Path ---
      - name: "test_detect_guardrail_returns_detection_result"
        given: "通学路画像にガードレールが2つ存在する"
        when: "detect_category('guardrail')を実行"
        then: "count=2, coverage_ratio>0, masks.shape[0]==2"
        
      - name: "test_detect_multiple_categories_returns_all"
        given: "通学路画像に信号機1つと横断歩道1つが存在する"
        when: "analyze_image()を実行"
        then: "safety_equipment に traffic_light と crosswalk が含まれる"
        
      - name: "test_analyze_image_returns_complete_detection_result"
        given: "有効な通学路画像"
        when: "analyze_image()を実行"
        then: "DetectionResult に全4カテゴリのキーが存在する"
        
      # --- Edge Cases ---
      - name: "test_no_detection_returns_zero_count"
        given: "何も写っていない白い画像"
        when: "detect_category('guardrail')を実行"
        then: "count=0, masks=None, coverage_ratio=0.0"
        
      - name: "test_confidence_threshold_filters_low_confidence"
        given: "conf=0.8 で初期化"
        when: "低信頼度の検出がある画像を処理"
        then: "conf未満の検出は結果に含まれない"
        
      # --- Error Cases ---
      - name: "test_invalid_image_path_raises_file_not_found"
        given: "存在しないファイルパス"
        when: "analyze_image()を実行"
        then: "FileNotFoundError が発生"
        
      - name: "test_corrupted_image_raises_value_error"
        given: "破損した画像ファイル"
        when: "analyze_image()を実行"
        then: "ValueError が発生"
        
      - name: "test_empty_prompt_list_raises_value_error"
        given: "空のプロンプトリスト"
        when: "detect_category([])を実行"
        then: "ValueError が発生"

  - name: "test_think_agent"
    file: "tests/unit/test_think_agent.py"
    cases:
      - name: "test_analyze_returns_think_result"
        given: "有効な画像パスと DetectionResult"
        when: "analyze()を実行"
        then: "ThinkResult が返る（contextual_risks は list）"
        
      - name: "test_no_guardrail_triggers_contextual_risk"
        given: "ガードレール未検出の DetectionResult"
        when: "analyze()を実行"
        then: "contextual_risks に歩行者安全に関するリスクが含まれる"
        
      - name: "test_high_traffic_triggers_priority_improvement"
        given: "車両8台検出の DetectionResult"
        when: "analyze()を実行"
        then: "priority_improvements が空でない"
        
      - name: "test_gemini_api_failure_raises_connection_error"
        given: "Gemini APIがタイムアウト"
        when: "analyze()を実行"
        then: "ConnectionError が発生"
        
      - name: "test_gemini_response_parsing_handles_malformed_json"
        given: "Gemini APIが不正なJSON文字列を返す"
        when: "analyze()を実行"
        then: "デフォルトのThinkResultが返る（クラッシュしない）"

  - name: "test_score_agent"
    file: "tests/unit/test_score_agent.py"
    cases:
      - name: "test_perfect_safety_returns_100"
        given: "全安全設備検出、危険要素なし、交通リスクなし"
        when: "calculate()を実行"
        then: "score=100, level='safe'"
        
      - name: "test_no_guardrail_deducts_20_points"
        given: "ガードレール未検出"
        when: "calculate()を実行"
        then: "breakdown にガードレール -20 が含まれる"
        
      - name: "test_multiple_hazards_accumulate_penalty"
        given: "工事現場2つ + 壊れたフェンス1つ"
        when: "calculate()を実行"
        then: "hazard関連で -30（10×3）減点"
        
      - name: "test_score_never_below_zero"
        given: "極端に危険な全条件"
        when: "calculate()を実行"
        then: "score >= 0"
        
      - name: "test_score_never_above_100"
        given: "完璧な安全条件"
        when: "calculate()を実行"
        then: "score <= 100"
        
      - name: "test_level_boundaries"
        given: "スコアが80, 79, 60, 59, 40, 39の各ケース"
        when: "calculate()を実行"
        then: "80→safe, 79→caution, 60→caution, 59→warning, 40→warning, 39→danger"
        
      - name: "test_contextual_risk_adds_penalty"
        given: "ThinkResult に severity=high のリスク2件"
        when: "calculate()を実行"
        then: "文脈リスクによる追加減点がbreakdownに含まれる"

  - name: "test_map_agent"
    file: "tests/unit/test_map_agent.py"
    cases:
      - name: "test_generate_marker_returns_valid_marker"
        given: "SafetyScore と GPS座標"
        when: "generate_marker()を実行"
        then: "MapMarker の lat, lng, score が正しい"
        
      - name: "test_generate_heatmap_with_multiple_markers"
        given: "5つの異なるスコアのMarker"
        when: "generate_heatmap()を実行"
        then: "heatmapデータにmarkers全件が反映"
        
      - name: "test_invalid_gps_raises_value_error"
        given: "lat=999, lng=-999"
        when: "generate_marker()を実行"
        then: "ValueError が発生"

  - name: "test_report_agent"
    file: "tests/unit/test_report_agent.py"
    cases:
      - name: "test_generate_parent_report"
        given: "FullAnalysisResult"
        when: "generate(report_type='parent')を実行"
        then: "文字列が返り、スコアと主要リスクが含まれる"
        
      - name: "test_generate_municipality_report"
        given: "FullAnalysisResult"
        when: "generate(report_type='municipality')を実行"
        then: "定量データが全て含まれた文字列が返る"
        
      - name: "test_invalid_report_type_raises_value_error"
        given: "存在しないレポートタイプ"
        when: "generate(report_type='invalid')を実行"
        then: "ValueError が発生"

  # ===== Integration Tests (20-30%) =====
  
  - name: "test_vision_think_pipeline"
    file: "tests/integration/test_vision_think_pipeline.py"
    cases:
      - name: "test_vision_output_flows_into_think_agent"
        given: "通学路画像"
        when: "VisionAgent → ThinkAgent の順で実行"
        then: "ThinkResultのrelated_detectionsがVision検出結果を参照"
        
      - name: "test_vision_think_score_pipeline"
        given: "通学路画像"
        when: "Vision → Think → Score の順で実行"
        then: "SafetyScore.detection_summaryがVision結果と一致"

  - name: "test_full_pipeline"
    file: "tests/integration/test_full_pipeline.py"
    cases:
      - name: "test_orchestrator_executes_all_modules_in_order"
        given: "有効な画像パスとコンフィグ"
        when: "Orchestrator.run()を実行"
        then: "FullAnalysisResult の全フィールドが非None"
        
      - name: "test_orchestrator_handles_vision_failure_gracefully"
        given: "SAM 3が利用不可（モデル未ロード）"
        when: "Orchestrator.run()を実行"
        then: "適切なエラーメッセージでModelNotLoadedError発生"
        
      - name: "test_orchestrator_handles_gemini_failure_gracefully"
        given: "Gemini APIが503を返す"
        when: "Orchestrator.run()を実行"
        then: "Thinkなしの部分結果を返す（score算出はVisionのみで可能）"

  # ===== E2E Tests (5-10%) =====
  
  - name: "test_single_image_analysis"
    file: "tests/e2e/test_single_image_analysis.py"
    cases:
      - name: "test_end_to_end_school_route_photo"
        given: "実際の通学路写真 + GPS座標"
        when: "完全なパイプラインを実行"
        then: "FullAnalysisResult が返り score が 0-100 の範囲内"

  coverage_target: 80%
  test_count_estimate:
    unit: 28
    integration: 5
    e2e: 1
    total: 34
```

---

### A4: Test Implementer（テスト実装エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **入力** | A3のテスト計画 + A2のデータ型定義 |
| **出力** | 実行可能なPythonテストコード |
| **ルール** | **pytest使用、conftest.pyで共通フィクスチャ管理** |

```python
# 実装時の指針
"""
- SAM 3 / Gemini API呼び出しは全てモック化
- テスト用フィクスチャ:
    - sample_image_path: テスト用画像のパス
    - mock_detection_result: 既知の検出結果
    - mock_think_result: 既知の推論結果
    - mock_sam3_predictor: SAM3SemanticPredictorのモック
    - mock_gemini_model: Gemini APIモデルのモック
- numpy配列の比較は np.testing.assert_array_equal 使用
- 外部API呼び出しテストは unittest.mock.patch 使用
"""
```

---

### A5: Test Runner（テスト実行エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **入力** | テストコード + プロダクションコード |
| **出力** | テスト結果（pass/fail、カバレッジ） |
| **コマンド** | `pytest tests/ -v --tb=short --cov=pathguardian --cov-report=term-missing` |

```yaml
red_check:
  expectation: "全テスト失敗（まだ実装がないため）"
  validation:
    - "ImportError は許容（モジュール未作成）"
    - "NotImplementedError は許容"
    - "テスト自体のSyntaxErrorは不許容 → A4に差し戻し"
    
green_check:
  expectation: "全テストパス"
  validation:
    - "failed == 0"
    - "coverage >= 80%"
    - "warnings は許容するが記録"
  on_failure:
    - "失敗テスト一覧を該当Implementerに返却"
    - "最大3回リトライ"
    - "3回失敗で人間にエスカレーション"
```

---

### ━━━ 実装層 ━━━

### A6: Vision Implementer（SAM 3 検出モジュール）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/agents/vision_agent.py`, `pathguardian/utils/mask_utils.py` |
| **外部依存** | ultralytics (SAM 3), opencv-python, numpy |
| **テスト対象** | `tests/unit/test_vision_agent.py` の全テストをパスさせる |

```python
class VisionAgent:
    """
    実装すべきメソッド:
    - __init__(conf: float, model_path: str, half: bool)
    - analyze_image(image_path: str) -> DetectionResult
    - detect_category(image_path: str, prompts: list[str]) -> list[DetectionItem]
    - _calc_coverage(masks, image_shape) -> float
    - _extract_positions(boxes) -> list[dict]
    
    モック境界:
    - SAM3SemanticPredictor はテスト時にモック
    - cv2.imread はテスト時にモック（テスト画像を返す）
    """
```

### A7: Think Implementer（Gemini推論モジュール）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/agents/think_agent.py` |
| **外部依存** | google-generativeai |
| **テスト対象** | `tests/unit/test_think_agent.py` の全テストをパスさせる |

```python
class ThinkAgent:
    """
    実装すべきメソッド:
    - __init__(model_name: str, api_key: str)
    - analyze(image_path: str, vision_data: DetectionResult) -> ThinkResult
    - _build_prompt(vision_data: DetectionResult) -> str
    - _parse_response(response: str) -> ThinkResult
    - _fallback_result() -> ThinkResult  # API失敗時のデフォルト
    
    モック境界:
    - genai.GenerativeModel はテスト時にモック
    - API呼び出し結果は事前定義のJSON文字列を返す
    """
```

### A8: Score Implementer（スコアリングエンジン）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/agents/score_agent.py` |
| **外部依存** | なし（純粋ロジック） |
| **テスト対象** | `tests/unit/test_score_agent.py` の全テストをパスさせる |

```python
class ScoreAgent:
    """
    実装すべきメソッド:
    - __init__(weights: Optional[dict])
    - calculate(vision_data: DetectionResult, think_data: ThinkResult) -> SafetyScore
    - _check_safety_equipment(vision_data) -> list[ScoreBreakdown]
    - _check_hazards(vision_data) -> list[ScoreBreakdown]
    - _check_traffic(vision_data) -> list[ScoreBreakdown]
    - _check_obstructions(vision_data) -> list[ScoreBreakdown]
    - _check_contextual_risks(think_data) -> list[ScoreBreakdown]
    - _determine_level(score: int) -> str
    
    注意: 純粋関数ベース。外部依存なし。テストが最も書きやすいモジュール。
    """
```

### A9: Map Implementer（地図可視化モジュール）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/agents/map_agent.py` |
| **テスト対象** | `tests/unit/test_map_agent.py` の全テストをパスさせる |

### A10: Report Implementer（レポート生成モジュール）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/agents/report_agent.py` |
| **テスト対象** | `tests/unit/test_report_agent.py` の全テストをパスさせる |

### A11: Integration Implementer（パイプライン統合）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **対象ファイル** | `pathguardian/pipeline/orchestrator.py` |
| **テスト対象** | `tests/integration/` の全テストをパスさせる |

```python
class PipelineOrchestrator:
    """
    全モジュールを接続するパイプライン
    
    実装すべきメソッド:
    - __init__(config: AnalysisConfig)
    - run(image_path: str, gps: Optional[tuple]) -> FullAnalysisResult
    - run_partial(image_path: str, modules: list[str]) -> PartialResult
    
    エラーハンドリング:
    - Vision失敗 → 全体を停止（基盤モジュール）
    - Think失敗 → Visionのみの部分結果でScore算出を続行
    - Map失敗 → Mapなしで結果返却
    - Report失敗 → Reportなしで結果返却
    """
```

---

### ━━━ 品質層 ━━━

### A12: Code Reviewer（コードレビューエージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | **Opus**（高品質な判断） |
| **入力** | 全テスト・全プロダクションコード |
| **チェック項目** | 下記参照 |

```yaml
review_checklist:
  code_quality:
    - "型アノテーションが全関数に付与されているか"
    - "docstring が全public関数にあるか"
    - "関数の行数が50行以内か"
    - "循環的複雑度が10以下か"
    
  architecture:
    - "各モジュールがProtocolインターフェースに準拠しているか"
    - "モジュール間の依存方向が正しいか（Vision→Think→Score→Map/Report）"
    - "循環依存がないか"
    
  tdd_compliance:
    - "テストカバレッジ >= 80%"
    - "全テストが独立して実行可能か（FIRST原則のI）"
    - "モックが適切な境界で使用されているか"
    - "テストコードが変更されていないことを確認"
    
  error_handling:
    - "外部API呼び出しに適切なtry/exceptがあるか"
    - "タイムアウト設定があるか"
    - "部分的な障害時のフォールバックが実装されているか"
    
  performance:
    - "不要な画像コピーがないか"
    - "SAM 3の特徴量再利用が適切か"
    - "大きなnumpy配列のメモリ管理"
```

### A13: Security Auditor（セキュリティ監査エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | Sonnet |
| **入力** | 全コード |
| **チェック項目** | 下記参照 |

```yaml
security_checklist:
  api_keys:
    - "Gemini APIキーがハードコードされていないか"
    - "環境変数またはシークレット管理を使用しているか"
    - ".envファイルが.gitignoreに含まれているか"
    
  input_validation:
    - "画像パスのパストラバーサル対策"
    - "テキストプロンプトのインジェクション対策"
    - "ファイルサイズ上限チェック"
    - "許可されたファイル拡張子チェック"
    
  data_privacy:
    - "子どもの写真データの取り扱いポリシー"
    - "GPS位置情報の暗号化/匿名化"
    - "一時ファイルの確実な削除"
    - "ログにセンシティブ情報が含まれないか"
    
  dependencies:
    - "既知の脆弱性がある依存パッケージがないか"
    - "pip-audit の実行結果確認"
```

### A14: PR Composer（PR作成エージェント）

| 項目 | 内容 |
|------|------|
| **モデル** | **Opus**（高品質な文章） |
| **入力** | 全アーティファクト（コード、テスト結果、レビュー結果） |
| **出力** | GitHub PR（タイトル、本文、ラベル） |

```yaml
pr_template:
  title: "feat: SAM 3 × Gemini 統合による通学路危険度定量解析システム"
  body:
    sections:
      - "## 概要"
      - "## 変更内容"
      - "## テスト結果"
      - "## アーキテクチャ図"
      - "## スクリーンショット（検出結果例）"
      - "## チェックリスト"
      - "## レビュアーへの注意事項"
  labels: ["feature", "sam3", "gemini", "tdd"]
  reviewers: ["kazushi"]
```

---

## TDD実行フロー（時系列）

```
Phase 1: 設計（A1 + A2 並列 → A3）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  A1 ──┐
       ├──→ A3 (Test Designer/Opus)
  A2 ──┘         │
                  ▼
          テスト計画完成

Phase 2: テスト実装 → Red確認
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  A4 (Test Implementer)
         │
         ▼
  A5 (Test Runner) ──→ 🔴 全テスト失敗を確認
                        │
                 テスト変更禁止ロック 🔒

Phase 3: 実装ループ（Red → Green）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  A6 (Vision) ──→ A5 → 部分Green確認
         │
  A7 (Think)  ──→ A5 → 部分Green確認
         │
  A8 (Score)  ──→ A5 → 部分Green確認
         │
  A9 (Map) ───┐
              ├──→ A5 → 部分Green確認（並列可）
  A10 (Report)┘
         │
  A11 (Integration) ──→ A5 → 🟢 全テストパス確認

  ※ 各Implementer実行後にA5でテスト実行
  ※ 失敗時は該当Implementerに差し戻し（最大3回）
  ※ テストコードは絶対に変更しない

Phase 4: 品質保証 → PR
━━━━━━━━━━━━━━━━━━━━

  A12 (Code Reviewer/Opus) ──┐
                              ├──→ A14 (PR Composer/Opus)
  A13 (Security Auditor)  ───┘         │
                                       ▼
                                   PR作成・提出
```

---

## モジュール別TDDタイムライン

```
  Phase 1         Phase 2        Phase 3              Phase 4
  設計             テスト          実装                  品質
  ──────          ──────         ──────────────────    ──────
  
  A1 ━━┓
       ┣━ A3 ━━━ A4 ━━ A5🔴
  A2 ━━┛                  │
                          ├━ A6(Vision)━━━━━━━ A5✓
                          ├━ A7(Think) ━━━━━━━ A5✓
                          ├━ A8(Score) ━━━━━━━ A5✓
                          ├━ A9(Map)  ━━━┓
                          ├━ A10(Report)━┫━━━━ A5✓
                          └━ A11(Integration)━ A5🟢
                                                │
                                          A12 ━━┫━ A14 → PR
                                          A13 ━━┛
```

---

## 並列実行可能なペア

| ペア | 理由 |
|------|------|
| A1 + A2 | 依存関係なし。要件分析とアーキテクチャ設計は並列可 |
| A9 + A10 | Map と Report は Score の出力を消費するが互いに独立 |
| A12 + A13 | コードレビューとセキュリティ監査は独立した視点 |

---

## エラーリカバリー戦略

```yaml
recovery_rules:
  test_syntax_error:
    action: "A4に差し戻し（テスト自体のバグ修正は許容）"
    note: "テストのロジック・期待値は変更禁止"
    
  red_check_failure:
    condition: "テストが実装前にパスしてしまう"
    action: "A3に差し戻し（テスト設計見直し）"
    
  green_check_failure:
    condition: "実装後もテストが失敗"
    action: "失敗テスト情報を該当Implementerに返却、最大3回リトライ"
    escalation: "3回失敗 → 人間にエスカレーション"
    
  review_rejection:
    condition: "A12が重大な問題を発見"
    action: "該当Implementerに修正指示を返却"
    note: "テストは変更しない。修正後に再度A5でGreen確認"
    
  security_alert:
    condition: "A13が脆弱性を発見"
    action: "即座に修正。最優先で対応"
    note: "APIキー露出等はコミット前に必ず解決"
```

---

## 必要な環境・ツール

```yaml
development:
  python: ">=3.10"
  packages:
    - ultralytics>=8.3.237    # SAM 3
    - google-generativeai     # Gemini API
    - opencv-python>=4.8.0    # 画像処理
    - numpy                   # 配列操作
    - pytest>=7.0             # テストフレームワーク
    - pytest-cov              # カバレッジ
    - pytest-mock             # モック
    - pytest-asyncio          # 非同期テスト
    - ruff                    # Lint
    - mypy                    # 型チェック
    - pip-audit               # セキュリティ
    
  external:
    - "SAM 3 model weights (sam3.pt) from HuggingFace"
    - "Gemini API key (環境変数 GEMINI_API_KEY)"
    
  ci_cd:
    - "GitHub Actions for automated testing"
    - "Pre-commit hooks for lint/format"
```
