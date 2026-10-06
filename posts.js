/* ═══════════════════════════════════════════════
   站点配置 + 文章数据

   ▶ 第一步：把下面 SITE 里的占位符换成你自己的信息。
     改这一处，页脚社交按钮、关于卡片、终端 social 指令、
     sitemap / RSS / robots / canonical 都会自动同步。
   ▶ 写新文章：复制一段对象改一改即可，content 用 Markdown 书写
     （支持标题、段落、列表、引用、行内样式、代码块、链接）。
     可选加 contentEn 字段提供英文正文，没有则英文模式也显示中文正文。
   ▶ 注意：content 是模板字符串，代码围栏请用 ~~~ （三个波浪线）；
     如果一定要用反引号围栏，每个反引号前要加反斜杠转义。
   ═══════════════════════════════════════════════ */

window.SITE = {
  name: 'MyBlog',                  // 站点名：标题、页脚、开屏动画都用它
  author: 'Your Name',             // 作者名：页脚署名、关于卡片
  startYear: 2025,                 // 版权起始年，页脚会自动显示 2025–当前年
  url: 'https://your-domain.com',  // 站点正式地址：sitemap / RSS / robots / canonical 都读它
  email: 'you@example.com',
  links: {
    github: 'https://github.com/yourname',
    x: 'https://x.com/yourname',
    zhihu: 'https://www.zhihu.com/people/your-id',
    xiaohongshu: 'https://www.xiaohongshu.com/user/profile/your-id'
    // 想加别的平台：这里加一项，再到 index.html 和 post.html 的页脚加一个按钮即可
  }
};

window.POSTS = [
  {
    slug: 'hello-world',
    title: 'Hello, World！这是你的第一篇示例文章',
    titleEn: 'Hello, World! Your First Sample Post',
    date: '2025-01-12',
    tags: ['示例', '开始'],
    tagsEn: ['demo', 'start'],
    excerpt: '这篇示例演示一篇文章该怎么写：复制它、改一改，就是你的新文章。',
    excerptEn: 'A sample post showing the shape of a post — copy it and start writing.',
    content: `## 这是示例文章

你现在看到的是模板自带的示例文章之一。把它改掉或删掉，就可以开始写自己的东西了。

## 怎么写新文章

打开 posts.js，复制一整段对象，改掉这些字段：

- slug：URL 里的参数，必须唯一，例如 my-first-post
- title / titleEn：中英文标题（英文可省略）
- date：发布日期，格式 2025-01-12
- tags / tagsEn：标签数组
- excerpt / excerptEn：列表卡片上的一句话摘要
- content：正文，用 Markdown 写

## 代码块怎么写

因为 content 本身是模板字符串，代码围栏请用三个波浪线：

~~~js
const hello = (name) => '你好，' + name;
console.log(hello('world'));
~~~

## 然后呢

写完文章跑一次构建，让 sitemap 和 RSS 跟上：

~~~bash
node tools/build.mjs
~~~

完整发布流程见 README 和 DEPLOY.md。`
  },
  {
    slug: 'markdown-demo',
    title: 'Markdown 语法演示',
    titleEn: 'Markdown Syntax Demo',
    date: '2025-01-15',
    tags: ['示例', 'Markdown'],
    tagsEn: ['demo', 'markdown'],
    excerpt: '标题、列表、引用、代码块、链接——模板内置的 Markdown 渲染效果一览。',
    excerptEn: 'Headings, lists, quotes, code blocks and links — what the built-in renderer supports.',
    content: `## 二级标题

这是普通段落。模板内置 marked.js 做 Markdown 解析，本地依赖，不走 CDN。

### 三级标题

无序列表：

- 第一项
- 第二项
- 第三项

有序列表：

1. 第一步
2. 第二步

引用：

> 写作是把脑子里模糊的想法变得清晰的最便宜的方式。

行内样式：**加粗**、*斜体*，以及行内代码 var name = 'world';

代码块（用三个波浪线围栏）：

~~~python
def greet(name):
    return "你好，" + name

print(greet("world"))
~~~

链接：[Markdown 语法说明](https://www.markdownguide.org/)

表格暂不支持，需要时可以直接写 HTML。`
  },
  {
    slug: 'deploy-notes',
    title: '打包、部署与留言板',
    titleEn: 'Build, Deploy and the Guestbook',
    date: '2025-01-20',
    tags: ['示例', '部署'],
    tagsEn: ['demo', 'deploy'],
    excerpt: '站点怎么发到线上、留言板怎么配——完整步骤在 DEPLOY.md，这里是速览。',
    excerptEn: 'How to publish the site and wire up the guestbook. Full steps live in DEPLOY.md.',
    content: `## 打包

站点是纯静态的，部署前跑一次：

~~~bash
node tools/deploy-build.mjs
~~~

它会生成 dist/ 目录，里面只有该公开的文件——含密码的 admin.php、api/、README、
构建脚本都会被自动排除；产物里一旦检出 PHP 文件或默认密码，脚本会直接报错中止。

## 部署

把 dist/ 整个目录传到任意静态托管即可。推荐 Cloudflare Pages：免费、自动签发 HTTPS、
免备案。完整步骤见 DEPLOY.md。

## 留言板

留言板有三层自动降级：

1. PHP 服务器：检测到 api/guestbook.php 可用时，留言存服务器，你在 admin.php 查看
2. 邮箱转发：静态托管下用表单服务把留言直接发进你的邮箱，页面不展示历史留言
3. 本地兜底：都没配置时只存访客浏览器，页面会如实提示

防刷也是内置的：同一浏览器 5 分钟一条、同一 IP 5 分钟一条（由 Cloudflare Worker 在边缘
按 CF-Connecting-IP 判定）、隐藏蜜罐字段、以及打开页面 3 秒内提交判为机器人。`
  }
];
