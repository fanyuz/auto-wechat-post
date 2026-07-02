import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { requireEnv } from "./env.js";

const API_BASE = "https://api.weixin.qq.com/cgi-bin";

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers ?? {}) };
    if (options.body && headers["Content-Length"] === undefined) {
      headers["Content-Length"] = Buffer.byteLength(options.body);
    }

    const request = https.request(url, { method: options.method ?? "GET", headers }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode, statusMessage: response.statusMessage, data: JSON.parse(body) });
        } catch {
          reject(new Error(`接口返回不是 JSON：${body.slice(0, 200)}`));
        }
      });
    });

    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

export async function getAccessToken(env) {
  const url = new URL(`${API_BASE}/token`);
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", requireEnv(env, "WECHAT_APP_ID"));
  url.searchParams.set("secret", requireEnv(env, "WECHAT_APP_SECRET"));

  const response = await requestJson(url);
  const data = response.data;
  if (response.statusCode < 200 || response.statusCode >= 300 || data.errcode) {
    throw new Error(`获取 access_token 失败：${data.errcode ?? response.statusCode} ${data.errmsg ?? response.statusMessage}`);
  }
  return data;
}

export async function createDraft({ accessToken, title, author, digest, content, thumbMediaId }) {
  const url = new URL(`${API_BASE}/draft/add`);
  url.searchParams.set("access_token", accessToken);

  const response = await requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      articles: [
        {
          title,
          author,
          digest,
          content,
          thumb_media_id: thumbMediaId,
          need_open_comment: 0,
          only_fans_can_comment: 0
        }
      ]
    })
  });

  const data = response.data;
  if (response.statusCode < 200 || response.statusCode >= 300 || data.errcode) {
    throw new Error(`创建草稿失败：${data.errcode ?? response.statusCode} ${data.errmsg ?? response.statusMessage}`);
  }
  return data;
}

export async function deleteDraft({ accessToken, mediaId }) {
  const url = new URL(`${API_BASE}/draft/delete`);
  url.searchParams.set("access_token", accessToken);

  const response = await requestJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_id: mediaId })
  });

  const data = response.data;
  if (response.statusCode < 200 || response.statusCode >= 300 || data.errcode) {
    throw new Error(`删除草稿失败：${data.errcode ?? response.statusCode} ${data.errmsg ?? response.statusMessage}`);
  }
  return data;
}

export async function uploadPermanentMaterial({ accessToken, filePath, type = "thumb" }) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`找不到素材文件：${resolvedPath}`);

  const url = new URL(`${API_BASE}/material/add_material`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("type", type);

  const blob = new Blob([fs.readFileSync(resolvedPath)], { type: mimeTypeFor(resolvedPath) });
  const form = new FormData();
  form.append("media", blob, path.basename(resolvedPath));

  const response = await fetch(url, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok || data.errcode) {
    throw new Error(`上传永久素材失败：${data.errcode ?? response.status} ${data.errmsg ?? response.statusText}`);
  }
  return data;
}

export async function uploadArticleImage({ accessToken, filePath }) {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) throw new Error(`找不到正文图片文件：${resolvedPath}`);

  const url = new URL(`${API_BASE}/media/uploadimg`);
  url.searchParams.set("access_token", accessToken);

  const blob = new Blob([fs.readFileSync(resolvedPath)], { type: mimeTypeFor(resolvedPath) });
  const form = new FormData();
  form.append("media", blob, path.basename(resolvedPath));

  const response = await fetch(url, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok || data.errcode) {
    throw new Error(`上传正文图片失败：${data.errcode ?? response.status} ${data.errmsg ?? response.statusText}`);
  }
  if (!data.url) throw new Error(`上传正文图片失败：接口未返回 url，返回值：${JSON.stringify(data)}`);
  return data;
}

function mimeTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}
