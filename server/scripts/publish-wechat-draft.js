#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadProject, ensureProjectDirs } from "../lib/project.js";
import { createContentFingerprint, loadJson, saveJson } from "../lib/publish-state.js";
import { createDraft, getAccessToken, uploadArticleImage, uploadPermanentMaterial } from "../lib/wechat.js";
import { requireEnv } from "../lib/env.js";

const packageArg = process.argv[2];
const forcePublish = process.argv.includes("--force");

if (!packageArg) {
  console.error("用法：npm run publish:package -- projects/PROJECT_ID/inbox/YYYY-MM-DD/article-package.json");
  process.exit(1);
}

const packagePath = path.resolve(process.cwd(), packageArg);
if (!fs.existsSync(packagePath)) {
  console.error(`找不到文章包：${packagePath}`);
  process.exit(1);
}

const articlePackage = JSON.parse(fs.readFileSync(packagePath, "utf8"));
validatePackage(articlePackage);

const project = loadProject(articlePackage.project_id);
ensureProjectDirs(project);

const fingerprint = createContentFingerprint(articlePackage);
const fingerprintPath = path.join(project.dataDir, "draft-publish-fingerprints.json");
const fingerprintState = loadJson(fingerprintPath, {});

if (fingerprintState[fingerprint] && !forcePublish) {
  const previous = fingerprintState[fingerprint];
  console.log("重复内容，已跳过草稿创建");
  console.log(`已有media_id：${previous.media_id || ""}`);
  console.log(`首次来源文章包：${previous.package || ""}`);
  process.exit(0);
}

try {
  const token = await getAccessToken(project.env);
  const thumb = await prepareThumbMediaId(articlePackage, token.access_token, packagePath, project.env);
  const preparedContent = await prepareContentHtml(articlePackage, token.access_token, packagePath);
  const draft = await createDraft({
    accessToken: token.access_token,
    title: articlePackage.title,
    author: articlePackage.author || articlePackage.account_name,
    digest: articlePackage.digest || "",
    content: preparedContent.contentHtml,
    thumbMediaId: thumb.mediaId
  });

  fingerprintState[fingerprint] = {
    package: path.relative(process.cwd(), packagePath).replaceAll(path.sep, "/"),
    title: articlePackage.title,
    media_id: draft.media_id,
    updated_at: new Date().toISOString()
  };
  saveJson(fingerprintPath, fingerprintState);

  console.log("草稿创建成功");
  console.log(`project_id：${articlePackage.project_id}`);
  console.log(`media_id：${draft.media_id}`);
  console.log(`来源文章包：${path.relative(process.cwd(), packagePath).replaceAll(path.sep, "/")}`);
  console.log(`封面素材：${thumb.source}`);
  if (preparedContent.uploadedImages.length) {
    console.log(`正文图片已上传并替换：${preparedContent.uploadedImages.length} 张`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function validatePackage(pkg) {
  const errors = [];
  for (const key of ["project_id", "account_name", "title", "content_html"]) {
    if (!pkg[key]) errors.push(`缺少字段：${key}`);
  }
  if (pkg.platform !== "wechat") errors.push("platform 必须是 wechat");
  if (pkg.review?.passed !== true) errors.push("review.passed 必须是 true");
  if (pkg.review?.risk_level === "high") errors.push("review.risk_level 为 high");
  if (!Array.isArray(pkg.images) || !pkg.images.some((image) => image?.role === "cover")) {
    errors.push("缺少封面图");
  }
  if (errors.length) {
    console.error(`文章包校验失败：\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
}

async function prepareThumbMediaId(pkg, accessToken, packagePath, env) {
  const cover = findImageByRole(pkg.images, "cover");
  const coverPath = cover?.path ? resolveImagePath(cover.path, packagePath) : null;

  if (coverPath) {
    const uploaded = await uploadPermanentMaterial({ accessToken, filePath: coverPath, type: "thumb" });
    if (!uploaded.media_id) throw new Error(`上传封面素材失败：${JSON.stringify(uploaded)}`);
    return { mediaId: uploaded.media_id, source: `本篇封面 ${path.basename(coverPath)}` };
  }

  return { mediaId: requireEnv(env, "WECHAT_THUMB_MEDIA_ID"), source: "环境变量 WECHAT_THUMB_MEDIA_ID" };
}

async function prepareContentHtml(pkg, accessToken, packagePath) {
  let contentHtml = pkg.content_html;
  const placeholders = Array.from(contentHtml.matchAll(/<!--\s*IMAGE:\s*([^>]+?)\s*-->/g));
  const uploadedImages = [];
  const uploadedByName = new Map();

  for (const match of placeholders) {
    const placeholder = match[1].trim();
    const uploaded = await uploadPackageImage({ pkg, accessToken, packagePath, imageReference: placeholder, uploadedByName });
    contentHtml = contentHtml.replace(match[0], renderWechatImage(uploaded.url));
    uploadedImages.push({ placeholder, filePath: uploaded.filePath, url: uploaded.url });
  }

  const localImageSrcs = Array.from(contentHtml.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi));
  for (const match of localImageSrcs) {
    const src = match[1].trim();
    if (isRemoteImage(src)) continue;
    const uploaded = await uploadPackageImage({ pkg, accessToken, packagePath, imageReference: src, uploadedByName });
    contentHtml = contentHtml.replace(match[0], match[0].replace(src, escapeHtml(uploaded.url)));
    uploadedImages.push({ placeholder: src, filePath: uploaded.filePath, url: uploaded.url });
  }

  return { contentHtml, uploadedImages };
}

async function uploadPackageImage({ pkg, accessToken, packagePath, imageReference, uploadedByName }) {
  const imageInfo = findImageInfo(pkg.images, imageReference);
  const imagePath = resolveImagePath(imageInfo?.path || imageReference, packagePath);
  if (!imagePath) throw new Error(`服务器找不到正文图片：${imageReference}`);

  const imageName = path.basename(imagePath).toLowerCase();
  if (uploadedByName.has(imageName)) return uploadedByName.get(imageName);

  const uploaded = await uploadArticleImage({ accessToken, filePath: imagePath });
  const result = { filePath: imagePath, url: uploaded.url };
  uploadedByName.set(imageName, result);
  return result;
}

function findImageByRole(images = [], role) {
  return images.find((image) => image?.role === role && image?.path);
}

function findImageInfo(images = [], placeholder) {
  const wanted = path.basename(placeholder).trim().toLowerCase();
  return images.find((image) => image?.path && path.basename(image.path).trim().toLowerCase() === wanted);
}

function resolveImagePath(candidate, packagePath) {
  const packageDir = path.dirname(packagePath);
  const basename = path.basename(candidate);
  const candidates = [
    path.resolve(packageDir, candidate),
    path.resolve(packageDir, basename),
    path.resolve(process.cwd(), candidate),
    path.resolve(process.cwd(), basename)
  ];
  return candidates.find((item) => fs.existsSync(item)) || null;
}

function isRemoteImage(src) {
  return /^(https?:)?\/\//i.test(src) || /^data:/i.test(src);
}

function renderWechatImage(url) {
  return `<p style="margin:16px 0;text-align:center;"><img src="${escapeHtml(url)}" alt="文章配图" style="max-width:100%;height:auto;display:inline-block;" /></p>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
