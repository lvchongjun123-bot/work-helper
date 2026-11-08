/* 渲染样稿截图：手机 390 / 桌面 1440 */
const { chromium } = require("E:/My-codex/daily-workflow/node_modules/playwright");
const path = require("path");

const FILE = "file:///E:/My-codex/work-helper/private/mock-memory.html";
const SHOTS = path.join(__dirname, "shots");

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"]
  });

  // 手机一屏
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN"
  });
  const mp = await mobile.newPage();
  await mp.goto(FILE, { waitUntil: "networkidle" });
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: path.join(SHOTS, "mock-memory-mobile.png"), fullPage: false });
  await mp.screenshot({ path: path.join(SHOTS, "mock-memory-mobile-full.png"), fullPage: true });

  // 桌面
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const dp = await desktop.newPage();
  await dp.goto(FILE, { waitUntil: "networkidle" });
  await dp.waitForTimeout(400);
  await dp.screenshot({ path: path.join(SHOTS, "mock-memory-desktop.png"), fullPage: false });

  console.log("mock screenshots done");
  await browser.close();
})();
