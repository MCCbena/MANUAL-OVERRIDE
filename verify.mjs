import { chromium } from 'playwright';
import { join } from 'path';

const OUT = 'e:/00code/tes/screenshots';
import { mkdirSync } from 'fs';
try { mkdirSync(OUT, { recursive: true }); } catch {}

const ss = (page, name) => page.screenshot({ path: join(OUT, name + '.png') });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

// Step 1: Load the page
await page.goto('http://localhost:5173');
await page.waitForTimeout(1500);
await ss(page, 'step1_title');
console.log('STEP1 title visible:', await page.locator('text=取扱説明書を読むゲーム').isVisible());
console.log('STEP1 start btn visible:', await page.locator('text=はじめる').isVisible());

// Step 2: Click start
await page.click('text=はじめる');
await page.waitForTimeout(2000);
await ss(page, 'step2_gameplay');
console.log('STEP2 canvas visible:', await page.locator('canvas').isVisible());
console.log('STEP2 manual-panel visible:', await page.locator('.manual-panel').isVisible());
console.log('STEP2 hud-score visible:', await page.locator('.hud-score').isVisible());

// Step 3: Press keys
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(600);
await page.keyboard.press('Space');
await page.waitForTimeout(400);
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(600);
await ss(page, 'step3_after_keys');
console.log('STEP3 game still running:', await page.locator('canvas').isVisible());

// Step 4: Wait for update trigger
await page.waitForTimeout(8000);
await ss(page, 'step4_8s_later');
const choiceVisible = await page.locator('.choice-overlay').isVisible();
console.log('STEP4 choice panel appeared:', choiceVisible);

// Step 5: Check giveup btn
const giveupVisible = await page.locator('text=説明書を投げる').isVisible();
console.log('STEP5 giveup btn visible:', giveupVisible);

// Step 6: If giveup visible, test throw flow
if (giveupVisible) {
  await page.click('text=説明書を投げる');
  await page.waitForTimeout(800);
  await ss(page, 'step6_throw_overlay');
  console.log('STEP6 throw overlay visible:', await page.locator('.throw-overlay').isVisible());
}

console.log('Console errors:', errors.length === 0 ? 'none' : errors.join('; '));
await browser.close();
console.log('DONE');
