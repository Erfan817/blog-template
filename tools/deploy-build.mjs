#!/usr/bin/env node
/* ═══════════════════════════════════════════════
   deploy-build.mjs — 生成可直接上传的 dist/ 目录

   用法：
     node tools/deploy-build.mjs              # 用 posts.js 里的 SITE.url
     node tools/deploy-build.mjs https://x.com  # 临时指定域名

   ▶ 会先跑一遍 build.mjs 重新生成 sitemap / rss / robots，
     再把「该公开的文件」复制进 dist/，上传 dist/ 整个目录即可。
   ▶ 同时把 worker/_worker.js 注入站点名后生成 dist/_worker.js：
     Cloudflare 会自动启用它，修掉 Pages 默认的 clean-URL 308 跳转和软 404。
   ▶ ⚠ admin.php / api/ / data/ 绝不进入 dist/：
     静态托管（Cloudflare Pages / Vercel / GitHub Pages）不执行 PHP，
     这些文件只会被当成普通文件供人下载，admin.php 里含登录密码。
   ▶ 最后有两道安全闸门：出现 .php 残留、或出现默认密码/密钥字样，直接报错中止。
   ═══════════════════════════════════════════════ */
import { existsSync, mkdirSync, rmSync, copyFileSync, writeFileSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/* 公开清单：只有这些文件会被发布 */
const PUBLIC_FILES = [
  'index.html', 'post.html',
  'blog.js', 'i18n.js', 'main.js', 'marked.min.js', 'posts.js',
  'style.css', 'logo.svg',
  'sitemap.xml', 'rss.xml', 'robots.txt'
];

/* 绝不允许出现在发布产物里的字样 */
const FORBIDDEN = [
  { pattern: /changeme/i, why: 'admin.php 的默认密码' },
  { pattern: /ADMIN_PASSWORD/, why: '管理后台密码变量' },
  { pattern: /SERVERCHAN_SENDKEY\s*=\s*['"][^'"]+['"]/, why: 'Server酱密钥' }
];

/* 1. 先重新生成 sitemap / rss / robots，保证与文章同步
      （这一步顺带把 posts.js 挂到 globalThis.window，下面要读 SITE） */
await import(pathToFileURL(join(root, 'tools', 'build.mjs')).href);
const SITE = globalThis.window && globalThis.window.SITE;
if (!SITE) throw new Error('posts.js 里没有 SITE，无法生成 Worker');

/* 2. 清空并重建 dist/ */
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const copied = [];
let total = 0;
for (const f of PUBLIC_FILES) {
  const src = join(root, f);
  if (!existsSync(src)) throw new Error(`缺少文件：${f}（先确认仓库完整）`);
  copyFileSync(src, join(dist, f));
  total += statSync(src).size;
  copied.push(f);
}

/* 2.5 生成 Worker：注入站点名后写入 dist/_worker.js
       Cloudflare Pages 检测到根目录的 _worker.js 会自动启用高级模式，
       它负责修掉 Pages 默认的 clean-URL 308 跳转和软 404 */
const workerSrcPath = join(root, 'worker', '_worker.js');
if (!existsSync(workerSrcPath)) throw new Error('缺少 worker/_worker.js');
const workerSrc = readFileSync(workerSrcPath, 'utf8');
if (workerSrc.indexOf('__SITE_NAME__') === -1) {
  throw new Error('worker/_worker.js 缺少 __SITE_NAME__ 占位符');
}
const worker = workerSrc.replace(/__SITE_NAME__/g, SITE.name);
writeFileSync(join(dist, '_worker.js'), worker);
copied.push('_worker.js');
total += Buffer.byteLength(worker);

/* 3. 安全闸门 */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(dist);
const phps = files.filter((p) => /\.php$/i.test(p)).map((p) => relative(dist, p));
if (phps.length) {
  throw new Error(`dist/ 里出现 PHP 文件，已中止（会被公开下载）：${phps.join(', ')}`);
}

const leaks = [];
for (const p of files) {
  const text = readFileSync(p, 'utf8');
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) leaks.push(`${relative(dist, p)} 含「${rule.why}」`);
  }
}
if (leaks.length) {
  throw new Error('发布产物里检出敏感内容，已中止：\n  - ' + leaks.join('\n  - '));
}

console.log(`\n✔ dist/ 已生成：${copied.length} 个文件，共 ${(total / 1024).toFixed(1)} KB`);
console.log('  静态资源修正：_worker.js（消掉 308 跳转 + 未命中返回真 404）');
console.log('  上传时把 dist/ 整个目录发出去即可（不是仓库根目录）。');
console.log('  有意排除：admin.php、api/、data/、tools/、worker/、serve.py、README.md、logo-preview.html');
