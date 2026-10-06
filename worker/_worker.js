/* ═══════════════════════════════════════════════
   Cloudflare Pages 高级模式 Worker

   它干三件事：

   1. 留言防刷「通行证」
      前端在真正发送前先来这里领一张票。Worker 读 CF-Connecting-IP
      （客户端伪造不了）判断该 IP 最近是否已发过，同一 IP 每 GB_WINDOW
      秒只放行一条。只用 Cache API 存标记 —— 不需要 KV 绑定，
      **也不对外发起任何请求**（这点很关键，理由见第 3 条）。

   2. 消掉 clean-URL 308 跳转
      Pages 默认把 /post.html 308 跳到 /post、/index.html 跳到 /。
      而站点的 sitemap、canonical、内部链接用的都是 .html 地址，
      每点一次文章就白白多一次往返。这里在 Worker 内部把 .html 改写成
      无扩展名路径再取静态资源，跳转就不会发生。

   3. 未命中路径返回真 404
      本项目默认把未命中请求回退成「200 + 首页 HTML」（软 404），
      会让 /admin.php、打错的地址都返回 200，搜索引擎会收录一堆垃圾 URL。
      这里显式判定：不是已知页面、也不是已知静态资源，就返回 404。

   ⚠️ 为什么留言不在这里代发（重要，别再改回去）：
      曾经试过让 Worker 把留言转发给 FormSubmit.co，好处是访客只连自己的域名。
      但实测该 Worker 发起的**任何外部 fetch 都会被 Cloudflare 平台层掐断**：
      不涉及外部请求的分支都能正常返回 JSON，一旦 fetch 外部地址，
      Cloudflare 就用它自己的 502 页替换掉响应，连 try/catch 都拦不住。
      所以这里只做「限流判定」，真正的投递仍由访客浏览器直连表单服务完成。

   部署方式：tools/deploy-build.mjs 会把它复制成 dist/_worker.js，
   上传 dist/ 时 Cloudflare 自动识别（无需 wrangler、无需任何后台配置）。
   ═══════════════════════════════════════════════ */

const SITE_NAME = '__SITE_NAME__';

const GB_WINDOW = 300;   // 同一 IP 的留言冷却时间（秒），想放宽就改这里

/* 站点里可以合法返回 HTML 的路径（新增页面时记得加进来） */
const HTML_ROUTES = new Set(['/', '/post']);

/* 允许直接透传给静态资源的扩展名 */
const ASSET_RE = /\.(css|js|mjs|json|xml|txt|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|webmanifest)$/i;

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/* ── 留言通行证 ──
   用 Cache API 当限流计数器：键按 IP 分桶，值里存上次放行的时间戳。
   所有异常都当作「没限流」——绝不因为限流本身出故障而挡住正常留言。 */
function rateKey(ip) {
  return new Request('https://guestbook.invalid/ticket/' + encodeURIComponent(ip));
}

async function cooldownLeft(ip) {
  if (typeof caches === 'undefined' || !caches.default) return 0;
  try {
    const hit = await caches.default.match(rateKey(ip));
    if (!hit) return 0;
    const ts = Number(await hit.text()) || 0;
    const left = Math.ceil((ts + GB_WINDOW * 1000 - Date.now()) / 1000);
    return left > 0 ? left : 0;
  } catch (e) { return 0; }
}

async function grantTicket(ip) {
  if (typeof caches === 'undefined' || !caches.default) return;
  try {
    await caches.default.put(rateKey(ip), new Response(String(Date.now()), {
      headers: { 'Cache-Control': 'max-age=' + GB_WINDOW }
    }));
  } catch (e) { /* 记不上就算了，不影响留言本身 */ }
}

async function handleTicket(request) {
  const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const wait = await cooldownLeft(ip);
  if (wait > 0) return json({ ok: false, error: 'rate', wait: wait });
  await grantTicket(ip);
  return json({ ok: true, window: GB_WINDOW });
}

function notFound() {
  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>404 — ' + SITE_NAME + '</title><style>' +
    'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;' +
    'background:#FAFAFB;color:#1a1a1a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}' +
    '.b{text-align:center}h1{margin:0;font-size:64px;color:#C96548}p{color:#777}' +
    'a{color:#C96548;text-decoration:none}a:hover{text-decoration:underline}</style></head>' +
    '<body><div class="b"><h1>404</h1><p>这里什么都没有。</p>' +
    '<p><a href="/">← 回首页</a></p></div></body></html>';
  return new Response(html, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

/* ── 路径归一化：去掉结尾斜杠、把 .html 换成无扩展名形式 ── */
function normalizePath(pathname) {
  let p = pathname;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);   // /post/ → /post
  if (p === '/index.html' || p === '/index') return '/';
  if (p.endsWith('.html')) p = p.slice(0, -5);               // /post.html → /post
  return p;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    /* ① 留言通行证（只在边缘做判定，不代发留言） */
    if (path === '/api/guestbook-ticket') {
      try {
        return await handleTicket(request);
      } catch (e) {
        return json({ ok: true });   // 兜底放行
      }
    }

    /* ② 已知页面：用无扩展名路径取资源，避开 Pages 的 308 跳转 */
    if (HTML_ROUTES.has(path)) {
      if (path === url.pathname) return env.ASSETS.fetch(request);
      return env.ASSETS.fetch(new Request(new URL(path + url.search, url), request));
    }

    /* ③ 不像静态资源的一律 404（挡住软 404 回退）
          注意：/api/guestbook.php 会落到这里返回 404，这是**有意为之** ——
          前端探测失败后会自动切到邮箱转发模式 */
    if (!ASSET_RE.test(path)) return notFound();

    /* ④ 静态资源：万一被回退成了 HTML，说明文件不存在，改成 404 */
    const res = await env.ASSETS.fetch(request);
    const ct = res.headers.get('content-type') || '';
    if (res.status === 200 && ct.indexOf('text/html') === 0) return notFound();
    return res;
  }
};
