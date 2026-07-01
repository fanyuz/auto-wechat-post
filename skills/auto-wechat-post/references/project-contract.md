# Project Contract

Every account project owns its identity and configuration.

## Files

```text
project.config.json
prompts/
  profile.md
  topic-rules.md
  style-guide.md
  image-style.md
  review-rules.md
outputs/
```

## project.config.json

```json
{
  "project_id": "food-daily",
  "account_name": "人间烟火小厨房",
  "platforms": ["wechat"],
  "daily_article_count": 2,
  "output_dir": "outputs/wechat-content",
  "server": {
    "host": "root@example.com",
    "ssh_key": "~/.ssh/wechat-server.pem",
    "remote_root": "/opt/auto-wechat-post-server"
  }
}
```

Rules:

- `project_id` must use lowercase letters, numbers, and hyphens.
- `project_id` is the server routing key. It must match `server/projects/{project_id}/`.
- Do not put AppSecret in `project.config.json`; use server-side `.env`.
- Keep project prompts plain and specific. Do not put generic workflow instructions in project prompts.

## Prompt Roles

- `profile.md`: account positioning, audience, content promise.
- `topic-rules.md`: topic categories, source priorities, diversity rules.
- `style-guide.md`: tone, title style, article structure, length.
- `image-style.md`: visual identity and image scene preferences.
- `review-rules.md`: platform safety, forbidden claims, final audit checklist.
