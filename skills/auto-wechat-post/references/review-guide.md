# Review Guide

Create one review JSON per article before packaging.

## Required Fields

```json
{
  "passed": true,
  "risk_level": "pass",
  "findings": [],
  "history_repeat": false,
  "image_quality": [],
  "fixes_made": []
}
```

## Review Checklist

- Title is useful and not deceptive.
- Content follows project positioning and style.
- Claims are supported by sources.
- Sensitive claims avoid certainty, exaggeration, and fake authority.
- Images pass the quality gate and are inserted in Markdown and HTML.
- Article does not repeat recent topics unless the project rules allow it.
- The interaction ending fits the account and platform.

Do not package `risk_level: "high"` unless the user explicitly overrides.
