import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';
const OUT = 'e:/00code/tes/screenshots';
try { mkdirSync(OUT, { recursive: true }); } catch {}
const ss = (p, n) => p.screenshot({ path: join(OUT, n + '.png') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });

// タイトル
await page.goto('http://localhost:5173');
await page.waitForTimeout(1200);
await ss(page, 'ux_01_title');

// ゲーム開始
await page.click('text=はじめる');
await page.waitForTimeout(1000);
await ss(page, 'ux_02_tutorial_start');

// チュートリアルヒントの確認
const hasHints = await page.locator('.tutorial-overlay').isVisible();
const hasColorHint = await page.locator('.hint-colors').isVisible();
const hasMoveHint = await page.locator('.hint-move').isVisible();
const hasJumpHint = await page.locator('.hint-jump').isVisible();
console.log('[CHECK] tutorial hints visible:', hasHints ? 'OK' : 'NG');
console.log('[CHECK] color rule hint:', hasColorHint ? 'OK' : 'NG');
console.log('[CHECK] move hint:', hasMoveHint ? 'OK' : 'NG');
console.log('[CHECK] jump hint:', hasJumpHint ? 'OK' : 'NG');

// giveup は tutorial 中は非表示のはず
const giveupDuringTutorial = await page.locator('text=説明書を投げてゲームを終わらせる').isVisible();
console.log('[CHECK] giveup hidden during tutorial:', !giveupDuringTutorial ? 'OK' : 'NG (shown too early)');

// 600m まで待機 → 2択出現
for (let i = 0; i < 22; i++) {
  await page.waitForTimeout(380);
  if (await page.locator('.choice-overlay').isVisible()) break;
}
await ss(page, 'ux_03_choice_panel');
console.log('[CHECK] choice panel:', await page.locator('.choice-overlay').isVisible() ? 'OK' : 'NG');

// 選択 → playing フェーズへ
await page.locator('.choice-btn').first().click();
await page.waitForTimeout(800);
await ss(page, 'ux_04_after_choice');

// playing フェーズでは giveup が表示されるはず
const giveupAfterChoice = await page.locator('text=説明書を投げてゲームを終わらせる').isVisible();
console.log('[CHECK] giveup visible after choice:', giveupAfterChoice ? 'OK' : 'NG');
// giveup hint も表示されるか
const giveupHint = await page.locator('.giveup-hint').isVisible();
console.log('[CHECK] giveup sub-hint:', giveupHint ? 'OK' : 'NG');

// 2択目
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(380);
  if (await page.locator('.choice-overlay').isVisible()) break;
}
if (await page.locator('.choice-overlay').isVisible()) {
  await page.locator('.choice-btn').last().click();
  await page.waitForTimeout(1200);
}
await ss(page, 'ux_05_genre_locked');
console.log('[CHECK] genre locked:', await page.locator('.hud-genre-badge').isVisible() ? 'OK' : 'NG');

console.log('Errors:', errs.length === 0 ? 'none' : errs.join(' | '));
await browser.close();
