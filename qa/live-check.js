/* 线上验证：GitHub Pages 真实地址的解锁 / 渲染 / PWA / 响应式检查 */
const { chromium } = require("E:/My-codex/daily-workflow/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const BASE = "https://lvchongjun123-bot.github.io/work-helper/";
const PASSWORD = fs.readFileSync(path.join(__dirname, "..", ".access-password.txt"), "utf8").trim();

(async () => {
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });

  const errors = [];

  const ctxMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    locale: "zh-CN"
  });
  const page = await ctxMobile.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  const resp = await page.goto(BASE + "#/flow", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  const locked = (await page.locator("#unlockPwd").count()) === 1;
  const shellTitle = await page.title();
  await page.screenshot({ path: path.join(__dirname, "shots", "live-m390-lock.png"), fullPage: true });

  // 错误密码应被拒绝
  await page.locator("#unlockPwd").fill("wrong-password-test");
  await page.locator("#unlockBtn").click();
  await page.waitForTimeout(900);
  const wrongError = (await page.locator("#lockError").innerText()).trim();

  // 正确密码
  await page.locator("#unlockPwd").fill(PASSWORD);
  await page.locator("#unlockBtn").click();
  await page.waitForSelector(".hero", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);

  const title = await page.title();
  const hero = (await page.locator(".hero-date").innerText()).trim();
  const items = await page.locator(".titem").count();

  const sw = await page.evaluate(async () => {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      return !!reg;
    } catch (e) { return false; }
  });

  // 离线验证：先在线刷新让 SW 接管，再断网重载
  let offlineOk = false;
  if (sw) {
    await page.reload({ waitUntil: "networkidle" });
    await ctxMobile.setOffline(true);
    try {
      const r = await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
      offlineOk = !!(r && r.status() === 200) && (await page.locator(".hero").count()) > 0;
    } catch (e) { offlineOk = false; }
    await ctxMobile.setOffline(false);
    await page.goto(BASE + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
  }

  await page.screenshot({ path: path.join(__dirname, "shots", "live-m390-flow.png"), fullPage: true });
  await page.goto(BASE + "#/memory", { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(__dirname, "shots", "live-m390-memory.png"), fullPage: true });

  const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const dpage = await ctxDesktop.newPage();
  await dpage.goto(BASE + "#/flow", { waitUntil: "networkidle" });
  await dpage.waitForTimeout(300);
  await dpage.locator("#unlockPwd").fill(PASSWORD);
  await dpage.locator("#unlockBtn").click();
  await dpage.waitForSelector(".hero", { timeout: 25000 }).catch(() => {});
  await dpage.waitForTimeout(300);
  const sidebar = await dpage.locator(".sidebar").evaluate((el) => getComputedStyle(el).display !== "none");
  await dpage.screenshot({ path: path.join(__dirname, "shots", "live-d1440-flow.png"), fullPage: true });

  console.log(JSON.stringify({
    status: resp ? resp.status() : null,
    lockedInitially: locked,
    shellTitle,
    wrongPasswordRejected: wrongError.indexOf("密码不正确") >= 0,
    titleAfterUnlock: title,
    hero,
    items,
    serviceWorker: sw,
    offlineReload: offlineOk,
    desktopSidebar: sidebar,
    consoleErrors: errors
  }, null, 2));

  await browser.close();
})();
