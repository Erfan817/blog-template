/* ═══════════════════════════════════════════════
   blog.js — 首页与文章页共享的逻辑
   1. 日期本地化（2025-01-12 → 2025年1月12日 / Jan 12, 2025）
   2. 阅读时长估算（中文按字、英文按词）
   3. Markdown → HTML（marked.js，含极简兜底渲染器）
   4. 文章页渲染：元信息 / 标签 / 正文 / 上一篇下一篇 / 404
   5. 站点配置注入（页脚社交链接、邮箱 —— data-site-link）
   6. 不蒜子加载失败的兜底（10 秒没加载出来就隐藏计数行）
   依赖加载顺序：posts.js → i18n.js → marked.min.js → blog.js
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── 1. 日期本地化 ── */
  function formatDate(iso, lang) {
    var p = String(iso).split('-');
    if (p.length !== 3) return iso;
    var y = +p[0], m = +p[1], d = +p[2];
    if (lang === 'en') {
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months[m - 1] + ' ' + d + ', ' + y;
    }
    return y + '年' + m + '月' + d + '日';
  }

  /* ── 2. 阅读时长：中文 ~400 字/分钟，英文 ~200 词/分钟 ── */
  function readingMinutes(md) {
    var text = String(md).replace(/~~~[\s\S]*?~~~/g, ' ').replace(/<[^>]+>/g, ' ');
    var cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
    var words = (text.replace(/[\u3400-\u4dbf\u4e00-\u9fff]/g, ' ')
                     .match(/[A-Za-z0-9]+/g) || []).length;
    return Math.max(1, Math.round(cjk / 400 + words / 200));
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  /* ── 3. Markdown 渲染（marked 缺位时的极简兜底：标题/段落/列表/围栏代码/行内样式） ── */
  function fallbackMd(src) {
    var out = [], para = [], list = null, code = null;
    function inline(s) {
      return esc(s)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
    }
    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<ul>' + list.map(function (li) { return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>'); list = null; } }
    String(src).split('\n').forEach(function (line) {
      if (code !== null) {
        if (/^~~~/.test(line.trim())) { out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); code = null; }
        else code.push(line);
        return;
      }
      if (/^~~~/.test(line.trim())) { flushPara(); flushList(); code = []; return; }
      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flushPara(); flushList(); var l = h[1].length; out.push('<h' + l + '>' + inline(h[2]) + '</h' + l + '>'); return; }
      var li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) { flushPara(); if (!list) list = []; list.push(li[1]); return; }
      if (!line.trim()) { flushPara(); flushList(); return; }
      para.push(line.trim());
    });
    flushPara(); flushList();
    if (code !== null) out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>');
    return out.join('\n');
  }

  function mdToHtml(md) {
    if (window.marked && typeof window.marked.parse === 'function') {
      return window.marked.parse(md);
    }
    return fallbackMd(md);
  }

  /* ── 4. 文章页渲染（语言切换时会整段重新渲染） ── */
  function sortedPosts() {
    return (window.POSTS || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  function renderArticle(root, post, lang) {
    if (!root) return;
    var en = lang === 'en';
    var siteName = window.SITE ? SITE.name : 'MyBlog';
    root.innerHTML = '';

    if (!post) {
      var h = document.createElement('h1');
      h.style.marginTop = '24px';
      h.textContent = I18N.t('post.404t');
      var p = document.createElement('p');
      p.style.color = 'var(--text-dim)';
      p.textContent = I18N.t('post.404b');
      root.appendChild(h);
      root.appendChild(p);
      document.title = '404 — ' + siteName;
      return;
    }

    var title = (en && post.titleEn) ? post.titleEn : post.title;

    var meta = document.createElement('p');
    meta.className = 'article-meta';
    meta.style.marginTop = '24px';
    meta.textContent = formatDate(post.date, en ? 'en' : 'zh') + ' · ' +
      I18N.t('post.readTime').replace('{n}', readingMinutes(post.content));

    var h1 = document.createElement('h1');
    h1.textContent = title;

    var tagsBox = document.createElement('div');
    tagsBox.className = 'article-tags';
    ((en && post.tagsEn) ? post.tagsEn : post.tags || []).forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'tag';
      s.textContent = '#' + t;
      tagsBox.appendChild(s);
    });

    var body = document.createElement('div');
    body.className = 'article-body';
    // 正文可选提供 contentEn（英文版）；没有则沿用中文正文
    body.innerHTML = mdToHtml((en && post.contentEn) ? post.contentEn : post.content);

    root.appendChild(meta);
    root.appendChild(h1);
    root.appendChild(tagsBox);
    root.appendChild(body);

    /* 上/下篇：上一篇=发布更早的，下一篇=更新的 */
    var list = sortedPosts();
    var idx = list.indexOf(post);
    var nav = document.createElement('nav');
    nav.className = 'post-nav';
    [{ key: 'prev', p: idx > 0 ? list[idx - 1] : null },
     { key: 'next', p: idx < list.length - 1 ? list[idx + 1] : null }].forEach(function (item) {
      if (!item.p) return;
      var a = document.createElement('a');
      a.className = 'post-nav-link ' + item.key;
      a.href = 'post.html?p=' + encodeURIComponent(item.p.slug);
      var label = document.createElement('span');
      label.className = 'post-nav-label';
      label.textContent = (item.key === 'prev' ? '← ' : '') +
        I18N.t('post.' + item.key) + (item.key === 'next' ? ' →' : '');
      var tEl = document.createElement('span');
      tEl.className = 'post-nav-title';
      tEl.textContent = (en && item.p.titleEn) ? item.p.titleEn : item.p.title;
      a.appendChild(label);
      a.appendChild(tEl);
      nav.appendChild(a);
    });
    if (nav.childNodes.length) root.appendChild(nav);

    document.title = title + ' — ' + siteName;

    /* canonical / og:url 指向这篇文章自己的地址（不能继承 post.html 的模板地址） */
    setSeo('/post.html?p=' + encodeURIComponent(post.slug),
           title + ' — ' + siteName,
           (en && post.excerptEn) ? post.excerptEn : post.excerpt);
  }

  /* ── 4.5 SEO：文章页的 canonical / og:url / 标题描述随当前文章更新 ── */
  function setSeo(pathAndQuery, title, desc) {
    if (!window.SITE || !SITE.url) return;
    var full = String(SITE.url).replace(/\/+$/, '') + pathAndQuery;
    var link = document.querySelector('link[rel="canonical"]');
    if (link) link.setAttribute('href', full);
    var ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', full);
    function setMeta(sel, val) {
      if (!val) return;
      document.querySelectorAll(sel).forEach(function (m) { m.setAttribute('content', val); });
    }
    setMeta('meta[property="og:title"], meta[name="twitter:title"]', title);
    setMeta('meta[property="og:description"], meta[name="twitter:description"]', desc);
  }

  /* ── 5. 站点配置注入：href 占位统一由 SITE 提供 ── */
  function applySite() {
    if (!window.SITE) return;
    document.querySelectorAll('[data-site-link]').forEach(function (a) {
      var key = a.getAttribute('data-site-link');
      var url = key === 'email' ? 'mailto:' + SITE.email : SITE.links[key];
      if (url) a.setAttribute('href', url);
    });
  }

  /* ── 6. 不蒜子兜底：一直拿不到数据就把"来访人数"整行藏起来 ── */
  function busuanziFallback() {
    var el = document.getElementById('busuanzi_value_site_pv');
    if (!el) return;
    var tries = 0;
    var timer = setInterval(function () {
      var txt = (el.textContent || '').trim();
      if (txt && txt !== '--') { clearInterval(timer); return; }
      if (++tries >= 10) {
        clearInterval(timer);
        var box = el.closest('.visit-count');
        if (box) box.style.display = 'none';
      }
    }, 1000);
  }

  /* ── 7. 主题切换：手动选择存 localStorage；没选过就跟随系统 ── */
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      var label = I18N.t(t === 'dark' ? 'theme.toLight' : 'theme.toDark');
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
    var meta = document.getElementById('meta-theme');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101014' : '#FAFAFB');
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function initTheme() {
    applyTheme(currentTheme());

    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch (e) {}
      applyTheme(next);
    });

    // 没有手动选择时，系统切换深浅色实时跟随
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    function followSystem(ev) {
      var stored = null;
      try { stored = localStorage.getItem('theme'); } catch (e) {}
      if (stored !== 'light' && stored !== 'dark') applyTheme(ev.matches ? 'dark' : 'light');
    }
    if (mq.addEventListener) mq.addEventListener('change', followSystem);
    else if (mq.addListener) mq.addListener(followSystem);

    // 语言切换时同步按钮的提示文字
    if (window.I18N) I18N.onChange(function () { applyTheme(currentTheme()); });
  }

  window.Blog = {
    formatDate: formatDate,
    readingMinutes: readingMinutes,
    mdToHtml: mdToHtml,
    renderArticle: renderArticle,
    applySite: applySite,
    busuanziFallback: busuanziFallback
  };

  applySite();
  busuanziFallback();
  initTheme();
})();
