# Auto WeChat Post

Auto WeChat Post 是一个面向 Codex 的微信公众号自动化内容项目模板。它把“文章生成”和“公众号 API 发布”分开：Codex 在本地生成选题、文章、图片、审核结果和文章包；服务器只负责监听文章包，并调用微信公众号接口创建草稿。

这个项目适合同时运营多个公众号项目，例如民生政策、美食、情感、生活方式等。每个公众号只需要维护自己的项目配置和提示词，通用流程、打包规则和服务器发布逻辑可以复用。

## 三句话安装

普通用户可以把下面三句话依次复制给 Codex：

```text
第一步：请从 git@github.com:fanyuz/auto-wechat-post.git 安装 Auto WeChat Post，把 auto-wechat-post skill 安装到我的 Codex skills 目录。
```

```text
第二步：请使用 auto-wechat-post，根据我的公众号名称、内容定位、目标读者和服务器信息，帮我初始化一个新的公众号项目配置。
```

```text
第三步：请把 auto-wechat-post 的 server 部署到我的 Ubuntu 服务器，配置微信公众号 AppID/AppSecret/IP 白名单相关信息，并启动自动监听发布服务。
```

## 核心思路

- **Skill**：负责通用工作流，包括读取项目配置、生成内容、生成图片、审核、打包和上传。
- **公众号项目**：负责账号定位、目标读者、选题规则、写作风格、图片风格和审核规则。
- **服务器**：负责保存每个项目的公众号密钥，监听上传的文章包，并调用微信 API 创建草稿。

也就是说，服务器不生成文章，只做 API 发布；不同公众号之间通过 `project_id` 区分。

## 功能

- 支持多个公众号项目共用一套服务器脚本。
- 每个项目独立配置 `profile`、选题规则、写作风格、图片风格和审核规则。
- 生成本地备份：Markdown、HTML、图片、审核文件和文章包。
- 支持每篇文章 2-3 张图片，并在发布前检查图片质量。
- 服务器监听 inbox，图片上传完成后再自动发布文章包。
- 支持微信公众号草稿箱创建、正文图片上传、封面素材上传。
- 支持内容指纹和发布锁，减少重复推送。
- 提供示例项目，方便改成自己的公众号。

## 目录结构

```text
auto-wechat-post/
  skills/auto-wechat-post/      Codex skill
  server/                       多项目微信公众号草稿发布服务
  examples/projects/            示例公众号项目
```

一个实际公众号项目通常长这样：

```text
my-wechat-project/
  project.config.json
  prompts/
    profile.md
    topic-rules.md
    style-guide.md
    image-style.md
    review-rules.md
  outputs/
```

服务器部署后通常长这样：

```text
/opt/auto-wechat-post-server/
  projects/
    my-account/
      .env
      inbox/
      data/
      logs/
```

## 准备条件

- 已安装 Codex，并支持使用 skill。
- 一台 Ubuntu 服务器。
- 服务器安装 Node.js 20 或更高版本。
- 一个微信公众号账号，并能使用草稿箱、素材等 API。
- 已将服务器公网 IP 加入公众号后台的 IP 白名单。
- 本地可以通过 SSH 登录服务器。

## 安装 Skill

克隆项目：

```bash
git clone git@github.com:fanyuz/auto-wechat-post.git
cd auto-wechat-post
```

把 skill 复制到 Codex skills 目录：

```powershell
Copy-Item -Recurse .\skills\auto-wechat-post C:\Users\你的用户名\.codex\skills\
```

安装后，可以在 Codex 里这样使用：

```text
使用 auto-wechat-post skill，按当前项目配置生成今天的公众号文章，并上传服务器。
```

## 初始化公众号项目

可以复制示例项目：

```text
examples/projects/senior-livelihood-demo
examples/projects/food-daily
```

然后修改这些文件：

```text
project.config.json
prompts/profile.md
prompts/topic-rules.md
prompts/style-guide.md
prompts/image-style.md
prompts/review-rules.md
```

`project.config.json` 示例：

```json
{
  "project_id": "my-account",
  "account_name": "我的公众号",
  "platforms": ["wechat"],
  "daily_article_count": 3,
  "output_dir": "outputs/wechat-content",
  "server": {
    "host": "root@example.com",
    "ssh_key": "~/.ssh/wechat-server.pem",
    "remote_root": "/opt/auto-wechat-post-server"
  }
}
```

项目里的 `prompts/` 文件决定这个公众号写什么、怎么写、图片什么风格、什么内容不能发。

## 部署服务器

把 `server/` 部署到 Ubuntu 服务器，例如：

```bash
cd /opt/auto-wechat-post-server
npm install
```

初始化一个公众号项目：

```bash
npm run init:project -- my-account
cp projects/my-account/.env.example projects/my-account/.env
nano projects/my-account/.env
```

填写公众号信息：

```env
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_THUMB_MEDIA_ID=
```

启动监听服务：

```bash
npm run watch:projects
```

正式运行建议使用 `server/config/auto-wechat-post.service.example` 配置 systemd：

```bash
systemctl daemon-reload
systemctl enable --now auto-wechat-post.service
systemctl status auto-wechat-post.service
```

## 日常使用

打开你的公众号项目目录，然后对 Codex 说：

```text
使用 auto-wechat-post skill，按当前项目配置生成今天 3 篇公众号文章，完成选题、图片、审核、打包，并上传服务器发布到草稿箱。
```

完整流程是：

1. Codex 读取 `project.config.json` 和 `prompts/`。
2. Codex 生成选题、文章、图片、审核文件和文章包。
3. 文件保存到项目本地 `outputs/`。
4. Codex 上传图片和文章包到服务器 inbox。
5. 服务器监听到文章包后，自动调用微信公众号 API 创建草稿。

## 安全提醒

不要提交这些内容到 Git：

- `.env`
- `AppSecret`
- access token
- SSH 私钥
- 真实服务器 IP
- 个人本地绝对路径
- 已发布或未发布的真实文章内容
- 服务器 `data/`、`logs/`、发布状态文件

如果你要公开自己的 fork，发布前请先搜索并清理个人信息。

## 常见问题

**服务器会不会生成文章？**

不会。文章生成在本地 Codex 项目里完成，服务器只负责调用微信公众号 API。

**多个公众号能共用一台服务器吗？**

可以。每个公众号对应 `projects/{project_id}/`，每个项目有自己的 `.env`、inbox、data 和 logs。

**公众号未认证能不能用？**

可以先测试 access token、素材等部分能力，但草稿箱等接口权限可能受公众号类型和认证状态影响。最终以微信公众平台当前接口权限为准。

**能不能用于头条号、小红书？**

当前仓库优先支持微信公众号草稿箱发布。其他平台可以复用内容生成和项目配置思路，但需要新增对应平台的发布器。

## License

MIT
