# MyBlog 上线部署手册

> **目标**：把站点发布到 `https://your-domain.com`，免备案、国内可直连。
> **平台**：Cloudflare Pages（免费）　**留言板**：FormSubmit.co（零注册，留言直达邮箱）
> **首次耗时**：约 20–30 分钟（其中等 DNS 生效占大头）

---

## 0. 出发前状态（已确认，无需操作）

| 项目 | 现状 |
|---|---|
| 域名 | `your-domain.com` |
| DNS 托管 | DNSPod（`execute.dnspod.net` / `fifth.dnspod.net`） |
| 现有记录 | **请到 DNSPod 控制台自行确认**（本机若开着代理/VPN 会伪造 DNS，命令行查出来的 `198.18.x.x` 是假的） |
| 邮箱记录 | 同样以 DNSPod 控制台为准；只要你没在这个域名上配过邮箱，改 NS 就没有影响 |
| 站点产物 | `dist/`（`node tools/deploy-build.mjs` 生成，12 个文件、约 124 KB） |

**一句话原理**：Cloudflare Pages 托管静态文件 → 你把域名 DNS 交给 Cloudflare → Cloudflare 把你的域名指向这份静态文件并自动发 HTTPS 证书。全程不需要服务器、不需要备案。

---

## 步骤总览

| # | 做什么 | 在哪做 | 预计 |
|---|---|---|---|
| 1 | 留言板：**零注册**，部署后花 1 分钟激活 | 浏览器 + 邮箱 | 1 分钟 |
| 2 | 把地址填进 `main.js`，重新打包 | 本机终端 | 2 分钟 |
| 3 | 注册 / 登录 Cloudflare | dash.cloudflare.com | 3 分钟 |
| 4 | 建 Pages 项目，上传 `dist/` | Cloudflare 后台 | 3 分钟 |
| 5 | 先验 `pages.dev` 能不能打开 | 浏览器 | 1 分钟 |
| 6 | 把域名加进 Cloudflare，拿两个 NS | Cloudflare 后台 | 2 分钟 |
| 7 | 到 DNSPod 把 NS 改成那两个 | dnspod.cn | 3 分钟 |
| 8 | 等 NS 生效（几分钟 ~ 几小时） | — | 等待 |
| 9 | 绑定自定义域，自动发证书 | Cloudflare 后台 | 2 分钟 |
| 10 | 验收清单逐条过 | 浏览器 | 3 分钟 |
| 11 | 提交代码到 git | 本机终端 | 1 分钟 |

---

## 第 1 步 · 留言板（零注册，什么都不用配）

留言转发用的是 **FormSubmit.co**，**不需要注册任何账号、不需要信用卡**。代码里已经自动拿
`posts.js` 的 `SITE.email`（当前是 `you@example.com`）当收件邮箱，所以这一步**你现在没有任何操作**。

> **架构说明**：留言由**访客浏览器直连 FormSubmit.co** 投递。`dist/` 里的 `_worker.js`
> **不参与留言**，只负责修静态资源（消掉 Pages 默认的 `.html` 308 跳转和软 404）。
>
> 曾经让 Worker 在边缘代发（访客只连自己域名、更快），但实测**该 Worker 发起的任何外部
> fetch 都会被 Cloudflare 平台层掐断**：不涉及外部请求的分支都能正常返回，一旦 fetch 外部地址，
> Cloudflare 就用它自己的 502 页替换响应，连 `try/catch` 都拦不住。所以回到直连方案。

**激活是必须做的一步**：FormSubmit 对未激活的表单同样返回 HTTP 200，但正文是 `success:"false"`，
邮件不会真正投递（前端已改成按正文判断）。正确顺序是：

1. 先把站点部署上线（第 3–9 步）；
2. 在留言板填一条测试留言提交 —— 此时按钮提示**"发送失败"是正常的**（还没激活）；
3. 去 `you@example.com` 收信（**一定要看垃圾箱**），找到 FormSubmit 的确认邮件，点里面的链接；
4. 回站点**再提交一次**，这次按钮提示"发送成功"，邮箱也就真收到了；
5. 之后每条留言都会直接进这个邮箱，页面上不展示任何历史留言。

> **收不到确认邮件？** 用浏览器直接打开 <https://formsubmit.co/you@example.com>，
> 在它页面上随便填一条提交，同样会触发确认邮件。
>
> **想换收件邮箱？** 改 `posts.js` 里的 `SITE.email` 就行（全站同步）。
>
> **想隐藏邮箱、防爬虫？** 激活后 FormSubmit 会给你一个随机别名
> `https://formsubmit.co/el/xxxxxx`，把它填到 `main.js` 的 `MAIL_ENDPOINT_OVERRIDE`，
> 再重新打包上传，网页源码里就不会再出现邮箱地址。

---

## 第 2 步 · 打包 dist/

在项目目录执行打包（会先重新生成 sitemap / RSS / robots，再产出 `dist/`）：

```powershell
cd D:\efanblog
node tools/deploy-build.mjs
```

看到这样的输出就成功了：

```
✔ dist/ 已生成：12 个文件，共 123.7 KB
  上传时把 dist/ 整个目录发出去即可（不是仓库根目录）。
```

> 脚本会自动拦住两类事故：`dist/` 里出现 `.php`（含密码的管理页）、出现默认密码/密钥字样。

**这一步的产出**：`D:\efanblog\dist\` —— 就是要上传的东西。

---

## 第 3 步 · 注册 Cloudflare

1. 打开 <https://dash.cloudflare.com/sign-up> → 填邮箱 + 密码注册（免费，不需要信用卡）。
2. 去邮箱点验证链接，回到后台登录。

---

## 第 4 步 · 建 Pages 项目并上传 dist/

1. 左侧栏点 **Workers & Pages**（有的界面叫 **Compute (Workers)**）。
2. 点 **Create** → 选 **Pages** 标签页 → 找到 **Upload assets** → 点 **Get started**。
   > 如果界面改版找不到，就找带 **Pages** 或 **Upload assets** 字样的入口，别选 "Import an existing Git repository"（你的 GitHub 在这台机器连不上，走上传更稳）。
3. **Project name** 填 `efanblog`（这决定默认地址 `your-project.pages.dev`）。
4. 把 **`D:\efanblog\dist` 这个文件夹整个拖进上传区**（拖文件夹，不是拖里面的文件）。
   里面已经包含 `_worker.js`，Cloudflare 会自动识别为静态资源修正（消掉 308 跳转和软 404），
   **不需要任何额外配置**。
5. 点 **Deploy site**，等十几秒。

**这一步的产出**：一个 `https://your-project.pages.dev` 的临时地址。

---

## 第 5 步 · 先验证临时地址

浏览器打开 `https://your-project.pages.dev`，逐条确认：

- [ ] 首页正常显示（终端风格的 Hero、文章卡片）
- [ ] 点进任意一篇文章能正常打开
- [ ] 右上角可以切深浅色、切中英文
- [ ] 页脚只有 **GitHub · X · 知乎 · 小红书** 四个按钮
- [ ] `https://your-project.pages.dev/sitemap.xml` 能打开，里面是 `your-domain.com`

> ⚠️ 这一步只验证"站点文件对不对"，还没接域名。**这里不通就不要往下走。**

---

## 第 6 步 · 把域名加进 Cloudflare，拿到两个 NS

1. 回到 Cloudflare 首页，点 **+ Add a site**（或 **Add a domain**）。
2. 输入 `your-domain.com` → 点 **Continue**。
3. 套餐选 **Free** → **Continue**。
4. 它会自动扫描现有 DNS 记录（会扫到那两条停放的 A 记录）→ 点 **Continue**。
5. 页面会给你**两个 nameserver**，形如：

   ```
   xxxx.ns.cloudflare.com
   yyyy.ns.cloudflare.com
   ```

   **把这两个地址复制下来**，下一步要用。这个页面先别关。

---

## 第 7 步 · 到 DNSPod 修改 DNS 服务器

1. 打开 <https://www.dnspod.cn> → 登录（腾讯云账号）。
2. 进入 **控制台 → 我的域名**，找到 `your-domain.com`。
3. 点域名后面的 **管理** → 找到 **DNS 修改**（或"修改 DNS 服务器"）。
4. 选 **自定义**，把默认的 `execute.dnspod.net` / `fifth.dnspod.net` **删掉**，换成第 6 步那两个
   `xxxx.ns.cloudflare.com`。
5. 确认提交。（有的账号会要求短信/邮箱验证。）

> **说明**：DNSPod 里原来的解析记录不会丢，只是不再生效；将来想切回来，把 NS 改回去即可。

---

## 第 8 步 · 等 NS 生效

- 通常 **几分钟到几小时**，最长 24 小时。
- 回到 Cloudflare 第 6 步那个页面，点 **Check nameservers now**，状态变成 **Active** 就成了。
- 想主动查：在终端跑

  ```powershell
  Resolve-DnsName your-domain.com -Type NS
  ```

  看到 `xxx.ns.cloudflare.com` 就是生效了。

> ⚠️ **查 NS 之前先把代理 / VPN 关掉。**
> 开着 Clash 这类代理时，本机 DNS 会被改成 `198.18.x.x` 的假 IP，`Resolve-DnsName` 的结果
> 全是伪造的，会让你误判成"还没生效"。最可靠的判断方式是直接看 Cloudflare 后台的状态。

---

## 第 9 步 · 绑定自定义域 + 清理停放记录

1. Cloudflare 左侧栏 → **Workers & Pages** → 点开 `efanblog` 项目。
2. 上方选 **Custom domains** → **Set up a custom domain**。
3. 输入 `your-domain.com` → **Continue** → **Activate domain**。
   - 因为域名已在这个 Cloudflare 账号里，它会自动建好解析记录。
   - 如果提示有冲突记录（例如 `@` 或 `www` 上已存在的旧 A 记录），选择 **替换/删除** 它。
4. 再来一次，添加 `www.your-domain.com`（这样 www 也能访问）。
5. 顺手做两件事（可选但推荐）：
   - **SSL/TLS → Edge Certificates → Always Use HTTPS** 打开（http 自动跳 https）；
   - **SSL/TLS → Overview** 加密模式选 **Full**。
6. HTTPS 证书由 Cloudflare 自动签发，一般几分钟内生效。

**这一步的产出**：`https://your-domain.com` 正式可访问。

---

## 第 10 步 · 上线验收清单

在浏览器（建议用无痕窗口，避免缓存）逐条打勾：

- [ ] `https://your-domain.com` 能打开，地址栏是**小锁 + https**
- [ ] `http://your-domain.com` 会自动跳到 https
- [ ] `https://www.your-domain.com` 也能打开
- [ ] 文章页能打开，例如 `https://your-domain.com/post.html?p=hello-world`
- [ ] `https://your-domain.com/sitemap.xml`、`/rss.xml`、`/robots.txt` 都能打开且域名正确
- [ ] 页脚社交只有 4 个按钮
- [ ] 留言板第 1 次提交：按钮提示**"发送失败"是正常的**（表单还没激活）
- [ ] 去邮箱（含垃圾箱）点 FormSubmit 的确认链接完成激活
- [ ] 留言板第 2 次提交：按钮提示"发送成功"，且邮箱确实收到
      （若一直显示"留言只存在你的浏览器里"，说明没走到邮箱转发模式，检查 `posts.js` 的
      `SITE.email` 与 `main.js` 的 `MAIL_ENDPOINT_OVERRIDE` 是否为空）
- [ ] **防刷自检 A**：紧接着再提交一次 → 按钮提示"发送太频繁啦"（本机 5 分钟冷却生效）
- [ ] **防刷自检 B**：换**无痕窗口**再提交 → **仍然**提示太频繁
      （这条能通过，说明 `_worker.js` 的 IP 通行证真的在工作；若这里能发出去，
      说明边缘的 Cache API 没生效，回退成了"放行"策略，告诉我我再换 KV 方案）
- [ ] **安全项**：`https://your-domain.com/admin.php` 应该 **404**
      （返回 404 才说明含密码的文件没被发布出去）
- [ ] 手机 4G/5G 网络下打开速度可接受

---

## 第 11 步 · 提交代码

在**你自己的终端**里跑（DSH 沙箱不能写 `.git` 目录，这一步必须你来做）：

```powershell
cd D:\efanblog
git add -A
git commit -m "chore: 新增部署手册；去掉 B 站/抖音入口；确定域名 your-domain.com"
```

> `github.com` 从你这台机器实测连不上，`git push` 多半会失败。有代理就开着推；
> 没有也没关系——上线走的是 Cloudflare 直接上传 `dist/`，完全不经过 GitHub。

---

## 以后发新文章的流程

1. 编辑 `posts.js`，在数组里加一篇（复制现有对象改一改即可，`content` 用 Markdown）。
2. 重新打包：

   ```powershell
   cd D:\efanblog
   node tools/deploy-build.mjs
   ```

3. 回到 Cloudflare → `efanblog` 项目 → **Create new deployment** → 把新的 `dist/` 再拖进去 → Deploy。
4. （可选）`git add -A` + `git commit` 存档。

---

## 常见问题

**Q：`pages.dev` 打开是 404 / 空白？**
上传时拖的应该是 `dist` 文件夹本身，且里面的文件要直接位于根（打开项目能看到 `index.html`）。
如果误传了仓库根目录，`.md`、`.php` 也会被公开，**务必删掉该项目重传 `dist/`**。

**Q：域名打不开 / 报 522、523？**
NS 还没生效，或第 9 步没绑定成功。先 `Resolve-DnsName your-domain.com -Type NS` 确认 NS 已切过去。

**Q：浏览器提示"不安全"？**
证书还在签发，等几分钟；顺便确认 SSL/TLS 模式不是 **Off**。

**Q：访问域名显示的是别的网站 / 提示证书错误？**
域名上还有旧的 A 记录没清掉。去 Cloudflare 的 **DNS → Records**，删掉 `@` 和 `www` 上
残留的旧 A 记录（绑定自定义域时 Cloudflare 会自动建好正确的记录）。

**Q：留言板提交后没收到邮件？**
先确认**激活**做过没有：FormSubmit 对未激活的表单也返回 HTTP 200，正文却是 `success:"false"`，
此时邮件不会投递。去 `SITE.email` 对应的邮箱（含垃圾箱）找 FormSubmit 的确认邮件并点链接。
之后仍收不到，就用浏览器打开 <https://formsubmit.co/你的邮箱> 提交一条触发激活；
也可以按 F12 看控制台里对 `formsubmit.co` 的请求是否被网络环境拦截
（该服务在国内偶尔会很慢，出现几秒等待甚至连接重置都属于它的网络问题，与本站无关）。

**Q：国内访问偶尔慢？**
Cloudflare 免费版走的是海外节点（香港/日本/新加坡等），晚高峰会有波动。实测你这边
TCP 握手 55–72ms，日常够用。哪天觉得不够稳，再考虑香港轻量服务器（同样免备案，PHP 留言板也能跑）。

---

## 附 · 不想改 NS 的替代方案（Vercel）

改 NS 是唯一需要动域名的地方，如果你不想动：

1. 到 <https://vercel.com> 用邮箱注册 → Add New → Project → 选 **Deploy from CLI / Upload**，上传同一份 `dist/`。
2. 项目 → **Settings → Domains** → 添加 `your-domain.com`。
3. 它会给一条 CNAME 记录，去 **DNSPod** 添加：
   - 主机记录 `@`（以及 `www`）→ 记录类型 `CNAME` → 记录值 `cname.vercel-dns.com`
4. 等解析生效，Vercel 自动发证书。

> 代价：实测国内 TCP 延迟约 91–94ms，比 Cloudflare 慢一些；好处是完全不用碰 NS。
