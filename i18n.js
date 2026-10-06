/* ═══════════════════════════════════════════════
   i18n.js — 中/英切换（localStorage 记忆）
   原则：中文模式全中文，英文模式全英文，不混杂。
   用法：data-i18n="key"（纯文本）
         data-i18n-html="key"（含 HTML）
         data-i18n-ph="key"（placeholder）
   ═══════════════════════════════════════════════ */

(function () {
  'use strict';

  var DICT = {
    zh: {
      /* 站点 */
      'site.indexTitle': 'MyBlog — 个人博客',
      /* 导航 */
      'nav.home':      '首页',
      'nav.posts':     '文章',
      'nav.about':     '关于',
      'nav.guestbook': '留言',
      /* 开场动画 */
      'intro.cmd':     '启动 我的博客',
      'intro.ok':      '[ 完成 ] 一切就绪',
      'intro.loading': '正在加载',
      'intro.welcome': '▸ 欢迎，随便看看。',
      'intro.skip':    '按 Esc 或点击任意处跳过 ▸▸',
      /* Hero 终端 */
      'hero.cmd1':     '我是谁',
      'hero.out1':     '👋 你好，我是 <strong>Your Name</strong>',
      'hero.cmd2':     '打开 自我介绍.txt',
      'hero.out2':     '这里是我的个人博客，记录代码、生活与随想。',
      'hero.btn1':     '读最新文章',
      'hero.btn2':     '去留言板',
      'hero.hint':     '试试输入 help 再回车 ↵',
      /* 互动终端 */
      't.unknown':     '没这条指令：{c} —— 输入 help 查看全部',
      't.whoami':      'Your Name —— 写代码的人 / 终身学习者',
      't.about':       '已带你跳到「关于我」↓',
      't.gb':          '已带你跳到留言板 ↓ 去给我写点什么吧',
      't.social':      '我的社交账号 ↓',
      't.sudo':        '权限不足：你不是博主 😏',
      't.rm':          '🗑️ 住手！博客差点没了……',
      't.hello':       '你好呀 👋 欢迎来到我的博客',
      't.lang':        '已切换语言 / Language switched',
      /* 区块标题 */
      'sec.posts':     '最新文章',
      'sec.about':     '关于我',
      'sec.guestbook': '留言板',
      /* 关于 */
      'about.k.name':  '姓名',
      'about.k.role':  '身份',
      'about.k.stack': '技术栈',
      'about.k.motto': '座右铭',
      'about.k.links': '链接',
      'about.role':    '写代码的人 / 终身学习者',
      'about.stack':   'JavaScript · Python · 好奇心',
      /* 主题切换 */
      'theme.toDark':  '切换到深色模式',
      'theme.toLight': '切换到浅色模式',
      /* 留言板 */
      'gb.hint':       '给我写点什么吧 — 留言只有我能看到 🔒',
      'gb.hintLocal':  '留言板接入中：留言暂时只保存在你自己的浏览器里，我还看不到',
      'gb.namePh':     '你的昵称',
      'gb.msgPh':      '写下你的想法…',
      'gb.submit':     '发送留言',
      'gb.sent':       '已收到 ✓',
      'gb.sentLocal':  '已保存到本地 ✓（我暂时还看不到）',
      'gb.tooFast':    '发送太频繁啦，过几分钟再试 🌿',
      'gb.fail':       '发送失败，稍后再试',
      /* 页脚 */
      'footer.findme': '找到我',
      'footer.visitsPre':  '已有',
      'footer.visitsPost': '位朋友来过',
      'footer.line':   '打印 "© {year} {author} — 由咖啡和好奇心驱动"',
      'replay':        '↺ 重播开场',
      /* 文章页 */
      'post.back':     '← 返回文章列表',
      'post.loading':  '加载中…',
      'post.readTime': '约 {n} 分钟读完',
      'post.prev':     '上一篇',
      'post.next':     '下一篇',
      'post.404t':     '404：文章不存在',
      'post.404b':     '这篇文章不存在，可能已经被删掉了。'
    },
    en: {
      /* site */
      'site.indexTitle': 'MyBlog — a personal blog',
      /* nav */
      'nav.home':      'home',
      'nav.posts':     'posts',
      'nav.about':     'about',
      'nav.guestbook': 'guestbook',
      /* intro */
      'intro.cmd':     'boot my.blog',
      'intro.ok':      '[ OK ] ready',
      'intro.loading': 'loading',
      'intro.welcome': '▸ Welcome, make yourself at home.',
      'intro.skip':    'press Esc or click anywhere to skip ▸▸',
      /* hero terminal */
      'hero.cmd1':     'whoami',
      'hero.out1':     '👋 Hi, I\'m <strong>Your Name</strong>',
      'hero.cmd2':     'cat intro.txt',
      'hero.out2':     'My personal blog — code, life, and random thoughts.',
      'hero.btn1':     'read latest posts',
      'hero.btn2':     'guestbook',
      'hero.hint':     'try typing help and press Enter ↵',
      /* interactive terminal */
      't.unknown':     'command not found: {c} — type help',
      't.whoami':      'Your Name — coder / lifelong learner',
      't.about':       'took you down to about me ↓',
      't.gb':          'took you down to the guestbook ↓ leave me something',
      't.social':      'find me online ↓',
      't.sudo':        'permission denied: you are not Your Name 😏',
      't.rm':          '🗑️ whoa! almost deleted the whole blog…',
      't.hello':       'Hey there 👋 welcome to my blog',
      't.lang':        'language switched / 语言已切换',
      /* section titles */
      'sec.posts':     'latest posts',
      'sec.about':     'about me',
      'sec.guestbook': 'guestbook',
      /* about */
      'about.k.name':  'name',
      'about.k.role':  'role',
      'about.k.stack': 'stack',
      'about.k.motto': 'motto',
      'about.k.links': 'links',
      'about.role':    'Coder / lifelong learner',
      'about.stack':   'JavaScript · Python · Curiosity',
      /* theme toggle */
      'theme.toDark':  'switch to dark mode',
      'theme.toLight': 'switch to light mode',
      /* guestbook */
      'gb.hint':       'Leave me a message — only I can read it 🔒',
      'gb.hintLocal':  'guestbook is being wired up — for now messages only stay in your own browser',
      'gb.namePh':     'your nickname',
      'gb.msgPh':      'leave a message…',
      'gb.submit':     'send',
      'gb.sent':       'sent ✓',
      'gb.sentLocal':  'saved locally ✓ (I can\'t see it yet)',
      'gb.tooFast':    'too many messages — try again in a few minutes',
      'gb.fail':       'failed to send, try later',
      /* footer */
      'footer.findme': 'find me online',
      'footer.visitsPre':  '',
      'footer.visitsPost': 'visitors so far',
      'footer.line':   'echo "© {year} {author} — powered by coffee & curiosity"',
      'replay':        '↺ replay intro',
      /* post page */
      'post.back':     '← back to posts',
      'post.loading':  'loading…',
      'post.readTime': '{n} min read',
      'post.prev':     'previous',
      'post.next':     'next',
      'post.404t':     '404: post not found',
      'post.404b':     'This post does not exist — it may have been deleted.'
    }
  };

  var current = 'zh';
  try { current = localStorage.getItem('lang') === 'en' ? 'en' : 'zh'; } catch (e) {}

  var listeners = [];

  function t(key) {
    var d = DICT[current];
    return (d && d[key] != null) ? d[key] : (DICT.zh[key] || key);
  }

  /* {year} 占位符：2025 → "2025"，同年之后 → "2025–2026" */
  function yearStr() {
    var y = new Date().getFullYear();
    var start = window.SITE && SITE.startYear ? SITE.startYear : y;
    return start >= y ? String(y) : start + '–' + y;
  }

  function tr(key) {
    return t(key)
      .replace('{year}', yearStr())
      .replace('{author}', (window.SITE && SITE.author) || 'Your Name');
  }

  function apply() {
    document.documentElement.lang = current === 'en' ? 'en' : 'zh-CN';

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = tr(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = tr(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = tr(el.getAttribute('data-i18n-ph'));
    });

    var btn = document.getElementById('lang-toggle');
    if (btn) btn.textContent = current === 'zh' ? 'EN' : '中文';

    listeners.forEach(function (cb) { cb(current); });
  }

  window.I18N = {
    lang: function () { return current; },
    t: t,
    onChange: function (cb) { listeners.push(cb); },
    toggle: function () {
      current = current === 'zh' ? 'en' : 'zh';
      try { localStorage.setItem('lang', current); } catch (e) {}
      apply();
    }
  };

  // 脚本在 body 末尾加载，DOM 已就绪
  var btn = document.getElementById('lang-toggle');
  if (btn) btn.addEventListener('click', function () { window.I18N.toggle(); });
  apply();
})();
