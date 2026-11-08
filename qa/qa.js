/* 本地 QA：静态服务器 + 解密解锁 + 多尺寸截图 + 关键交互回归
 * 运行：node qa/qa.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("E:/My-codex/daily-workflow/node_modules/playwright");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = path.join(ROOT, "qa", "shots");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 8123;
const PASSWORD = fs.readFileSync(path.join(ROOT, ".access-password.txt"), "utf8").trim();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8"
};

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`);
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname); }
      catch { res.writeHead(400); res.end("bad request"); return; }
      let target = path.normalize(path.join(ROOT, pathname));
      if (!target.startsWith(ROOT)) { res.writeHead(403); res.end("forbidden"); return; }
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");
      if (!fs.existsSync(target)) { res.writeHead(404); res.end("not found"); return; }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(target).pipe(res);
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function shoot(page, name, opts = {}) {
  await page.screenshot({ path: path.join(SHOTS, name + ".png"), fullPage: opts.full !== false });
  console.log("shot:", name);
}

async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, innerW: window.innerWidth, diff: de.scrollWidth - window.innerWidth };
  });
}

async function unlockIfLocked(page, password) {
  const hasLock = await page.locator("#unlockPwd").count();
  if (!hasLock) return { locked: false, error: "" };
  await page.locator("#unlockPwd").fill(password || PASSWORD);
  await page.locator("#unlockBtn").click();
  await page.waitForFunction(() => {
    const err = document.querySelector("#lockError");
    if (err && err.textContent.trim()) return true;
    return !document.querySelector("#unlockPwd");
  }, null, { timeout: 30000 }).catch(() => {});
  const hasErr = await page.locator("#lockError").count();
  const error = hasErr ? (await page.locator("#lockError").innerText()).trim() : "";
  return { locked: true, error };
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"]
  });

  const errors = [];
  const base = `http://127.0.0.1:${PORT}/`;

  async function newPage(viewport, isMobile) {
    const context = await browser.newContext({
      viewport,
      isMobile: !!isMobile,
      hasTouch: !!isMobile,
      deviceScaleFactor: isMobile ? 2 : 1,
      serviceWorkers: "block",
      locale: "zh-CN"
    });
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    return { context, page };
  }

  /* ---------- 手机 390：解锁流程 + 功能 ---------- */
  {
    const { context, page } = await newPage({ width: 390, height: 844 }, true);
    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    check("lock: 未解锁时显示密码页", (await page.locator("#unlockPwd").count()) === 1);
    check("lock: 标题不暴露内容", (await page.title()) === "工作小助手", await page.title());
    await shoot(page, "m390-lock");

    // 错误密码
    const wrong = await unlockIfLocked(page, "definitely-wrong-pass");
    check("lock: 错误密码被拒绝", wrong.locked && wrong.error.indexOf("密码不正确") >= 0, wrong.error);
    // 正确密码
    await page.locator("#unlockPwd").fill(PASSWORD);
    await page.locator("#unlockBtn").click();
    await page.waitForSelector(".hero", { timeout: 20000 }).catch(() => {});
    check("lock: 正确密码解锁", (await page.locator(".hero").count()) === 1);

    // sessionStorage 记住会话，刷新不需要再输
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("lock: 刷新后保持解锁", (await page.locator("#unlockPwd").count()) === 0);

    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);

    const items = await page.locator(".titem").count();
    check("flow: 12 items", items === 12, "count=" + items);

    await page.locator(".tcheck").first().click();
    await page.waitForTimeout(150);
    const checked = await page.locator(".tcheck[aria-checked='true']").count();
    check("flow: checkbox toggles", checked === 1, "checked=" + checked);
    const ls = await page.evaluate(() => localStorage.getItem("wh.flow." + new Date().toISOString().slice(0, 10)));
    check("flow: state persisted", !!ls, String(ls));

    await shoot(page, "m390-flow");

    await page.locator(".tcard").first().click();
    await page.waitForTimeout(250);
    const sheetVisible = await page.locator("#sheet").evaluate((el) => !el.hidden);
    check("flow: sheet opens", sheetVisible);
    if (sheetVisible) await shoot(page, "m390-sheet", { full: false });
    await page.locator(".sheet-close").click();
    await page.waitForTimeout(150);

    await page.locator("#resetFlow").click();
    await page.waitForTimeout(150);
    const checked2 = await page.locator(".tcheck[aria-checked='true']").count();
    check("flow: reset works", checked2 === 0, "checked=" + checked2);

    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const mods = await page.locator(".modcard").count();
    check("memory: 8 modules", mods === 8, "count=" + mods);
    await shoot(page, "m390-memory");

    await page.locator("#memSearch").fill("温度");
    await page.waitForTimeout(200);
    const hits = await page.locator("#memResults .qitem").count();
    check("memory: search hits", hits > 0, "hits=" + hits);
    await shoot(page, "m390-search");
    await page.locator("#memSearch").fill("");
    await page.waitForTimeout(150);

    await page.goto(base + "#/memory/mod/m3", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const mq = await page.locator(".qitem").count();
    check("module m3: 9 questions", mq === 9, "count=" + mq);

    await page.goto(base + "#/memory/q/Q20", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const ex = await page.locator(".block-ex li").count();
    check("Q20: 3 exceptions", ex === 3, "count=" + ex);
    const red = await page.locator(".rednote").count();
    check("Q20: red note", red === 1);
    await shoot(page, "m390-question");

    await page.goto(base + "#/memory/quiz", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    await page.locator("#revealBtn").click();
    await page.waitForTimeout(200);
    const ans = await page.locator(".answer").count();
    check("quiz: reveal answer", ans === 1);
    await shoot(page, "m390-quiz");
    const before = await page.locator(".quiz-meta").innerText();
    await page.locator("#knownBtn").click();
    await page.waitForTimeout(200);
    const after = await page.locator(".quiz-meta").innerText();
    check("quiz: mark known advances", before !== after, `${before.replace(/\s+/g, " ")} -> ${after.replace(/\s+/g, " ")}`);

    await page.locator(".chip", { hasText: "直红项" }).first().click();
    await page.waitForTimeout(250);
    const redMeta = await page.locator(".quiz-meta").innerText();
    check("quiz: red range 8", /\/\s*8\s*题/.test(redMeta), redMeta.replace(/\s+/g, " "));
    await shoot(page, "m390-quiz-red");

    await page.goto(base + "#/ref", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const refs = await page.locator(".refitem").count();
    check("ref: sections", refs >= 12, "count=" + refs);
    await shoot(page, "m390-ref");

    await page.goto(base + "#/ref/temp", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const rows = await page.locator("table tbody tr").count();
    check("ref temp: 10 rows", rows === 10, "count=" + rows);
    await shoot(page, "m390-ref-temp");

    await page.goto(base + "#/ref/red", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    const redCards = await page.locator(".redcard").count();
    check("ref red: 8 cards", redCards === 8, "count=" + redCards);
    await shoot(page, "m390-ref-red");

    await page.goto(base + "#/ref/calib", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    await shoot(page, "m390-ref-calib");

    for (const hash of ["#/flow", "#/memory", "#/ref", "#/memory/quiz"]) {
      await page.goto(base + hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(120);
      const o = await overflow(page);
      check("overflow " + hash, o.diff <= 1, JSON.stringify(o));
    }

    await context.close();
  }

  /* ---------- 小屏 375 / 430 / 平板 768 ---------- */
  for (const [w, h, name] of [[375, 812, "m375-flow"], [430, 932, "m430-memory"], [768, 1024, "tab768-flow"]]) {
    const { context, page } = await newPage({ width: w, height: h }, true);
    const hash = name.includes("memory") ? "#/memory" : "#/flow";
    await page.goto(base + hash, { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const r = await unlockIfLocked(page);
    check("unlock " + w, !r.error, r.error);
    await page.waitForTimeout(200);
    const o = await overflow(page);
    check("overflow " + w, o.diff <= 1, JSON.stringify(o));
    await shoot(page, name);
    await context.close();
  }

  /* ---------- 桌面 1440 ---------- */
  {
    const { context, page } = await newPage({ width: 1440, height: 900 }, false);
    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const r = await unlockIfLocked(page);
    check("unlock desktop", !r.error, r.error);
    await page.waitForTimeout(200);
    const side = await page.locator(".sidebar").evaluate((el) => getComputedStyle(el).display !== "none");
    const tab = await page.locator(".tabbar").evaluate((el) => getComputedStyle(el).display);
    check("desktop: sidebar visible", side);
    check("desktop: tabbar hidden", tab === "none", tab);
    await shoot(page, "d1440-flow");
    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    await shoot(page, "d1440-memory");
    await page.goto(base + "#/ref/temp", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    await shoot(page, "d1440-ref");
    await context.close();
  }

  check("no console/page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  await browser.close();
  await new Promise((r) => server.close(r));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) {
    console.log("FAILED:", failed.map((f) => f.name).join("; "));
    process.exitCode = 1;
  }
})();
