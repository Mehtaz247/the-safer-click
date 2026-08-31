import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { absoluteUrl, escapeHtml as e, isoDate, loadArticles, readJson, root, siteHref } from "./lib.mjs";

const config = await readJson("site.config.json");
const strategy = await readJson("state/strategy.json");
const corrections = await readJson("state/corrections.json");
const articles = (await loadArticles()).sort((a, b) => b.published.localeCompare(a.published) || b.title.localeCompare(a.title));
const out = path.join(root, "docs");

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "articles"), { recursive: true });
await mkdir(path.join(out, "assets"), { recursive: true });

const pillarLabels = { "scam-defense": "Scam defense", "account-safety": "Account safety", "safer-defaults": "Safer defaults" };

function head({ title, description, pathname = "/", type = "website", published, updated }) {
  const fullTitle = title === config.name ? title : `${title} · ${config.name}`;
  const canonical = absoluteUrl(config, pathname);
  const dates = published ? `<meta property="article:published_time" content="${e(published)}"><meta property="article:modified_time" content="${e(updated)}">` : "";
  return `<!doctype html>
<html lang="${e(config.language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(fullTitle)}</title>
  <meta name="description" content="${e(description)}">
  <meta name="theme-color" content="${e(config.themeColor)}">
  <link rel="icon" type="image/svg+xml" href="${e(siteHref(config, "/assets/favicon.svg"))}">
  <link rel="canonical" href="${e(canonical)}">
  <link rel="alternate" type="application/rss+xml" title="${e(config.name)} RSS" href="${e(absoluteUrl(config, "/feed.xml"))}">
  <meta property="og:type" content="${e(type)}">
  <meta property="og:title" content="${e(fullTitle)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${e(canonical)}">
  <meta property="og:site_name" content="${e(config.name)}">
  <meta name="twitter:card" content="summary">
  ${dates}
  <link rel="stylesheet" href="${e(siteHref(config, "/assets/style.css"))}">
  <script defer src="${e(siteHref(config, "/assets/site.js"))}"></script>
</head>`;
}

function nav() {
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${e(siteHref(config))}" aria-label="${e(config.name)} home"><span class="brand-mark" aria-hidden="true">✓</span><span>${e(config.name)}</span></a>
  <nav aria-label="Primary navigation">
    <a href="${e(siteHref(config, "/articles/"))}">Guides</a>
    <a href="${e(siteHref(config, "/about/"))}">About</a>
    <a href="${e(siteHref(config, "/standards/"))}">Standards</a>
  </nav>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div><strong>${e(config.name)}</strong><p>${e(config.tagline)}</p></div>
  <div class="footer-links"><a href="${e(siteHref(config, "/feed.xml"))}">RSS</a><a href="${e(siteHref(config, "/standards/"))}">Editorial standards</a><a href="${e(siteHref(config, "/about/"))}">About</a></div>
  <p class="fine-print">Educational information, not a guarantee of safety. Last site build: ${e(new Date().toISOString().slice(0, 10))}.</p>
</footer>`;
}

function page({ title, description, pathname, content, type, published, updated, schema }) {
  return `${head({ title, description, pathname, type, published, updated })}
<body>${nav()}<main id="main">${content}</main>${footer()}${schema ? `<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>` : ""}</body></html>`;
}

function articleCard(article) {
  return `<article class="article-card" data-pillar="${e(article.pillar)}">
  <p class="eyebrow">${e(pillarLabels[article.pillar])}</p>
  <h3><a href="${e(siteHref(config, `/articles/${article.slug}/`))}">${e(article.title)}</a></h3>
  <p>${e(article.dek)}</p>
  <div class="card-meta"><span>${e(isoDate(article.updated))}</span><span>${e(article.readingMinutes)} min</span></div>
</article>`;
}

function homePage() {
  const featured = articles.filter((article) => article.featured);
  const lead = featured[0] ?? articles[0];
  const rest = articles.filter((article) => article.slug !== lead.slug).slice(0, 4);
  const content = `<section class="hero">
  <p class="eyebrow">Clear steps. Checked sources. No panic.</p>
  <h1>Make the safer click.</h1>
  <p class="hero-copy">${e(config.description)}</p>
  <div class="hero-actions"><a class="button" href="${e(siteHref(config, `/articles/${lead.slug}/`))}">Read the featured guide</a><a class="text-link" href="${e(siteHref(config, "/standards/"))}">How we check our work →</a></div>
</section>
<section class="signal-strip" aria-label="Editorial promises">
  <div><strong>Primary sources</strong><span>Every guide shows its evidence.</span></div>
  <div><strong>Review dates</strong><span>Advice has a visible shelf life.</span></div>
  <div><strong>No hidden incentives</strong><span>No ads, affiliates, or paid coverage.</span></div>
</section>
<section class="featured-grid section-wrap">
  <div class="feature-copy"><p class="eyebrow">Featured guide</p><h2><a href="${e(siteHref(config, `/articles/${lead.slug}/`))}">${e(lead.title)}</a></h2><p>${e(lead.dek)}</p><ul class="mini-checklist">${lead.takeaway.map((item) => `<li>${e(item)}</li>`).join("")}</ul><a class="text-link" href="${e(siteHref(config, `/articles/${lead.slug}/`))}">Read the ${e(lead.readingMinutes)}-minute guide →</a></div>
  <aside class="feature-panel"><p class="eyebrow">The rule to remember</p><blockquote>“A message can create urgency. It cannot choose your verification channel.”</blockquote><p>Leave the message, call, or page. Re-enter through the official app or an address you already trust.</p></aside>
</section>
<section class="section-wrap"><div class="section-heading"><div><p class="eyebrow">Latest field guides</p><h2>One decision at a time</h2></div><a class="text-link" href="${e(siteHref(config, "/articles/"))}">Browse every guide →</a></div><div class="card-grid">${rest.map(articleCard).join("")}</div></section>
<section class="manifesto"><p class="eyebrow">Our position</p><h2>Security advice should lower the temperature.</h2><p>Fear makes people rush. Useful guidance creates a pause, names the evidence, and gives the next safe action. That is the whole editorial model.</p><a class="text-link light" href="${e(siteHref(config, "/about/"))}">Why this publication exists →</a></section>`;
  return page({ title: config.name, description: config.description, pathname: "/", content });
}

function articlePage(article) {
  const sourceItems = article.sources.map((source, index) => `<li id="source-${index + 1}"><a href="${e(source.url)}" rel="noreferrer">${e(source.title)}</a><span>${e(source.publisher)} · accessed ${e(isoDate(source.accessed))}</span></li>`).join("");
  const sections = article.sections.map((section) => `<section class="article-section"><h2>${e(section.heading)}</h2>${section.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join("")}${section.steps ? `<ol class="action-list">${section.steps.map((step) => `<li>${e(step)}</li>`).join("")}</ol>` : ""}${section.callout ? `<aside class="callout"><strong>Keep this boundary</strong><p>${e(section.callout)}</p></aside>` : ""}</section>`).join("");
  const articleCorrections = corrections.corrections.filter((item) => item.slug === article.slug);
  const correctionHtml = articleCorrections.length ? `<section class="corrections"><h2>Corrections</h2>${articleCorrections.map((item) => `<p><strong>${e(item.date)}:</strong> ${e(item.summary)}</p>`).join("")}</section>` : "";
  const content = `<article class="article-page">
  <header class="article-hero"><a class="pill" href="${e(siteHref(config, `/articles/?topic=${article.pillar}`))}">${e(pillarLabels[article.pillar])}</a><h1>${e(article.title)}</h1><p class="dek">${e(article.dek)}</p><div class="article-meta"><span>Published ${e(isoDate(article.published))}</span><span>Updated ${e(isoDate(article.updated))}</span><span>${e(article.readingMinutes)} min read</span></div></header>
  <div class="article-layout"><aside class="takeaway"><p class="eyebrow">The short version</p><ul>${article.takeaway.map((item) => `<li>${e(item)}</li>`).join("")}</ul><p class="review-date">Next evidence review: ${e(isoDate(article.reviewDue))}</p></aside><div class="article-body">${sections}<section class="sources"><p class="eyebrow">Evidence</p><h2>Sources checked</h2><p>These links support the guidance above. They are shown so you can inspect the evidence and check for later changes.</p><ol>${sourceItems}</ol></section>${correctionHtml}<aside class="article-disclosure"><strong>How this was made</strong><p>This guide was produced by an autonomous editorial system and passed source, structure, date, and unsafe-claim checks before publication. It does not describe personal experience.</p></aside></div></div>
</article>`;
  const schema = { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.description, datePublished: article.published, dateModified: article.updated, author: { "@type": "Organization", name: config.author }, publisher: { "@type": "Organization", name: config.name }, mainEntityOfPage: absoluteUrl(config, `/articles/${article.slug}/`) };
  return page({ title: article.title, description: article.description, pathname: `/articles/${article.slug}/`, content, type: "article", published: article.published, updated: article.updated, schema });
}

function archivePage() {
  const content = `<section class="page-intro"><p class="eyebrow">The library</p><h1>Practical guides for safer digital decisions.</h1><p>Filter by the problem in front of you. Every result includes its latest review date.</p></section><section class="archive section-wrap"><div class="filters" aria-label="Filter guides"><button class="filter is-active" data-filter="all">All</button>${Object.entries(pillarLabels).map(([id, label]) => `<button class="filter" data-filter="${e(id)}">${e(label)}</button>`).join("")}</div><div class="card-grid archive-grid">${articles.map(articleCard).join("")}</div><p class="empty-state" hidden>No guides match this filter yet.</p></section>`;
  return page({ title: "Guides", description: `Browse every ${config.name} digital-safety guide.`, pathname: "/articles/", content });
}

function aboutPage() {
  const content = `<section class="page-intro"><p class="eyebrow">About the publication</p><h1>Calm is a security feature.</h1><p>${e(config.description)}</p></section><section class="prose-page"><h2>The problem</h2><p>Most people meet digital-safety advice at the worst possible moment: an alarming call, a confusing sign-in screen, or a message that demands an immediate decision. Technical jargon and fear do not make that moment easier.</p><h2>The editorial choice</h2><p>${e(strategy.publication.readerPromise)}</p><p>The publication focuses on scam defense, account safety, and safer defaults. It favors durable questions over an endless news feed and updates existing guidance when the evidence changes.</p><h2>Who writes this?</h2><p>The Safer Click is operated by an autonomous editorial system. Software and language models may research, draft, edit, publish, measure, and revise the site. Articles carry an institutional byline because the system will not invent a human author or imply personal experience it does not have.</p><p>Automation is disclosed because trust should come from inspectable methods: cited sources, explicit review dates, correction records, and public standards.</p><h2>What is absent</h2><p>There are no affiliate links, paid recommendations, sponsored rankings, fake testimonials, or fabricated traffic numbers. If a useful measurement is unavailable, it remains unavailable.</p><a class="button" href="${e(siteHref(config, "/standards/"))}">Read the editorial standards</a></section>`;
  return page({ title: "About", description: `Why ${config.name} publishes calm, source-first digital safety guidance.`, pathname: "/about/", content });
}

function standardsPage() {
  const content = `<section class="page-intro"><p class="eyebrow">Editorial standards</p><h1>Evidence before advice.</h1><p>The rules the autonomous operator must satisfy before it can publish.</p></section><section class="prose-page"><h2>Publication gate</h2><ol class="policy-list"><li><strong>A concrete reader question.</strong> The guide must help someone make a specific decision or complete a bounded task.</li><li><strong>At least two primary sources.</strong> Government agencies, standards bodies, and first-party platform documentation come first.</li><li><strong>Visible dates.</strong> Every article shows publication, update, and next-review dates.</li><li><strong>No invented experience.</strong> The system cannot claim it received a call, tested a product, interviewed someone, or witnessed an event unless a documented method proves that work happened.</li><li><strong>No absolute safety claims.</strong> Advice can reduce risk; it cannot promise that a person or account is unhackable.</li><li><strong>A passing verification run.</strong> Source metadata, article structure, links, feeds, and rendered output are checked before deployment.</li></ol><h2>Corrections and retirement</h2><p>Meaningful factual changes receive a dated correction note. Advice that can no longer be supported is updated, redirected, or retired. The operator prioritizes overdue reviews before increasing publication volume.</p><h2>Commercial independence</h2><p>The publication does not accept payment for coverage, run affiliate links, or sell reader data. Paid growth and product recommendations are disabled by operating policy.</p><h2>Automation and costs</h2><p>API-backed drafting is disabled unless a spending cap is explicitly authorized. The operator cannot weaken credential handling, incur paid promotion costs, auto-delete published work, or deploy self-modifying code without preserving a recoverable version and passing verification.</p><h2>Measurement honesty</h2><p>Metrics are used only when their source is known. Blank analytics are not replaced with demo numbers. Strategy changes require enough evidence to separate a real pattern from ordinary noise.</p></section>`;
  return page({ title: "Editorial standards", description: `The evidence, correction, automation, and commercial-independence rules for ${config.name}.`, pathname: "/standards/", content });
}

async function writePage(relative, html) {
  const target = path.join(out, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html);
}

await writePage("index.html", homePage());
await writePage("articles/index.html", archivePage());
await writePage("about/index.html", aboutPage());
await writePage("standards/index.html", standardsPage());
for (const article of articles) await writePage(`articles/${article.slug}/index.html`, articlePage(article));

const feedItems = articles.map((article) => `<item><title>${e(article.title)}</title><link>${e(absoluteUrl(config, `/articles/${article.slug}/`))}</link><guid>${e(absoluteUrl(config, `/articles/${article.slug}/`))}</guid><pubDate>${new Date(`${article.published}T12:00:00Z`).toUTCString()}</pubDate><description>${e(article.description)}</description></item>`).join("");
await writePage("feed.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${e(config.name)}</title><link>${e(absoluteUrl(config))}</link><description>${e(config.description)}</description><language>${e(config.language)}</language>${feedItems}</channel></rss>`);

const routes = ["/", "/articles/", "/about/", "/standards/", ...articles.map((article) => `/articles/${article.slug}/`)];
await writePage("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((route) => `<url><loc>${e(absoluteUrl(config, route))}</loc></url>`).join("")}</urlset>`);
await writePage("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(config, "/sitemap.xml")}\n`);
await writePage("404.html", page({ title: "Page not found", description: "The requested page could not be found.", pathname: "/404.html", content: `<section class="page-intro"><p class="eyebrow">404</p><h1>That page is not here.</h1><p>The link may be old or mistyped.</p><a class="button" href="${e(siteHref(config))}">Return home</a></section>` }));
await writePage(".nojekyll", "");
await cp(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });

console.log(`Built ${articles.length} articles and ${routes.length} indexable routes in docs/.`);
