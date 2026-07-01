import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function createContentFingerprint(pkg) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({
      project_id: pkg.project_id || "",
      platform: pkg.platform || "",
      title: pkg.title || "",
      digest: pkg.digest || "",
      content_html: pkg.content_html || ""
    }))
    .digest("hex");
}

export function loadJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

export function saveJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
