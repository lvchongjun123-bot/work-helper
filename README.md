# 工作小助手（加密内容 PWA · v4）

个人工作流程 + 审核知识速查的手机端 PWA。**页面壳公开，内容用密码加密**（AES-256-GCM，密钥由 PBKDF2-SHA256 从访问密码派生），打开时输入一次密码解锁。

- **线上地址**：<https://lvchongjun123-bot.github.io/work-helper/>
- **手机使用**：浏览器打开 → 输入访问密码 → 可「安装应用 / 添加到主屏幕」，解锁后离线可用
- 视觉：品牌手册风——手机蓝色章节头、桌面深蓝侧栏，正文白纸 + 品牌蓝强调 + 右侧目录；全站无 emoji，图标统一线性 SVG；Sam's Club 蓝 `#0067A0` + 白色菱形标记
- 已加 `noindex`；访问密码不在仓库中

## 页面

| 页面 | 内容 |
|---|---|
| 流程 | 每日工作流程清单（可勾选、按天重置、只存本机）；支持在「编辑」里自定义条目 |
| 背诵 | **重点背诵 6 个主题**（直红项 / 四懂四会 / 生病处置 / 虫害处置 / 温度计校准 / 算分评级）+ 全部 35 条审核条目（折叠展开，错落动画）；随机抽考（默认只考重点）+ 全文搜索 |
| 速查 | 温度标准、计分评级、8 类直红、速记卡、申诉流程、召回与可追溯 |
| 编辑 | 新建「我的板块」并添加条目、流程编辑、备份与恢复（导出/导入 JSON） |

**重点抽考**：34 道重点问答，自评「记住了 / 再练一次」，掌握进度只存本机。

## 我的内容存在哪

- 你在「编辑」里新增的板块、条目、流程 **只存在本机浏览器**（`localStorage`，key: `wh.custom.v1`），不上传公网
- 换手机或清理浏览器数据前，到「编辑 → 备份与恢复」**导出 JSON**；新设备打开页面后导入
- 内置的 35 条审核条目与速记卡是只读的（保证审核口径准确）；想改可复制到「我的板块」再编辑

## 目录结构

```
index.html                    页面壳
assets/css/app.css            样式（响应式 + 深色模式 + 品牌配色）
assets/js/app.js              解锁 + 路由 + 背诵/抽考/编辑（无依赖）
assets/js/secure-data.js      加密数据包（由 build/encrypt.mjs 生成）
manifest.webmanifest          PWA 清单
sw.js                         Service Worker（离线缓存）
icons/                        图标
build/encrypt.mjs             明文数据 → 加密包
private/                      明文数据（本机保留，不提交）
.github/workflows/pages.yml   自动部署到 GitHub Pages
qa/                           本地 QA 脚本
```

## 更新内容

1. 明文数据只在本机 `private/` 目录（`data-fsha.js` / `data-ref.js` / `data-flow.js` / `data-key.js`，不进仓库）
2. 改完执行 `node build/encrypt.mjs`（读 `.access-password.txt` 或环境变量 `WORKHELPER_PASSWORD`），重新生成 `assets/js/secure-data.js`
3. `sw.js` 里的 `CACHE` 版本号 +1，push `main` 后 GitHub Actions 自动重新部署

## 本地预览

```bash
python -m http.server 8123
# 打开 http://127.0.0.1:8123/
```

`file://` 直接打开也能看，但解密需要安全上下文、PWA 安装需要 HTTP(S)。

## 测试

```bash
node qa/qa.js          # 本地 48 项：解锁/重点背诵/抽考/搜索/编辑/流程/备份/多尺寸
node qa/live-check.js  # 线上验证（需能访问 GitHub Pages）
```


