# 説明書更新・ジャンル確定の演出強化

## 概要

説明書の更新（カード選択）時とジャンル確定時に、キャンバスおよびUI側にドラマティックなアニメーションエフェクトを追加した。

## 追加された演出

### 1. キャンバストランジション（SideScroller.ts）

#### ルール更新時トランジション (`triggerTransition`)

カード選択時に呼ばれる。0.4秒間の演出:

- **画面フラッシュ**: 選択ジャンルのアクセントカラーで全画面が一瞬点灯（alpha 0→1→0, 0.4秒）
- **画面シェイク**: intensity 8 の振動（既存の shake システムを流用）
- **スローモーション**: 0.4秒間、ゲーム速度を30%に低下（既存の timescale システムを流用）
- **Feature 通知テキスト**: 画面中央に `+射撃` `+ダブルジャンプ` 等のテキストが glow 付きで表示（1.2秒間、上に浮きながらフェードアウト）

#### ジャンル確定時エフェクト (`triggerGenreLockEffect`)

ジャンルが確定した時に呼ばれる、より大規模な演出:

- **強めシェイク**: intensity 16（通常トランジションの2倍）
- **長時間フラッシュ**: 確定ジャンルのカラーで点灯
- **長時間スローモ**: 0.8秒間、ゲーム速度を20%に低下
- **パーティクル爆発**: 画面中央から40個のパーティクルが放射状に飛散

### 2. 説明書パネルアニメーション（ManualPanel.vue）

#### パネル入場演出の強化

中央表示時のアニメーションを `panelCenterIn` で強化:

- scale 0.85→1.03→1.0 のバウンス
- rotateX 8°→-2°→0° の3Dフリップ（奥行き感）

#### タイプライター効果

差分追加行が1文字ずつ表示される:

- 速度: 35文字/秒
- カーソル `|` が点滅
- 完了後に通常表示に遷移

#### Feature 通知バッジ

選択で新たに有効になった feature がパネル上部に表示:

- `+射撃` `+コンボ` 等のバッジ
- 右下からスライドインアニメーション
- 2秒後にフェードアウト

### 3. 選択肢カード演出（ChoicePanel.vue）

#### 選択時バーストエフェクト

ボタンクリック時に:

- ボタンが縮小しながら glow パルス（`choiceBurst`）
- 背景から放射状グラデーションが拡散（`burstRadiate`）

#### カードグローパルス

カード表示中に微妙に glow  that pulses（`cardGlowPulse`）

## 実装詳細

### 関連ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/game/sideScroller.ts` | `triggerTransition()`, `triggerGenreLockEffect()`, `getPendingNewFeatures()` メソッド追加。`_loop` にトランジション状態更新を追加。`_render` にフラッシュ・_feature 通知描画を追加。`updateRules()` に新 feature 検出を追加。 |
| `src/components/ManualPanel.vue` | タイプライター効果（RAF ベース）。`newFeatures` prop 追加。Feature 通知バッジ表示。パネル入場アニメーション強化。 |
| `src/components/ChoicePanel.vue` | 選択時バーストエフェクト（`bursting` クラス）。カードグローパルス。 |
| `src/composables/useManual.ts` | `newFeatures` ref 追加。`showFeatureNotification()` 関数追加。 |
| `src/App.vue` | `onChoose()` で `triggerTransition()` + `showFeatureNotification()` を呼出。`lockedGenre` watch で `triggerGenreLockEffect()` を呼出。ManualPanel に `:new-features` prop を渡す。 |

### FeatureId → 日本語ラベルマッピング

`App.vue` の `formatFeatureLabels()` で変換:

| FeatureId | ラベル |
|-----------|--------|
| `shoot` | 射撃 |
| `double_jump` | ダブルジャンプ |
| `dash` | ダッシュ |
| `enemy_hp` | 敵HP |
| `auto_run` | 自動走行 |
| `item_pickup` | アイテム |
| `combo` | コンボ |
| `beat_hazard` | ビートハザード |
| `tower` | タワー |
| `stealth` | 隠密 |
| `survival_hp` | HP管理 |
| `growth` | 成長 |
| `puzzle_grid` | グリッド |
| `rhythm_beat` | リズム |

## 既存コードとの整合性

- 既存の shake/timescale システムを流用するため、新システム不要
- 既存のアニメーション（`inkIn`, `panelCenterIn` 等）を破壊せず拡張
- 既存のテスト（Playwright smoke, theme-transition）すべて通過確認済み
- ESLint チェック通過（warning 1件修正済み）
