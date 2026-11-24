import test from "node:test";
import assert from "node:assert/strict";
import {readFile,writeFile,rm} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {root} from "../engine/lib.mjs";

test("consolidated articles preserve their URL but leave discovery surfaces", async () => {
  const file = `${root}/content/articles/test-consolidation-alias.json`;
  const article = JSON.parse(await readFile(`${root}/content/articles/connected-app-access.json`));
  try {
    await writeFile(file, JSON.stringify({...article,slug:"test-consolidation-alias",redirectTo:article.slug}));
    execFileSync(process.execPath,["engine/build.mjs"],{cwd:root});
    const html = await readFile(`${root}/docs/articles/test-consolidation-alias/index.html`,"utf8");
    assert.ok(html.includes('rel="canonical" href="https://mehtaz247.github.io/the-safer-click/articles/connected-app-access/"'));
    assert.ok(html.includes('http-equiv="refresh"'));
    assert.ok(html.includes('name="robots" content="noindex,follow"'));
    for (const relative of ["feed.xml","sitemap.xml","articles/index.html"]) {
      assert.ok(!(await readFile(`${root}/docs/${relative}`,"utf8")).includes("test-consolidation-alias"));
    }
  } finally {
    await rm(file,{force:true});
    execFileSync(process.execPath,["engine/build.mjs"],{cwd:root});
  }
});
