import fs from "node:fs";
import path from "node:path";

export function loadEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`找不到环境变量文件：${resolved}`);
  }

  const env = {};
  for (const line of fs.readFileSync(resolved, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

export function requireEnv(env, key) {
  const value = env[key] || process.env[key];
  if (!value) throw new Error(`缺少环境变量：${key}`);
  return value;
}
