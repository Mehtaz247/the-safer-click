import { loadArticles, readJson } from "./lib.mjs";

const errors = [];
const warnings = [];
const required = ["slug", "title", "dek", "description", "pillar", "published", "updated", "reviewDue", "readingMinutes", "takeaway", "sections", "sources", "quality"];
const allowedPillars = new Set(["scam-defense", "account-safety", "safer-defaults"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const today = new Date().toISOString().slice(0, 10);

function issue(article, message) {
  errors.push(`${article._file}: ${message}`);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function validateArticle(article) {
  for (const field of required) {
    if (article[field] === undefined || article[field] === null || article[field] === "") issue(article, `missing ${field}`);
  }
  if (!slugPattern.test(article.slug ?? "")) issue(article, "slug must be lowercase kebab-case");
  if (!allowedPillars.has(article.pillar)) issue(article, `unknown pillar ${article.pillar}`);
  if ((article.title ?? "").length < 20 || article.title.length > 85) issue(article, "title must be 20–85 characters");
  if ((article.description ?? "").length < 80 || article.description.length > 180) issue(article, "description must be 80–180 characters");
  for (const field of ["published", "updated", "reviewDue"]) {
    if (!validDate(article[field] ?? "")) issue(article, `${field} must be YYYY-MM-DD`);
  }
  if (article.updated < article.published) issue(article, "updated date precedes publication date");
  if (article.reviewDue <= article.updated) issue(article, "reviewDue must be after updated");
  if (!Number.isInteger(article.readingMinutes) || article.readingMinutes < 3 || article.readingMinutes > 15) issue(article, "readingMinutes must be an integer from 3 to 15");
  if (!Array.isArray(article.takeaway) || article.takeaway.length < 2 || article.takeaway.length > 5) issue(article, "takeaway must have 2–5 items");
  if (!Array.isArray(article.sections) || article.sections.length < 3) issue(article, "at least three sections are required");
  article.sections?.forEach((section, index) => {
    if (!section.heading) issue(article, `section ${index + 1} has no heading`);
    if (!Array.isArray(section.paragraphs) || section.paragraphs.length === 0) issue(article, `section ${index + 1} has no paragraphs`);
  });
  const primarySources = article.sources?.filter((source) => source.primary) ?? [];
  if (!Array.isArray(article.sources) || article.sources.length < 2) issue(article, "at least two sources are required");
  if (primarySources.length < 2) issue(article, "at least two primary sources are required");
  const sourceUrls = new Set();
  article.sources?.forEach((source, index) => {
    if (!source.title || !source.publisher || !source.url || !source.accessed) issue(article, `source ${index + 1} is incomplete`);
    try {
      const url = new URL(source.url);
      if (url.protocol !== "https:") issue(article, `source ${index + 1} must use HTTPS`);
      if (sourceUrls.has(source.url)) issue(article, `source ${index + 1} duplicates another URL`);
      sourceUrls.add(source.url);
    } catch {
      issue(article, `source ${index + 1} has an invalid URL`);
    }
    if (!validDate(source.accessed ?? "")) issue(article, `source ${index + 1} has an invalid accessed date`);
  });
  if (!Number.isInteger(article.quality?.score) || article.quality.score < 82 || article.quality.score > 100) issue(article, "quality score must be an integer from 82 to 100");
  const prose = JSON.stringify(article.sections ?? []).toLowerCase();
  const bannedClaims = ["completely safe", "100% safe", "guaranteed protection", "unhackable"];
  for (const phrase of bannedClaims) if (prose.includes(phrase)) issue(article, `contains prohibited absolute claim: ${phrase}`);
  if (article.reviewDue < today) warnings.push(`${article._file}: review date has passed`);
}

const config = await readJson("site.config.json");
const strategy = await readJson("state/strategy.json");
const articles = await loadArticles();

if (!config.name || !config.url || !config.description) errors.push("site.config.json: name, url, and description are required");
try { new URL(config.url); } catch { errors.push("site.config.json: url is invalid"); }
if (strategy.publication?.name !== config.name) errors.push("strategy publication name must match site config");
if (articles.length === 0) errors.push("no articles found");

const seen = new Set();
for (const article of articles) {
  validateArticle(article);
  if (seen.has(article.slug)) issue(article, `duplicate slug ${article.slug}`);
  seen.add(article.slug);
}

for (const warning of warnings) console.warn(`WARN ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exit(1);
}

console.log(`Validated ${articles.length} articles, ${articles.reduce((sum, article) => sum + article.sources.length, 0)} sources, and publication strategy v${strategy.version}.`);

