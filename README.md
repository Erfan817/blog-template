# MyBlog — 极简个人博客模板

纯原生 HTML / CSS / JS 的个人博客，**无框架、无构建步骤**。终端主题、中英双语、
深浅色自适应、Markdown 写作、留言板，外加一套开箱可用的免费部署方案。

## 特性

- **零依赖**：不需要 npm、不需要打包器，改完文件刷新即生效
- **终端美学**：开屏启动动画、可交互的命令行 Hero、行内代码高亮
- **中英双语**：一键切换，localStorage 记忆
- **深浅色主题**：默认跟随系统，也可手动切换
- **Markdown 写作**：文章写在 `posts.js` 里，marked.js 本地解析，无 CDN 依赖
- **留言板三层降级**：PHP 服务器 / 邮箱转发 / 本地兜底，并内置三层防刷
- **SEO 就绪**：sitemap、RSS、robots、canonical、Open Graph 全部由一处配置驱动
- **部署友好**：一条命令产出可上传的 `dist/`，自动排除含密码的文件

## 快速开始

```bash
# 1. 本地预览（Python 3 即可，不需要 Node）
python serve.py 8000
#    打开 http://127.0.0.1:8000

# 2. 改成你自己的（见下）
#    - posts.js 顶部的 SITE：站点名、作者、邮箱、社交链接、正式域名
#    - posts.js 里的三篇示例文章：改写或删除

# 3. 发新文章后跑一次构建，再打包
node tools/build.mjs          # 生成 sitemap.xml / rss.xml / robots.txt
node tools/deploy-build.mjs   # 生成部署包 dist/
```

本地没有 PHP 时，留言板会自动进入本地兜底模式（留言只存访客浏览器），属于预期行为。

## 目录结构

```
├── index.html        首页（Hero 终端、文章列表、关于、留言板）
├── post.html         文章页（?p=slug 读取对应文章）
├── posts.js          ★ 站点配置 SITE + 全部文章数据（Markdown）
├── blog.js           共享逻辑：Markdown 渲染、日期本地化、阅读时长、
│                     上/下篇、主题切换、页脚配置注入、统计兜底
├── i18n.js           中/英切换字典（localStorage 记忆）
├── main.js           首页逻辑：开场动画、互动终端、留言板、滚动入场
├── marked.min.js     marked v12（Markdown 解析，本地依赖，无需 CDN）
├── style.css         浅色 + 深色两套主题（可手动切换，默认跟随系统）
├── logo.svg          站点标志（浏览器标签页用；导航里是内联 SVG 自动变色）
├── api/guestbook.php 留言接口（纯 PHP 单文件，无需数据库）
├── admin.php         ★ 留言管理页（密码登录，查看/删除留言）
├── data/             留言数据目录（服务器上自动生成，需可写）
├── tools/build.mjs          生成 sitemap.xml / rss.xml / robots.txt
├── tools/deploy-build.mjs   生成部署包 dist/（自动排除不该公开的文件）
├── tools/test-worker.mjs    Worker 自测（不需要联网和部署）
├── worker/_worker.js        Cloudflare 边缘 Worker（防刷 + 静态资源修正）
├── sitemap.xml / rss.xml / robots.txt   构建生成
├── dist/             部署产物（生成，不入库；部署时上传这个目录）
└── serve.py          开发预览服务器（no-cache，改文件刷新即生效）
```

## 写文章

打开 `posts.js`，复制一段对象改一改：

```js
{
  slug: 'my-new-post',           // URL 里的 ?p= 参数，需唯一
  title: '文章标题',
  titleEn: 'English Title',      // 英文模式显示，可省略
  date: '2025-10-06',
  tags: ['标签'],
  tagsEn: ['tag'],
  excerpt: '列表卡片上的一句话摘要。',
  excerptEn: 'One-line excerpt.',
  content: `## Markdown 正文

- 支持常用的 Markdown 语法
- 代码围栏请用 ~~~（三个波浪线）`
}
```

可选加 `contentEn` 字段提供英文正文；没有则英文模式也显示中文正文。

**发新文章后记得跑一次：**

```bash
node tools/build.mjs            # 更新 sitemap / RSS / robots
node tools/deploy-build.mjs     # 重新打包 dist/
```

## 站点配置（改一处，全站同步）

`posts.js` 顶部的 `SITE` 对象：站点名、作者、邮箱、社交链接、正式域名、版权起始年。
页脚社交按钮、关于卡片、终端 `social` 指令、sitemap / RSS / robots / canonical 都会自动读取。

- 想加社交平台：在 `SITE.links` 加一项，再到 `index.html` 和 `post.html` 的页脚照抄一个按钮。
- 页脚署名读的是 `SITE.author`（i18n 里的 `{author}` 占位符）。

## 留言板：三种模式自动切换

| 模式 | 触发条件 | 留言去向 |
|------|----------|----------|
| ① 服务器 | 检测到 `api/guestbook.php` 可用（PHP 主机） | 存到服务器 `data/`，你在 `admin.php` 查看 |
| ② 邮箱转发 | 没有 PHP，但 `SITE.email` 存在 | 访客浏览器直连表单服务，留言进你邮箱 |
| ③ 本地兜底 | 都没配置 | 只存访客浏览器，页面会如实提示 |

**部署到自己的服务器（PHP 环境，宝塔/lnmp/虚拟主机均可）：**

1. 全部文件上传到网站目录，PHP ≥ 7.0；
2. **改掉 `admin.php` 顶部的 `ADMIN_PASSWORD`**（默认是示例值，必须改！）；
3. 确保 `data/` 目录对 PHP 可写（宝塔默认即可；报 storage 错误就 chmod 755）；
4. 访问 `https://你的域名/admin.php` 登录查看留言。

**可选：新留言微信提醒** — 去 [Server酱](https://sct.ftqq.com) 申请 SendKey，
填到 `api/guestbook.php` 顶部的 `$SERVERCHAN_SENDKEY`，有人留言微信立刻收到。

**反垃圾已内置**：蜜罐字段（机器人会填）+ 同 IP 限流 + 长度截断。

## 本地预览

```bash
python serve.py 8000     # 或 python -m http.server 8000
# 打开 http://localhost:8000
```

## 部署

推荐 **Cloudflare Pages**（免费、免备案、自动 HTTPS）。完整步骤见 [DEPLOY.md](DEPLOY.md)。

要点：部署时上传的是 **`dist/` 目录**，不是仓库根目录 —— 这样含密码的 `admin.php`、
`api/`、构建脚本都不会被公开。`tools/deploy-build.mjs` 会自动完成这些排除，
并在产物里检出 `.php` 文件或默认密码时直接报错中止。

## 上手检查清单

- [ ] `posts.js` 的 `SITE` 全部换成自己的信息（站点名、作者、邮箱、社交链接、域名）
- [ ] 三篇示例文章：改写或删除
- [ ] `admin.php` 的 `ADMIN_PASSWORD` 改掉（虽然 `dist/` 不会上传它，改了更保险）
- [ ] 邮箱转发模式：按 [DEPLOY.md](DEPLOY.md) 激活一次表单服务
- [ ] 挑一个开源许可证并补上 `LICENSE`（本模板未附带，默认即"保留所有权利"）

## 说明

- 主题切换、语言切换、留言板都不依赖任何后端；唯一可选的后端是 PHP 留言接口。
- 站点的字体走 `fonts.loli.net` 国内镜像（`fonts.googleapis.com` 在大陆不可达），
  追求极致稳定可以下载字体自托管。
- 访问统计用的是[不蒜子](https://busuanzi.ibruce.info)的免费脚本，加载不出来时页面会自动隐藏这一行。
