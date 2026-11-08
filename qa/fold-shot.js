/* 折叠效果截图：收起 / 展开 / 动画帧 */
const { chromium } = require("E:/My-codex/daily-workflow/node_modules/playwright");
const path = require("path");
const fs = require("fs");

const FILE = "file:///E:/My-codex/work-helper/private/mock-memory.html";
const SHOTS = path.join(__dirname, "shots");
const FRAMES = path.join(SHOTS, "fold-frames");

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });

  // 静态两态：dsf=2
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN"
  });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("allFold").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, "fold-collapsed.png") });

  await page.locator(".fold-head").click();
  await page.waitForTimeout(140);
  await page.screenshot({ path: path.join(SHOTS, "fold-mid.png") });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, "fold-expanded.png") });

  // GIF 帧：dsf=1，体积小
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-CN" });
  const p2 = await ctx2.newPage();
  await p2.goto(FILE, { waitUntil: "networkidle" });
  await p2.waitForTimeout(300);
  await p2.evaluate(() => document.getElementById("allFold").scrollIntoView({ block: "center" }));
  await p2.waitForTimeout(250);
  await p2.locator(".fold-head").click();
  const frames = [];
  for (let i = 0; i < 10; i++) {
    const f = path.join(FRAMES, "f" + String(i).padStart(2, "0") + ".png");
    await p2.screenshot({ path: f });
    frames.push(f);
    await p2.waitForTimeout(65);
  }
  console.log("frames:", frames.length);
  await browser.close();
})();
