#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { projectDir } from "../lib/project.js";

const projectId = process.argv[2];
if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) {
  console.error("用法：npm run init:project -- project-id");
  process.exit(1);
}

const dir = projectDir(projectId);
for (const subdir of ["inbox", "data", "logs"]) {
  fs.mkdirSync(path.join(dir, subdir), { recursive: true });
}

const envPath = path.join(dir, ".env.example");
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, [
    "WECHAT_APP_ID=",
    "WECHAT_APP_SECRET=",
    "WECHAT_THUMB_MEDIA_ID=",
    ""
  ].join("\n"), "utf8");
}

console.log(`已初始化项目目录：${dir}`);
console.log(`请复制 ${envPath} 为 .env 并填写公众号凭据。`);
