# Auto WeChat Post Server

This server watches multiple account projects and publishes WeChat article packages to the correct WeChat draft box.

## Layout

```text
server/
  projects/
    project-id/
      .env
      inbox/
      data/
      logs/
```

Each project has its own `.env`, inbox, state, and logs.

## Install

```bash
cd /opt/auto-wechat-post-server
npm install
```

## Create A Project

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

`WECHAT_THUMB_MEDIA_ID` is only a fallback. Normal packages upload their own cover image.

## Run

```bash
npm run watch:projects
```

One-off scan:

```bash
node scripts/watch-projects.js --once
```

Manual publish:

```bash
npm run publish:package -- projects/my-account/inbox/2026-06-28/2026-06-28-01-wechat-package.json
```

Delete a draft by `media_id`:

```bash
npm run delete:draft -- my-account MEDIA_ID
```

## systemd

Copy `config/auto-wechat-post.service.example` to `/etc/systemd/system/auto-wechat-post.service`, adjust paths if needed, then run:

```bash
systemctl daemon-reload
systemctl enable --now auto-wechat-post.service
systemctl status auto-wechat-post.service
```

## Duplicate Guard

The publish script records content fingerprints per project in:

```text
projects/{project_id}/data/draft-publish-fingerprints.json
```

Identical content is skipped even if the package filename changes.

The watcher also skips overlapping scans, and the publish script uses a per-content lock so a slow WeChat API call cannot create duplicate drafts. Package image paths may come from Windows or Linux; the server normalizes both forms before checking and uploading images.
