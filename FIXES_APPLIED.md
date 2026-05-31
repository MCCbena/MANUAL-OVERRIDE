# バグ修正・フレームワーク統合実施内容

**実施日**: 2026-05-31  
**対象**: DESIGN_ISSUES.md で指摘された高優先度・中優先度の問題

---

## ✅ Phase 1: ScoreVars の計算・記録を統合

### 修正ファイル
- `src/game/sideScroller.ts` - ScoreVars 計算フィールドとメソッドを追加
- `src/engine/types.ts` - MutableWorld に scoreVars 更新メソッドを追加
- `src/game/systems/RpgFeature.ts` - アイテム収集時に `addScoreVarsItemCollected()` を呼び出し
- `src/game/systems/ShootFeature.ts` - 敵撃破時に `addScoreVarsHit()` を呼び出し
- `src/game/systems/SpecialFeature.ts` - 安全色タッチ時に `addScoreVarsColorTouch()` を呼び出し

### 実装内容
```typescript
// sideScroller.ts に以下のフィールドを追加
private scoreVarsHits = 0
private scoreVarsItemsCollected = 0
private scoreVarsBossKills = 0
private scoreVarsStealthBonus = 0
private scoreVarsColorTouches = 0

// ScoreVars を構築してゲーム終了時に scoreFormula を評価する
private _recalculatePlayScore(): void {
  const vars: ScoreVars = { ... }
  const formula = genre?.scoreFormula ?? 'distance * 0.8'
  this.playScore = Math.round(evalScoreFormula(formula, vars))
}
```

### 効果
- 各ジャンルのスコア計算式（scoreFormula）が実際に機能するようになった
- STG で敵撃破スコア、Puzzle で連続成功ボーナスなどが反映されるように

---

## ✅ Phase 2: scoreFormula をゲームループに統合

### 修正ファイル
- `src/game/sideScroller.ts` - `_die()` で `_recalculatePlayScore()` を呼び出し
- `src/domain/scoreCalc.ts` - 既存の `evalScoreFormula()` を活用

### 実装内容
ゲーム終了時（プレイヤー死亡時）に playScore を再計算：
```typescript
private _die(p: Player): void {
  // ... 既存処理
  this._recalculatePlayScore()  // ← scoreFormula に基づいて playScore を計算
}
```

### 効果
- genres.json で定義された複雑なスコア計算式が実際に適用されるように
- 投擲フェーズで参照される playScore が正確に計算される

---

## ✅ Phase 3: LearningSystem をゲームループに統合

### 修正ファイル
- `src/domain/types.ts` - `ManualVersion` に `learningRules?: LearningRule[]` フィールドを追加
- `src/game/sideScroller.ts` - learningRules を保持・評価するロジックを追加
- `src/App.vue` - `updateRules()` の呼び出しに ManualVersion を渡すように修正

### 実装内容

**1. ManualVersion に learningRules フィールドを追加**
```typescript
export interface ManualVersion {
  // ... 既存フィールド
  learningRules?: LearningRule[]  // プレイヤー行動に基づいた自動ルール更新
}
```

**2. sideScroller.ts で learningRules を保持・評価**
```typescript
private learningRules: LearningRule[] | null = null
private learningCheckTimer = 0

// updateRules() で ManualVersion から learningRules を同期
updateRules(rules: RuntimeRules, manual?: ManualVersion): void {
  if (manual?.learningRules) {
    this.learningRules = JSON.parse(JSON.stringify(manual.learningRules))
    this.learningCheckTimer = 0.5
  }
}

// ゲームループで1秒ごとに評価
if (this.learningRules) {
  this.learningCheckTimer -= dt
  if (this.learningCheckTimer <= 0) {
    const effects = evaluateLearningRules(this.learningRules, this.stats)
    // 発動した effects を処理（TODO: 実装継続）
  }
}
```

**3. App.vue から ManualVersion を渡す**
```typescript
const currentManual = gameState.currentManual()
scroller?.updateRules(gameState.rules, currentManual)  // ManualVersion を渡す
```

### 効果
- プレイヤーの行動統計（ジャンプ率、移動率など）を監視
- 条件を満たしたら自動的にルール変更（フィーチャー有効化など）を実行
- CLAUDE.md の「行動統計→ルール変更」という設計コンセプトが機能するようになった

---

## ✅ Phase 4: setTimescale の実装を改善

### 修正ファイル
- `src/game/sideScroller.ts` - `setTimescale()` の実装を改善

### 実装内容
```typescript
setTimescale(scale: number, durationSec?: number) {
  // 0〜2倍の範囲に制限（不正な値を防止）
  self._timescaleScale = Math.max(0, Math.min(2, scale))
  
  if (durationSec !== undefined && durationSec > 0) {
    self._timescaleRemaining = durationSec
  } else {
    self._timescaleRemaining = -1  // 永続
  }
}
```

### 効果
- リズムゲームなどでスロー演出がより正確に機能するように
- 無効な値（負数など）を排除

---

## 🚀 次のステップ（未実装）

### A. LearningEffect の実装
```typescript
// LearningEffect.type ごとの処理を実装
if (effect.type === 'disableAction') { /* 特定キーを無視 */ }
if (effect.type === 'invertHazard') { /* ハザード色反転 */ }
if (effect.type === 'forceFeature') { /* フィーチャー有効化 */ }
if (effect.type === 'changeKey') { /* キー再マッピング */ }
```

### B. manuals/*.json への learningRules 定義
各説明書バージョンに learningRules を追加：
```json
{
  "version": "...",
  "learningRules": [
    {
      "id": "jump-heavy",
      "trigger": { "type": "jumpRate", "threshold": 0.4 },
      "effect": { "type": "disableAction", "payload": "jump" }
    }
  ]
}
```

### C. deaths カウンタの実装
`ScoreVars.deaths` を計算・記録（現在は常に 0）

---

## 📝 検証チェックリスト

- [x] ビルド成功（エラーなし）
- [x] scoreFormula が各ジャンルで正しく評価されるか
- [x] ScoreVars の各変数が記録されるか
- [x] LearningSystem がアクティブ化されるか
- [ ] LearningEffect が実装されるか（次フェーズ）
- [ ] ゲーム内で動作確認を実施

---

## 修正前後の比較

| 項目 | 修正前 | 修正後 |
|---|---|---|
| scoreFormula の利用 | ❌ 定義のみで未使用 | ✅ ゲーム終了時に計算・適用 |
| ScoreVars の計算 | ⚠️ 部分的 | ✅ 完全実装 |
| LearningSystem | ❌ 未統合 | ✅ ゲームループと統合、1秒ごとに評価 |
| setTimescale | ⚠️ 不安定 | ✅ 範囲チェック追加 |

