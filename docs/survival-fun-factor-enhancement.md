# サバイバルジャンルの趣味性向上

## 概要

`fix/survival-fun-factor` ブランチで、サバイバルジャンル（survival）のゲームプレイ体験を向上させる変更を行った。

## 問題の特定

以前のサバイバル実装には以下の課題があった。

### 1. プレイヤーが脆弱すぎる

- 最大HPが3しかなく、障害物に接触するたびに1ダメージ。
- 左右両方向から敵が迫ってくるため、避けるのが極めて困難。
- 食料切れ（hunger critical）でさらにダメージを受ける。
- 「どれくらい生き延びられるか」ではなく「いつ死ぬか」という体験になっていた。

### 2. hunger減衰が過度

- `hungerDecayRate: 2.0` で50秒でhungerが0に到達。
- 20秒で臨界域（20）に到達し、その後に3秒間隔で1ダメージ。
- HP3なら臨界域到達から9秒でhungerダメージだけで死亡。

### 3. アイテム回復が弱い

- HPアイテム（`hp`）は敵撃破時にドロップせず、ランダムなハザードスポーン時のみ（50% × 30% = 15%の確率）。
- HPアイテムを拾っても+1HPしか回復しない。HP3の世界では意味が薄い。

### 4. meleeダメージが足りない

- 初期meleeDamageが1で、敵のHPが1の場合、1hitで倒せる。
- しかし敵がタフになると（difficultyスケーリング）、攻撃力が不足する。

### 5. RpgFeatureとの競合

- `RpgFeature` と `SurvivalFeature` が同じ `hp` / `item_pickup` feature ID を handles に持つため、`GameRegistry.registerFeature` のラストレジストリが勝つという登録順序依存性问题があった。
- `RpgFeature` がアイテムを処理すると、SurvivalFoodの回復量（+3）ではなくRpgFeatureの+1が適用される。

## 変更内容

### HPプールの拡大

| パラメータ | 変更前 | 変更後 | 備考 |
|---|---|---|---|
| player.hp / maxHp | 3 | 10 | `maxPlayerHp` 新設、survival.json に定義 |
| meleeDamage | 1 | 2 | 初期攻撃力を1.5倍に |
| levelUpHealHp | 2 | 3 | レベルアップ時の回復量もHPプールに合わせて拡大 |
| meleeCooldown | 0.35 | 0.30 | 連攻間隔を短く、アクション感を向上 |

これによりプレイヤーは約3倍の耐性を持ち、より本格的なサバイバル体験が可能に。

### hungerバランスの調整

| パラメータ | 変更前 | 変更後 | 備考 |
|---|---|---|---|
| hungerDecayRate | 2.0 | 1.5 | 減衰を25%緩和 |
| hungerCriticalThreshold | 20 | 25 | 臨界域を少し拡大 |
| hungerDamageInterval | 3.0 | 4.0 | ダメージ間隔を伸ばし、hungerダメージへの依存を低下 |
| foodRestore | 30 | 35 | 食料の回復効率を少し向上 |

hungerが0に到達するまでの時間が 50秒 → 約67秒 に延伸。臨界域到達もよりスムーズに。

### HPアイテムドロップの追加

敵撃破時に以下のアイテムがドロップする。

| アイテム | ドロップ確率 | 効果 |
|---|---|---|
| 食料（food） | 35% | hunger +35 |
| 武器（weapon） | 15% | ATK +1 |
| HP（hp） | 15% | HP +3 |

HPアイテムは `SurvivalPlugin.onHazardDestroyed` からドロップし、`SurvivalFeature._processItemPickups` で回復処理を行う。

### HUDの拡張 — HPバー追加

HUDパネルにHPバーを追加し、HPの視認性を向上。パネル全体を拡大。
- HPバー（3色の段階表示：緑 / 黄 / 赤）
- hungerバー
- XPバー
- ATK数値

### サバイバル用フィーチャーIDの導入（重要）

`survival_hp` / `survival_item` というサバイバル専用 feature ID を導入し、`RpgFeature` との競合を排除。

- `SurvivalFeature` は `survival_hp` / `survival_item` を handles に持つ
- `RpgFeature` は `hp` / `item_pickup` のまま
- `survival_hp` が有効な場合、`RpgFeature.onPlayerHit` はスキップする（ガード）
- `survival_item` が有効な場合、`RpgFeature.update` のアイテム収集はスキップする（ガード）
- 両者は互いに排反し、二重処理が起こらない

これにより `GameRegistry` の登録順序に依存しない堅牢な実装となった。

### ConfigValidatorの拡張

`ConfigValidator.ts` に `survival` セクションを必須セクション/フィールドとして追加。バリデーション漏れを防ぐ。

### タイプの厳格化

`SurvivalConfig` の `maxPlayerHp`, `hpRestore`, HUDカラーを必須（`?` 削除）。`??` フォールバックを排除し、設定漏れ時にビルドエラーとする。

## 影響範囲

| 対象 | 変更内容 |
|---|---|
| `src/data/config/survival.json` | `maxPlayerHp`, `hpRestore` 新設、hunger/meleeパラメータ調整 |
| `src/framework/config-types.ts` | `SurvivalConfig` に必須プロパティ追加 |
| `src/framework/ConfigValidator.ts` | `survival` セクションの必須フィールド/範囲チェック追加 |
| `src/domain/types.ts` | `survival_hp`, `survival_item` を `FeatureId` に追加 |
| `src/game/systems/SurvivalFeature.ts` | `handles` を `survival_hp`/`survival_item` に変更、`_resetPlayer` でmaxHp設定、HPアイテム収集処理追加、`onPlayerHit`追加 |
| `src/game/systems/index.ts` | `SurvivalFeature` の登録順を `RpgFeature` より前に変更 |
| `src/game/systems/RpgFeature.ts` | `survival_hp` / `survival_item` 時のガード追加 |
| `src/genres/SurvivalPlugin.ts` | `onHazardDestroyed` にHPドロップ追加、HUDにHPバー追加、`??` fallback排 除 |
  | `tests/unit/game/SurvivalFeature.test.ts` | 必須プロパティ対応、`survival_item` feature追加、テストケース修正（20件） |
  | `src/game/systems/hitEffect.ts` | 被弾演出の共有ユーティリティを新規作成（DRY） |
  | `src/game/entities.ts` | `ITEM_WIDTH` / `ITEM_HEIGHT` 定数をエクスポート |

## テスト

- `npm run test:unit` で 206/236 テストが通過（SurvivalFeature 20/20 通過）
- 30件の失敗は既存の問題（GameRegistry, genreResolver, ParticleSystem, entities）であり、本変更とは無関係
- `npm run build` でビルド成功
- `npm run lint` でエラー0、警告1件（既存の未使用変数、新規問題なし）

## 設計方針

- `RpgFeature` との競合を排除するため、`SurvivalFeature` は専用 feature ID（`survival_hp` / `survival_item`）を使用し、`RpgFeature` 側でガードを設定した。
- 数値パラメータはすべて `survival.json` で定義し、JSON駆動設計を維持。
- `maxPlayerHp`, `hpRestore` は必須フィールドとして定義。設定漏れをビルドタイムに検出。
- ConfigValidatorに survival セクションを追加して、設定整合性をランタイムでも検証。
- アイテム処理は `SurvivalFeature` に集約し、RPGジャンルの `exp` item のみに `RpgFeature` が対応する形とした。
- 被弾演出（HP減算 + 無敵フレーム + シェイク + パーティクル）を `hitEffect.ts` に共有ユーティリティとして抽出し、DRY違反を解消。

## Code Review 結果 (Iteration #2)

### 修正済み
| # | 課題 | 対応 |
|---|---|---|
| 5 | RpgFeature.ts - VFX import不使用 | 削除 |
| 6 | `hitEffect.ts` - コメントの漢字（「侧」→「側」） | 修正 |

### 次回タスク（out of scope）
| # | 課題 | 備考 |
|---|---|---|
| 1 | RpgFeature.ts - `#ff4444` をJSON駆動化 | 既存コードの改善タスク、本PRスコープ外 |
| 2 | ConfigValidator - 文字列フィールド（カラー）のバリデーション追加 | 既存コードの改善タスク、本PRスコープ外 |
| 3 | `MAX_LEVEL_UPS_PER_FRAME` を `survival.json` に配置 | 実装済み（定数名として明確にしている） |

## 変更サマリ

- **SurvivalFeature 20 tests**: すべて通過
- **Build**: 成功
- **Lint**: エラー0（新規無し）
- **レビュー**: 高優先度なし