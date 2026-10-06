#!/usr/bin/env node
/* ═══════════════════════════════════════════════
   build.mjs — 从 posts.js 生成 sitemap.xml / rss.xml / robots.txt

   用法：
     node tools/build.mjs                 # 用脚本内的默认域名
     node tools/build.mjs https://xx.com  # 或指定你的正式域名

   ▶ 发新文章后记得跑一次，让 sitemap / RSS 与文章保持同步。
   ▶ 域名备案下来后，用正式域名跑一次并提交生成结果。
   ═══════════════════════════════════════════════ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* posts.js 是给浏览器用的（挂 window），这里垫一个 window 再导入 */
globalThis.window = globalThis;
await import(pathToFileURL(join(root, 'posts.js')).href);
const { SITE, POSTS } = globalThis.window;

/* 域名优先级：命令行参数 > posts.js 里的 SITE.url > 占位符 */
const SITE_URL = (process.argv[2] || SITE.url || 'https://your-domain.com').replace(/\/+$/, '');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');
const postUrl = (p) => `${SITE_URL}/post.html?p=${encodeURIComponent(p.slug)}`;
const sorted = [...POSTS].sort((a, b) => (a.date < b.date ? -1 : 1));
const newest = sorted[sorted.length - 1];

/* ── sitemap.xml ── */
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${newest.date}</lastmod>
  </url>
${sorted.map((p) => `  <url>
    <loc>${postUrl(p)}</loc>
    <lastmod>${p.date}</lastmod>
  </url>`).join('\n')}
</urlset>
`;

/* ── rss.xml（RSS 2.0）── */
const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(SITE.name)}</title>
  <link>${SITE_URL}/</link>
  <description>${esc('我的个人博客：代码、生活与随想。')}</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date(newest.date + 'T12:00:00Z').toUTCString()}</lastBuildDate>
  <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${sorted.slice().reverse().map((p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${postUrl(p)}</link>
    <guid isPermaLink="true">${postUrl(p)}</guid>
    <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
    <description>${esc(p.excerpt)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`;

/* ── robots.txt ── */
const robots = `User-agent: *
Allow: /
Disallow: /admin.php
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

writeFileSync(join(root, 'sitemap.xml'), sitemap);
writeFileSync(join(root, 'rss.xml'), rss);
writeFileSync(join(root, 'robots.txt'), robots);
console.log(`✓ 已生成 sitemap.xml / rss.xml / robots.txt（站点地址：${SITE_URL}）`);
console.log(`  共 ${POSTS.length} 篇文章。域名正式确定后用 node tools/build.mjs https://你的域名 重新生成。`);
