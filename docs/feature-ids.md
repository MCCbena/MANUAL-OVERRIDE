# FeatureId リファレンス

`RuntimeRules.features: Set<FeatureId>` に含まれるフラグ一覧。  
ジャンル定義の `enableFeatures` / `disableFeatures` で制御される。

---

## STG 系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `shoot` | 前方弾発射（デフォルトキー: Z） | ShootFeature |
| `three_way` | 三方向弾（shoot の拡張） | ShootFeature |
| `charge_shot` | 長押しチャージショット | ShootFeature |
| `spread_shot` | 扇状5方向散弾 | ShootFeature |
| `bomb` | 爆弾アイテム（画面全体攻撃） | ShootFeature |
| `enemy_hp` | 敵が HP を持ち複数ヒット必要 | ShootFeature |
| `boss` | ボスエネミー出現 | ShootFeature |

---

## 移動系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `auto_run` | 自動前進（プレイヤーは左右とジャンプのみ） | MovementFeature |
| `slow_precise` | 低速精密移動（速度 × slowPreciseRatio） | MovementFeature |
| `double_jump` | 空中でもう一度ジャンプ可能 | MovementFeature |
| `long_air` | 空中での水平速度を持続（滑空） | MovementFeature |
| `dash` | 短距離ダッシュ（Shift など） | MovementFeature |
| `wall_jump` | 壁接触中に逆方向ジャンプ | MovementFeature |
| `slide` | しゃがみスライド（障害物くぐり） | MovementFeature |
| `gravity_flip` | 重力反転（天井を床として走る） | MovementFeature |
| `vertical_scroll` | 縦スクロールモード（障害物が上下から来る） | MovementFeature |

---

## RPG / 育成系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `hp` | HP システム（複数回被弾許容） | ─（sideScroller 直接処理） |
| `exp` | 経験値・レベルアップ | ─（sideScroller 直接処理） |
| `item_pickup` | フィールドアイテム収集 | ─（sideScroller 直接処理） |
| `shield` | シールド（1回ガード） | 未実装 |

---

## パズル系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `grid_stop` | スクロール停止してグリッド配置モード | 未実装 |
| `puzzle_solve` | 正解が存在するパズル入力 | 未実装 |

---

## リズム系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `beat_hazard` | BPM 同期でハザードが色変化・反転 | RhythmFeature |
| `just_input` | ジャスト入力でボーナス | RhythmFeature |
| `beat_dash` | リズムに合わせたダッシュで加速 | RhythmFeature |

---

## ステルス / 特殊系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `stealth_mode` | 透明化・一定時間ハザード無視 | 未実装 |
| `time_bonus` | タイムアタック評価（早いほど高得点） | 未実装 |
| `color_touch` | 安全色を踏むと得点（sideScroller が直接処理） | ─ |

---

## タワー / クラフト系

| FeatureId | 説明 | 対応 FeatureSystem |
|---|---|---|
| `tower` | タワー設置（停止して配置） | 未実装 |

---

## 実装ステータス

| ステータス | 意味 |
|---|---|
| ✅ ShootFeature | 弾発射・命中・コンボ・描画まで実装済み |
| ✅ RhythmFeature | BPM同期・ジャスト入力・ビートマーカー描画実装済み |
| ⚠️ MovementFeature | フィーチャー宣言のみ。ロジックは sideScroller.ts に内蔵 |
| ❌ 未実装 | FeatureId のみ定義。FeatureSystem クラスが存在しない |
| ─ sideScroller | FeatureSystem を経由せず sideScroller が直接処理 |

---

## FeatureId を新規追加するには

1. `src/domain/types.ts` の `FeatureId` union に文字列リテラルを追加
2. `src/data/genres.ts` の該当ジャンルの `enableFeatures` に追加
3. `src/game/systems/` に `XxxFeature.ts` を作成（[feature-system.md](feature-system.md) 参照）
4. `src/game/systems/index.ts` に `registerFeature(new XxxFeature())` を追加
