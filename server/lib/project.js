import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./env.js";

export function projectsRoot() {
  return path.resolve(process.cwd(), process.env.PROJECTS_DIR || "projects");
}

export function projectDir(projectId) {
  if (!/^[a-z0-9-]+$/.test(projectId)) {
    throw new Error(`非法 project_id：${projectId}`);
  }
  return path.join(projectsRoot(), projectId);
}

export function loadProject(projectId) {
  const dir = projectDir(projectId);
  const envPath = path.join(dir, ".env");
  const env = loadEnvFile(envPath);
  return {
    id: projectId,
    dir,
    env,
    inboxDir: path.join(dir, "inbox"),
    dataDir: path.join(dir, "data"),
    logsDir: path.join(dir, "logs")
  };
}

export function listProjectIds() {
  const root = projectsRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function ensureProjectDirs(project) {
  fs.mkdirSync(project.inboxDir, { recursive: true });
  fs.mkdirSync(project.dataDir, { recursive: true });
  fs.mkdirSync(project.logsDir, { recursive: true });
}
