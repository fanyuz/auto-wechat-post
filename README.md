# Auto WeChat Post

[中文说明](README.zh-CN.md)

Auto WeChat Post is an open-source starter kit for running multiple WeChat Official Account content projects with Codex. It helps Codex generate topics, articles, images, reviews, and package files locally, then lets a server publish the package to the correct WeChat draft box.

The core idea is separation:

- The **skill** owns the reusable workflow.
- Each **content project** owns its audience, style, topic rules, and safety rules.
- The **server** owns WeChat credentials and API calls.

## Features

- Multi-account project structure driven by `project_id`.
- Project-local prompts for audience, topic rules, writing style, image style, and review rules.
- WeChat article package contract for Markdown, HTML, images, sources, and review metadata.
- Image quality gate to block placeholder or low-quality generated images.
- Multi-project server watcher with per-project `.env`, inbox, logs, and duplicate-publish state.
- Example projects for senior public-service content and food/lifestyle content.

## Repository Layout

```text
auto-wechat-post/
  skills/auto-wechat-post/      Installable Codex skill
  server/                       Multi-project WeChat draft publisher
  examples/projects/            Example content projects
```

## Architecture

```text
Codex Project
  project.config.json
  prompts/
  outputs/
    wechat-content/YYYY-MM-DD/topic-1/*.json, *.html, images

Server
  projects/{project_id}/
    .env
    inbox/YYYY-MM-DD/
    data/
    logs/

WeChat Official Account
  Draft box
```

Codex generates content locally. The server only reads package files, uploads images, and calls WeChat APIs.

## Requirements

- Codex with skill support.
- Node.js 20+ on the server.
- A WeChat Official Account with API access to draft/material endpoints.
- Server IP added to the WeChat Official Account IP allowlist.
- SSH access from your local machine to the server.

## Quick Start

### 1. Install the Codex skill

Copy the skill folder into your Codex skills directory:

```text
skills/auto-wechat-post
```

### 2. Create a content project

Copy one example project and edit it:

```text
examples/projects/senior-livelihood-demo
examples/projects/food-daily
```

Update:

- `project.config.json`
- `prompts/profile.md`
- `prompts/topic-rules.md`
- `prompts/style-guide.md`
- `prompts/image-style.md`
- `prompts/review-rules.md`

Use placeholders like this in public templates:

```json
{
  "project_id": "my-account",
  "account_name": "My Account",
  "server": {
    "host": "root@example.com",
    "ssh_key": "~/.ssh/wechat-server.pem",
    "remote_root": "/opt/auto-wechat-post-server"
  }
}
```

### 3. Deploy the server

Upload `server/` to your server, for example:

```bash
cd /opt/auto-wechat-post-server
npm install
```

Create a project on the server:

```bash
npm run init:project -- my-account
cp projects/my-account/.env.example projects/my-account/.env
nano projects/my-account/.env
```

Fill:

```env
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_THUMB_MEDIA_ID=
```

Run the watcher:

```bash
npm run watch:projects
```

### 4. Ask Codex to run the workflow

Open your content project in Codex and ask:

```text
Use Auto WeChat Post to generate today's articles for this project and upload them to the server.
```

## Security

Never commit `.env`, AppSecret, access tokens, SSH keys, or generated publish state. This repository only ships `.env.example` templates.

Before publishing your own fork, scan for:

- real IP addresses
- local usernames and absolute paths
- real AppID/AppSecret values
- private SSH key names or paths
- unpublished article outputs

## Limitations

This project focuses on WeChat draft publishing first. Other platforms can be added later through new publishers and platform-specific package contracts.
