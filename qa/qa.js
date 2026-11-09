/* 本地 QA v2：静态服务器 + 解密解锁 + 多尺寸截图 + 重点背诵/编辑/流程回归
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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(180);
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
      locale: "zh-CN",
      acceptDownloads: true
    });
    const page = await context.newPage();
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    return { context, page };
  }

  /* ---------- 手机 390 ---------- */
  {
    const { context, page } = await newPage({ width: 390, height: 844 }, true);
    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    check("lock: 未解锁时显示密码页", (await page.locator("#unlockPwd").count()) === 1);
    check("lock: 标题不暴露内容", (await page.title()) === "工作小助手", await page.title());
    await shoot(page, "m390-lock");

    const wrong = await unlockIfLocked(page, "definitely-wrong-pass");
    check("lock: 错误密码被拒绝", wrong.locked && wrong.error.indexOf("密码不正确") >= 0, wrong.error);
    await page.locator("#unlockPwd").fill(PASSWORD);
    await page.locator("#unlockBtn").click();
    await page.waitForSelector(".page-band", { timeout: 20000 }).catch(() => {});
    check("lock: 正确密码解锁", (await page.locator(".page-band").count()) === 1);

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    check("lock: 刷新后保持解锁", (await page.locator("#unlockPwd").count()) === 0);

    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const items = await page.locator(".titem").count();
    check("flow: 12 items", items === 12, "count=" + items);
    const tabs = await page.locator(".tabitem").count();
    check("nav: 4 tabs", tabs === 4, "count=" + tabs);

    await page.locator(".tcheck").first().click();
    await page.waitForTimeout(150);
    const checked = await page.locator(".tcheck[aria-checked='true']").count();
    check("flow: checkbox toggles", checked === 1, "checked=" + checked);
    await shoot(page, "m390-flow");
    await page.locator("#resetFlow").click();
    await page.waitForTimeout(150);

    /* 背诵首页：6 个重点卡 */
    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const keyCards = await page.locator(".keycard").count();
    check("memory: 6 key topics", keyCards === 6, "count=" + keyCards);
    const mods = await page.locator(".modcard").count();
    check("memory: 8 modules", mods === 8, "count=" + mods);
    await shoot(page, "m390-memory");

    /* 折叠动画 */
    await page.locator(".fold-head").click();
    await page.waitForTimeout(800);
    const foldOpen = await page.locator("#allFold").evaluate((el) => el.classList.contains("open"));
    const foldCount = (await page.locator("#modCount").innerText()).trim();
    check("memory: fold expands", foldOpen && foldCount === "35", "open=" + foldOpen + " count=" + foldCount);
    await shoot(page, "m390-fold-open", { full: false });
    await page.locator(".fold-head").click();
    await page.waitForTimeout(500);

    /* 重点主题详情 + 抽背 */
    await page.locator(".keycard").first().click();
    await page.waitForTimeout(300);
    check("key: detail opens", (await page.locator(".keydetail").count()) === 1);
    await shoot(page, "m390-key");
    await page.locator("#keyQuizBtn").click();
    await page.waitForTimeout(300);
    const keyMeta = await page.locator(".quiz-meta").innerText();
    check("key: quiz ranges to topic", /\/\s*6\s*题/.test(keyMeta), keyMeta.replace(/\s+/g, " "));

    /* 抽考默认重点 */
    await page.goto(base + "#/memory/quiz", { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.locator(".chip", { hasText: "重点" }).first().click();
    await page.waitForTimeout(300);
    const meta = await page.locator(".quiz-meta").innerText();
    check("quiz: 重点 34 题", /\/\s*34\s*题/.test(meta), meta.replace(/\s+/g, " "));
    await page.locator("#revealBtn").click();
    await page.waitForTimeout(250);
    check("quiz: reveal answer", (await page.locator(".answer").count()) === 1);
    await shoot(page, "m390-quiz");
    const before = await page.locator(".quiz-meta").innerText();
    await page.locator("#knownBtn").click();
    await page.waitForTimeout(250);
    const after = await page.locator(".quiz-meta").innerText();
    check("quiz: mark known advances", before !== after);

    /* 搜索 */
    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.locator("#memSearch").fill("温度");
    await page.waitForTimeout(200);
    const hits = await page.locator("#memResults .qitem").count();
    check("memory: search hits", hits > 0, "hits=" + hits);
    await page.locator("#memSearch").fill("");
    await page.waitForTimeout(150);

    /* 模块页 + 全条目 */
    await page.goto(base + "#/memory/mod/m3", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("module m3: 9 questions", (await page.locator(".qitem").count()) === 9);
    await page.goto(base + "#/memory/q/Q20", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("Q20: 3 exceptions", (await page.locator(".block-ex li").count()) === 3);

    /* 速查 */
    await page.goto(base + "#/ref", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("ref: sections", (await page.locator(".refitem").count()) >= 13);
    await shoot(page, "m390-ref");
    await page.goto(base + "#/ref/temp", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("ref temp: 10 rows", (await page.locator("table tbody tr").count()) === 10);
    await shoot(page, "m390-ref-temp");
    await page.goto(base + "#/ref/red", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("ref red: 8 cards", (await page.locator(".redcard").count()) === 8);

    /* ---------------- 编辑功能 ---------------- */
    await page.goto(base + "#/edit", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    check("edit: home cards", (await page.locator(".editcard").count()) >= 3);
    await shoot(page, "m390-edit");

    await page.goto(base + "#/edit/board/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.locator("#boardName").fill("测试板块");
    await page.locator("#boardPlace").selectOption("memory");
    await page.locator("#boardForm button[type='submit']").click();
    await page.waitForTimeout(350);
    const boardHash = await page.evaluate(() => location.hash);
    check("edit: create board", /#\/edit\/board\/b/.test(boardHash), boardHash);
    await shoot(page, "m390-board-manage");

    await page.goto(base + "#/edit/board/" + boardHash.split("/")[3] + "/entry/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.locator("#entryTitle").fill("测试条目");
    await page.locator("#entryBody").fill("- 第一条要点\n- 第二条要点\n\n第二段内容");
    await page.locator("#entryForm button[type='submit']").click();
    await page.waitForTimeout(350);
    check("edit: add entry", (await page.locator(".boardrow").count()) >= 1);

    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const hasMy = await page.locator(".boardrow").count();
    check("memory: my board shows", hasMy >= 1, "rows=" + hasMy);
    await page.locator(".boardrow").first().click();
    await page.waitForTimeout(250);
    check("my: board page opens", (await page.locator(".qitem").count()) >= 1);
    await page.locator(".qitem").first().click();
    await page.waitForTimeout(250);
    check("my: entry page opens", (await page.locator(".richbody").count()) === 1);
    await shoot(page, "m390-myentry");

    /* 流程编辑 */
    await page.goto(base + "#/edit/flow/new", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await page.locator("#flowTime").fill("14:30");
    await page.locator("#flowName").fill("测试流程条目");
    await page.locator("#flowForm button[type='submit']").click();
    await page.waitForTimeout(350);
    check("edit: add flow item", (await page.locator(".boardrow").count()) === 13);
    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const flowCrumb = await page.locator(".page-band .crumb").innerText();
    check("flow: custom flow active", flowCrumb.indexOf("自定义") >= 0, flowCrumb);
    check("flow: 13 items after edit", (await page.locator(".titem").count()) === 13);

    /* 备份导出 */
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await page.goto(base + "#/edit/backup", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).catch(() => null);
    await page.locator("#exportBtn").click();
    const download = await downloadPromise;
    check("backup: export downloads json", !!download && /工作助手-我的内容/.test(download.suggestedFilename()), download ? download.suggestedFilename() : "no download");

    /* 清空自定义内容 */
    await page.locator("#clearBtn").click();
    await page.waitForTimeout(400);
    await page.goto(base + "#/flow", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    check("flow: reset to 12 after clear", (await page.locator(".titem").count()) === 12);
    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    check("memory: my boards cleared", (await page.locator(".boardrow").count()) === 0);

    /* 溢出检查 */
    for (const hash of ["#/flow", "#/memory", "#/ref", "#/edit", "#/memory/quiz"]) {
      await page.goto(base + hash, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      const o = await overflow(page);
      check("overflow " + hash, o.diff <= 1, JSON.stringify(o));
    }

    await context.close();
  }

  /* ---------- 小屏 / 平板 ---------- */
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
    await page.goto(base + "#/memory", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    const r = await unlockIfLocked(page);
    check("unlock desktop", !r.error, r.error);
    await page.waitForTimeout(250);
    const side = await page.locator(".sidebar").evaluate((el) => getComputedStyle(el).display !== "none");
    const tab = await page.locator(".tabbar").evaluate((el) => getComputedStyle(el).display);
    check("desktop: sidebar visible", side);
    const tocVisible = await page.locator(".toc").evaluate((el) => getComputedStyle(el).display !== "none").catch(() => false);
    check("desktop: toc visible", tocVisible);
    check("desktop: tabbar hidden", tab === "none", tab);
    await shoot(page, "d1440-memory");
    await page.goto(base + "#/edit", { waitUntil: "networkidle" });
    await page.waitForTimeout(250);
    await shoot(page, "d1440-edit");
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


