---
name: auto-wechat-post
description: Generate, review, package, upload, and prepare WeChat public-account articles for configurable multi-account projects; use when Codex needs to run a reusable article workflow for any WeChat account project, read project-local account prompts/config, create images, enforce quality gates, upload packages to a multi-project server, or publish to a WeChat draft box.
---

# Auto WeChat Post

Use this skill as the generic workflow engine. Account-specific positioning, style, topics, safety rules, and credentials must live in the current Project, not in this skill.

## Required Project Files

Before generating content, read these files from the current Project root:

```text
project.config.json
prompts/profile.md
prompts/topic-rules.md
prompts/style-guide.md
prompts/image-style.md
prompts/review-rules.md
```

If a required prompt file is missing, create a draft only when the user asks for setup help. Do not invent a project identity silently.

`project.config.json` must include:

```json
{
  "project_id": "senior-livelihood-demo",
  "account_name": "Senior Life Guide Demo",
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

## Workflow

1. Work from the current Project root.
2. Read project config and all prompt files.
3. Inspect the last 7 days under `output_dir` before choosing topics.
4. Gather current heat signals first, then verify claims with reliable sources.
5. Generate the configured number of topics. Keep topics diverse according to project rules.
6. Write article Markdown and WeChat HTML locally.
7. Generate 2-3 bitmap images per article using `imagegen` or ChatGPT image2. Never use placeholder graphics.
8. Run the image quality gate in [image-guide.md](references/image-guide.md).
9. Run the content review gate in [review-guide.md](references/review-guide.md).
10. Package with `scripts/package_article.mjs`.
11. Save all outputs under `output_dir/YYYY-MM-DD/topic-N/`.
12. Upload images first and package JSON last to:

```text
{remote_root}/projects/{project_id}/inbox/YYYY-MM-DD/
```

13. Let the server watcher publish to the correct WeChat draft box. Use manual server publishing only for recovery.

## Output Shape

```text
outputs/wechat-content/YYYY-MM-DD/
  topics.json
  topic-1/
    YYYY-MM-DD-01-wechat.md
    YYYY-MM-DD-01-wechat.html
    YYYY-MM-DD-01-wechat-cover.png
    YYYY-MM-DD-01-wechat-inline-1.png
    YYYY-MM-DD-01-wechat-inline-2.png
    YYYY-MM-DD-01-wechat-image-prompts.json
    YYYY-MM-DD-01-wechat-review.json
    YYYY-MM-DD-01-wechat-package.json
```

Package JSON must follow [package-contract.md](references/package-contract.md).

## Project Boundary

Keep these in the project:

- Account name, audience, category, voice, forbidden claims.
- Topic categories and source preferences.
- Platform-specific style rules.
- AppID/AppSecret in project/server `.env`.
- Generated outputs and history.

Keep these in this skill:

- Generic workflow.
- Package validation.
- Image quality gate.
- Upload contract.
- Server package contract.

## References

- Read [project-contract.md](references/project-contract.md) when setting up a new account project.
- Read [package-contract.md](references/package-contract.md) before packaging or uploading.
- Read [image-guide.md](references/image-guide.md) before generating or reviewing images.
- Read [review-guide.md](references/review-guide.md) before final review.
- Read [server-contract.md](references/server-contract.md) before uploading to the server.
