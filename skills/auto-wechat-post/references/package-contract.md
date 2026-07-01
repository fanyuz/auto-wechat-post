# Package Contract

Codex creates one package per article. The server publishes packages.

## Required JSON

```json
{
  "schema_version": "1.0",
  "project_id": "senior-livelihood-demo",
  "account_name": "Senior Life Guide Demo",
  "platform": "wechat",
  "date": "2026-06-28",
  "topic_id": "topic-1",
  "title": "标题",
  "author": "账号名",
  "digest": "摘要",
  "content_md": "# 标题\n正文",
  "content_html": "<section>正文</section>",
  "images": [
    {
      "role": "cover",
      "path": "outputs/wechat-content/2026-06-28/topic-1/cover.png",
      "prompt": "...",
      "quality_check": {
        "passed": true,
        "issues": []
      }
    }
  ],
  "image_inserted": true,
  "sources": [],
  "review": {
    "passed": true,
    "risk_level": "pass",
    "findings": []
  }
}
```

Required:

- `project_id`
- `account_name`
- `platform: "wechat"`
- `title`
- `author`
- `digest`
- `content_html`
- `review.passed: true`
- at least 2 images, including one `role: "cover"`
- `image_inserted: true`

The server rejects high-risk or failed-review packages.
