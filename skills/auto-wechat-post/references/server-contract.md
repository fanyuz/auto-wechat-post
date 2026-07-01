# Server Contract

The server runs one codebase for many account projects.

## Server Layout

```text
/opt/auto-wechat-post-server/
  projects/
    senior-livelihood-demo/
      .env
      inbox/YYYY-MM-DD/
      data/
      logs/
    food-daily/
      .env
      inbox/YYYY-MM-DD/
      data/
      logs/
  scripts/
  lib/
```

## Upload Rule

Upload image files first, then upload package JSON last:

```powershell
scp -i "KEY.pem" "outputs\wechat-content\2026-06-28\topic-1\*.png" root@HOST:/opt/auto-wechat-post-server/projects/PROJECT_ID/inbox/2026-06-28/
scp -i "KEY.pem" "outputs\wechat-content\2026-06-28\topic-1\2026-06-28-01-wechat-package.json" root@HOST:/opt/auto-wechat-post-server/projects/PROJECT_ID/inbox/2026-06-28/
```

The watcher scans `projects/*/inbox/`, loads `projects/{project_id}/.env`, uploads cover/body images, creates the WeChat draft, and records content fingerprints in `projects/{project_id}/data/`.

Do not run manual publishing while the watcher is also processing the same package unless recovering a failure.
