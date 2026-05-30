// ブラッシュアップ後の動作検証
import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';

const OUT = 'e:/00code/tes/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}
const ss = (page, name) => page.screenshot({ path: join(OUT, name + '.png') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

const errors = [];
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

// 1. タイトル
await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
await ss(page, 'v3_01_title');

// 2. ゲーム開始
await page.click('text=はじめる');
await page.waitForTimeout(800);
await ss(page, 'v3_02_gamestart');
console.log('[2] canvas:', await page.locator('canvas').isVisible());
console.log('[2] manual-panel:', await page.locator('.manual-panel').isVisible());
console.log('[2] hud-score:', await page.locator('.hud-score').isVisible());
console.log('[2] giveup btn:', await page.locator('text=説明書を投げる').isVisible());

// 3. Spaceキーでジャンプ（最重要バグ修正確認）
// headless では実際のキー入力をシミュレートする
await page.keyboard.down('Space');
await page.waitForTimeout(150);
await page.keyboard.up('Space');
await page.waitForTimeout(400);
await ss(page, 'v3_03_jump_test');
console.log('[3] jump simulated (no crash):', await page.locator('canvas').isVisible());

// ArrowLeft / ArrowRight
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(500);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowLeft');

// 4. 距離600mまで待機（スクロールが自動）
let choiceAppeared = false;
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(400);
  if (await page.locator('.choice-overlay').isVisible()) {
    choiceAppeared = true;
    break;
  }
}
await ss(page, 'v3_04_choice');
console.log('[4] choice at 600m:', choiceAppeared);

// 5. 選択 → 説明書更新（差分アニメーション確認）
if (choiceAppeared) {
  await page.locator('.choice-btn').first().click();
  await page.waitForTimeout(600);
  await ss(page, 'v3_05_after_choice');
  // ver.2.0 になっているか
  const verText = await page.locator('.manual-ver-badge').textContent();
  console.log('[5] manual version:', verText?.trim());
  // 追加行の赤テキストがあるか
  const addedLines = await page.locator('.line-added').count();
  console.log('[5] diff added lines:', addedLines);
}

// 6. 2択目まで待機
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(400);
  if (await page.locator('.choice-overlay').isVisible()) break;
}
if (await page.locator('.choice-overlay').isVisible()) {
  await page.locator('.choice-btn').last().click();
  await page.waitForTimeout(1200);
}
await ss(page, 'v3_06_genre_lock');
console.log('[6] genre badge visible:', await page.locator('.hud-genre-badge').isVisible());
console.log('[6] genre locked banner:', await page.locator('.genre-locked-banner').isVisible());

// 7. ギブアップ → 投擲フェーズ
const giveup = await page.locator('text=説明書を投げる').isVisible();
console.log('[7] giveup btn:', giveup);
if (giveup) {
  await page.click('text=説明書を投げる');
  await page.waitForTimeout(700);
  await ss(page, 'v3_07_throw');
  console.log('[7] throw overlay:', await page.locator('.throw-overlay').isVisible());

  // ドラッグ投擲
  const throwManual = page.locator('.throw-manual');
  const box = await throwManual.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy - 140, { steps: 12 });
    await ss(page, 'v3_07b_dragging');
    console.log('[7b] power gauge:', await page.locator('.gauge-track').isVisible());
    await page.mouse.up();
    await page.waitForTimeout(2800);
    await ss(page, 'v3_08_ending');
    console.log('[8] ending panel:', await page.locator('.ending-overlay').isVisible());
  }
}

console.log('Console errors:', errors.length === 0 ? 'none' : errors.join(' | '));
await browser.close();
console.log('DONE');
