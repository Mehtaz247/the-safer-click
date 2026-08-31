import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function writeJson(relativePath, value) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
}

export async function loadArticles() {
  const directory = path.join(root, "content/articles");
  if (!existsSync(directory)) return [];
  const names = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(names.map(async (name) => ({
    ...(JSON.parse(await readFile(path.join(directory, name), "utf8"))),
    _file: name
  })));
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isoDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}

export function basePath(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, "");
  return pathname === "/" ? "" : pathname;
}

export function siteHref(config, pathname = "/") {
  const base = basePath(config.url);
  if (pathname === "/") return `${base}/`;
  return `${base}/${pathname.replace(/^\//, "")}`;
}

export function absoluteUrl(config, pathname = "/") {
  return new URL(siteHref(config, pathname), new URL(config.url).origin).toString();
}

export function stripForText(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

