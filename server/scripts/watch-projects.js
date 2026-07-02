#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { listProjectIds, loadProject, ensureProjectDirs } from "../lib/project.js";
import { loadJson, saveJson } from "../lib/publish-state.js";

const pollMs = Number(process.env.WATCH_POLL_MS || 15000);
const stableMs = Number(process.env.WATCH_STABLE_MS || 8000);
const once = process.argv.includes("--once");
const markExisting = process.argv.includes("--mark-existing");

const seen = new Map();
const running = new Set();
let scanning = false;

console.log(`多项目监听启动，轮询间隔：${pollMs}ms`);

await scanAllProjects();
if (!once) {
  setInterval(() => {
    scanAllProjects().catch((error) => console.error(`监听任务异常：${error.message}`));
  }, pollMs);
}

async function scanAllProjects() {
  if (scanning) {
    console.log("上一轮扫描尚未结束，跳过本轮");
    return;
  }

  scanning = true;
  try {
    for (const projectId of listProjectIds()) {
      let project;
      try {
        project = loadProject(projectId);
        ensureProjectDirs(project);
      } catch (error) {
        console.error(`项目 ${projectId} 配置错误：${error.message}`);
        continue;
      }

      await scanProject(project);
    }
  } finally {
    scanning = false;
  }
}

async function scanProject(project) {
  const statePath = path.join(project.dataDir, "inbox-publish-state.json");
  const state = loadJson(statePath, {});
  const packagePaths = findPackageFiles(project.inboxDir);
  const now = Date.now();

  if (markExisting) {
    for (const packagePath of packagePaths) {
      const relPath = toProjectRelative(packagePath);
      if (!state[relPath]) state[relPath] = { status: "ignored_existing", updated_at: new Date().toISOString() };
    }
    saveJson(statePath, state);
    console.log(`项目 ${project.id} 已标记历史文章包：${packagePaths.length} 个`);
    return;
  }

  for (const packagePath of packagePaths) {
    const relPath = toProjectRelative(packagePath);
    const runKey = `${project.id}:${relPath}`;
    if (["published", "ignored_existing", "rejected", "duplicate_skipped"].includes(state[relPath]?.status) || running.has(runKey)) {
      continue;
    }

    const readiness = checkPackageReady(packagePath, project, now, state, statePath);
    if (!readiness.ready) {
      console.log(`等待上传完成：${project.id}/${relPath}（${readiness.reason}）`);
      continue;
    }

    await publishPackage(project, packagePath, relPath, state, statePath, runKey);
  }
}

function findPackageFiles(root) {
  if (!fs.existsSync(root)) return [];
  const found = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) found.push(...findPackageFiles(fullPath));
    else if (entry.isFile() && /package\.json$/i.test(entry.name)) found.push(fullPath);
  }
  return found.sort();
}

function checkPackageReady(packagePath, project, now, state, statePath) {
  const packageStable = isStable(packagePath, now);
  if (!packageStable.ready) return packageStable;

  let articlePackage;
  try {
    articlePackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch (error) {
    return { ready: false, reason: `JSON 还不可读：${error.message}` };
  }

  const relPath = toProjectRelative(packagePath);
  if (articlePackage.project_id !== project.id) {
    state[relPath] = { status: "rejected", reason: `project_id mismatch: ${articlePackage.project_id}`, updated_at: new Date().toISOString() };
    saveJson(statePath, state);
    return { ready: false, reason: "project_id 与目录不一致，已拒绝" };
  }

  if (articlePackage.review?.passed === false) {
    state[relPath] = { status: "rejected", reason: "review.passed=false", updated_at: new Date().toISOString() };
    saveJson(statePath, state);
    return { ready: false, reason: "审核未通过，已跳过" };
  }

  for (const imagePath of resolvePackageImages(articlePackage, packagePath)) {
    if (!fs.existsSync(imagePath)) return { ready: false, reason: `缺少图片 ${portableBasename(imagePath)}` };
    const imageStable = isStable(imagePath, now);
    if (!imageStable.ready) return { ready: false, reason: `图片未稳定 ${portableBasename(imagePath)}` };
  }

  return { ready: true };
}

function resolvePackageImages(articlePackage, packagePath) {
  const packageDir = path.dirname(packagePath);
  return (Array.isArray(articlePackage.images) ? articlePackage.images : [])
    .map((image) => image?.path)
    .filter(Boolean)
    .map((imagePath) => {
      const basename = portableBasename(imagePath);
      const candidates = [
        path.resolve(packageDir, basename),
        path.resolve(packageDir, normalizePortablePath(imagePath)),
        path.resolve(process.cwd(), normalizePortablePath(imagePath))
      ];
      return candidates.find((candidate) => fs.existsSync(candidate)) || path.resolve(packageDir, basename);
    });
}

async function publishPackage(project, packagePath, relPath, state, statePath, runKey) {
  running.add(runKey);
  console.log(`开始自动发布草稿：${project.id}/${relPath}`);

  const result = await runNodeScript("scripts/publish-wechat-draft.js", path.relative(process.cwd(), packagePath).replaceAll(path.sep, "/"));
  const mediaId = result.stdout.match(/media_id：(.+)/)?.[1]?.trim() || "";
  const duplicateSkipped = result.stdout.includes("已跳过草稿创建");

  if (result.code === 0) {
    state[relPath] = {
      status: duplicateSkipped ? "duplicate_skipped" : "published",
      media_id: mediaId,
      updated_at: new Date().toISOString()
    };
    console.log(duplicateSkipped ? `跳过重复内容：${project.id}/${relPath}` : `自动发布成功：${project.id}/${relPath}`);
  } else {
    state[relPath] = {
      status: "failed",
      code: result.code,
      stderr: result.stderr.slice(-1000),
      updated_at: new Date().toISOString()
    };
    console.error(`自动发布失败：${project.id}/${relPath}`);
    console.error(result.stderr || result.stdout);
  }

  saveJson(statePath, state);
  running.delete(runKey);
}

function runNodeScript(scriptPath, packagePath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, packagePath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function isStable(filePath, now) {
  const stat = fs.statSync(filePath);
  const key = path.resolve(filePath);
  const previous = seen.get(key);
  const current = { size: stat.size, mtimeMs: stat.mtimeMs, firstSeenAt: now };

  if (!previous || previous.size !== current.size || previous.mtimeMs !== current.mtimeMs) {
    seen.set(key, current);
    return { ready: false, reason: "文件刚变化" };
  }

  if (now - previous.firstSeenAt < stableMs) return { ready: false, reason: "文件等待稳定" };
  return { ready: true };
}

function toProjectRelative(filePath) {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
}

function normalizePortablePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

function portableBasename(filePath) {
  return path.posix.basename(normalizePortablePath(filePath));
}
