# PathGuardian エージェントチーム クイックリファレンス

## チーム一覧（15エージェント）

```
┌─────┬───────────────────────┬────────┬────────────────────────────┐
│ ID  │ エージェント名          │ モデル  │ 一言責務                    │
├─────┼───────────────────────┼────────┼────────────────────────────┤
│     │ ━━━ 指揮層 ━━━        │        │                            │
│ A0  │ Project Orchestrator  │ Sonnet │ 全体制御・TDDサイクル管理    │
├─────┼───────────────────────┼────────┼────────────────────────────┤
│     │ ━━━ 設計層 ━━━        │        │                            │
│ A1  │ Issue Analyzer        │ Sonnet │ 要件分析・モジュール境界定義  │
│ A2  │ Architecture Designer │ Sonnet │ 型定義・プロジェクト構造設計  │
├─────┼───────────────────────┼────────┼────────────────────────────┤
│     │ ━━━ テスト層 ━━━      │        │                            │
│ A3  │ Test Designer         │ Opus   │ テストケース設計(Given-When-Then) │
│ A4  │ Test Implementer      │ Sonnet │ pytestテストコード実装       │
│ A5  │ Test Runner           │ Sonnet │ テスト実行・Red/Green判定    │
├─────┼───────────────────────┼────────┼────────────────────────────┤
│     │ ━━━ 実装層 ━━━        │        │                            │
│ A6  │ Vision Implementer    │ Sonnet │ SAM 3検出モジュール          │
│ A7  │ Think Implementer     │ Sonnet │ Gemini API推論モジュール     │
│ A8  │ Score Implementer     │ Sonnet │ スコアリングエンジン         │
│ A9  │ Map Implementer       │ Sonnet │ 地図可視化モジュール         │
│ A10 │ Report Implementer    │ Sonnet │ レポート生成モジュール       │
│ A11 │ Integration Implementer│ Sonnet │ パイプライン統合             │
├─────┼───────────────────────┼────────┼────────────────────────────┤
│     │ ━━━ 品質層 ━━━        │        │                            │
│ A12 │ Code Reviewer         │ Opus   │ コード品質・設計レビュー     │
│ A13 │ Security Auditor      │ Sonnet │ セキュリティ・個人情報監査   │
│ A14 │ PR Composer           │ Opus   │ PR作成・ドキュメント整備     │
└─────┴───────────────────────┴────────┴────────────────────────────┘

Opus使用: A3(テスト設計), A12(レビュー), A14(PR) — 判断品質が重要な箇所
Sonnet使用: その他全て — コスト効率重視
```

## TDDフロー図

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │   A1+A2 ──→ A3 ──→ A4 ──→ A5(🔴Red) ──→ 実装ループ       │
  │   設計       テスト   テスト   全失敗        ↓               │
  │   (並列)     設計    実装    確認     ┌──────────────┐      │
  │                                      │ A6 → A5(✓)   │      │
  │        テスト変更禁止🔒               │ A7 → A5(✓)   │      │
  │                                      │ A8 → A5(✓)   │      │
  │                                      │ A9+A10→A5(✓) │      │
  │                                      │ A11 → A5(🟢) │      │
  │                                      └──────┬───────┘      │
  │                                             ↓               │
  │                                      A12+A13 → A14 → PR    │
  │                                      レビュー    PR作成      │
  │                                      (並列)                 │
  └─────────────────────────────────────────────────────────────┘
  
  失敗時: 該当Implementerに差し戻し（最大3回→人間エスカレーション）
  テスト: 絶対に変更しない（TDD原則）
```

## プロジェクト構造

```
pathguardian/
├── __init__.py
├── config.py                    # 設定・定数
├── types.py                     # 共通データ型
├── agents/
│   ├── __init__.py
│   ├── vision_agent.py          # A6: SAM 3
│   ├── think_agent.py           # A7: Gemini
│   ├── score_agent.py           # A8: スコア
│   ├── map_agent.py             # A9: 地図
│   └── report_agent.py          # A10: レポート
├── pipeline/
│   ├── __init__.py
│   └── orchestrator.py          # A11: 統合
└── utils/
    ├── __init__.py
    ├── image_utils.py
    └── mask_utils.py

tests/
├── conftest.py                  # 共通フィクスチャ
├── fixtures/
│   ├── sample_school_route.jpg
│   ├── sample_detection.json
│   └── expected_scores.json
├── unit/
│   ├── test_vision_agent.py     # 8テスト
│   ├── test_think_agent.py      # 5テスト
│   ├── test_score_agent.py      # 7テスト
│   ├── test_map_agent.py        # 3テスト
│   └── test_report_agent.py     # 3テスト
├── integration/
│   ├── test_vision_think_pipeline.py  # 2テスト
│   └── test_full_pipeline.py          # 3テスト
└── e2e/
    └── test_single_image_analysis.py  # 1テスト
    
Total: 34テスト (Unit:26 / Integration:5 / E2E:1)
Coverage Target: >= 80%
```

## 実装順序（依存関係ベース）

```
Week 1: 基盤
  Day 1-2: A1+A2(設計) → A3(テスト設計)
  Day 3:   A4(テスト実装) → A5(Red確認🔴)
  Day 4-5: A6(Vision) + A8(Score) ← 外部依存なしで先行可能

Week 2: 統合
  Day 1-2: A7(Think/Gemini連携)
  Day 3:   A9(Map) + A10(Report) ← 並列可
  Day 4:   A11(Integration) → A5(Green確認🟢)
  Day 5:   A12+A13(レビュー) → A14(PR)
```

## コマンドリファレンス

```bash
# テスト実行
pytest tests/ -v --tb=short

# カバレッジ付き
pytest tests/ -v --cov=pathguardian --cov-report=term-missing

# Unit のみ
pytest tests/unit/ -v

# 特定モジュール
pytest tests/unit/test_vision_agent.py -v

# Lint
ruff check pathguardian/ tests/

# 型チェック
mypy pathguardian/

# セキュリティ
pip-audit
```
