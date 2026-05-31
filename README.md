# 取扱説明書を読むゲーム

説明書が更新されるたびにルールを選び、横スクロールを育てていく体験型ゲーム。  
Vite + Vue 3 + TypeScript で構築。100+ の選択肢が永遠に続く仕組みになっています。

## クイックスタート

```bash
npm install
npm run dev      # 開発サーバー起動 (localhost:5173)
npm run build    # 本番ビルド
```

## ゲームの流れ

1. **ver 1.0 チュートリアル** - 横スクロール基本操作（左右移動+ジャンプ）
2. **ver 2.0～8.0 初期分岐** - 8つのジャンル方向へ分岐
3. **ver 9.0～15.0 高度な分岐** - さらに複雑な選択肢ツリー（100+ 選択肢）
4. **無限更新** - ver 15.0 を超えても 1500px ごとに新しい選択肢が出現
5. **投擲フェーズ** - 説明書をドラッグして投げてゲーム完成

## 実装の分割

| ファイル | 役割 |
|---------|------|
| `src/data/manualDeck.ts` | マニュアルJSONの一括読み込み（import.meta.glob 使用） |
| `src/data/manuals/*.json` | マニュアルバージョン定義（base, action-branch, flow-branch, advanced-branch） |
| `src/data/gameBalance.ts` | ゲーム進行パラメータ（UPDATE_DISTANCES, スコア比率、物理定数） |
| `src/data/tunables.ts` | 操作感・視覚効果パラメータ（物理、エフェクト、VFX） |
| `src/domain/ruleEngine.ts` | マニュアル + 選択履歴 → 実行時ルールへ合成 |
| `src/domain/genreResolver.ts` | ジャンルパラメータ → ジャンルID 決定 |
| `src/game/sideScroller.ts` | Canvas 横スクロール本体・物理エンジン・距離ベース難易度 |
| `src/game/throwEngine.ts` | 投擲フェーズとスコア計算 |
| `src/genres/` | ジャンル別プラグイン（STG, RPG, rhythm など） |
| `src/game/systems/` | 機能別モジュール（shoot, enemy, item など） |
| `src/composables/` | Vue 状態管理（useGameState, useManual） |
| `src/components/` | UI パーツ（HUD, Manual, ChoicePanel, ThrowOverlay） |

## 永遠に続く仕組み

### UPDATE_DISTANCES の無限化

```typescript
// gameBalance.ts: 100段階 + 無限トリガー
const _generateUpdateDistances = (): readonly number[] => {
  const intervals = [1100, 2400, 3900]
  const baseInterval = 1500
  for (let i = 3; i < 100; i++) {
    intervals.push(1100 + baseInterval * i)
  }
  return intervals
}
```

### 距離ベース難易度曲線

```typescript
// sideScroller.ts: 距離に応じてスクロール速度が 1.0倍 → 1.5倍に加速
const distanceAccelFactor = 1 + Math.min(this.distance / 20000, 0.5)
const effectiveScrollSpeed = r.scrollSpeed * distanceAccelFactor
```

### 無限選択肢ロジック

```typescript
// sideScroller.ts: 最後の UPDATE_DISTANCES を超えても 1500px ごとに更新
if (pending < 0) {
  const lastDist = UPDATE_DISTANCES[UPDATE_DISTANCES.length - 1]
  const infiniteInterval = 1500
  if (this.distance >= lastDist) {
    const extraIdx = UPDATE_DISTANCES.length + Math.floor((this.distance - lastDist) / infiniteInterval)
    if (!this.updateTriggeredFor.has(extraIdx)) {
      pending = extraIdx
    }
  }
}
```

## 選択肢ツリー構成

```
ver 1.0（基本）
├─ ver 2.0-a（戦闘・探索）
│  ├─ ... → ver 8.0-a（STG他）
│  └─ ... → ver 8.0-g（RPG他）
├─ ver 2.0-b（速度・リズム）
│  └─ ... → ver 8.0 各分岐
└─ ver 9.0-a～d（高度な分岐）
   ├─ puzzle, rhythm, platformer, roguelike, metroidvania, soulslike, endless, choices
   └─ ver 10.0～15.0：各段階で倍増
      └─ ver 15.0：16 種類のエンディング
```

## 新規選択肢の追加方法

マニュアルは JSON ファイルで定義：

1. **新しい分岐を追加する場合**
   ```bash
   src/data/manuals/your-branch.json
   ```
   を作成（import.meta.glob で自動収集）

2. **フォーマット**
   ```json
   {
     "id": "your-branch",
     "description": "説明",
     "entries": [
       {
         "key": "9.0-example",
         "version": "9.0",
         "manualText": ["ゲーム説明のテキスト"],
         "controls": { "jump": "Space", ... },
         "choices": [
           {
             "label": "選択肢1",
             "next": "10.0-a",
             "genreParams": { "tempo": 1 }
           },
           ...
         ]
       },
       ...
     ]
   }
   ```

3. **参考**
   - `src/data/manuals/TEMPLATE.json` - テンプレート
   - `src/data/manuals/advanced-branch.json` - 大規模な例

## パフォーマンス最適化

- **距離ベース難易度**: スクロール速度が 1500px 間隔で段階的に上昇
- **無限ループ対応**: 同じ距離で複数回更新されない仕組み
- **JSON バンドル**: dist に静的に埋め込まれ、サーバー不要

## テスト実行

```bash
# 無限選択肢テスト（20段階まで）
node test_massive_choices.mjs
```

---

**詳細な設計情報**: [CLAUDE.md](./CLAUDE.md) | **アーキテクチャ**: [docs/](./docs/)
