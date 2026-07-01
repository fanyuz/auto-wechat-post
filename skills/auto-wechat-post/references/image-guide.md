# Image Guide

Generate real bitmap images with `imagegen` or ChatGPT image2. Do not use placeholders, SVG-style diagrams, simple geometric icons, or fallback PNGs.

## Required Images

For each article:

- Cover image: WeChat feed visual hook, close to 900x383.
- Inline image 1: exact action/checking section.
- Inline image 2: risk, warning, checklist, or emotional turning point when useful.

## Prompt Record

Each item in `image-prompts.json` must include:

```json
{
  "role": "cover",
  "matched_section": "开头段落",
  "title_hook": "别乱点",
  "reader_stakes": "避免损失",
  "generation_source": "imagegen",
  "scene": "具体生活场景",
  "main_subject": "主要人物/物件",
  "camera": "镜头距离和角度",
  "composition": "主体位置和留白",
  "prompt": "...",
  "quality_check": {
    "passed": true,
    "issues": [],
    "regenerated": false,
    "final_file": "YYYY-MM-DD-01-wechat-cover.png"
  }
}
```

## Quality Gate

Reject or regenerate when:

- The image is blurry, low-resolution, deformed, text-heavy, or cluttered.
- The image looks like a placeholder, SVG diagram, or flat icon.
- The file is suspiciously small: cover below 60KB, inline image below 80KB.
- The image does not match the article section.
- The image repeats another image from today in people, place, and object.
- The image contains real logos, official seals, QR codes, fake app screenshots, readable private information, or misleading official notices.

Do not upload when any image has `quality_check.passed !== true`.
