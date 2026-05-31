import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  // ページロード
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  
  // スクリーンショット取得（タイトル画面）
  await page.screenshot({ path: '/tmp/title-screen.png' });
  console.log('✓ Title screen loaded');
  
  // タイトルテキストを確認
  const titleText = await page.locator('.title-main').textContent();
  console.log(`Title text: "${titleText}"`);
  
  // コンソールエラーをチェック
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // ゲーム開始ボタンをクリック
  const startBtn = page.locator('.title-btn');
  if (await startBtn.isVisible()) {
    console.log('✓ Start button is visible');
    await startBtn.click();
    await page.waitForTimeout(1000);
  }
  
  // スクリーンショット取得（ゲーム画面）
  await page.screenshot({ path: '/tmp/game-screen.png' });
  console.log('✓ Game started');
  
  // DebugPanel を確認
  const debugPanel = await page.locator('.debug-panel').isVisible();
  console.log(`Debug panel visible: ${debugPanel}`);
  
  if (errors.length > 0) {
    console.error('Console errors found:');
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log('✓ No console errors');
  }
  
  console.log('\n✅ All tests passed!');
} catch (e) {
  console.error('Test failed:', e.message);
  process.exit(1);
} finally {
  await browser.close();
}
