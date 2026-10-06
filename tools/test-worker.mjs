#!/usr/bin/env node
/* ═══════════════════════════════════════════════
   test-worker.mjs — 自测 worker/_worker.js

   用法：node tools/test-worker.mjs

   ▶ 不需要部署、不需要联网、不需要 Cloudflare 账号：
     · 用假的 ASSETS 模拟 Cloudflare 静态资源（含它那个"未命中回退成 200 首页"的坑）
     · 用假的 Cache API 模拟限流计数，验证「同一 IP 只放行一条」真的生效
   ▶ 改完 worker/_worker.js 后先跑这个再上传。
   ═══════════════════════════════════════════════ */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 1. 注入占位符后写成临时 .mjs（worker 源码是 ESM，但 .js 会被 Node 当 CommonJS） */
const src = readFileSync(join(root, 'worker', '_worker.js'), 'utf8')
  .replace(/__SITE_NAME__/g, 'MyBlog');
const dir = mkdtempSync(join(tmpdir(), 'worker-test-'));
const file = join(dir, 'worker.mjs');
writeFileSync(file, src);
const worker = (await import(pathToFileURL(file).href)).default;

/* 2. 模拟 Cloudflare 静态资源 */
const FILES = {
  '/': 'text/html; charset=utf-8',
  '/post': 'text/html; charset=utf-8',
  '/style.css': 'text/css',
  '/main.js': 'text/javascript',
  '/logo.svg': 'image/svg+xml',
  '/sitemap.xml': 'text/xml',
  '/robots.txt': 'text/plain'
};
let assetCalls = [];
const env = {
  ASSETS: {
    fetch(req) {
      const u = new URL(req.url);
      assetCalls.push(u.pathname + u.search);
      const ct = FILES[u.pathname];
      if (ct) return new Response('content:' + u.pathname, { status: 200, headers: { 'Content-Type': ct } });
      /* 真实环境里未命中会回退成 200 + 首页 HTML（软 404），这里如实模拟 */
      return new Response('<!DOCTYPE html><html>index</html>', {
        status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }
  }
};

/* 3. 模拟 Cloudflare Cache API（限流计数器就存在这里） */
function fakeCaches() {
  const store = new Map();
  return {
    store,
    caches: {
      default: {
        async match(req) {
          const e = store.get(req.url);
          if (!e) return undefined;
          if (e.expires <= Date.now()) { store.delete(req.url); return undefined; }
          return new Response(e.body);
        },
        async put(req, res) {
          const m = /max-age=(\d+)/.exec(res.headers.get('Cache-Control') || '');
          store.set(req.url, { body: await res.text(), expires: Date.now() + (m ? Number(m[1]) * 1000 : 0) });
        }
      }
    }
  };
}

const call = (path, init) => worker.fetch(new Request('https://your-domain.com' + path, init), env);
const ticket = (ip) => call('/api/guestbook-ticket', { method: 'POST', headers: { 'CF-Connecting-IP': ip } });

let pass = 0, fail = 0;
function check(label, ok, extra) {
  if (ok) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '   → ' + extra : '')); }
}
const reset = () => { assetCalls = []; };

console.log('【留言防刷：IP 通行证】');
delete globalThis.caches;
let t = await ticket('9.9.9.9');
let tj = await t.json();
check('Cache API 不可用时放行（fail-open，绝不挡住正常留言）', tj.ok === true, JSON.stringify(tj));

const fc = fakeCaches();
globalThis.caches = fc.caches;

t = await ticket('1.1.1.1'); tj = await t.json();
check('第一次领票：放行', tj.ok === true, JSON.stringify(tj));

t = await ticket('1.1.1.1'); tj = await t.json();
check('同一 IP 第二次：拦下', tj.ok === false && tj.error === 'rate', JSON.stringify(tj));
check('  并告知还要等多少秒', typeof tj.wait === 'number' && tj.wait > 0 && tj.wait <= 300, 'wait=' + tj.wait);

t = await ticket('2.2.2.2'); tj = await t.json();
check('换一个 IP 不受影响（按 IP 分桶）', tj.ok === true, JSON.stringify(tj));

fc.store.clear();
t = await ticket('1.1.1.1'); tj = await t.json();
check('冷却时间过后可再次放行', tj.ok === true, JSON.stringify(tj));

globalThis.caches = { default: { async match() { throw new Error('boom'); }, async put() { throw new Error('boom'); } } };
t = await ticket('3.3.3.3'); tj = await t.json();
check('Cache API 抛异常时也放行（不因限流故障挡留言）', tj.ok === true, JSON.stringify(tj));

delete globalThis.caches;

console.log('\n【消掉 clean-URL 308 跳转】');
reset();
let r = await call('/');
check('/ 正常返回 200', r.status === 200 && assetCalls[0] === '/', 'ASSETS 收到 ' + assetCalls[0]);

reset();
r = await call('/index.html');
check('/index.html 改写为 / 后再取资源（不再 308）', r.status === 200 && assetCalls[0] === '/', 'ASSETS 收到 ' + assetCalls[0]);

reset();
r = await call('/post.html?p=hello-world');
check('/post.html?p=… 改写为 /post?p=…（保留查询串）', r.status === 200 && assetCalls[0] === '/post?p=hello-world',
  'ASSETS 收到 ' + assetCalls[0]);

reset();
r = await call('/post/?p=x');
check('/post/ 去掉结尾斜杠后取资源', r.status === 200 && assetCalls[0] === '/post?p=x', 'ASSETS 收到 ' + assetCalls[0]);

console.log('\n【未命中返回真 404，挡住软 404】');
reset();
r = await call('/nonexistent-xyz');
check('/nonexistent-xyz 返回 404', r.status === 404, 'status=' + r.status);
check('  且根本没有去取静态资源', assetCalls.length === 0, 'ASSETS 被调用 ' + assetCalls.length + ' 次');

reset();
r = await call('/admin.php');
check('/admin.php 返回 404（不泄露也不回退首页）', r.status === 404, 'status=' + r.status);

reset();
r = await call('/missing.js');
check('/missing.js 被回退成 HTML 时改判 404', r.status === 404, 'status=' + r.status);

reset();
r = await call('/api/guestbook.php?ping=1');
check('/api/guestbook.php 返回 404（前端靠它降级到邮箱转发模式）', r.status === 404, 'status=' + r.status);

console.log('\n【静态资源正常透传】');
for (const [p, want] of [['/style.css', 'text/css'], ['/sitemap.xml', 'text/xml'], ['/logo.svg', 'image/svg+xml']]) {
  reset();
  r = await call(p);
  check(p + ' 返回 200 ' + want, r.status === 200 && (r.headers.get('content-type') || '').indexOf(want) === 0,
    'status=' + r.status + ' ct=' + r.headers.get('content-type'));
}

console.log(`\n${fail === 0 ? '✔ 全部通过' : '✘ 存在失败项'}：${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
