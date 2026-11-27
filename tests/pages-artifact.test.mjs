import test from "node:test";
import assert from "node:assert/strict";

test("Pages deployment waits for its current-run artifact and stops after bounded retries", async () => {
  const {waitForPagesArtifact} = await import("../ops/wait-pages-artifact.mjs");
  let calls=0, waits=0;
  const options={repository:"owner/repo",runId:"123",token:"test-token",sleep:async()=>{waits++;},fetchImpl:async(url)=>{
    assert.equal(url,"https://api.github.com/repos/owner/repo/actions/runs/123/artifacts");
    return Response.json({artifacts:++calls<3?[]:[{name:"github-pages",expired:false,id:456}]});
  }};
  assert.equal(await waitForPagesArtifact(options),456);
  assert.equal(calls,3);
  assert.equal(waits,2);
  calls=0;
  await assert.rejects(waitForPagesArtifact({...options,attempts:2,fetchImpl:async()=>{calls++;return Response.json({artifacts:[{name:"other",expired:false}]});}}),/not visible/);
  assert.equal(calls,2);
});
