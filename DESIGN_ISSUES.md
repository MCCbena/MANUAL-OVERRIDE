# 設計上のミスとバグ検出レポート

## 優先度: **高** 🔴

### Issue #1: scoreFormula が実装されていない

**場所:** `src/domain/scoreCalc.ts` (定義), `src/data/config/genres.json` (フォーミュラ定義), `src/game/sideScroller.ts` (未使用)

**問題:**
- genres.json に各ジャンルごとに複雑なスコア計算式（scoreFormula）が定義されている
  - 例: `"kills * 120 + distance * 0.5 + combo * 80"` (STG)
  - 例: `"combo * 200 + survivedSec * 3"` (Puzzle)
- `evalScoreFormula()` 関数が `src/domain/scoreCalc.ts` で実装済み
- しかし **実装は全く使われていない**

**現状:**
```typescript
// sideScroller.ts:539
this.playScore += effectiveScrollSpeed * dt * SCORE.distanceScoreRate
```
- ジャンル関係なく、距離ベースの単純な加算のみが行われている
- scoreFormula は JSON 定義のみで、計算に反映されていない

**影響:**
- STG で敵を倒してもスコアが増えない（kills パラメータが無視される）
- Puzzle で連続成功してもコンボボーナスが反映されない
- RPG で経験値を稼いでもスコア計算に反映されない
- 各ジャンルの「プレイスタイル別のスコア設計」が完全に無視されている

**修正案:**
```typescript
// sideScroller.ts の getSnapshot() や終了時に呼ぶべき場所で：
const vars: ScoreVars = {
  distance: this.distance,
  kills: this._gameStats.kills,
  combo: this._gameStats.combo,
  exp: this.player.exp,
  beatHits: this._gameStats.beatHits,
  survivedSec: this.survivedSec,
  accuracy: /* 計算 */,
  maxCombo: this._gameStats.maxCombo,
  // ... その他の変数
}
const formula = GENRES.find(g => g.id === this.rules.genre)?.scoreFormula ?? "distance * 0.8"
const playScore = evalScoreFormula(formula, vars)
```

---

### Issue #2: LearningSystem が未統合

**場所:** `src/domain/LearningSystem.ts` (実装済み), `src/game/sideScroller.ts` (呼び出しなし)

**問題:**
- `evaluateLearningRules()` 関数が完全に実装されている
- コメント「統合方法」に明確な手順が書かれている
- しかし **ゲームループに一切統合されていない**

**現状:**
```typescript
// LearningSystem.ts:12-15 のコメント
// 統合方法:
//  1. sideScroller.ts の getStats() で ActionStats を取得
//  2. 説明書バージョンに learningRules: LearningRule[] を定義（ManualVersion 拡張時）
//  3. updateRules() 内または定期ポーリングで evaluateLearningRules() を呼ぶ
//  4. 返り値の LearningEffect[] を RuntimeRules のミューテーションに適用する
```

**実装状況:**
- `evaluateLearningRules()` は未呼び出し
- ManualVersion に learningRules フィールドは存在しない
- ActionStats は記録されているが参照されない

**影響:**
- ジャンプを多用するプレイヤーへのフィードバック機能が全く動作しない
- 自動ルール更新システムが利用不可
- CLAUDE.md の「行動統計→ルール変更」という設計コンセプトが実装されていない

---

### Issue #3: setTimescale の実装が不完全

**場所:** `src/engine/types.ts` (API定義), `src/game/sideScroller.ts` (実装)

**問題:**
MutableWorld.setTimescale() は実装されているが、実際のタイムスケール適用に問題がある可能性がある

**現状:**
```typescript
// sideScroller.ts:119-122
setTimescale(scale, durationSec) {
  self._timescaleScale = scale
  self._timescaleRemaining = durationSec ?? -1
}
```

**潜在的な問題:**
- `durationSec` が undefined の場合、`-1` に設定される（永続）
- 実時間ベースのカウントダウン（rawDt に対して）が、フレーム単位の削減（dt に対して）と混在
- フレームレート変動時に不正確になる可能性

**修正案:**
```typescript
// より正確な実装
setTimescale(scale: number, durationSec?: number) {
  self._timescaleScale = Math.max(0, Math.min(1, scale))  // 0〜1 の範囲に制限
  if (durationSec !== undefined && durationSec > 0) {
    self._timescaleRemaining = durationSec
  } else {
    self._timescaleRemaining = -1  // 永続
  }
}
```

---

## 優先度: **中** 🟡

### Issue #4: ScoreVars の変数が不完全

**場所:** `src/domain/types.ts:284-300`

**問題:**
ScoreVars インターフェースで定義された変数の多くがゲーム中に計算されていない

未実装の変数:
- `accuracy` - 命中率（shots > 0 ）
- `itemsCollected` - アイテム収集総数
- `bossKills` - ボス撃破数
- `stealthBonus` - ステルス継続フレーム数
- `colorTouches` - 安全色タッチ回数

**影響:**
- scoreFormula で `accuracy * 500` のような計算を使おうとしても、accuracy は常に 0
- Survival ジャンルの scoreFormula: `"survivedSec * 15 + itemsCollected * 80 + distance * 0.2"` が部分的に動作しない

---

### Issue #5: Player.exp が初期化されていない可能性

**場所:** `src/game/entities.ts`, `src/game/sideScroller.ts:110-112`

**確認必要:**
プレイヤーの exp フィールドが初期値 0 で正しく初期化されているか確認が必要

---

### Issue #6: ジャンル確定後の playScore リセット処理の欠落

**場所:** `src/game/sideScroller.ts`

**問題:**
ジャンルが確定した時点で、playScore をリセットすべき設計要件があるかどうか不明確

**現状:**
- playScore は距離ベースで連続加算されている
- ジャンル確定後も playScore は加算され続ける
- 最終スコア計算（calcFinalScore）で play × 0.7 として使用される

**質問:**
- ジャンル確定前のスコアは「基本スコア」として破棄すべき？
- 現在のジャンルのスコアのみを使用すべき？
- CLAUDE.md に明記がないため、設計意図が不明確

---

## 優先度: **低** 🟢

### Issue #7: _frameWorld キャッシュが完全ではない可能性

**場所:** `src/game/sideScroller.ts:222, 283, 502, 617`

**現状:**
- フレーム開始時に `this._frameWorld = null` でリセット
- `_getWorld()` で一度だけ buildWorld() を呼ぶ設計

**潜在的な問題:**
- `buildWorld()` 内の getter が評価のたびに fresh な値を返す
- distance, cameraX など時間依存値が複数箇所で異なる値を持つ可能性は低いが、設計としては脆弱

---

### Issue #8: CLAUDE.md で実装完了とされている項目の精度

**参照:** `docs/framework.md:401-635` と実装の乖離

**指摘:**
- framework.md では多くの項目が「✅ 実装完了」とマークされている
- しかし **Issue #1 (scoreFormula)** と **Issue #2 (LearningSystem)** の実装状態を見ると、「定義はあるが統合されていない」という状態が複数存在
- framework.md の「実装完了」は「コード存在」を意味し、「ゲームループ統合」を意味していない可能性

---

## サマリー

| # | 項目 | 優先度 | 影響 |
|---|---|---|---|
| 1 | scoreFormula 未実装 | 🔴 高 | ジャンル別スコア計算が全く動作しない |
| 2 | LearningSystem 未統合 | 🔴 高 | プレイヤーフィードバック機能が利用不可 |
| 3 | setTimescale の不完全性 | 🟡 中 | リズムゲーム等で演出がズレる可能性 |
| 4 | ScoreVars の部分的実装 | 🟡 中 | scoreFormula が完全に機能しない |
| 5 | Player.exp 初期化確認 | 🟡 中 | RPG ジャンル動作に影響の可能性 |
| 6 | playScore リセット処理 | 🟡 中 | 仕様不明確 |
| 7 | _frameWorld キャッシュ | 🟢 低 | 現在の実装では問題なし |
| 8 | framework.md 精度 | 🟢 低 | ドキュメント更新が必要 |

---

## 推奨修正順序

1. **Issue #1** → scoreFormula の統合（ゲーム全体のスコア計算が機能するようになる）
2. **Issue #4** → ScoreVars の各変数を計算・記録する（scoreFormula が完全に機能するようになる）
3. **Issue #2** → LearningSystem の統合（ジャンル分岐の後付けフィードバック機能）
4. **Issue #6** → playScore リセット処理の仕様確定と実装
5. **Issue #5** → Player.exp 初期化の確認と修正

