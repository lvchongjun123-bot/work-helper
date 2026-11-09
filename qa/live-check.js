/* 线上验证 v2：GitHub Pages 真实地址的解锁 / 重点背诵 / 编辑 / PWA / 响应式 */
const { chromium } = require("E:/My-codex/daily-workflow/node_modules/playwright");
const fs = require("fs");
const path = require("path");

const BASE = "https://lvchongjun123-bot.github.io/work-helper/";
const PASSWORD = fs.readFileSync(path.join(__dirname, "..", ".access-password.txt"), "utf8").trim();
const SHOTS = path.join(__dirname, "shots");

async function shot(page, name, fullPage = false) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage });
}

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
  await shot(page, "live-m390-lock");

  await page.locator("#unlockPwd").fill("wrong-password-test");
  await page.locator("#unlockBtn").click();
  await page.waitForTimeout(900);
  const wrongError = (await page.locator("#lockError").innerText()).trim();

  await page.locator("#unlockPwd").fill(PASSWORD);
  await page.locator("#unlockBtn").click();
  await page.waitForSelector(".page-band", { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(500);

  const title = await page.title();
  const hero = (await page.locator(".page-band h1").innerText()).trim();
  const items = await page.locator(".titem").count();
  const tabs = await page.locator(".tabitem").count();
  await shot(page, "live-m390-flow");

  const sw = await page.evaluate(async () => {
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 5000))
      ]);
      return !!reg;
    } catch (e) { return false; }
  });

  let offlineOk = false;
  if (sw) {
    await page.reload({ waitUntil: "networkidle" });
    await ctxMobile.setOffline(true);
    try {
      const r = await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
      offlineOk = !!(r && r.status() === 200) && (await page.locator(".page-band").count()) > 0;
    } catch (e) { offlineOk = false; }
    await ctxMobile.setOffline(false);
    await page.goto(BASE + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
  }

  await shot(page, "live-m390-memory");
  const keyCards = await page.locator(".keycard").count();
  const mods = await page.locator(".modcard").count();

  // 重点主题详情
  await page.locator(".keycard").first().click();
  await page.waitForTimeout(400);
  const keyDetail = (await page.locator(".keydetail").count()) === 1;
  await shot(page, "live-m390-key");

  // 抽考
  await page.goto(BASE + "#/memory/quiz", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await page.locator(".chip", { hasText: "重点" }).first().click();
  await page.waitForTimeout(300);
  const quizMeta = (await page.locator(".quiz-meta").innerText()).replace(/\s+/g, " ");
  await shot(page, "live-m390-quiz");

  // 编辑页
  await page.goto(BASE + "#/edit", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const editCards = await page.locator(".editcard").count();
  await shot(page, "live-m390-edit");

  const ctxDesktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-CN" });
  const dpage = await ctxDesktop.newPage();
  await dpage.goto(BASE + "#/memory", { waitUntil: "networkidle" });
  await dpage.waitForTimeout(300);
  await dpage.locator("#unlockPwd").fill(PASSWORD);
  await dpage.locator("#unlockBtn").click();
  await dpage.waitForSelector(".keycard", { timeout: 25000 }).catch(() => {});
  await dpage.waitForTimeout(400);
  const sidebar = await dpage.locator(".sidebar").evaluate((el) => getComputedStyle(el).display !== "none");
  await shot(dpage, "live-d1440-memory");

  console.log(JSON.stringify({
    status: resp ? resp.status() : null,
    lockedInitially: locked,
    shellTitle,
    wrongPasswordRejected: wrongError.indexOf("密码不正确") >= 0,
    titleAfterUnlock: title,
    hero,
    items,
    tabs,
    keyCards,
    modules: mods,
    keyDetail,
    quizMeta,
    editCards,
    serviceWorker: sw,
    offlineReload: offlineOk,
    desktopSidebar: sidebar,
    consoleErrors: errors
  }, null, 2));

  await browser.close();
})();

