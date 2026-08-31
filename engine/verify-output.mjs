import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { basePath, loadArticles, readJson, root, siteHref } from "./lib.mjs";

const config = await readJson("site.config.json");
const articles = await loadArticles();
const failures = [];
const configuredBase = basePath(config.url);

async function requireFile(relative, minimumBytes = 1) {
  try {
    const info = await stat(path.join(root, "docs", relative));
    if (info.size < minimumBytes) failures.push(`${relative} is unexpectedly small`);
  } catch {
    failures.push(`${relative} is missing`);
  }
}

await requireFile("index.html", 1000);
await requireFile("articles/index.html", 1000);
await requireFile("about/index.html", 800);
await requireFile("standards/index.html", 800);
await requireFile("feed.xml", 300);
await requireFile("sitemap.xml", 300);
await requireFile("robots.txt", 20);
await requireFile("assets/style.css", 2000);
await requireFile("assets/site.js", 100);
for (const article of articles) await requireFile(`articles/${article.slug}/index.html`, 1800);

const htmlFiles = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (entry.name.endsWith(".html")) htmlFiles.push(target);
  }
}
await walk(path.join(root, "docs"));

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const relative = path.relative(path.join(root, "docs"), file);
  for (const required of ["<title>", "meta name=\"description\"", "link rel=\"canonical\"", "Skip to content", "site-footer"]) {
    if (!html.includes(required)) failures.push(`${relative} missing ${required}`);
  }
  const localLinks = [...html.matchAll(/href=["'](\/[^"']*)["']/g)].map((match) => match[1]);
  for (const link of localLinks) {
    if (configuredBase && link !== configuredBase && !link.startsWith(`${configuredBase}/`)) failures.push(`${relative} contains project-breaking local link: ${link}`);
  }
  if (/(lorem ipsum|example\.com|John Doe|10,000 readers)/i.test(html)) failures.push(`${relative} contains placeholder or fabricated content`);
}

const sitemap = await readFile(path.join(root, "docs/sitemap.xml"), "utf8");
for (const article of articles) if (!sitemap.includes(`/articles/${article.slug}/`)) failures.push(`sitemap missing ${article.slug}`);

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`Verified ${htmlFiles.length} HTML files, ${articles.length} article routes, feeds, metadata, and project-path links.`);
