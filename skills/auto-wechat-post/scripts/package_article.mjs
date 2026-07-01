#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const imageMinimums = {
  cover: { minBytes: 60 * 1024, minWidth: 850, minHeight: 360, minAspect: 2.1, maxAspect: 2.5 },
  "inline-1": { minBytes: 80 * 1024, minWidth: 850, minHeight: 500 },
  "inline-2": { minBytes: 80 * 1024, minWidth: 850, minHeight: 500 }
};

const required = ["project-config", "date", "topic-id", "title", "digest", "markdown", "html", "out"];
for (const key of required) {
  if (!args[key]) fail(`Missing --${key}`);
}

const projectConfig = readJson(args["project-config"]);
const contentMd = fs.readFileSync(path.resolve(args.markdown), "utf8");
const contentHtml = fs.readFileSync(path.resolve(args.html), "utf8");
const imagePrompts = readJsonIfPresent(args["image-prompts"], []);
const images = readImages(args, imagePrompts);
const sources = readJsonIfPresent(args.sources, []);
const review = readJsonIfPresent(args.review, { passed: false, risk_level: "unknown", findings: [] });
const bodyLength = countArticleChars(contentMd);
const imageInserted = contentMd.includes("![") || contentHtml.includes("<img") || contentHtml.includes("<!-- IMAGE:");

validateProject(projectConfig);
validatePackageInputs({ contentMd, contentHtml, bodyLength, images, imagePrompts, imageInserted, review, sources });

const pkg = {
  schema_version: "1.0",
  project_id: projectConfig.project_id,
  account_name: projectConfig.account_name,
  date: args.date,
  topic_id: args["topic-id"],
  platform: "wechat",
  title: args.title,
  author: args.author || projectConfig.account_name,
  digest: args.digest,
  content_md: contentMd,
  content_html: contentHtml,
  images,
  image_inserted: imageInserted,
  sources,
  review
};

const outPath = path.resolve(args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
console.log(`Saved package: ${outPath}`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      parsed[key] = "true";
    } else {
      parsed[key] = value;
      index += 1;
    }
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function readJsonIfPresent(filePath, fallback) {
  if (!filePath) return fallback;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) return fallback;
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function readImages(parsedArgs, prompts) {
  const images = [];

  for (const key of ["cover-image", "inline-image-1", "inline-image-2"]) {
    if (!parsedArgs[key]) continue;
    const role = key.replace("-image", "").replace("inline-1", "inline-1").replace("inline-2", "inline-2");
    const promptItem = Array.isArray(prompts) ? prompts.find((item) => item.role === role) : null;
    images.push({
      role,
      path: parsedArgs[key],
      prompt: promptItem?.prompt || "",
      quality_check: promptItem?.quality_check || null
    });
  }

  return images;
}

function validateProject(config) {
  const errors = [];
  if (!/^[a-z0-9-]+$/.test(config.project_id || "")) errors.push("project_id must use lowercase letters, numbers, and hyphens");
  if (!config.account_name) errors.push("account_name is required");
  if (errors.length) fail(`Project config invalid:\n- ${errors.join("\n- ")}`);
}

function validatePackageInputs({ contentMd, contentHtml, bodyLength, images, imagePrompts, imageInserted, review, sources }) {
  const errors = [];

  if (bodyLength <= 1000) errors.push(`正文太短：${bodyLength} 字，必须大于 1000 字`);
  if (bodyLength >= 3000) errors.push(`正文太长：${bodyLength} 字，必须小于 3000 字`);
  if (!imageInserted) errors.push("正文没有插入图片或图片占位");
  if (images.length < 2) errors.push(`图片数量不足：${images.length} 张，至少需要 2 张`);
  if (!images.some((image) => image.role === "cover")) errors.push("缺少 role=cover 的封面图");

  for (const image of images) {
    const resolvedImagePath = path.resolve(image.path);
    if (!fs.existsSync(resolvedImagePath)) {
      errors.push(`图片文件不存在：${image.path}`);
      continue;
    }

    errors.push(...inspectImageFile(resolvedImagePath, image.role).map((error) => `${image.role} ${error}`));
  }

  if (!Array.isArray(imagePrompts) || imagePrompts.length < images.length) {
    errors.push("image-prompts.json 缺少图片提示词或质量检查记录");
  }

  for (const image of images) {
    const promptItem = Array.isArray(imagePrompts) ? imagePrompts.find((item) => item?.role === image.role) : null;
    const quality = promptItem?.quality_check;

    if (!promptItem) {
      errors.push(`image-prompts.json 缺少 ${image.role} 的记录`);
      continue;
    }

    for (const key of ["matched_section", "generation_source", "scene", "main_subject", "camera", "composition"]) {
      if (!promptItem[key]) errors.push(`${image.role} 提示词记录缺少 ${key}`);
    }

    if (!["chatgpt-image2", "imagegen"].includes(promptItem.generation_source)) {
      errors.push(`${image.role} generation_source 必须是 chatgpt-image2 或 imagegen`);
    }

    if (!quality || quality.passed !== true) errors.push(`${image.role} 未通过图片质量检查`);
    if (quality?.final_file && path.basename(quality.final_file) !== path.basename(image.path)) {
      errors.push(`${image.role} quality_check.final_file 与实际图片不一致`);
    }
  }

  if (review?.passed !== true) errors.push("review.passed 不是 true，拒绝打包");
  if (review?.risk_level === "high") errors.push("review.risk_level 为 high，拒绝打包");
  if (!Array.isArray(sources) || sources.length === 0) errors.push("sources 为空，至少需要 1 个来源");
  if (!contentHtml.trim()) errors.push("HTML 内容为空");
  if (!contentMd.trim()) errors.push("Markdown 内容为空");

  if (errors.length) fail(`文章包校验失败：\n- ${errors.join("\n- ")}`);
}

function inspectImageFile(filePath, role) {
  const minimum = imageMinimums[role];
  if (!minimum) return [];

  const errors = [];
  const stat = fs.statSync(filePath);
  const dimensions = readImageDimensions(filePath);

  if (stat.size < minimum.minBytes) {
    errors.push(`文件太小：${Math.round(stat.size / 1024)}KB，疑似占位图或低质量图`);
  }

  if (!dimensions) {
    errors.push("无法读取图片尺寸");
    return errors;
  }

  if (dimensions.width < minimum.minWidth || dimensions.height < minimum.minHeight) {
    errors.push(`尺寸不足：${dimensions.width}x${dimensions.height}`);
  }

  if (minimum.minAspect || minimum.maxAspect) {
    const aspect = dimensions.width / dimensions.height;
    if (aspect < minimum.minAspect || aspect > minimum.maxAspect) {
      errors.push(`封面比例异常：${aspect.toFixed(2)}`);
    }
  }

  return errors;
}

function readImageDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }

  return null;
}

function countArticleChars(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>#\-\s]/g, "")
    .length;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
