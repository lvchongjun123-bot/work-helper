/* ============================================================
 * 山姆云仓 · 工作小助手
 * 纯原生 JS，无依赖、无构建步骤。
 * 路由： #/flow · #/memory · #/memory/quiz · #/memory/mod/:id
 *        #/memory/q/:id · #/ref · #/ref/:id
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------- 数据（解锁后注入，见文件底部） ---------------- */
  let META = {};
  let MODULES = [];
  let RED = [];
  let REF = [];
  let FLOW = { items: [] };
  let QLIST = [];
  let QBY = new Map();
  let REDBY = new Map();
  let MODBY = new Map();
  let REFBY = new Map();
  let ALL_QUIZ_IDS = [];

  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const STORE_FLOW = "wh.flow.";
  const STORE_MASTERY = "wh.mastery.v1";
  const SESSION_KEY = "wh.session.v1";
  const REMEMBER_KEY = "wh.key.v1";
  const ENC = window.ENC_PAYLOAD || null;

  const els = {
    view: document.getElementById("view"),
    sheet: document.getElementById("sheet"),
    sheetBody: document.getElementById("sheetBody"),
    topbarSub: document.getElementById("topbarSub"),
    todayChip: document.getElementById("todayChip"),
    brandName: document.getElementById("brandName"),
    brandSub: document.getElementById("brandSub"),
    topTitle: document.getElementById("topTitle"),
    verChip: document.getElementById("verChip")
  };

  let appReady = false;

  function initData(data) {
    META = data.meta || {};
    MODULES = data.modules || [];
    RED = data.directRed || [];
    REF = data.ref || [];
    FLOW = data.flow || { items: [] };

    QLIST = [];
    MODULES.forEach((m) => {
      (m.questions || []).forEach((q) => {
        QLIST.push(Object.assign({}, q, {
          moduleId: m.id,
          moduleName: m.name,
          moduleCode: m.code,
          moduleIcon: m.icon
        }));
      });
    });
    QBY = new Map(QLIST.map((q) => [q.id, q]));
    REDBY = new Map(RED.map((r) => [r.id, r]));
    MODBY = new Map(MODULES.map((m) => [m.id, m]));
    REFBY = new Map(REF.map((s) => [s.id, s]));
    ALL_QUIZ_IDS = QLIST.map((q) => q.id).concat(RED.map((r) => r.id));
  }

  /* ---------------- 工具函数 ---------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function storeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) { return fallback; }
  }

  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* 忽略隐私模式写入失败 */ }
  }

  function todayMeta() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return {
      key: d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()),
      dateLabel: (d.getMonth() + 1) + "月" + d.getDate() + "日",
      weekLabel: WEEK[d.getDay()],
      wdMon0: (d.getDay() + 6) % 7,
      minutes: d.getHours() * 60 + d.getMinutes()
    };
  }

  function timeToMin(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
  }

  function masteryMap() { return storeGet(STORE_MASTERY, {}); }
  function masteryCount(ids) {
    const map = masteryMap();
    return ids.filter((id) => map[id]).length;
  }

  function setSub(txt) { if (els.topbarSub) els.topbarSub.textContent = txt; }

  function setActiveNav(tab) {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const on = a.getAttribute("data-nav") === tab;
      a.classList.toggle("active", on);
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function parseHash() {
    const raw = (location.hash || "").replace(/^#\/?/, "").trim();
    return raw ? raw.split("/").filter(Boolean) : [];
  }

  function scrollTop() { window.scrollTo(0, 0); }

  /* ---------------- 根渲染 ---------------- */
  function renderRoot(opts) {
    const keepScroll = opts && opts.keepScroll;
    const y = window.scrollY;
    const parts = parseHash();
    const tab = parts[0] || "flow";
    setActiveNav(tab);
    const t = todayMeta();
    if (els.todayChip) els.todayChip.textContent = t.dateLabel + " " + t.weekLabel;

    if (tab === "flow") { setSub("FSHA V1.2 · 今日流程"); renderFlow(t); }
    else if (tab === "memory") { setSub("FSHA V1.2 · 背诵"); renderMemory(parts); }
    else if (tab === "ref") { setSub("FSHA V1.2 · 速查"); renderRef(parts); }
    else { setSub("FSHA V1.2 · 工作流程"); renderFlow(t); }

    if (keepScroll) window.scrollTo(0, y);
    else scrollTop();
  }

  /* ============================================================
   * 流程页
   * ============================================================ */
  function renderFlow(t) {
    const items = FLOW.items || [];
    const skey = STORE_FLOW + t.key;
    const checked = storeGet(skey, {});
    const eligible = items.filter((it) => it.weekday === undefined || it.weekday === t.wdMon0);
    const total = eligible.length;
    const done = eligible.filter((it) => checked[it.t]).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    let next = eligible.find((it) => !checked[it.t] && timeToMin(it.t) >= t.minutes);
    if (!next) next = eligible.find((it) => !checked[it.t]) || null;

    const rows = items.map((it) => {
      const off = it.weekday !== undefined && it.weekday !== t.wdMon0;
      const isDone = !!checked[it.t] && !off;
      const isNext = !!next && next.t === it.t && !off;
      const cls = ["titem"];
      if (off) cls.push("off");
      if (isDone) cls.push("done");
      if (isNext) cls.push("next");
      const wdTag = off ? '<span class="tag wd">仅' + WEEK[(it.weekday + 1) % 7] + "</span>" : "";
      const redChip = it.fsha && it.fsha.length
        ? '<span class="tmeta-label">关联</span>' + it.fsha.map((id) => {
            const q = QBY.get(id);
            return '<a class="qlink" href="#/memory/q/' + id + '">' + id + "</a>";
          }).join("")
        : "";
      return [
        '<li class="' + cls.join(" ") + '">',
        '  <div class="ttime">' + esc(it.t) + (isNext ? '<span class="nowdot" aria-hidden="true"></span>' : "") + "</div>",
        '  <div class="tspine"><span class="tdot"></span></div>',
        '  <div class="tcard" data-open="' + esc(it.t) + '" role="button" tabindex="0" aria-label="' + esc(it.name) + '详情">',
        '    <div class="tbody">',
        '      <div class="trow"><h3>' + esc(it.name) + "</h3>" + '<span class="tag">' + esc(it.tag || "") + "</span>" + wdTag + "</div>",
        '      <p class="tdesc">' + esc(it.desc || "") + "</p>",
        ('      <div class="tmeta">' + redChip + "</div>"),
        "    </div>",
        '    <button class="tcheck" type="button" role="checkbox" aria-checked="' + (isDone ? "true" : "false") + '" data-t="' + esc(it.t) + '"' + (off ? " disabled" : "") + ">",
        '      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4 9-9"/></svg>',
        "    </button>",
        "  </div>",
        "</li>"
      ].join("");
    }).join("");

    els.view.innerHTML = [
      '<section class="hero">',
      '  <div class="hero-row">',
      "    <div>",
      '      <p class="hero-kicker">今日流程 · ' + esc(FLOW.title || "") + "</p>",
      '      <h1 class="hero-date">' + t.dateLabel + " " + t.weekLabel + "</h1>",
      '      <p class="hero-sub">' + esc(FLOW.shift || "") + " · 今日 " + total + " 项</p>",
      "    </div>",
      '    <div class="ring" style="--p:' + pct + '" aria-hidden="true"><span>' + done + "<small>/" + total + "</small></span></div>",
      "  </div>",
      '  <div class="hero-bar"><i style="width:' + pct + '%"></i></div>',
      next
        ? '  <div class="hero-next"><span class="hero-next-k">' + (timeToMin(next.t) >= t.minutes ? "接下来" : "待完成") + '</span><b>' + esc(next.t) + " " + esc(next.name) + "</b></div>"
        : '  <div class="hero-next"><span class="hero-next-k">完成</span><b>今天的流程都勾完了 🎉</b></div>',
      "</section>",
      '<div class="flow-toolbar">',
      '  <p class="flow-note">' + esc(FLOW.note || "") + "</p>",
      "</div>",
      '<ol class="timeline">' + rows + "</ol>",
      '<div class="flow-actions"><button class="linkbtn" type="button" id="resetFlow">清空今日勾选</button></div>',
      '<p class="footnote">勾选记录只保存在本机浏览器，按天自动隔离；第二天打开是全新清单，不留历史。</p>'
    ].join("");

    const resetBtn = document.getElementById("resetFlow");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        storeSet(skey, {});
        renderRoot({ keepScroll: true });
      });
    }
  }

  function toggleFlowCheck(tKey) {
    const t = todayMeta();
    const skey = STORE_FLOW + t.key;
    const checked = storeGet(skey, {});
    if (checked[tKey]) delete checked[tKey];
    else checked[tKey] = true;
    storeSet(skey, checked);
    renderRoot({ keepScroll: true });
  }

  function openFlowSheet(tKey) {
    const t = todayMeta();
    const items = FLOW.items || [];
    const it = items.find((x) => x.t === tKey);
    if (!it) return;
    const related = (it.fsha || []).map((id) => {
      const q = QBY.get(id);
      if (!q) return "";
      return '<a class="qitem-mini" href="#/memory/q/' + id + '"><span class="qid">' + id + "</span><span>" + esc(q.title) + "</span></a>";
    }).join("");
    openSheet([
      '<h2 id="sheetTitle" class="sheet-title">' + esc(it.t) + " · " + esc(it.name) + "</h2>",
      '<p class="sheet-sub">' + esc(it.desc || "") + "</p>",
      related ? '<div class="sheet-block"><h3>关联审核点（参考）</h3><div class="minilist">' + related + "</div></div>" : "",
      '<div class="sheet-block"><h3>提示</h3><p class="sheet-text">' + esc(FLOW.note || "") + "</p></div>"
    ].join(""));
  }

  /* ============================================================
   * 背诵页
   * ============================================================ */
  function renderMemory(parts) {
    const sub = parts[1];
    if (!sub) return renderMemoryIndex();
    if (sub === "quiz") return renderQuiz();
    if (sub === "mod") return renderModule(parts[2]);
    if (sub === "q") return renderQuestion(parts[2]);
    return renderMemoryIndex();
  }

  function renderMemoryIndex() {
    const knownQ = masteryCount(QLIST.map((q) => q.id));
    const qTotal = QLIST.length;
    const pct = qTotal ? Math.round((knownQ / qTotal) * 100) : 0;

    const modCards = MODULES.map((m) => {
      const redCount = (m.questions || []).filter((q) => q.red).length;
      return [
        '<a class="modcard" href="#/memory/mod/' + m.id + '">',
        '  <span class="modicon" aria-hidden="true">' + m.icon + "</span>",
        '  <span class="modcount">' + (m.questions || []).length + " 条" + (redCount ? ' · <b class="redtxt">' + redCount + " 直红</b>" : "") + "</span>",
        '  <span class="modcode">' + esc(m.code) + "</span>",
        '  <span class="modname">' + esc(m.name) + "</span>",
        '  <span class="modsub">' + esc(m.sub || "") + "</span>",
        "</a>"
      ].join("");
    }).join("");

    els.view.innerHTML = [
      '<section class="search" role="search">',
      '  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.5 15.5l4.4 4.4"/></svg>',
      '  <input id="memSearch" type="search" placeholder="搜索 35 条：温度、洗手、蟑螂、健康证…" autocomplete="off" aria-label="搜索审核条目">',
      "</section>",
      '<div id="memMain">',
      '  <button class="quiz-entry" type="button" id="startQuiz">',
      '    <span class="quiz-entry-icon" aria-hidden="true">🎯</span>',
      '    <span class="quiz-entry-body">',
      '      <span class="quiz-entry-k">随机抽考</span>',
      '      <strong>' + qTotal + " 道审核题 + 8 类直红项</strong>",
      '      <span class="quiz-entry-sub">已掌握 <b>' + knownQ + "</b> / " + qTotal + " 题</span>",
      '      <span class="quiz-entry-bar"><i style="width:' + pct + '%"></i></span>',
      "    </span>",
      '    <span class="quiz-entry-go" aria-hidden="true">开始</span>',
      "  </button>",
      '  <div class="section-head"><h2>按模块背诵</h2><span class="section-note">Q1-Q35 · 8 个模块</span></div>',
      '  <div class="modgrid">' + modCards + "</div>",
      '  <div class="section-head"><h2>快速入口</h2><span class="section-note">速查表</span></div>',
      '  <div class="quicklinks">',
      '    <a class="quicklink" href="#/ref/temp"><span aria-hidden="true">🌡️</span>温度标准</a>',
      '    <a class="quicklink" href="#/ref/red"><span aria-hidden="true">🔴</span>8 类直红</a>',
      '    <a class="quicklink" href="#/ref/score"><span aria-hidden="true">🧮</span>计分评级</a>',
      '    <a class="quicklink" href="#/ref/fourfood"><span aria-hidden="true">🍎</span>四懂四会</a>',
      "  </div>",
      '  <p class="footnote">数据来源：FSHA 审核标准 V1.2（2026-11-07）· 35 条逐条录入；9 月背诵表冲突处已按 V1.2 修正并标注「待核对」。仅供个人复习参考。</p>',
      "</div>",
      '<div id="memResults" hidden></div>'
    ].join("");

    const input = document.getElementById("memSearch");
    const memMain = document.getElementById("memMain");
    const memResults = document.getElementById("memResults");
    if (input) {
      input.addEventListener("input", () => {
        const q = input.value.trim();
        if (!q) {
          memResults.hidden = true;
          memResults.innerHTML = "";
          memMain.hidden = false;
          return;
        }
        memMain.hidden = true;
        memResults.hidden = false;
        renderSearchResults(q, memResults);
      });
    }
    const start = document.getElementById("startQuiz");
    if (start) start.addEventListener("click", () => { location.hash = "#/memory/quiz"; });
  }

  function searchText(q) {
    return [
      q.id, q.title, q.moduleName,
      (q.areas || []).join(" "),
      q.method || "", q.standard || "", q.note || "",
      (q.exceptions || []).join(" ")
    ].join(" ").toLowerCase();
  }

  function matchSnippet(q, query) {
    const lc = query.toLowerCase();
    const keys = [["title", q.title], ["standard", q.standard || ""], ["method", q.method || ""], ["note", q.note || ""]];
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][1]).toLowerCase().indexOf(lc) >= 0) return String(keys[i][1]);
    }
    const ex = (q.exceptions || []).find((e) => String(e).toLowerCase().indexOf(lc) >= 0);
    return ex || (q.exceptions || [])[0] || "";
  }

  function markText(text, query) {
    const safe = esc(text);
    if (!query) return safe;
    try {
      const re = new RegExp("(" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      return safe.replace(re, "<mark>$1</mark>");
    } catch (err) {
      return safe;
    }
  }

  function renderSearchResults(query, container) {
    const q = query.toLowerCase();
    const hits = QLIST.filter((item) => searchText(item).indexOf(q) >= 0);
    if (!hits.length) {
      container.innerHTML = '<div class="empty"><span aria-hidden="true">🔍</span><p>没有找到「' + esc(query) + '」相关内容</p><span class="empty-sub">换个关键词试试：温度 / 洗手 / 虫害 / 过敏原 / 临期</span></div>';
      return;
    }
    container.innerHTML = '<div class="result-head">找到 <b>' + hits.length + "</b> 条</div>" +
      hits.map((item) => {
        const snip = matchSnippet(item, query);
        return [
          '<a class="qitem" href="#/memory/q/' + item.id + '">',
          '  <span class="qid">' + item.id + "</span>",
          '  <span class="qitem-body">',
          '    <span class="qitem-title">' + markText(item.title, query) + (item.red ? ' <b class="redtag">直红</b>' : "") + "</span>",
          '    <span class="qitem-snip">' + markText(snip, query) + "</span>",
          '    <span class="qitem-mod">' + esc(item.moduleName) + "</span>",
          "  </span>",
          "</a>"
        ].join("");
      }).join("");
  }

  function renderModule(id) {
    const m = MODBY.get(id);
    if (!m) { renderMemoryIndex(); return; }
    const items = (m.questions || []).map((q) => {
      return [
        '<li>',
        '  <a class="qitem" href="#/memory/q/' + q.id + '">',
        '    <span class="qid">' + q.id + "</span>",
        '    <span class="qitem-body">',
        '      <span class="qitem-title">' + esc(q.title) + (q.red ? ' <b class="redtag">直红</b>' : "") + "</span>",
        '      <span class="qitem-snip">' + esc((q.exceptions || [])[0] || (q.standard ? "标准：" + q.standard : "")) + "</span>",
        "    </span>",
        '    <span class="qarrow" aria-hidden="true">›</span>',
        "  </a>",
        "</li>"
      ].join("");
    }).join("");

    els.view.innerHTML = [
      '<div class="subhead">',
      '  <a class="back" href="#/memory">‹ 背诵</a>',
      "  <div><h1>" + m.icon + " " + esc(m.name) + "</h1><p>" + esc(m.code) + " · 共 " + (m.questions || []).length + " 条</p></div>",
      "</div>",
      '<ul class="qlist">' + items + "</ul>",
      '<p class="footnote">点任意一条查看：审核区域、审核方式、标准、例外情形。带「直红」标记的条目，相关行为可能导致直接红灯。</p>'
    ].join("");
  }

  function renderQuestion(id) {
    const q = QBY.get(id);
    if (!q) { renderMemoryIndex(); return; }
    const m = MODBY.get(q.moduleId);
    const idx = m.questions.findIndex((x) => x.id === id);
    const prev = idx > 0 ? m.questions[idx - 1] : null;
    const nextQ = idx < m.questions.length - 1 ? m.questions[idx + 1] : null;

    const areas = (q.areas || []).map((a) => '<span class="area">📍 ' + esc(a) + "</span>").join("");
    const exceptions = (q.exceptions || []).map((e) => "<li>" + esc(e) + "</li>").join("");

    els.view.innerHTML = [
      '<div class="subhead">',
      '  <a class="back" href="#/memory/mod/' + m.id + '">‹ ' + esc(m.name) + "</a>",
      "</div>",
      '<article class="qdetail">',
      '  <div class="qbadges"><span class="badge badge-id">' + q.id + "</span><span class=\"badge\">" + esc(m.name) + "</span>" + (q.red ? '<span class="badge badge-red">🔴 直红关联</span>' : "") + "</div>",
      "  <h1>" + esc(q.title) + "</h1>",
      '  <div class="arearow">' + areas + "</div>",
      q.method ? '<section class="block"><h2>审核方式</h2><p>' + esc(q.method) + "</p></section>" : "",
      q.standard ? '<section class="block block-standard"><h2>标准</h2><p>' + esc(q.standard) + "</p></section>" : "",
      exceptions ? '<section class="block block-ex"><h2>出现以下任意情形即判例外</h2><ol>' + exceptions + "</ol></section>" : "",
      q.redNote ? '<div class="rednote"><b>🔴 直接红灯</b><span>' + esc(q.redNote) + "</span></div>" : "",
      q.note ? '<div class="notebox"><b>备注</b><span>' + esc(q.note) + "</span></div>" : "",
      q.red ? '<div class="qredlink"><a href="#/ref/red">查看全部 8 类直接红灯项 →</a></div>' : "",
      '<nav class="qnav">',
      prev ? '<a class="btn ghost" href="#/memory/q/' + prev.id + '">‹ ' + prev.id + "</a>" : "<span></span>",
      nextQ ? '<a class="btn ghost" href="#/memory/q/' + nextQ.id + '">' + nextQ.id + " ›</a>" : "<span></span>",
      "</nav>",
      "</article>"
    ].join("");
  }

  /* ---------------- 随机抽考 ---------------- */
  const quiz = { range: "all", queue: [], idx: 0, revealed: false, roundKnown: 0 };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function quizPool(range) {
    if (range === "red") return RED.map((r) => ({ kind: "red", id: r.id }));
    if (range === "all") return QLIST.map((q) => ({ kind: "q", id: q.id })).concat(RED.map((r) => ({ kind: "red", id: r.id })));
    const m = MODBY.get(range);
    return m ? m.questions.map((q) => ({ kind: "q", id: q.id })) : [];
  }

  function startQuiz(range) {
    quiz.range = range || quiz.range;
    quiz.queue = shuffle(quizPool(quiz.range));
    quiz.idx = 0;
    quiz.revealed = false;
    quiz.roundKnown = 0;
    renderRoot();
  }

  function renderQuiz() {
    if (!quiz.queue.length) {
      quiz.queue = shuffle(quizPool(quiz.range));
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
    }
    const total = quiz.queue.length;
    const knownAll = masteryCount(ALL_QUIZ_IDS);

    const ranges = [
      { key: "all", label: "全部 " + (QLIST.length + RED.length) },
      { key: "red", label: "直红项 " + RED.length }
    ].concat(MODULES.map((m) => ({ key: m.id, label: m.icon + " " + m.name })));

    const chipHtml = ranges.map((r) => '<button type="button" class="chip' + (quiz.range === r.key ? " active" : "") + '" data-range="' + r.key + '">' + esc(r.label) + "</button>").join("");

    const head = [
      '<div class="subhead">',
      '  <a class="back" href="#/memory">‹ 背诵</a>',
      "  <div><h1>🎯 随机抽考</h1><p>先自己回想，再点开答案</p></div>",
      "</div>",
      '<div class="chips" role="tablist" aria-label="抽考范围">' + chipHtml + "</div>",
      '<div class="quiz-meta"><span>第 <b>' + Math.min(quiz.idx + 1, total) + "</b> / " + total + " 题</span><span>累计掌握 <b>" + knownAll + "</b> / " + ALL_QUIZ_IDS.length + "</span></div>"
    ].join("");

    let body = "";
    if (quiz.idx >= total) {
      body = [
        '<div class="done-card">',
        '  <span class="done-emoji" aria-hidden="true">✅</span>',
        "  <h2>本轮完成</h2>",
        '  <p>这一轮自评记住了 <b>' + quiz.roundKnown + "</b> 条 / 共 " + total + " 条。</p>",
        '  <div class="done-actions">',
        '    <button class="btn primary" type="button" id="quizAgain">再来一轮</button>',
        '    <button class="btn ghost" type="button" id="quizWeak">只练未掌握</button>',
        "  </div>",
        '  <button class="linkbtn" type="button" id="quizResetMastery">重置掌握进度</button>',
        "</div>"
      ].join("");
    } else {
      const cur = quiz.queue[quiz.idx];
      const item = cur.kind === "q" ? QBY.get(cur.id) : REDBY.get(cur.id);
      if (!item) { quiz.idx += 1; renderQuiz(); return; }
      body = quizCard(item, cur.kind);
    }

    els.view.innerHTML = head + body;
    bindQuiz(total);
  }

  function quizCard(item, kind) {
    const isRed = kind === "red";
    const badges = isRed
      ? '<span class="badge badge-red">🔴 直红项 ' + item.no + "</span>"
      : '<span class="badge badge-id">' + item.id + '</span><span class="badge">' + esc(item.moduleName) + "</span>" + (item.red ? '<span class="badge badge-red">🔴 直红关联</span>' : "");
    const areas = isRed ? "" : '<div class="arearow">' + (item.areas || []).map((a) => '<span class="area">📍 ' + esc(a) + "</span>").join("") + "</div>";
    const prompt = isRed ? "这一类直红项，具体哪些情形算？" : "这道题怎么判？先自己说一遍。";

    let answer = "";
    if (quiz.revealed) {
      if (isRed) {
        answer = '<div class="answer">' + renderRedBody(item) + "</div>";
      } else {
        answer = [
          '<div class="answer">',
          item.method ? '<section class="block"><h2>审核方式</h2><p>' + esc(item.method) + "</p></section>" : "",
          item.standard ? '<section class="block block-standard"><h2>标准</h2><p>' + esc(item.standard) + "</p></section>" : "",
          (item.exceptions || []).length ? '<section class="block block-ex"><h2>例外情形</h2><ol>' + item.exceptions.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ol></section>" : "",
          item.redNote ? '<div class="rednote"><b>🔴 直接红灯</b><span>' + esc(item.redNote) + "</span></div>" : "",
          '<p class="qdetail-link"><a href="#/memory/q/' + item.id + '">查看完整条目 →</a></p>',
          "</div>"
        ].join("");
      }
    }

    return [
      '<article class="quiz-question">',
      '  <div class="qbadges">' + badges + "</div>",
      "  <h1>" + esc(item.title) + "</h1>",
      "  " + areas,
      '  <p class="quiz-prompt">' + prompt + "</p>",
      quiz.revealed ? "" : '<button class="btn primary revealbtn" type="button" id="revealBtn">显示答案</button>',
      answer,
      "</article>",
      quiz.revealed
        ? '<div class="quiz-actions"><button class="btn ghost" type="button" id="againBtn">再练一次</button><button class="btn primary" type="button" id="knownBtn">记住了</button></div>'
        : ""
    ].join("");
  }

  function bindQuiz(total) {
    els.view.querySelectorAll(".chip[data-range]").forEach((chip) => {
      chip.addEventListener("click", () => startQuiz(chip.getAttribute("data-range")));
    });
    const reveal = document.getElementById("revealBtn");
    if (reveal) reveal.addEventListener("click", () => { quiz.revealed = true; renderRoot({ keepScroll: true }); });
    const again = document.getElementById("againBtn");
    if (again) again.addEventListener("click", () => { quiz.idx += 1; quiz.revealed = false; renderRoot({ keepScroll: true }); });
    const known = document.getElementById("knownBtn");
    if (known) known.addEventListener("click", () => {
      const cur = quiz.queue[quiz.idx];
      if (cur) {
        const map = masteryMap();
        if (!map[cur.id]) {
          map[cur.id] = true;
          quiz.roundKnown += 1;
        }
        storeSet(STORE_MASTERY, map);
      }
      quiz.idx += 1;
      quiz.revealed = false;
      renderRoot({ keepScroll: true });
    });
    const qAgain = document.getElementById("quizAgain");
    if (qAgain) qAgain.addEventListener("click", () => startQuiz(quiz.range));
    const weak = document.getElementById("quizWeak");
    if (weak) weak.addEventListener("click", () => {
      const map = masteryMap();
      const pool = quizPool(quiz.range).filter((x) => !map[x.id]);
      if (!pool.length) { window.alert("这个范围内没有未掌握的条目了 🎉"); return; }
      quiz.queue = shuffle(pool);
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
      renderRoot();
    });
    const resetMastery = document.getElementById("quizResetMastery");
    if (resetMastery) resetMastery.addEventListener("click", () => {
      if (!window.confirm("确定重置所有「已掌握」标记？")) return;
      storeSet(STORE_MASTERY, {});
      startQuiz(quiz.range);
    });
  }

  /* ============================================================
   * 速查页
   * ============================================================ */
  function renderRef(parts) {
    const id = parts[1];
    if (!id) return renderRefList();
    const sec = REFBY.get(id);
    if (!sec) return renderRefList();
    return renderRefDetail(sec);
  }

  function renderRefList() {
    const items = REF.map((s) => {
      const tag = s.tag ? '<span class="tag-warn">' + esc(s.tag) + "</span>" : "";
      return [
        '<a class="refitem" href="#/ref/' + s.id + '">',
        '  <span class="reficon" aria-hidden="true">' + s.icon + "</span>",
        '  <span class="refbody"><h3>' + esc(s.title) + tag + "</h3><p>" + esc(s.sub || "") + "</p></span>",
        '  <span class="refarrow" aria-hidden="true">›</span>',
        "</a>"
      ].join("");
    }).join("");

    els.view.innerHTML = [
      '<div class="section-head"><h2>速查</h2><span class="section-note">' + REF.length + " 个主题</span></div>",
      '<div class="reflist">' + items + "</div>",
      '<p class="footnote">其中标注「待核对」的卡片来自 9 月背诵表，与 V1.2 存在差异或 V1.2 未收录，已按 V1.2 修正明显错误；请以公司最新文件为准。</p>',
      '<div class="aboutbox">',
      '  <h3>关于</h3>',
      "  <p>" + esc(META.appName || "工作小助手") + " · FSHA " + esc(META.fshaVersion || "") + "（" + esc(META.fshaUpdated || "") + "）</p>",
      "  <p>内容来源：" + esc(META.source || "") + "；工作流程初版来自用户 daily-workflow 早班模板。</p>",
      "  <p>数据只在本机浏览器保存，不上传、不统计。</p>",
      "</div>"
    ].join("");
  }

  function renderRefDetail(sec) {
    els.view.innerHTML = [
      '<div class="subhead">',
      '  <a class="back" href="#/ref">‹ 速查</a>',
      "  <div><h1>" + sec.icon + " " + esc(sec.title) + "</h1><p>" + esc(sec.sub || "") + "</p></div>",
      "</div>",
      sec.tag ? '<div class="detail-tag"><span class="tag-warn">' + esc(sec.tag) + "：请按公司最新文件核对</span></div>" : "",
      '<div class="rblocks">' + renderBlocks(sec.blocks || []) + "</div>",
      '<p class="footnote">来源：FSHA 审核标准 V1.2（2026-11-07）' + (sec.tag ? "；本卡片部分内容来自 9 月背诵表" : "") + "。仅供个人复习参考。</p>"
    ].join("");
  }

  function renderBlocks(blocks) {
    return blocks.map((b) => {
      if (b.type === "kv") {
        const rows = b.rows.map((row) => '<div class="kv-row"><div class="kv-k">' + esc(row[0]) + '</div><div class="kv-v">' + esc(row[1]) + "</div></div>").join("");
        return '<div class="rblock' + (b.tone === "brand" ? " rblock-brand" : "") + '"><div class="kv">' + rows + "</div></div>";
      }
      if (b.type === "table") {
        const head = b.head.map((h) => "<th>" + esc(h) + "</th>").join("");
        const rows = b.rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("");
        return '<div class="rblock rblock-table"><div class="tablewrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div></div>";
      }
      if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        return '<div class="rblock"><' + tag + ' class="rlist">' + b.items.map((i) => "<li>" + esc(i) + "</li>").join("") + "</" + tag + "></div>";
      }
      if (b.type === "note") {
        return '<div class="rblock note-box"><span class="note-k">说明</span><span>' + esc(b.text) + "</span></div>";
      }
      if (b.type === "p") {
        return '<div class="rblock"><p class="' + (b.big ? "bigp" : "") + '">' + esc(b.text) + "</p></div>";
      }
      if (b.type === "red") {
        return '<div class="redblock">' + RED.map(renderRedCard).join("") + "</div>";
      }
      return "";
    }).join("");
  }

  function renderRedCard(r) {
    return [
      '<article class="redcard" id="' + r.id + '">',
      '  <div class="redcard-head"><span class="redcard-no">' + r.no + "</span><h3>" + esc(r.title) + "</h3></div>",
      renderRedBody(r),
      "</article>"
    ].join("");
  }

  function renderRedBody(r) {
    return (r.sections || []).map((sec) => {
      const head = sec.head ? '<p class="redsec-head">' + esc(sec.head) + "</p>" : "";
      const list = '<ul class="redsec">' + (sec.items || []).map((i) => "<li>" + esc(i) + "</li>").join("") + "</ul>";
      return head + list;
    }).join("");
  }

  /* ============================================================
   * 底部弹层
   * ============================================================ */
  function openSheet(html) {
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
    document.body.classList.add("sheet-open");
    const close = els.sheet.querySelector(".sheet-close");
    if (close) close.focus();
  }

  function closeSheet() {
    els.sheet.hidden = true;
    document.body.classList.remove("sheet-open");
  }

  document.addEventListener("click", (e) => {
    const close = e.target.closest("[data-close]");
    if (close) { closeSheet(); return; }
    const link = e.target.closest("#sheetBody a[href^='#/']");
    if (link) closeSheet();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.sheet.hidden) closeSheet();
  });

  /* ============================================================
   * 全局事件
   * ============================================================ */
  els.view.addEventListener("click", (e) => {
    const chk = e.target.closest(".tcheck");
    if (chk) {
      e.preventDefault();
      if (!chk.disabled) toggleFlowCheck(chk.getAttribute("data-t"));
      return;
    }
    if (e.target.closest("a")) return;
    const card = e.target.closest(".tcard[data-open]");
    if (card) openFlowSheet(card.getAttribute("data-open"));
  });

  els.view.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("tcard")) {
      e.preventDefault();
      openFlowSheet(e.target.getAttribute("data-open"));
    }
  });

  window.addEventListener("hashchange", () => { if (appReady) renderRoot(); });

  /* ============================================================
   * 解锁 / 启动
   * 公开的页面壳 + 加密数据包（window.ENC_PAYLOAD）；
   * 密码只在本机参与 PBKDF2 派生，不上传、不存储明文。
   * ============================================================ */
  function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function bytesToB64(bytes) {
    const arr = new Uint8Array(bytes);
    let s = "";
    for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
    return btoa(s);
  }

  function sessionLoad() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function sessionSave(data) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch (err) { /* 忽略 */ }
  }

  function rememberedKey() {
    try { return localStorage.getItem(REMEMBER_KEY); } catch (err) { return null; }
  }

  function rememberKey(b64) {
    try { localStorage.setItem(REMEMBER_KEY, b64); } catch (err) { /* 忽略 */ }
  }

  function clearRemembered() {
    try { localStorage.removeItem(REMEMBER_KEY); } catch (err) { /* 忽略 */ }
  }

  async function deriveKey(password, saltBytes, iterations) {
    const base = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBytes, iterations: iterations, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]
    );
  }

  async function decryptWithKey(key) {
    const ct = b64ToBytes(ENC.ct);
    const tag = b64ToBytes(ENC.tag);
    const iv = b64ToBytes(ENC.iv);
    const buf = new Uint8Array(ct.length + tag.length);
    buf.set(ct, 0);
    buf.set(tag, ct.length);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv, tagLength: 128 }, key, buf);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function unlockWithPassword(password, remember) {
    const key = await deriveKey(password, b64ToBytes(ENC.salt), ENC.iter);
    const data = await decryptWithKey(key);
    if (remember) {
      const raw = await crypto.subtle.exportKey("raw", key);
      rememberKey(bytesToB64(raw));
    }
    return data;
  }

  async function unlockWithRemembered(rawB64) {
    const key = await crypto.subtle.importKey("raw", b64ToBytes(rawB64), { name: "AES-GCM" }, false, ["decrypt"]);
    return decryptWithKey(key);
  }

  function updateBranding() {
    const name = META.appName || "工作小助手";
    const parts = String(name).split(" · ");
    document.title = name;
    if (els.topTitle) els.topTitle.textContent = name;
    if (els.brandName) els.brandName.textContent = parts[0] || name;
    if (els.brandSub) els.brandSub.textContent = parts[1] || "工作助手";
    if (els.verChip) els.verChip.innerHTML = "FSHA <b>" + esc(META.fshaVersion || "") + "</b>";
  }

  function startApp(data) {
    initData(data);
    appReady = true;
    document.body.classList.remove("locked");
    updateBranding();
    renderRoot();
  }

  function renderLock(message) {
    document.body.classList.add("locked");
    if (els.topbarSub) els.topbarSub.textContent = "私有内容 · 密码解锁";
    els.view.innerHTML = [
      '<section class="lock">',
      '  <div class="lock-badge" aria-hidden="true">🔒</div>',
      "  <h1>工作小助手</h1>",
      '  <p class="lock-sub">内容已加密，请输入访问密码</p>',
      '  <form id="unlockForm" class="lock-form" autocomplete="off">',
      '    <input id="unlockPwd" type="password" placeholder="访问密码" aria-label="访问密码" autocomplete="current-password" required>',
      '    <button class="btn primary" type="submit" id="unlockBtn">解锁</button>',
      "  </form>",
      '  <label class="lock-remember"><input type="checkbox" id="rememberChk"> 在此设备记住（下次自动解锁）</label>',
      '  <p class="lock-error" id="lockError" role="alert">' + esc(message || "") + "</p>",
      '  <p class="lock-foot">密码只在本机参与解密、不会上传；忘记后需要重新生成加密数据包。</p>',
      "</section>"
    ].join("");

    const form = document.getElementById("unlockForm");
    const input = document.getElementById("unlockPwd");
    const err = document.getElementById("lockError");
    const btn = document.getElementById("unlockBtn");
    if (input) setTimeout(() => input.focus(), 60);
    if (form) form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!ENC) { err.textContent = "缺少加密数据包，无法解锁。"; return; }
      if (!window.crypto || !crypto.subtle) { err.textContent = "当前浏览器环境不支持解密，请用 HTTPS 打开。"; return; }
      const pwd = input.value;
      if (!pwd) return;
      btn.disabled = true;
      btn.textContent = "解锁中…";
      err.textContent = "";
      try {
        const remember = document.getElementById("rememberChk").checked;
        const data = await unlockWithPassword(pwd, remember);
        sessionSave(data);
        startApp(data);
      } catch (ex) {
        err.textContent = "密码不正确，或数据包已更新，请重试。";
        input.select();
      } finally {
        btn.disabled = false;
        btn.textContent = "解锁";
      }
    });
  }

  async function autoUnlock() {
    const raw = rememberedKey();
    if (!raw) { renderLock(); return; }
    els.view.innerHTML = '<div class="boot"><span class="boot-spin" aria-hidden="true"></span><p>正在解锁…</p></div>';
    try {
      const data = await unlockWithRemembered(raw);
      sessionSave(data);
      startApp(data);
    } catch (ex) {
      clearRemembered();
      renderLock("自动解锁失败，请重新输入密码");
    }
  }

  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => { /* 离线能力不可用不影响页面 */ });
      });
    }
  }

  /* ---------------- 启动流程 ---------------- */
  if (!location.hash) location.hash = "#/flow";
  registerSW();

  const cachedSession = sessionLoad();
  if (cachedSession) {
    startApp(cachedSession);
  } else if (!ENC) {
    renderLock("缺少加密数据包，请稍后重试。");
  } else {
    autoUnlock();
  }
})();
