import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });

const logs = [];
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto('http://localhost:5173');
await page.waitForTimeout(1000);
await page.click('text=はじめる');
await page.waitForTimeout(1000);

// 2秒ごとに距離とフェーズを取得
for (let i = 0; i < 8; i++) {
  await page.waitForTimeout(2000);

  // DOM から距離テキストを読む
  const distText = await page.locator('.hud-dist-text').textContent().catch(() => '?');
  const scoreText = await page.locator('.hud-score').textContent().catch(() => '?');
  const choiceVisible = await page.locator('.choice-overlay').isVisible();

  console.log(`t=${2+i*2}s | score=${scoreText} dist=${distText} choice=${choiceVisible}`);
  if (choiceVisible) {
    console.log('Choice appeared!');
    await page.locator('.choice-btn').first().click();
    await page.waitForTimeout(500);
    break;
  }
}

console.log('Recent console logs:', logs.slice(-5).join('\n'));
await browser.close();
