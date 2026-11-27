import {fileURLToPath} from "node:url";
import path from "node:path";

export async function waitForPagesArtifact({repository,runId,token,attempts=6,fetchImpl=fetch,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^\d+$/.test(String(runId)) || !token) throw new Error("Artifact check requires repository, run ID and token.");
  for (let attempt=0;attempt<attempts;attempt++) {
    const response=await fetchImpl(`https://api.github.com/repos/${repository}/actions/runs/${runId}/artifacts`,{
      headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Artifact visibility check HTTP ${response.status}.`);
    const data=await response.json();
    const artifact=data.artifacts.find(item=>item.name==="github-pages"&&!item.expired);
    if (artifact) return artifact.id;
    if (attempt+1<attempts) await sleep(5000);
  }
  throw new Error("Current-run github-pages artifact not visible after bounded retries; deployment stopped.");
}

if (process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const id=await waitForPagesArtifact({repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,token:process.env.GITHUB_TOKEN});
  console.log(`Current-run Pages artifact visible: ${id}`);
}
