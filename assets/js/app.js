/* ============================================================
 * 工作小助手 · 现场手册风（v3）
 * 纯原生 JS，无依赖、无构建步骤。
 * 路由：
 *   #/flow
 *   #/memory · #/memory/quiz · #/memory/key/:id · #/memory/mod/:id · #/memory/q/:id
 *   #/ref · #/ref/:id
 *   #/my/board/:id · #/my/entry/:boardId/:entryId
 *   #/edit · #/edit/board/... · #/edit/flow/... · #/edit/backup
 * ============================================================ */
(function () {
  "use strict";

  /* ---------------- 数据（解锁后注入） ---------------- */
  let META = {};
  let MODULES = [];
  let RED = [];
  let REF = [];
  let FLOW = { items: [] };
  let KEY_TOPICS = [];

  let QLIST = [];
  let QBY = new Map();
  let REDBY = new Map();
  let MODBY = new Map();
  let REFBY = new Map();
  let KEYBY = new Map();
  let KEY_QUIZ = [];
  let KEYQBY = new Map();

  /* ---------------- 我的内容（本机编辑） ---------------- */
  const CUSTOM_KEY = "wh.custom.v1";
  let CUSTOM = { boards: [], flow: null };

  const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const STORE_FLOW = "wh.flow.";
  const STORE_MASTERY = "wh.mastery.v1";
  const SESSION_KEY = "wh.session.v1";
  const REMEMBER_KEY = "wh.key.v1";
  const ENC = window.ENC_PAYLOAD || null;

  const CHEV = '<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const BACK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

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

  function buildDerived() {
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
    KEYBY = new Map(KEY_TOPICS.map((k) => [k.id, k]));
    KEY_QUIZ = [];
    KEY_TOPICS.forEach((k) => {
      (k.quiz || []).forEach((qa, i) => {
        KEY_QUIZ.push({ kind: "key", id: k.id + "#" + i, keyId: k.id, q: qa.q, a: qa.a });
      });
    });
    KEYQBY = new Map(KEY_QUIZ.map((x) => [x.id, x]));
  }

  function initData(data) {
    META = data.meta || {};
    MODULES = data.modules || [];
    RED = data.directRed || [];
    REF = data.ref || [];
    FLOW = data.flow || { items: [] };
    KEY_TOPICS = data.keyTopics || [];
    buildDerived();
    loadCustom();
  }

  /* ---------------- 小工具 ---------------- */
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function storeGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) { return fallback; }
  }

  function storeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* 忽略 */ }
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

  function uid(prefix) {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function fmtDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
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

  function pageHead(crumb, title, ledeHtml) {
    return '<header class="page-head">' +
      '<div><p class="crumb">' + esc(crumb) + "</p><h1>" + esc(title) + "</h1></div>" +
      (ledeHtml ? '<p class="lede">' + ledeHtml + "</p>" : "") +
      "</header>";
  }

  function detailHead(crumb, title, lede) {
    return '<header class="detail-head">' +
      '<p class="crumb">' + esc(crumb) + "</p><h1>" + esc(title) + "</h1>" +
      (lede ? '<p class="lede">' + esc(lede) + "</p>" : "") +
      "</header>";
  }

  function backLink(href, label) {
    return '<div class="subhead"><a class="back" href="' + href + '">' + BACK + "<span>" + esc(label) + "</span></a></div>";
  }

  function sectionHead(title, meta) {
    return '<div class="sec-head"><h2>' + esc(title) + '</h2><span class="sec-meta">' + esc(meta) + "</span></div>";
  }

  function footLine(text) {
    return '<p class="foot">' + text + "</p>";
  }

  /* ---------------- 我的内容存储 ---------------- */
  function loadCustom() {
    const c = storeGet(CUSTOM_KEY, null);
    CUSTOM = (c && typeof c === "object")
      ? {
          boards: Array.isArray(c.boards) ? c.boards : [],
          flow: (c.flow && Array.isArray(c.flow.items)) ? c.flow : null
        }
      : { boards: [], flow: null };
  }

  function saveCustom() { storeSet(CUSTOM_KEY, CUSTOM); }

  function customBoards(place) { return CUSTOM.boards.filter((b) => b.place === place); }
  function findBoard(id) { return CUSTOM.boards.find((b) => b.id === id) || null; }

  function effectiveFlow() {
    return (CUSTOM.flow && CUSTOM.flow.items && CUSTOM.flow.items.length) ? CUSTOM.flow : FLOW;
  }

  function ensureCustomFlow() {
    if (!CUSTOM.flow) {
      CUSTOM.flow = { title: FLOW.title || "工作流程", shift: FLOW.shift || "", items: (FLOW.items || []).map((x) => Object.assign({}, x)) };
      saveCustom();
    }
    return CUSTOM.flow;
  }

  /* ============================================================
   * 根渲染
   * ============================================================ */
  function renderRoot(opts) {
    const keepScroll = opts && opts.keepScroll;
    const y = window.scrollY;
    const parts = parseHash();
    const tab = parts[0] || "flow";
    let navTab = tab;
    if (tab === "my") {
      const b = parts[1] === "board" ? findBoard(parts[2]) : null;
      navTab = (b && b.place === "ref") ? "ref" : "memory";
    }
    setActiveNav(navTab);
    const t = todayMeta();
    if (els.todayChip) els.todayChip.textContent = t.dateLabel + " " + t.weekLabel;

    if (tab === "flow") { setSub("今日流程"); renderFlow(t); }
    else if (tab === "memory") { setSub("背诵重点"); renderMemory(parts); }
    else if (tab === "ref") { setSub("速查"); renderRef(parts); }
    else if (tab === "edit") { setSub("编辑 · 仅存本机"); renderEdit(parts); }
    else if (tab === "my") { setSub("我的板块"); renderMy(parts); }
    else { setSub("今日流程"); renderFlow(t); }

    if (keepScroll) window.scrollTo(0, y);
    else scrollTop();
  }

  /* ============================================================
   * 流程页
   * ============================================================ */
  function renderFlow(t) {
    const f = effectiveFlow();
    const items = f.items || [];
    const isCustom = !!CUSTOM.flow;
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
        ? '<span class="tmeta-label">关联</span>' + it.fsha.map((id) => '<a class="qlink" href="#/memory/q/' + id + '">' + id + "</a>").join("")
        : "";
      return [
        '<li class="' + cls.join(" ") + '">',
        '  <span class="ttime">' + esc(it.t) + "</span>",
        '  <div class="tcard" data-open="' + esc(it.t) + '" role="button" tabindex="0" aria-label="' + esc(it.name) + '详情">',
        '    <div class="tbody">',
        '      <div class="trow"><h3>' + esc(it.name) + "</h3>" + '<span class="tag">' + esc(it.tag || "") + "</span>" + wdTag + "</div>",
        '      <p class="tdesc">' + esc(it.desc || "") + "</p>",
        '      <div class="tmeta">' + redChip + "</div>",
        "    </div>",
        '    <button class="tcheck" type="button" role="checkbox" aria-checked="' + (isDone ? "true" : "false") + '" data-t="' + esc(it.t) + '"' + (off ? " disabled" : "") + ">",
        "      " + CHECK,
        "    </button>",
        "  </div>",
        "</li>"
      ].join("");
    }).join("");

    const nextLine = next
      ? '<p class="flow-next"><span class="flow-next-k">' + (timeToMin(next.t) >= t.minutes ? "接下来" : "待完成") + "</span><b>" + esc(next.t) + " " + esc(next.name) + "</b></p>"
      : '<p class="flow-next"><span class="flow-next-k">完成</span><b>今天的流程已全部勾完</b></p>';

    els.view.innerHTML = [
      pageHead("今日流程 · " + (f.title || "工作流程") + (isCustom ? "（自定义）" : ""), t.dateLabel + " " + t.weekLabel, "<b>" + done + "</b> / " + total + " 已完成"),
      '<div class="flow-bar"><span class="flow-track"><i style="width:' + pct + '%"></i></span><span class="flow-frac">' + done + "/" + total + "</span></div>",
      nextLine,
      '<p class="flow-note">' + esc(isCustom ? "当前使用你自定义的流程；可在「编辑 → 流程编辑」里修改。" : (f.note || "")) + "</p>",
      '<ol class="timeline">' + rows + "</ol>",
      '<div class="flow-actions"><a class="rowlink" href="#/edit/flow">编辑流程</a><button class="rowlink" type="button" id="resetFlow">清空今日勾选</button></div>',
      footLine("勾选记录只保存在本机，按天自动隔离；第二天打开是全新清单。")
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
    const f = effectiveFlow();
    const it = (f.items || []).find((x) => x.t === tKey);
    if (!it) return;
    const related = (it.fsha || []).map((id) => {
      const q = QBY.get(id);
      if (!q) return "";
      return '<a class="qitem-mini" href="#/memory/q/' + id + '"><span class="qid">' + id + "</span><span>" + esc(q.title) + "</span></a>";
    }).join("");
    openSheet([
      '<h2 id="sheetTitle" class="sheet-title">' + esc(it.t) + " · " + esc(it.name) + "</h2>",
      '<p class="sheet-sub">' + esc(it.desc || "") + "</p>",
      related ? '<div class="sheet-block"><h3>关联审核点</h3><div class="minilist">' + related + "</div></div>" : "",
      '<div class="sheet-block"><h3>说明</h3><p class="sheet-text">' + esc(CUSTOM.flow ? "这是你自定义的流程条目。" : (FLOW.note || "")) + "</p></div>"
    ].join(""));
  }

  /* ============================================================
   * 背诵页
   * ============================================================ */
  function renderMemory(parts) {
    const sub = parts[1];
    if (!sub) return renderMemoryIndex();
    if (sub === "quiz") return renderQuiz();
    if (sub === "key") return renderKeyTopic(parts[2]);
    if (sub === "mod") return renderModule(parts[2]);
    if (sub === "q") return renderQuestion(parts[2]);
    return renderMemoryIndex();
  }

  let foldAnimated = false;

  function animateCount(el, to, dur) {
    if (!el) return;
    const start = performance.now();
    el.textContent = "0";
    function tick(t) {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function bindFold() {
    const fold = document.getElementById("allFold");
    if (!fold) return;
    const head = fold.querySelector(".fold-head");
    const countEl = document.getElementById("modCount");
    const hint = fold.querySelector(".fold-hint");
    head.addEventListener("click", () => {
      const open = fold.classList.toggle("open");
      head.setAttribute("aria-expanded", open ? "true" : "false");
      hint.textContent = open ? "收起" : "展开";
      if (open && !foldAnimated) {
        foldAnimated = true;
        animateCount(countEl, QLIST.length, 520);
      }
    });
  }

  function keyRow(k, i) {
    const qs = KEY_QUIZ.filter((x) => x.keyId === k.id);
    const known = masteryCount(qs.map((x) => x.id));
    const sub = esc(k.sub || "").replace(/直接判红灯/g, '<span class="red">直接判红灯</span>');
    return '<li><a class="keycard" href="#/memory/key/' + k.id + '">' +
      '<span class="idx">' + pad2(i + 1) + "</span>" +
      '<span class="key-main"><span class="key-title">' + esc(k.title) + '</span><span class="key-sub">' + sub + "</span></span>" +
      '<span class="key-side"><span class="key-num">' + known + "/" + qs.length + "</span>" + CHEV + "</span>" +
      "</a></li>";
  }

  function moduleRow(m) {
    return '<a class="modcard" href="#/memory/mod/' + m.id + '">' +
      '<span class="mod-code">' + esc(m.code) + "</span>" +
      '<span class="mod-name">' + esc(m.name) + "</span>" +
      '<span class="mod-count">' + (m.questions || []).length + "</span>" +
      "</a>";
  }

  function boardRowHtml(b, idx, editMode) {
    const href = editMode ? "#/edit/board/" + b.id : "#/my/board/" + b.id;
    const place = b.place === "ref" ? "速查" : "背诵";
    return '<a class="boardrow" href="' + href + '">' +
      '<span class="idx">' + pad2(idx + 1) + "</span>" +
      '<span class="board-main"><span class="board-title">' + esc(b.name) + '</span><span class="board-sub">' + (b.entries || []).length + " 条 · " + place + "</span></span>" +
      CHEV +
      "</a>";
  }

  function renderMemoryIndex() {
    const keyQuizIds = KEY_QUIZ.map((x) => x.id);
    const knownKey = masteryCount(keyQuizIds);
    const keyTotal = keyQuizIds.length;
    const myBoards = customBoards("memory");
    const modRows = MODULES.map(moduleRow).join("");

    els.view.innerHTML = [
      pageHead("FSHA V1.2 · 背诵", "背诵重点", "<b>6</b> 项重点 · <b>" + keyTotal + "</b> 道问答"),
      '<div class="search" role="search">' +
        '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4l4.4 4.4"/></svg>' +
        '<input id="memSearch" type="search" placeholder="搜索 35 条审核条目" autocomplete="off" aria-label="搜索审核条目">' +
      "</div>",
      '<div id="memMain">',
      '<section class="sec">' + sectionHead("重点背诵", "6 项") +
        '<ol class="keylist">' + KEY_TOPICS.map(keyRow).join("") + "</ol>" +
        '<button class="quiz-row" type="button" id="startQuiz">' +
          '<svg class="ic q-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>' +
          '<span class="quiz-body"><span class="q-title">重点抽考</span><span class="q-sub">' + keyTotal + " 道问答 · 已掌握 " + knownKey + "</span></span>" +
          '<span class="q-go">开始 →</span>' +
        "</button>" +
      "</section>",
      '<section class="sec">' +
        '<div class="fold" id="allFold">' +
          '<button class="fold-head" type="button" aria-expanded="false" aria-controls="foldBody">' +
            '<span class="fold-title">全部审核条目</span>' +
            '<span class="fold-meta"><b id="modCount">' + QLIST.length + "</b> 条 · " + MODULES.length + " 模块</span>" +
            '<span class="fold-hint">展开</span>' +
            '<svg class="ic chev fold-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
          "</button>" +
          '<div class="fold-body" id="foldBody"><div class="fold-inner"><div class="modgrid">' + modRows + "</div></div></div>" +
        "</div>" +
      "</section>",
      myBoards.length
        ? '<section class="sec">' + sectionHead("我的板块", myBoards.length + " 个") + '<div class="boardlist">' + myBoards.map((b, i) => boardRowHtml(b, i, false)).join("") + "</div></section>"
        : "",
      footLine("内置条目只读（FSHA V1.2 · 2026-11-07）· 我的内容仅存本机 · 仅供个人复习参考"),
      "</div>",
      '<div id="memResults" hidden></div>'
    ].join("");

    bindMemoryIndex();
  }

  function bindMemoryIndex() {
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
    if (start) start.addEventListener("click", () => {
      quiz.range = "key";
      quiz.queue = [];
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
      location.hash = "#/memory/quiz";
    });
    bindFold();
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
      container.innerHTML = '<div class="empty"><p>没有找到「' + esc(query) + "」相关内容</p><span class=\"empty-sub\">换个关键词：温度 / 洗手 / 虫害 / 过敏原 / 临期</span></div>";
      return;
    }
    container.innerHTML = '<p class="result-head">找到 <b>' + hits.length + "</b> 条</p>" +
      hits.map((item) => {
        const snip = matchSnippet(item, query);
        return '<a class="qitem" href="#/memory/q/' + item.id + '">' +
          '<span class="qid">' + item.id + "</span>" +
          '<span class="qitem-body">' +
            '<span class="qitem-title">' + markText(item.title, query) + (item.red ? ' <b class="redtag">直红</b>' : "") + "</span>" +
            '<span class="qitem-snip">' + markText(snip, query) + "</span>" +
            '<span class="qitem-mod">' + esc(item.moduleName) + "</span>" +
          "</span>" + CHEV +
          "</a>";
      }).join("");
  }

  function renderKeyTopic(id) {
    const k = KEYBY.get(id);
    if (!k) { renderMemoryIndex(); return; }
    const idx = KEY_TOPICS.findIndex((x) => x.id === id);
    const qs = KEY_QUIZ.filter((x) => x.keyId === id);
    const known = masteryCount(qs.map((x) => x.id));

    els.view.innerHTML = [
      backLink("#/memory", "背诵"),
      detailHead("重点 " + pad2(idx + 1) + " · " + (k.source || ""), k.title, k.sub),
      '<article class="keydetail">',
      renderSectionBlocks(k.sections),
      '<div class="detail-actions"><button class="btn primary" type="button" id="keyQuizBtn">抽背本主题（' + qs.length + " 题）</button><span class=\"muted-note\">已掌握 " + known + " / " + qs.length + "</span></div>",
      "</article>"
    ].join("");

    const btn = document.getElementById("keyQuizBtn");
    if (btn) btn.addEventListener("click", () => {
      quiz.range = "key:" + id;
      quiz.queue = [];
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
      location.hash = "#/memory/quiz";
    });
  }

  function renderSectionBlocks(sections) {
    return (sections || []).map((sec) => [
      '<section class="block">',
      '<h2>' + esc(sec.head || "要点") + "</h2>",
      '<ol class="numlist">' + (sec.items || []).map((i) => "<li>" + esc(i) + "</li>").join("") + "</ol>",
      "</section>"
    ].join("")).join("");
  }

  function renderModule(id) {
    const m = MODBY.get(id);
    if (!m) { renderMemoryIndex(); return; }
    const rows = (m.questions || []).map((q) => [
      "<li>",
      '<a class="qitem" href="#/memory/q/' + q.id + '">',
      '<span class="qid">' + q.id + "</span>",
      '<span class="qitem-body">',
      '<span class="qitem-title">' + esc(q.title) + (q.red ? ' <b class="redtag">直红</b>' : "") + "</span>",
      '<span class="qitem-snip">' + esc((q.exceptions || [])[0] || (q.standard ? "标准：" + q.standard : "")) + "</span>",
      "</span>", CHEV,
      "</a>",
      "</li>"
    ].join("")).join("");

    els.view.innerHTML = [
      backLink("#/memory", "背诵"),
      detailHead(m.code + " · 审核条目", m.name, "共 " + (m.questions || []).length + " 条"),
      '<ul class="qlist">' + rows + "</ul>",
      '<div class="detail-actions"><button class="btn ghost" type="button" id="modQuizBtn">抽考本模块（' + (m.questions || []).length + " 题）</button></div>",
      footLine("点条目查看：审核区域、审核方式、标准、例外情形。标「直红」的条目可能导致直接红灯。")
    ].join("");

    const btn = document.getElementById("modQuizBtn");
    if (btn) btn.addEventListener("click", () => {
      quiz.range = "mod:" + id;
      quiz.queue = [];
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
      location.hash = "#/memory/quiz";
    });
  }

  function renderQuestion(id) {
    const q = QBY.get(id);
    if (!q) { renderMemoryIndex(); return; }
    const m = MODBY.get(q.moduleId);
    const idx = m.questions.findIndex((x) => x.id === id);
    const prev = idx > 0 ? m.questions[idx - 1] : null;
    const nextQ = idx < m.questions.length - 1 ? m.questions[idx + 1] : null;

    const areas = (q.areas || []).map((a) => '<span class="area">' + esc(a) + "</span>").join("");
    const exceptions = (q.exceptions || []).map((e) => "<li>" + esc(e) + "</li>").join("");

    els.view.innerHTML = [
      backLink("#/memory/mod/" + m.id, m.name),
      detailHead(q.id + " · " + m.name, q.title),
      '<article class="qdetail">',
      '<div class="arearow">' + areas + "</div>",
      q.method ? '<section class="block"><h2>审核方式</h2><p>' + esc(q.method) + "</p></section>" : "",
      q.standard ? '<section class="block block-standard"><h2>标准</h2><p>' + esc(q.standard) + "</p></section>" : "",
      exceptions ? '<section class="block block-ex"><h2>出现以下任意情形即判例外</h2><ol class="numlist">' + exceptions + "</ol></section>" : "",
      q.redNote ? '<div class="rednote"><b>直接红灯</b><span>' + esc(q.redNote) + "</span></div>" : "",
      q.note ? '<div class="notebox"><b>备注</b><span>' + esc(q.note) + "</span></div>" : "",
      q.red ? '<p class="qredlink"><a href="#/ref/red">查看全部 8 类直接红灯项</a></p>' : "",
      '<nav class="qnav">',
      prev ? '<a class="rowlink" href="#/memory/q/' + prev.id + '">‹ ' + prev.id + "</a>" : "<span></span>",
      nextQ ? '<a class="rowlink" href="#/memory/q/' + nextQ.id + '">' + nextQ.id + " ›</a>" : "<span></span>",
      "</nav>",
      "</article>"
    ].join("");
  }

  /* ---------------- 随机抽考 ---------------- */
  const quiz = { range: "key", queue: [], idx: 0, revealed: false, roundKnown: 0 };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function quizPool(range) {
    if (range === "key") return KEY_QUIZ.map((x) => ({ kind: "key", id: x.id }));
    if (range === "red") return RED.map((r) => ({ kind: "red", id: r.id }));
    if (range === "all") {
      return QLIST.map((q) => ({ kind: "q", id: q.id }))
        .concat(RED.map((r) => ({ kind: "red", id: r.id })))
        .concat(KEY_QUIZ.map((x) => ({ kind: "key", id: x.id })));
    }
    if (range.indexOf("mod:") === 0) {
      const m = MODBY.get(range.slice(4));
      return m ? m.questions.map((q) => ({ kind: "q", id: q.id })) : [];
    }
    if (range.indexOf("key:") === 0) {
      const kid = range.slice(4);
      return KEY_QUIZ.filter((x) => x.keyId === kid).map((x) => ({ kind: "key", id: x.id }));
    }
    return [];
  }

  function getQuizItem(ref) {
    if (ref.kind === "q") {
      const q = QBY.get(ref.id);
      return q ? Object.assign({ kind: "q" }, q) : null;
    }
    if (ref.kind === "red") {
      const r = REDBY.get(ref.id);
      return r ? Object.assign({ kind: "red" }, r) : null;
    }
    const kq = KEYQBY.get(ref.id);
    if (!kq) return null;
    const k = KEYBY.get(kq.keyId);
    return { kind: "key", id: kq.id, title: kq.q, answer: kq.a, keyTitle: k ? k.title : "" };
  }

  function rangeLabel(range) {
    if (range === "key") return "重点";
    if (range === "red") return "直红项";
    if (range === "all") return "全部";
    if (range.indexOf("mod:") === 0) {
      const m = MODBY.get(range.slice(4));
      return m ? m.name : "模块";
    }
    if (range.indexOf("key:") === 0) {
      const k = KEYBY.get(range.slice(4));
      return k ? k.title : "重点";
    }
    return "重点";
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
    const pool = quizPool(quiz.range);
    const total = quiz.queue.length;
    const knownInPool = masteryCount(pool.map((x) => x.id));

    const defs = [
      { key: "key", label: "重点 " + KEY_QUIZ.length },
      { key: "all", label: "全部 " + (QLIST.length + RED.length + KEY_QUIZ.length) },
      { key: "red", label: "直红项 " + RED.length }
    ];
    const inDefs = defs.some((d) => d.key === quiz.range);
    const chips = (inDefs ? [] : [{ key: quiz.range, label: rangeLabel(quiz.range) }]).concat(defs);

    const head = [
      backLink("#/memory", "背诵"),
      detailHead("抽考 · " + rangeLabel(quiz.range), "随机抽考", "先自己回想，再对答案"),
      '<div class="chips" role="tablist" aria-label="抽考范围">' + chips.map((c) => '<button type="button" class="chip' + (quiz.range === c.key ? " active" : "") + '" data-range="' + esc(c.key) + '">' + esc(c.label) + "</button>").join("") + "</div>",
      '<div class="quiz-meta"><span>第 <b>' + Math.min(quiz.idx + 1, total) + "</b> / " + total + " 题</span><span>本范围已掌握 <b>" + knownInPool + "</b> / " + pool.length + "</span></div>"
    ].join("");

    let body = "";
    if (quiz.idx >= total) {
      body = [
        '<div class="done-card">',
        "<h2>本轮完成</h2>",
        "<p>自评记住 <b>" + quiz.roundKnown + "</b> 条 / 共 " + total + " 条。</p>",
        '<div class="done-actions"><button class="btn primary" type="button" id="quizAgain">再来一轮</button><button class="btn ghost" type="button" id="quizWeak">只练未掌握</button></div>',
        '<button class="rowlink" type="button" id="quizResetMastery">重置掌握进度</button>',
        "</div>"
      ].join("");
    } else {
      const cur = getQuizItem(quiz.queue[quiz.idx]);
      if (!cur) { quiz.idx += 1; renderQuiz(); return; }
      body = quizCard(cur);
    }

    els.view.innerHTML = head + body;
    bindQuiz();
  }

  function quizCard(item) {
    const isRed = item.kind === "red";
    const isKey = item.kind === "key";
    let crumb = "";
    if (isRed) crumb = "直红项 " + pad2(item.no) + " · " + item.title;
    else if (isKey) crumb = "重点 · " + (item.keyTitle || "");
    else crumb = item.id + " · " + item.moduleName + (item.red ? " · 直红关联" : "");

    const areas = (!isRed && !isKey) ? '<div class="arearow">' + (item.areas || []).map((a) => '<span class="area">' + esc(a) + "</span>").join("") + "</div>" : "";
    const prompt = isRed ? "这一类直红项，具体哪些情形算？" : isKey ? "先自己回答，再看参考答案。" : "这道题怎么判？先自己说一遍。";

    let answer = "";
    if (quiz.revealed) {
      if (isRed) {
        answer = '<div class="answer">' + renderRedBody(item) + "</div>";
      } else if (isKey) {
        answer = '<div class="answer"><section class="block"><h2>参考答案</h2><p class="key-answer">' + esc(item.answer) + "</p></section></div>";
      } else {
        answer = [
          '<div class="answer">',
          item.method ? '<section class="block"><h2>审核方式</h2><p>' + esc(item.method) + "</p></section>" : "",
          item.standard ? '<section class="block block-standard"><h2>标准</h2><p>' + esc(item.standard) + "</p></section>" : "",
          (item.exceptions || []).length ? '<section class="block block-ex"><h2>例外情形</h2><ol class="numlist">' + item.exceptions.map((e) => "<li>" + esc(e) + "</li>").join("") + "</ol></section>" : "",
          item.redNote ? '<div class="rednote"><b>直接红灯</b><span>' + esc(item.redNote) + "</span></div>" : "",
          '<p class="qdetail-link"><a href="#/memory/q/' + item.id + '">查看完整条目</a></p>',
          "</div>"
        ].join("");
      }
    }

    return [
      '<article class="quiz-question">',
      '<p class="crumb">' + esc(crumb) + "</p>",
      "<h1>" + esc(item.title || "") + "</h1>",
      "  " + areas,
      '<p class="quiz-prompt">' + prompt + "</p>",
      quiz.revealed ? "" : '<button class="btn primary revealbtn" type="button" id="revealBtn">显示答案</button>',
      answer,
      "</article>",
      quiz.revealed
        ? '<div class="quiz-actions"><button class="btn ghost" type="button" id="againBtn">再练一次</button><button class="btn primary" type="button" id="knownBtn">记住了</button></div>'
        : ""
    ].join("");
  }

  function bindQuiz() {
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
        if (!map[cur.id]) { map[cur.id] = true; quiz.roundKnown += 1; }
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
      const weakPool = quizPool(quiz.range).filter((x) => !map[x.id]);
      if (!weakPool.length) { window.alert("这个范围内没有未掌握的条目了。"); return; }
      quiz.queue = shuffle(weakPool);
      quiz.idx = 0;
      quiz.revealed = false;
      quiz.roundKnown = 0;
      renderRoot();
    });
    const resetMastery = document.getElementById("quizResetMastery");
    if (resetMastery) resetMastery.addEventListener("click", () => {
      if (!window.confirm("重置所有「已掌握」标记？")) return;
      storeSet(STORE_MASTERY, {});
      startQuiz(quiz.range);
    });
  }

  /* ============================================================
   * 我的板块（阅读）
   * ============================================================ */
  function renderMy(parts) {
    if (parts[1] === "board") return renderBoard(parts[2]);
    if (parts[1] === "entry") return renderBoardEntry(parts[2], parts[3]);
    renderMemoryIndex();
  }

  function renderBoard(id) {
    const b = findBoard(id);
    if (!b) { renderMemoryIndex(); return; }
    const back = b.place === "ref" ? "#/ref" : "#/memory";
    const entries = (b.entries || []).map((e, i) => [
      "<li>",
      '<a class="qitem" href="#/my/entry/' + b.id + "/" + e.id + '">',
      '<span class="idx">' + pad2(i + 1) + "</span>",
      '<span class="qitem-body"><span class="qitem-title">' + esc(e.title) + '</span><span class="qitem-snip">' + esc(firstLine(e.body)) + "</span></span>",
      CHEV,
      "</a>",
      "</li>"
    ].join("")).join("");

    els.view.innerHTML = [
      backLink(back, b.place === "ref" ? "速查" : "背诵"),
      detailHead("我的板块 · " + (b.place === "ref" ? "速查" : "背诵"), b.name, "共 " + (b.entries || []).length + " 条"),
      '<div class="subhead-actions"><a class="rowlink" href="#/edit/board/' + b.id + '">管理这个板块</a></div>',
      (b.entries || []).length ? '<ul class="qlist">' + entries + "</ul>" : '<div class="empty"><p>这个板块还没有内容</p><span class="empty-sub">去「编辑」里添加条目</span></div>',
      footLine("自定义内容只保存在本机浏览器；换设备前请在「编辑 → 备份与恢复」导出备份。")
    ].join("");
  }

  function renderBoardEntry(boardId, entryId) {
    const b = findBoard(boardId);
    const e = b && (b.entries || []).find((x) => x.id === entryId);
    if (!b || !e) { renderMemoryIndex(); return; }
    els.view.innerHTML = [
      backLink("#/my/board/" + b.id, b.name),
      detailHead("我的板块 · " + (b.place === "ref" ? "速查" : "背诵"), e.title),
      '<article class="qdetail"><div class="richbody">' + renderRichBody(e.body) + "</div>" +
        '<div class="subhead-actions"><a class="rowlink" href="#/edit/board/' + b.id + '/entry/' + e.id + '">编辑这条</a></div></article>'
    ].join("");
  }

  function firstLine(text) {
    const lines = String(text || "").split("\n").filter((l) => l.trim());
    return lines.length ? lines[0].slice(0, 60) : "";
  }

  function renderRichBody(text) {
    return renderRichBodyHtml(text);
  }

  function renderRichBodyHtml(text) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let list = null;
    const flush = () => {
      if (list !== null) {
        html += '<ul class="rich-ul">' + list.map((li) => "<li>" + esc(li) + "</li>").join("") + "</ul>";
        list = null;
      }
    };
    lines.forEach((raw) => {
      const line = raw.trim();
      if (!line) { flush(); return; }
      const bullet = /^[-•·]\s*(.+)$/.exec(line) || /^\d+[.、]\s*(.+)$/.exec(line);
      if (bullet) {
        if (list === null) list = [];
        list.push(bullet[1]);
        return;
      }
      flush();
      html += '<p class="rich-p">' + esc(line) + "</p>";
    });
    flush();
    return html || '<p class="rich-p">（还没有内容）</p>';
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

  function refRowHtml(href, idx, title, sub, tag) {
    return '<a class="refitem" href="' + href + '">' +
      '<span class="refidx">' + pad2(idx + 1) + "</span>" +
      '<span class="refbody"><span class="ref-title">' + esc(title) + (tag ? '<span class="tag-warn">' + esc(tag) + "</span>" : "") + '</span><span class="ref-sub">' + esc(sub) + "</span></span>" +
      CHEV +
      "</a>";
  }

  function renderRefList() {
    const builtin = REF.map((s, i) => refRowHtml("#/ref/" + s.id, i, s.title, s.sub || "", s.tag)).join("");
    const custom = customBoards("ref");
    const customHtml = custom.length
      ? '<section class="sec">' + sectionHead("我的速查", custom.length + " 个") + '<div class="reflist">' + custom.map((b, i) => refRowHtml("#/my/board/" + b.id, i, b.name, (b.entries || []).length + " 条 · 我的板块")).join("") + "</div></section>"
      : "";

    els.view.innerHTML = [
      pageHead("FSHA V1.2 · 速查", "速查", "<b>" + REF.length + "</b> 个主题"),
      '<div class="reflist">' + builtin + "</div>",
      customHtml,
      footLine("标「待核对」的卡片来自 9 月背诵表，与 V1.2 有差异或未被收录；请以公司最新文件为准。"),
      '<section class="sec aboutbox"><h2>关于</h2>' +
        "<p>" + esc(META.appName || "工作小助手") + " · FSHA " + esc(META.fshaVersion || "") + "（" + esc(META.fshaUpdated || "") + "）</p>" +
        "<p>内容来源：" + esc(META.source || "") + "；流程初版来自 daily-workflow 早班模板。</p>" +
        "<p>我的自定义板块只保存在本机浏览器，不上传、不统计。</p>" +
      "</section>"
    ].join("");
  }

  function renderRefDetail(sec) {
    const idx = REF.findIndex((x) => x.id === sec.id);
    els.view.innerHTML = [
      backLink("#/ref", "速查"),
      detailHead(pad2(idx + 1) + " · 速查", sec.title, sec.sub || ""),
      sec.tag ? '<p class="tagline"><span class="tag-warn">' + esc(sec.tag) + "</span> 请按公司最新文件核对</p>" : "",
      renderBlocks(sec.blocks || []),
      footLine("来源：FSHA 审核标准 V1.2（2026-11-07）" + (sec.tag ? "；部分内容来自 9 月背诵表" : "") + "。仅供个人复习参考。")
    ].join("");
  }

  function renderBlocks(blocks) {
    return blocks.map((b) => {
      if (b.type === "kv") {
        const rows = b.rows.map((row) => '<div class="kv-row"><div class="kv-k">' + esc(row[0]) + '</div><div class="kv-v">' + esc(row[1]) + "</div></div>").join("");
        return '<section class="rblock' + (b.tone === "brand" ? " rblock-brand" : "") + '"><div class="kv">' + rows + "</div></section>";
      }
      if (b.type === "table") {
        const head = b.head.map((h) => "<th>" + esc(h) + "</th>").join("");
        const rows = b.rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("");
        return '<section class="rblock rblock-table"><div class="tablewrap"><table><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div></section>";
      }
      if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        return '<section class="rblock"><' + tag + ' class="rlist">' + b.items.map((i) => "<li>" + esc(i) + "</li>").join("") + "</" + tag + "></section>";
      }
      if (b.type === "note") {
        return '<div class="rblock note-box"><span class="note-k">说明</span><span>' + esc(b.text) + "</span></div>";
      }
      if (b.type === "p") {
        return '<section class="rblock"><p class="' + (b.big ? "bigp" : "") + '">' + esc(b.text) + "</p></section>";
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
      '<div class="redcard-head"><span class="redcard-no">' + pad2(r.no) + "</span><h3>" + esc(r.title) + "</h3></div>",
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
   * 编辑页
   * ============================================================ */
  function renderEdit(parts) {
    const section = parts[1];
    if (!section) return renderEditHome();
    if (section === "board") {
      if (parts[2] === "new") return renderBoardForm(null);
      const id = parts[2];
      if (parts[3] === "edit") return renderBoardForm(id);
      if (parts[3] === "entry") {
        if (parts[4] === "new") return renderEntryForm(id, null);
        if (parts[4]) return renderEntryForm(id, parts[4]);
      }
      return renderBoardManage(id);
    }
    if (section === "flow") {
      if (parts[2] === "new") return renderFlowItemForm(null);
      if (parts[2] !== undefined) return renderFlowItemForm(parseInt(parts[2], 10));
      return renderFlowEdit();
    }
    if (section === "backup") return renderBackup();
    return renderEditHome();
  }

  function renderEditHome() {
    const boards = CUSTOM.boards;
    const rows = [
      { href: "#/edit/board/new", title: "新建板块", sub: "给背诵或速查加一个自己的板块" },
      { href: "#/edit/flow", title: "流程编辑", sub: "增删改每日流程条目和时间" },
      { href: "#/edit/backup", title: "备份与恢复", sub: "导出或导入 JSON，换手机可迁移" }
    ].map((r, i) => '<a class="editcard" href="' + r.href + '"><span class="idx">' + pad2(i + 1) + '</span><span class="edit-body"><b>' + r.title + "</b><span>" + r.sub + "</span></span>" + CHEV + "</a>").join("");

    els.view.innerHTML = [
      pageHead("我的内容 · 仅存本机", "编辑", "改动只保存在本机"),
      '<div class="editgrid">' + rows + "</div>",
      '<section class="sec">' + sectionHead("我的板块", boards.length + " 个") +
        (boards.length
          ? '<div class="boardlist">' + boards.map((b, i) => boardRowHtml(b, i, true)).join("") + "</div>"
          : '<div class="empty"><p>还没有自定义板块</p><span class="empty-sub">点上方「新建板块」开始加内容</span></div>') +
      "</section>",
      '<section class="sec aboutbox"><h2>数据存在哪</h2>' +
        "<p>你新增的板块、条目和流程只保存在这台设备的浏览器里，不上传公网。换手机或清理浏览器数据前，先在「备份与恢复」导出 JSON，另一台设备导入即可。</p>" +
        "<p>内置的 35 条审核条目、速记卡是只读的；想改其中内容，可以把要点放进「我的板块」再编辑。</p>" +
      "</section>"
    ].join("");
  }

  function renderBoardForm(boardId) {
    const board = boardId ? findBoard(boardId) : null;
    if (boardId && !board) { renderEditHome(); return; }
    const isNew = !board;
    const name = board ? board.name : "";
    const place = board ? board.place : "memory";

    els.view.innerHTML = [
      backLink(isNew ? "#/edit" : "#/edit/board/" + board.id, "编辑"),
      detailHead("我的板块", isNew ? "新建板块" : "修改板块", "板块会显示在「背诵」或「速查」页"),
      '<form id="boardForm" class="form" autocomplete="off">',
      '<label class="field"><span class="field-label">板块名称</span><input class="input" id="boardName" maxlength="24" placeholder="例如：化学品知识 / 我的收发货笔记" value="' + esc(name) + '" required></label>',
      '<label class="field"><span class="field-label">放在哪一页</span><select class="input" id="boardPlace"><option value="memory"' + (place === "memory" ? " selected" : "") + '>背诵页</option><option value="ref"' + (place === "ref" ? " selected" : "") + '>速查页</option></select></label>',
      '<p class="form-error" id="boardErr" role="alert"></p>',
      '<div class="form-actions"><button class="btn primary" type="submit">保存</button><a class="btn ghost" href="' + (isNew ? "#/edit" : "#/edit/board/" + board.id) + '">取消</a>' +
        (!isNew ? '<button class="btn danger" type="button" id="delBoard">删除板块</button>' : "") + "</div>",
      "</form>"
    ].join("");

    const form = document.getElementById("boardForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const nm = document.getElementById("boardName").value.trim();
      const plc = document.getElementById("boardPlace").value;
      const err = document.getElementById("boardErr");
      if (!nm) { err.textContent = "请填板块名称"; return; }
      if (isNew) {
        const b = { id: uid("b"), name: nm, icon: "", place: plc, entries: [], updatedAt: Date.now() };
        CUSTOM.boards.push(b);
        saveCustom();
        location.hash = "#/edit/board/" + b.id;
      } else {
        board.name = nm; board.place = plc; board.updatedAt = Date.now();
        saveCustom();
        location.hash = "#/edit/board/" + board.id;
      }
    });

    const del = document.getElementById("delBoard");
    if (del) del.addEventListener("click", () => {
      if (!window.confirm("删除板块「" + board.name + "」及里面所有条目？")) return;
      CUSTOM.boards = CUSTOM.boards.filter((b) => b.id !== board.id);
      saveCustom();
      location.hash = "#/edit";
    });
  }

  function renderBoardManage(boardId) {
    const board = findBoard(boardId);
    if (!board) { renderEditHome(); return; }
    const entries = (board.entries || []).map((e, i) => [
      '<div class="boardrow">',
      '<span class="idx">' + pad2(i + 1) + "</span>",
      '<span class="board-main"><span class="board-title">' + esc(e.title) + '</span><span class="board-sub">' + esc(firstLine(e.body)) + "</span></span>",
      '<span class="rowbtns"><a class="rowlink" href="#/edit/board/' + board.id + "/entry/" + e.id + '">编辑</a><button class="rowlink danger" type="button" data-del-entry="' + e.id + '">删除</button></span>',
      "</div>"
    ].join("")).join("");

    els.view.innerHTML = [
      backLink("#/edit", "编辑"),
      detailHead("我的板块 · " + (board.place === "ref" ? "速查" : "背诵"), board.name, "共 " + (board.entries || []).length + " 条"),
      '<div class="subhead-actions"><a class="rowlink" href="#/my/board/' + board.id + '">预览</a><a class="rowlink" href="#/edit/board/' + board.id + '/edit">修改名称</a></div>',
      (board.entries || []).length ? '<div class="boardlist">' + entries + "</div>" : '<div class="empty"><p>还没有条目</p><span class="empty-sub">点下面「添加条目」开始写</span></div>',
      '<div class="form-actions"><a class="btn primary" href="#/edit/board/' + board.id + '/entry/new">添加条目</a></div>',
      footLine("条目正文支持多行：空行分段，行首「- 」或「1. 」显示为列表。")
    ].join("");

    els.view.querySelectorAll("[data-del-entry]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const eid = btn.getAttribute("data-del-entry");
        if (!window.confirm("删除这条内容？")) return;
        board.entries = (board.entries || []).filter((e) => e.id !== eid);
        board.updatedAt = Date.now();
        saveCustom();
        renderRoot({ keepScroll: true });
      });
    });
  }

  function renderEntryForm(boardId, entryId) {
    const board = findBoard(boardId);
    if (!board) { renderEditHome(); return; }
    const entry = entryId ? (board.entries || []).find((e) => e.id === entryId) : null;
    if (entryId && !entry) { renderBoardManage(boardId); return; }
    const isNew = !entry;

    els.view.innerHTML = [
      backLink("#/edit/board/" + board.id, board.name),
      detailHead("我的板块", isNew ? "添加条目" : "编辑条目"),
      '<form id="entryForm" class="form" autocomplete="off">',
      '<label class="field"><span class="field-label">标题</span><input class="input" id="entryTitle" maxlength="60" placeholder="例如：化学品泄漏怎么处理" value="' + esc(entry ? entry.title : "") + '" required></label>',
      '<label class="field"><span class="field-label">内容</span><textarea class="input textarea" id="entryBody" rows="10" placeholder="一行一条；空行分段；行首用「- 」或「1. 」会变成列表">' + esc(entry ? entry.body : "") + "</textarea></label>",
      '<p class="form-error" id="entryErr" role="alert"></p>',
      '<div class="form-actions"><button class="btn primary" type="submit">保存</button><a class="btn ghost" href="#/edit/board/' + board.id + '">取消</a>' +
        (!isNew ? '<button class="btn danger" type="button" id="delEntry">删除这条</button>' : "") + "</div>",
      "</form>"
    ].join("");

    const form = document.getElementById("entryForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = document.getElementById("entryTitle").value.trim();
      const body = document.getElementById("entryBody").value;
      const err = document.getElementById("entryErr");
      if (!title) { err.textContent = "请填标题"; return; }
      if (isNew) {
        board.entries = board.entries || [];
        board.entries.push({ id: uid("e"), title: title, body: body, updatedAt: Date.now() });
      } else {
        entry.title = title; entry.body = body; entry.updatedAt = Date.now();
      }
      board.updatedAt = Date.now();
      saveCustom();
      location.hash = "#/edit/board/" + board.id;
    });

    const del = document.getElementById("delEntry");
    if (del) del.addEventListener("click", () => {
      if (!window.confirm("删除这条内容？")) return;
      board.entries = (board.entries || []).filter((x) => x.id !== entry.id);
      saveCustom();
      location.hash = "#/edit/board/" + board.id;
    });
  }

  function renderFlowEdit() {
    const items = effectiveFlow().items || [];
    const isCustom = !!CUSTOM.flow;
    const rows = items.map((it, i) => [
      '<div class="boardrow">',
      '<span class="idx">' + esc(it.t) + "</span>",
      '<span class="board-main"><span class="board-title">' + esc(it.name) + '</span><span class="board-sub">' + esc(it.desc || "") + (it.weekday !== undefined ? " · 仅" + WEEK[(it.weekday + 1) % 7] : "") + "</span></span>",
      '<span class="rowbtns"><a class="rowlink" href="#/edit/flow/' + i + '">编辑</a>' +
        '<button class="rowlink" type="button" data-move="' + i + '" data-dir="-1"' + (i === 0 ? " disabled" : "") + ">上移</button>" +
        '<button class="rowlink" type="button" data-move="' + i + '" data-dir="1"' + (i === items.length - 1 ? " disabled" : "") + ">下移</button>" +
        '<button class="rowlink danger" type="button" data-del-flow="' + i + '">删除</button></span>',
      "</div>"
    ].join("")).join("");

    els.view.innerHTML = [
      backLink("#/edit", "编辑"),
      detailHead("编辑 · 流程", "流程编辑", isCustom ? "当前为自定义流程" : "当前为内置早班流程"),
      '<div class="subhead-actions"><a class="btn primary" href="#/edit/flow/new">添加条目</a>' +
        (isCustom ? '<button class="rowlink" type="button" id="resetFlowCustom">恢复内置流程</button>' : "") + "</div>",
      items.length ? '<div class="boardlist">' + rows + "</div>" : '<div class="empty"><p>还没有流程条目</p></div>',
      footLine("修改后以你的自定义流程为准；「恢复内置流程」可以还原成最初 12 项。勾选记录不受影响。")
    ].join("");

    els.view.querySelectorAll("[data-del-flow]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-del-flow"), 10);
        if (!window.confirm("删除流程条目「" + items[i].name + "」？")) return;
        ensureCustomFlow().items.splice(i, 1);
        saveCustom();
        renderRoot({ keepScroll: true });
      });
    });
    els.view.querySelectorAll("[data-move]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = parseInt(btn.getAttribute("data-move"), 10);
        const dir = parseInt(btn.getAttribute("data-dir"), 10);
        const list = ensureCustomFlow().items;
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
        saveCustom();
        renderRoot({ keepScroll: true });
      });
    });
    const reset = document.getElementById("resetFlowCustom");
    if (reset) reset.addEventListener("click", () => {
      if (!window.confirm("恢复内置早班流程？你自定义的流程条目会被清空。")) return;
      CUSTOM.flow = null;
      saveCustom();
      renderRoot({ keepScroll: true });
    });
  }

  function renderFlowItemForm(index) {
    const items = effectiveFlow().items || [];
    const isNew = index === null || isNaN(index);
    const item = (!isNew && items[index]) ? items[index] : null;
    if (!isNew && !item) { renderFlowEdit(); return; }
    const wd = (item && item.weekday !== undefined) ? String(item.weekday) : "";
    const weekOptions = ["", "0", "1", "2", "3", "4", "5", "6"];
    const weekLabels = ["每天", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

    els.view.innerHTML = [
      backLink("#/edit/flow", "流程编辑"),
      detailHead("编辑 · 流程", isNew ? "添加流程条目" : "编辑流程条目"),
      '<form id="flowForm" class="form" autocomplete="off">',
      '<div class="field-row">',
      '<label class="field"><span class="field-label">时间</span><input class="input" id="flowTime" type="time" value="' + esc(item ? item.t : "") + '" required></label>',
      '<label class="field"><span class="field-label">仅哪天出现</span><select class="input" id="flowWeekday">' + weekOptions.map((v, i) => '<option value="' + v + '"' + (v === wd ? " selected" : "") + ">" + weekLabels[i] + "</option>").join("") + "</select></label>",
      "</div>",
      '<label class="field"><span class="field-label">名称</span><input class="input" id="flowName" maxlength="40" value="' + esc(item ? item.name : "") + '" required></label>',
      '<label class="field"><span class="field-label">说明</span><input class="input" id="flowDesc" maxlength="80" value="' + esc(item ? (item.desc || "") : "") + '"></label>',
      '<label class="field"><span class="field-label">标签</span><input class="input" id="flowTag" maxlength="10" value="' + esc(item ? (item.tag || "") : "常规") + '" placeholder="常规 / 巡检 / 核对"></label>',
      '<p class="form-error" id="flowErr" role="alert"></p>',
      '<div class="form-actions"><button class="btn primary" type="submit">保存</button><a class="btn ghost" href="#/edit/flow">取消</a>' +
        (!isNew ? '<button class="btn danger" type="button" id="delFlowItem">删除这条</button>' : "") + "</div>",
      "</form>"
    ].join("");

    const form = document.getElementById("flowForm");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = document.getElementById("flowTime").value;
      const name = document.getElementById("flowName").value.trim();
      const desc = document.getElementById("flowDesc").value.trim();
      const tag = document.getElementById("flowTag").value.trim();
      const wdVal = document.getElementById("flowWeekday").value;
      const err = document.getElementById("flowErr");
      if (!t || !name) { err.textContent = "时间和名称必填"; return; }
      const next = { t: t, name: name, desc: desc, tag: tag || "常规" };
      if (wdVal !== "") next.weekday = parseInt(wdVal, 10);
      if (item && item.fsha) next.fsha = item.fsha;
      const flow = ensureCustomFlow();
      if (isNew) flow.items.push(next);
      else flow.items[index] = next;
      flow.items.sort((a, b) => timeToMin(a.t) - timeToMin(b.t));
      saveCustom();
      location.hash = "#/edit/flow";
    });

    const del = document.getElementById("delFlowItem");
    if (del) del.addEventListener("click", () => {
      if (!window.confirm("删除这条流程？")) return;
      ensureCustomFlow().items.splice(index, 1);
      saveCustom();
      location.hash = "#/edit/flow";
    });
  }

  function renderBackup() {
    let size = 0;
    try { size = new Blob([JSON.stringify(CUSTOM)]).size; } catch (err) { size = 0; }
    els.view.innerHTML = [
      backLink("#/edit", "编辑"),
      detailHead("编辑 · 备份", "备份与恢复", "只包含你新增的板块和流程"),
      '<div class="editgrid">' +
        '<button class="editcard" type="button" id="exportBtn"><span class="idx">01</span><span class="edit-body"><b>导出备份</b><span>下载 JSON 文件，发到另一台设备导入</span></span>' + CHEV + "</button>" +
        '<label class="editcard" for="importFile"><span class="idx">02</span><span class="edit-body"><b>导入备份</b><span>选择之前导出的 JSON 文件（会覆盖当前内容）</span></span>' + CHEV + '<input id="importFile" type="file" accept="application/json,.json" hidden></label>' +
        '<button class="editcard" type="button" id="clearBtn"><span class="idx">03</span><span class="edit-body"><b>清空我的内容</b><span>删除本机所有自定义板块和流程</span></span>' + CHEV + "</button>" +
      "</div>",
      '<section class="sec aboutbox"><h2>当前数据</h2>' +
        "<p>板块 " + CUSTOM.boards.length + " 个 · 流程 " + (CUSTOM.flow ? "自定义（" + CUSTOM.flow.items.length + " 条）" : "内置") + " · 约 " + Math.max(1, Math.round(size / 1024)) + " KB</p>" +
        "<p>存储位置：本机浏览器 localStorage（wh.custom.v1），不上传公网、不跨设备自动同步。</p>" +
      "</section>",
      footLine("建议：加完重要内容后导出一次，把 JSON 发到微信「文件传输助手」存着；换手机时在新设备导入即可。")
    ].join("");

    const exp = document.getElementById("exportBtn");
    if (exp) exp.addEventListener("click", () => {
      const data = { app: "work-helper", version: 1, exportedAt: new Date().toISOString(), boards: CUSTOM.boards, flow: CUSTOM.flow };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const d = new Date();
      a.href = url;
      a.download = "工作助手-我的内容-" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    });

    const imp = document.getElementById("importFile");
    if (imp) imp.addEventListener("change", () => {
      const file = imp.files && imp.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result || ""));
          if (!data || !Array.isArray(data.boards)) throw new Error("bad format");
          if (!window.confirm("导入会覆盖当前「我的内容」，继续？")) return;
          CUSTOM = { boards: data.boards, flow: (data.flow && Array.isArray(data.flow.items)) ? data.flow : null };
          saveCustom();
          window.alert("导入成功，共 " + CUSTOM.boards.length + " 个板块。");
          location.hash = "#/edit";
        } catch (err) {
          window.alert("导入失败：文件不是有效的备份 JSON。");
        }
      };
      reader.readAsText(file);
    });

    const clear = document.getElementById("clearBtn");
    if (clear) clear.addEventListener("click", () => {
      if (!window.confirm("确定清空本机所有自定义板块和流程？此操作不可撤销，建议先导出备份。")) return;
      CUSTOM = { boards: [], flow: null };
      saveCustom();
      window.alert("已清空。");
      renderRoot();
    });
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
    if (e.target.closest("a") || e.target.closest("button") || e.target.closest("input") || e.target.closest("select") || e.target.closest("textarea") || e.target.closest("label")) return;
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
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
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
      '<svg class="lock-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
      "<h1>工作小助手</h1>",
      '<p class="lock-sub">内容已加密，输入访问密码</p>',
      '<form id="unlockForm" class="lock-form" autocomplete="off">',
      '<input id="unlockPwd" type="password" placeholder="访问密码" aria-label="访问密码" autocomplete="current-password" required>',
      '<button class="btn primary" type="submit" id="unlockBtn">解锁</button>',
      "</form>",
      '<label class="lock-remember"><input type="checkbox" id="rememberChk"> 在此设备记住（下次自动解锁）</label>',
      '<p class="lock-error" id="lockError" role="alert">' + esc(message || "") + "</p>",
      '<p class="lock-foot">密码只在本机参与解密，不会上传；忘记后需要重新生成加密数据包。</p>',
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
