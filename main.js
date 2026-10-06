/* ═══════════════════════════════════════════════
   MyBlog — 首页主逻辑（共享逻辑见 blog.js）
   1. 开场动画：精简版终端启动（Esc/点击跳过，每会话一次）
   2. Hero 互动终端（访客可输入指令）
   3. 文章卡片渲染（跟随语言切换）
   4. 留言板（自建 PHP 接口 / 表单转发 FormSubmit 直达邮箱 / 本地兜底，三级降级）
   5. 滚动入场动效
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ▼▼▼ 留言转发地址（FormSubmit.co，零注册、留言直达邮箱）：
     默认直接用 posts.js 里 SITE.email 当收件邮箱，这里不用改。
     FormSubmit 激活后会给你一个随机别名（https://formsubmit.co/el/xxxxxx），
     填到下面即可隐藏邮箱、防爬虫。▼▼▼ */
  var MAIL_ENDPOINT_OVERRIDE = '';
  var MAIL_ENDPOINT = MAIL_ENDPOINT_OVERRIDE ||
    (window.SITE && SITE.email ? 'https://formsubmit.co/ajax/' + SITE.email : '');
  var MAIL_CONFIGURED = !!MAIL_ENDPOINT;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────────── 1. 开场动画（三幕式） ─────────────
     一幕：终端敲入启动命令 + 进度条冲刺
     二幕：Logo 笔画描绘 + 名字逐字炸出
     三幕：幕布掀起，进入首页                      */
  var intro = document.getElementById('intro');
  var introBody = document.getElementById('intro-body');

  var introFinished = false;

  function finishIntro() {
    if (introFinished || !intro) return;
    introFinished = true;
    intro.classList.add('done');
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}
    setTimeout(function () {
      if (intro && intro.parentNode) intro.parentNode.removeChild(intro);
    }, 950);
    document.removeEventListener('keydown', onIntroKey);
  }

  function onIntroKey(e) {
    if (e.key === 'Escape') finishIntro();
  }

  function typeLine(spec, done) {
    var kind = spec[0], text = spec[1], speed = spec[2];
    var line = document.createElement('div');
    line.className = kind;
    introBody.appendChild(line);

    if (reduceMotion) { line.textContent = text; done(); return; }
    var i = 0;
    (function tick() {
      line.textContent = text.slice(0, ++i);
      if (i < text.length) {
        setTimeout(tick, speed);
      } else {
        setTimeout(done, kind === 'welcome' ? 750 : 200);
      }
    })();
  }

  /* 一幕收尾：终端内进度条冲刺 */
  function runProgress(done) {
    var line = document.createElement('div');
    line.className = 'dim';
    introBody.appendChild(line);
    var pct = 0;
    (function step() {
      if (introFinished) return;
      pct = Math.min(100, pct + 4 + Math.floor(Math.random() * 7));
      var filled = Math.round(pct / 10);
      line.textContent = I18N.t('intro.loading') + ' [' +
        '█'.repeat(filled) + '░'.repeat(10 - filled) + '] ' + pct + '%';
      if (pct < 100) setTimeout(step, 36);
      else setTimeout(done, 280);
    })();
  }

  /* 二幕：把 "MyBlog" 拆成字母，逐字炸出 */
  function buildLogoName() {
    var el = document.getElementById('logo-name');
    if (!el || el.childNodes.length) return;
    function addWord(word, cls, base) {
      for (var i = 0; i < word.length; i++) {
        var s = document.createElement('span');
        s.className = 'ln-letter' + (cls ? ' ' + cls : '');
        s.textContent = word[i];
        s.style.animationDelay = (base + i * 55) + 'ms';
        el.appendChild(s);
      }
      return word.length;
    }
    /* 站点名按点号分段：MyBlog → "My" + ".Blog"，跟着 SITE.name 走 */
    var parts = String((window.SITE && SITE.name) || 'MyBlog').split('.');
    var n = addWord(parts.shift() || 'MyBlog', '', 750);
    if (parts.length) addWord('.' + parts.join('.'), 'ln-accent', 750 + n * 55 + 80);
  }

  function runIntro() {
    typeLine(['cmd', 'user@blog ~ % ' + I18N.t('intro.cmd'), 32], function () {
      if (introFinished) return;
      typeLine(['ok', I18N.t('intro.ok'), 10], function () {
        if (introFinished) return;
        runProgress(function () {
          if (introFinished) return;
          intro.classList.add('phase-logo');
          buildLogoName();
          setTimeout(finishIntro, 2400);
        });
      });
    });
  }

  if (intro) {
    var seen = false;
    try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}

    if (seen || reduceMotion) {
      finishIntro();
    } else {
      document.addEventListener('keydown', onIntroKey);
      intro.addEventListener('click', finishIntro);
      setTimeout(runIntro, 450);
    }

    var replay = document.getElementById('replay-intro');
    if (replay) {
      replay.addEventListener('click', function () {
        try { sessionStorage.removeItem('introSeen'); } catch (e) {}
        location.reload();
      });
    }
  }

  /* ───────────── 2. Hero 互动终端：访客可以真的打字 ───────────── */
  var HELP_LINES = {
    zh: [
      '可用指令：',
      '  help         —— 查看全部指令',
      '  whoami       —— 我是谁',
      '  posts        —— 最新文章',
      '  about        —— 跳到「关于我」',
      '  social       —— 我的社交账号',
      '  guestbook    —— 跳到留言板',
      '  echo <文字>  —— 复读给你听',
      '  date         —— 现在几点',
      '  lang         —— 切换中/英文',
      '  clear        —— 清空屏幕'
    ],
    en: [
      'available commands:',
      '  help         — list all commands',
      '  whoami       — who am I',
      '  posts        — latest posts',
      '  about        — jump to about me',
      '  social       — my social links',
      '  guestbook    — jump to guestbook',
      '  echo <text>  — repeat after you',
      '  date         — current time',
      '  lang         — switch language',
      '  clear        — clear the screen'
    ]
  };

  var heroTerm = document.getElementById('hero-term');
  var termInput = document.getElementById('term-input');
  var termInputLine = document.getElementById('term-input-line');

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function termPrint(html, cls) {
    var line = document.createElement('p');
    line.className = (cls || 'output') + ' dynamic';
    line.innerHTML = html;
    heroTerm.insertBefore(line, termInputLine);
  }

  function termEcho(cmd) {
    var line = document.createElement('p');
    line.className = 'dynamic';
    line.innerHTML = '<span class="prompt">user@blog</span> <span class="path">~</span> % ';
    var span = document.createElement('span');
    span.textContent = cmd;
    line.appendChild(span);
    heroTerm.insertBefore(line, termInputLine);
  }

  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function processCommand(raw) {
    var trimmed = raw.trim();
    if (!trimmed) return;
    var firstSpace = trimmed.indexOf(' ');
    var cmd = (firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace)).toLowerCase();
    var args = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
    var en = I18N.lang() === 'en';

    switch (cmd) {
      case 'help':
        HELP_LINES[I18N.lang()].forEach(function (l) { termPrint(esc(l), 'output dim'); });
        break;
      case 'whoami':
        termPrint(esc(I18N.t('t.whoami')));
        break;
      case 'posts':
        (window.POSTS || []).forEach(function (p) {
          var title = (en && p.titleEn) ? p.titleEn : p.title;
          termPrint('<a class="term-link" href="post.html?p=' + encodeURIComponent(p.slug) + '">' +
            esc(title) + '</a> <span class="dim">' + esc(p.date) + '</span>');
        });
        break;
      case 'about':
        scrollToId('about');
        termPrint(esc(I18N.t('t.about')));
        break;
      case 'guestbook':
      case 'gb':
        scrollToId('guestbook');
        termPrint(esc(I18N.t('t.gb')));
        break;
      case 'social':
        termPrint(esc(I18N.t('t.social')));
        // 链接统一取自 posts.js 的 SITE.links，改配置即全站同步
        if (window.SITE) {
          var socials = [['github', 'GitHub'], ['x', 'X'], ['zhihu', '知乎'],
                         ['xiaohongshu', '小红书']];
          termPrint(socials
            .filter(function (s) { return SITE.links && SITE.links[s[0]]; })
            .map(function (s) {
              return '<a class="term-link" href="' + esc(SITE.links[s[0]]) +
                '" target="_blank" rel="noopener">' + esc(s[1]) + '</a>';
            })
            .join(' · '));
        }
        break;
      case 'echo':
        termPrint(esc(args));
        break;
      case 'date':
        termPrint(esc(new Date().toLocaleString(en ? 'en-US' : 'zh-CN')));
        break;
      case 'lang':
        I18N.toggle();
        termPrint(esc(I18N.t('t.lang')));
        break;
      case 'clear':
        heroTerm.querySelectorAll('.dynamic').forEach(function (n) { n.remove(); });
        break;
      case 'sudo':
        termPrint(esc(I18N.t('t.sudo')));
        break;
      case 'rm':
        termPrint(esc(I18N.t('t.rm')));
        break;
      case 'hello':
      case 'hi':
      case '你好':
        termPrint(esc(I18N.t('t.hello')));
        break;
      default:
        termPrint(esc(I18N.t('t.unknown').replace('{c}', cmd)));
    }
  }

  if (heroTerm && termInput) {
    termInput.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var raw = termInput.value;
      termInput.value = '';
      termEcho(raw);
      processCommand(raw);
      heroTerm.scrollTop = heroTerm.scrollHeight;
    });
    // 点终端任意处聚焦输入框（选中文字时不抢焦点）
    heroTerm.addEventListener('click', function () {
      if (!window.getSelection().toString()) termInput.focus();
    });
  }

  /* ───────────── 3. 文章卡片渲染 ───────────── */
  var grid = document.getElementById('post-grid');

  function renderPosts() {
    if (!grid || !window.POSTS) return;
    grid.innerHTML = '';
    var en = I18N.lang() === 'en';
    window.POSTS.forEach(function (post) {
      var a = document.createElement('a');
      a.className = 'post-card reveal visible';
      a.href = 'post.html?p=' + encodeURIComponent(post.slug);
      a.innerHTML = '<div class="file-name"></div><h3></h3><p></p><div class="tags"></div>';
      a.querySelector('.file-name').textContent =
        window.Blog ? Blog.formatDate(post.date, en ? 'en' : 'zh') : post.date;
      a.querySelector('h3').textContent = (en && post.titleEn) ? post.titleEn : post.title;
      a.querySelector('p').textContent = (en && post.excerptEn) ? post.excerptEn : post.excerpt;
      var tagBox = a.querySelector('.tags');
      var tags = (en && post.tagsEn) ? post.tagsEn : post.tags;
      tags.forEach(function (t) {
        var s = document.createElement('span');
        s.className = 'tag';
        s.textContent = '#' + t;
        tagBox.appendChild(s);
      });
      grid.appendChild(a);
    });
  }
  renderPosts();

  /* ───────────── 4. 留言板 ─────────────
     三级模式，按可用性自动选择：
     ① server —— 部署到支持 PHP 的服务器后自动启用（api/guestbook.php），
                 留言存到服务器，博主在 admin.php 查看
     ② mail   —— 无 PHP 且有转发地址时，经 FormSubmit.co 直接发到博主邮箱
                 （访客看不到历史留言，页面上也不会展示）
     ③ local  —— 都没有时存访客浏览器本地，并如实提示"博主看不到"

     ── 防刷三层，正常访客完全无感 ──
     a. 本机冷却：同一浏览器 5 分钟内只能发一条（localStorage）
     b. IP 通行证：发送前先向 Cloudflare 边缘领票，同一 IP 同窗口只放行一条
        （边缘读 CF-Connecting-IP，客户端伪造不了；拿不到票就放行，不挡正常留言）
     c. 机器人特征：填了隐藏字段、或打开页面 3 秒内就提交 —— 静默丢弃   */
  var GUESTBOOK_API = 'api/guestbook.php';
  var GB_TICKET_API = 'api/guestbook-ticket';
  var GB_COOLDOWN_MS = 5 * 60 * 1000;   // 与 worker/_worker.js 里的 GB_WINDOW 保持一致
  var GB_MIN_DWELL_MS = 3000;           // 打开页面到提交的最短间隔
  var GB_LAST_KEY = 'myblog-gb-last';
  var gbOpenedAt = Date.now();
  var gbMode = 'local';
  var gbForm = document.getElementById('gb-form');
  var gbHint = document.querySelector('.gb-hint');

  /* 本机冷却：记录/读取上次成功发送的时间 */
  function gbLastSent() {
    try { return parseInt(localStorage.getItem(GB_LAST_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function gbMarkSent() {
    try { localStorage.setItem(GB_LAST_KEY, String(Date.now())); } catch (e) {}
  }
  function gbCooldownLeft() {
    return Math.max(0, gbLastSent() + GB_COOLDOWN_MS - Date.now());
  }

  function setGbHint(key) {
    if (!gbHint) return;
    gbHint.setAttribute('data-i18n', key);
    gbHint.textContent = I18N.t(key);
  }

  // 页面加载时探测服务端接口
  fetch(GUESTBOOK_API + '?ping=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (data && data.ok) {
        gbMode = 'server';
        setGbHint('gb.hint');
      } else {
        initFallbackMode();
      }
    })
    .catch(initFallbackMode);

  function initFallbackMode() {
    if (MAIL_CONFIGURED) {
      gbMode = 'mail';
      setGbHint('gb.hint');
    } else {
      gbMode = 'local';
      setGbHint('gb.hintLocal');
    }
  }

  function saveLocally(name, msg) {
    try {
      var list = JSON.parse(localStorage.getItem('myblog-guestbook')) || [];
      list.push({ name: name, msg: msg, ts: Date.now() });
      localStorage.setItem('myblog-guestbook', JSON.stringify(list));
    } catch (err) {}
  }

  if (gbForm) {
    gbForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = document.getElementById('gb-name');
      var msgEl = document.getElementById('gb-msg');
      var msg = msgEl.value.trim();
      if (!msg) return;
      var btn = gbForm.querySelector('button[type="submit"]');

      function feedback(key) {
        if (!btn) return;
        btn.textContent = I18N.t(key);
        setTimeout(function () { btn.textContent = I18N.t('gb.submit'); }, 2500);
      }

      var name = nameEl.value.trim() || 'anonymous';
      var website = (document.getElementById('gb-website') || {}).value || '';

      /* ── 防刷闸门（对正常访客无感）── */
      if (website) { msgEl.value = ''; feedback('gb.sent'); return; }                 // 蜜罐：机器人会填
      if (Date.now() - gbOpenedAt < GB_MIN_DWELL_MS) { feedback('gb.sent'); return; }  // 秒填秒交，判为机器人
      if (gbCooldownLeft() > 0) { feedback('gb.tooFast'); return; }                    // 本机冷却

      /* ① 自建 PHP 接口（推荐：部署后自动启用） */
      if (gbMode === 'server') {
        if (btn) btn.textContent = '...';
        fetch(GUESTBOOK_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, message: msg.slice(0, 300), website: website })
        }).then(function (r) { return r.json().catch(function () { return null; }); })
          .then(function (data) {
            if (data && data.ok) { msgEl.value = ''; gbMarkSent(); feedback('gb.sent'); }
            else if (data && data.error === 'rate') { feedback('gb.tooFast'); }
            else { feedback('gb.fail'); }
          })
          .catch(function () {
            saveLocally(name, msg.slice(0, 300));   // 网络异常时兜底，不丢留言
            feedback('gb.sentLocal');
          });
        return;
      }

      /* ② FormSubmit.co（无 PHP 且配了收件地址时走这里）：留言直接进博主邮箱
         ⚠️ 必须看正文里的 success 字段，不能只看 r.ok：
            表单**未激活**时它同样返回 HTTP 200，但正文是 success:"false"
            （"This form needs Activation…"），只看 r.ok 会误报"发送成功" */
      if (gbMode === 'mail') {
        if (btn) btn.textContent = '...';

        function sendByMail() {
          fetch(MAIL_ENDPOINT, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              _subject: ((window.SITE && SITE.name) || '博客') + ' 收到一条新留言',
              _template: 'table',
              name: name,
              message: msg.slice(0, 300)
            })
          }).then(function (r) {
            return r.json().catch(function () { return null; });
          }).then(function (data) {
            var sent = !!data && (data.success === true || data.success === 'true');
            if (sent) { msgEl.value = ''; gbMarkSent(); feedback('gb.sent'); }
            else { saveLocally(name, msg.slice(0, 300)); feedback('gb.fail'); }
          }).catch(function () {
            saveLocally(name, msg.slice(0, 300));   // 网络异常也不丢，留在访客本机
            feedback('gb.fail');
          });
        }

        /* 先向 Cloudflare 边缘领「IP 通行证」：同一 IP 5 分钟只放行一条。
           领不到（纯静态主机、网络异常等）就照常发送 ——
           限流环节自己出故障时，绝不能挡住正常留言 */
        fetch(GB_TICKET_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }).then(function (r) { return r.json().catch(function () { return null; }); })
          .catch(function () { return null; })
          .then(function (ticket) {
            if (ticket && ticket.ok === false && ticket.error === 'rate') {
              feedback('gb.tooFast');
              return;
            }
            sendByMail();
          });
        return;
      }

      /* ③ 都没配置：存本地并如实告知 */
      saveLocally(name, msg.slice(0, 300));
      msgEl.value = '';
      feedback('gb.sentLocal');
    });
  }

  /* ───────────── 语言切换时的联动 ───────────── */
  function applyIndexTitle() {
    document.title = I18N.t('site.indexTitle');
  }
  applyIndexTitle();
  I18N.onChange(function () {
    renderPosts();
    applyIndexTitle();
  });

  /* ───────────── 5. 滚动入场 ───────────── */
  var revealEls = document.querySelectorAll('.reveal:not(.post-card)');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }
})();
