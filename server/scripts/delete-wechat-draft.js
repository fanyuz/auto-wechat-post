#!/usr/bin/env node
import { ensureProjectDirs, loadProject } from "../lib/project.js";
import { deleteDraft, getAccessToken } from "../lib/wechat.js";

const [projectId, mediaId] = process.argv.slice(2);

if (!projectId || !mediaId) {
  console.error("用法：node scripts/delete-wechat-draft.js PROJECT_ID MEDIA_ID");
  process.exit(1);
}

try {
  const project = loadProject(projectId);
  ensureProjectDirs(project);

  const token = await getAccessToken(project.env);
  await deleteDraft({ accessToken: token.access_token, mediaId });

  console.log("草稿删除成功");
  console.log(`project_id：${projectId}`);
  console.log(`media_id：${mediaId}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
