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
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

// タイトル
await page.goto('http://localhost:5173');
await page.waitForTimeout(1200);
await ss(page, 'final_01_title');

// ゲーム開始
await page.click('text=はじめる');
await page.waitForTimeout(1200);
await ss(page, 'final_02_start_clean');
// 初期状態で赤い差分が出ていないか確認
const addedInitial = await page.locator('.line-added').count();
console.log('[PASS] initial added lines (expect 0):', addedInitial === 0 ? 'OK' : 'NG: ' + addedInitial);

// 障害物が流れてくるまで待機してスクリーンショット
await page.waitForTimeout(3000);
await ss(page, 'final_03_obstacles');

// 距離600m到達まで待機
let choice = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(350);
  if (await page.locator('.choice-overlay').isVisible()) { choice = true; break; }
}
await ss(page, 'final_04_choice');
console.log('[PASS] choice appeared:', choice ? 'OK' : 'NG');

// 選択して差分演出確認
if (choice) {
  await page.locator('.choice-btn').first().click();
  await page.waitForTimeout(700);
  await ss(page, 'final_05_diff_anim');
  const addedAfter = await page.locator('.line-added').count();
  console.log('[PASS] diff lines after choice:', addedAfter > 0 ? 'OK (' + addedAfter + ')' : 'NG');
}

// 2択目
for (let i = 0; i < 25; i++) {
  await page.waitForTimeout(350);
  if (await page.locator('.choice-overlay').isVisible()) break;
}
if (await page.locator('.choice-overlay').isVisible()) {
  await page.locator('.choice-btn').last().click();
  await page.waitForTimeout(1200);
}

// ジャンル確定
await ss(page, 'final_06_genre_locked');
console.log('[PASS] genre badge:', await page.locator('.hud-genre-badge').isVisible() ? 'OK' : 'NG');

// ギブアップ → 投擲
await page.waitForTimeout(500);
const gb = await page.locator('text=説明書を投げる').isVisible();
if (gb) {
  await page.click('text=説明書を投げる');
  await page.waitForTimeout(600);
  await ss(page, 'final_07_throw');

  const box = await page.locator('.throw-manual').boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 160, { steps: 15 });
    await ss(page, 'final_07b_power');
    await page.mouse.up();
    await page.waitForTimeout(3000);
    await ss(page, 'final_08_ending');
    console.log('[PASS] ending:', await page.locator('.ending-overlay').isVisible() ? 'OK' : 'NG');
    const grade = await page.locator('.ending-grade').textContent().catch(() => '-');
    console.log('[PASS] grade shown:', grade);
  }
}

console.log('Errors:', errors.length === 0 ? 'none' : errors.join(' | '));
await browser.close();
