# Issue #146: サプライズエンドの実装完了要件定義

## 概要
現在の `computeSurpriseEnding()` 関数は `glitch` エンドのみ実装されており、以下の3種類の判定ロジックが未実装状態です。これを完全に実装し、Issue #24 の「分岐の意外な結末」を完成させます。

## 実装するエンドタイプ

### 1. hidden_genre（隠しジャンル）
**発火条件**: 
- 特定の軸パラメータの組み合わせが閾値を超える
- または、特定のカードIDの選択履歴パターンに一致する場合
- **例**: tempo > 3.0 && stealth > 2.5 で "stealth_action" へ誘導など

**実装方法**:
- `src/data/config/surprise-ending-conditions.json` に条件テーブルを作成
- JSON 形式:
```json
{
  "hidden_genre": [
    {
      "id": "hide-1",
      "title": "隠されたジャンル",
      "trigger": {
        "type": "genre_params",
        "params": ["tempo", "stealth"],
        "thresholds": { "tempo": 3.0, "stealth": 2.5 },
        "resultGenre": "stealth_action"
      }
    }
  ]
}
```

### 2. bad_ending（バッドエンド）
**発火条件**: 
- プレイスタイルが特定の状態に達する（例：chaotic 信頼度 > 0.8）
- あるいは、矛盾スコアが高くても glitch エンドには至らない場合の分岐

**実装方法**:
```json
{
  "bad_ending": [
    {
      "id": "bad-1",
      "title": "最悪の結末",
      "trigger": {
        "type": "play_style",
        "style": "chaotic",
        "minConfidence": 0.8,
        "description": "混沌が君を飲み込んだ..."
      }
    }
  ]
}
```

### 3. narrative_twist（ナラティブツイスト）
**発火条件**: 
- 選択履歴のパターンによる分岐（例：特定のカードの連続選択、回避率など）
- プレイスタイルと矛盾スコアの組み合わせ

**実装方法**:
```json
{
  "narrative_twist": [
    {
      "id": "twist-1",
      "title": "予想外の転換点",
      "trigger": {
        "type": "pattern",
        "requiredChoices": ["c-choice-a", "c-choice-b"],
        "orderMatters": true,
        "description": "過去の一部択が今、裏切りの形に"
      }
    }
  ]
}
```

## 判定順序
1. `glitch` エンド（矛盾スコア >= 閾値）
2. `hidden_genre`（条件テーブルから一致するもの）
3. `bad_ending`（プレイスタイルに基づく判定）
4. `narrative_twist`（選択履歴パターンのチェック）
5. どれも該当しなければ `null`

## 実装箇所
1. **データ定義**: 
   - 新しい JSON ファイル: `src/data/config/surprise-ending-conditions.json`
   - 型定義は既存の `SurpriseEndingType` を流用可能

2. **ロジック実装**: 
   - `src/composables/useGameState.ts` の `computeSurpriseEnding()` 関数内の TODO コメント部分を置き換え
   - 各エンドタイプごとに判定関数を分割して記述する（可読性向上）

3. **テスト追加**:
   - ユニットテスト: `tests/unit/domain/surpriseEnding.test.ts`
   - E2E テスト：既存の `surprise-ending.spec.ts` にケースを追加

## 要件
- 既存の `glitch` ロジックは維持すること
- 条件テーブルは JSON で記述し、変更容易性を確保する
- 各判定には明確な理由（説明テキスト）を返す
- プレイスタイル検出結果（PlayStyleResult）と矛盾状態（ContradictionState）を有効活用する

## 成功基準
- 全てのエンドタイプが正常に発火する
- テストが全てパスする
- エンディングパネルで適切な表示が行われる