# 工作小助手（加密内容 PWA）

个人工作流程 + 知识速查的手机端 PWA。**页面壳公开，内容用密码加密**（AES-256-GCM，密钥由 PBKDF2-SHA256 从访问密码派生），打开时输入一次密码解锁。

- **线上地址**：<https://lvchongjun123-bot.github.io/work-helper/>
- **手机使用**：浏览器打开 → 输入访问密码 → 可「安装应用 / 添加到主屏幕」，解锁后离线可用
- 已加 `noindex`；访问密码不在仓库中，忘记密码只能重新生成加密包

## 页面

| 页面 | 内容 |
|---|---|
| 流程 | 每日工作流程清单（可勾选、按天重置、只存本机），关联审核点 |
| 背诵 | 审核条目卡片浏览 + 随机抽考 + 全文搜索 |
| 速查 | 速查表 / 速记卡 / 流程政策 |

## 目录结构

```
index.html                    页面壳
assets/css/app.css            样式（响应式 + 深色模式）
assets/js/app.js              解锁 + 路由 + 交互（无依赖）
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

1. 明文数据只在本机 `private/` 目录（`data-fsha.js` / `data-ref.js` / `data-flow.js`，不进仓库）
2. 改完执行 `node build/encrypt.mjs`（读 `.access-password.txt` 或环境变量 `WORKHELPER_PASSWORD`），重新生成 `assets/js/secure-data.js`
3. `sw.js` 里的 `CACHE` 版本号 +1，push `main` 后 GitHub Actions 自动重新部署

## 本地预览

```bash
python -m http.server 8123
# 打开 http://127.0.0.1:8123/
```

`file://` 直接打开也能看，但解密需要安全上下文、PWA 安装需要 HTTP(S)。
