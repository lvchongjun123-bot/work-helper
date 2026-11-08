/* 把 private/ 下的明文数据打包成 AES-256-GCM 加密的 secure-data.js
 * 用法：node build/encrypt.mjs
 * 密码来源：环境变量 WORKHELPER_PASSWORD，或项目根目录 .access-password.txt（不进仓库）
 * 输出：assets/js/secure-data.js（只含密文，可公开提交）
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASSWORD_FILE = path.join(ROOT, ".access-password.txt");
const OUT_FILE = path.join(ROOT, "assets", "js", "secure-data.js");
const ITERATIONS = 250000;

const password = (process.env.WORKHELPER_PASSWORD || (existsSync(PASSWORD_FILE) ? readFileSync(PASSWORD_FILE, "utf8") : "")).trim();
if (password.length < 6) {
  console.error("缺少访问密码：请设置 WORKHELPER_PASSWORD 或创建 .access-password.txt（至少 6 位）。");
  process.exit(1);
}

/* 在隔离上下文里加载三个明文数据文件，收集 window 上的数据 */
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const file of ["data-fsha.js", "data-ref.js", "data-flow.js"]) {
  const full = path.join(ROOT, "private", file);
  if (!existsSync(full)) {
    console.error("缺少明文数据文件：" + full);
    process.exit(1);
  }
  vm.runInContext(readFileSync(full, "utf8"), sandbox, { filename: file });
}

const w = sandbox.window;
const payload = {
  meta: w.APP_META || {},
  modules: w.FSHA_MODULES || [],
  directRed: w.DIRECT_RED || [],
  ref: w.REF_SECTIONS || [],
  flow: w.WORKFLOW || {}
};
const plaintext = JSON.stringify(payload);

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();

/* 自检：解密回来必须与原文一致 */
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const roundtrip = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
if (roundtrip !== plaintext) {
  console.error("自检失败：解密结果与原文不一致");
  process.exit(1);
}

const pack = {
  v: 1,
  kdf: "PBKDF2-SHA256",
  iter: ITERATIONS,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  tag: tag.toString("base64"),
  ct: ciphertext.toString("base64")
};

const output = [
  "/* 加密数据包（AES-256-GCM / PBKDF2-SHA256）。",
  " * 由 build/encrypt.mjs 从本机 private/ 明文生成，密码不在仓库中。",
  " * 不要手改此文件；改内容请改 private/ 下的数据后重新加密。",
  " */",
  "window.ENC_PAYLOAD = " + JSON.stringify(pack) + ";",
  ""
].join("\n");

writeFileSync(OUT_FILE, output, "utf8");
console.log("已生成", path.relative(ROOT, OUT_FILE));
console.log("明文字节:", Buffer.byteLength(plaintext, "utf8"), "| 密文字节:", ciphertext.length, "| 文件字节:", Buffer.byteLength(output, "utf8"));
console.log("PBKDF2 迭代:", ITERATIONS);
