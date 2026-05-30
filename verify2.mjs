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

// Step 1: Title
await page.goto('http://localhost:5173');
await page.waitForTimeout(1500);
await ss(page, 'v2_step1_title');
console.log('[1] title:', await page.locator('text=取扱説明書を読むゲーム').isVisible());

// Step 2: Start game
await page.click('text=はじめる');
await page.waitForTimeout(1500);
await ss(page, 'v2_step2_start');
console.log('[2] canvas:', await page.locator('canvas').isVisible());
console.log('[2] manual-panel:', await page.locator('.manual-panel').isVisible());
console.log('[2] hud-score:', await page.locator('.hud-score').isVisible());
console.log('[2] giveup btn:', await page.locator('text=説明書を投げる').isVisible());

// Step 3: Wait for choice trigger (600m)
let choiceAppeared = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500);
  if (await page.locator('.choice-overlay').isVisible()) {
    choiceAppeared = true;
    break;
  }
}
await ss(page, 'v2_step3_choice_check');
console.log('[3] choice appeared:', choiceAppeared);
const dist = await page.locator('text=/距離:.*m/').textContent().catch(() => 'unknown');
console.log('[3] distance:', dist);

// Step 4: Make a choice
if (choiceAppeared) {
  const btns = page.locator('.choice-btn');
  console.log('[4] choice count:', await btns.count());
  await btns.first().click();
  await page.waitForTimeout(1200);
  await ss(page, 'v2_step4_after_choice');
  console.log('[4] manual updated (no longer updating phase):', await page.locator('.choice-overlay').isVisible() === false);
  console.log('[4] manual ver changed:', await page.locator('.manual-version').textContent());
}

// Step 5: Wait for 2nd choice
let choice2 = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(500);
  if (await page.locator('.choice-overlay').isVisible()) {
    choice2 = true;
    break;
  }
}
console.log('[5] 2nd choice appeared:', choice2);
if (choice2) {
  await page.locator('.choice-btn').last().click();
  await page.waitForTimeout(1200);
}

// Step 6: Wait for genre lock
await page.waitForTimeout(3000);
await ss(page, 'v2_step6_genre');
const genreBanner = await page.locator('.genre-locked-banner').isVisible();
console.log('[6] genre locked banner:', genreBanner);
if (genreBanner) {
  console.log('[6] banner text:', await page.locator('.genre-locked-text').textContent());
}

// Step 7: Giveup
const giveup = await page.locator('text=説明書を投げる').isVisible();
console.log('[7] giveup btn visible:', giveup);
if (giveup) {
  await page.click('text=説明書を投げる');
  await page.waitForTimeout(800);
  await ss(page, 'v2_step7_throw');
  console.log('[7] throw overlay:', await page.locator('.throw-overlay').isVisible());

  // Simulate drag throw
  const throwManual = page.locator('.throw-manual').first();
  const box = await throwManual.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 80, cy - 120, { steps: 10 });
    await ss(page, 'v2_step7b_dragging');
    console.log('[7b] power gauge visible:', await page.locator('.gauge-track').isVisible());
    await page.mouse.up();
    await page.waitForTimeout(3000);
    await ss(page, 'v2_step7c_flying');
    console.log('[7c] ending appeared:', await page.locator('.ending-overlay').isVisible());
  }
}

console.log('Errors:', errors.length === 0 ? 'none' : errors.join('; '));
await browser.close();
console.log('DONE');
