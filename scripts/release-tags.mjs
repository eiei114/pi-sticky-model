import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function compareStableTags(leftTag, rightTag) {
  const left = /^v(\d+)\.(\d+)\.(\d+)$/.exec(leftTag);
  const right = /^v(\d+)\.(\d+)\.(\d+)$/.exec(rightTag);
  if (!left || !right) return null;

  for (let index = 1; index <= 3; index++) {
    const leftPart = BigInt(left[index]);
    const rightPart = BigInt(right[index]);
    if (leftPart < rightPart) return -1;
    if (leftPart > rightPart) return 1;
  }
  return 0;
}

/** Select the newest stable baseline strictly older than current from git's descending tag list. */
export function selectPreviousStableTag(tags, currentTag) {
  return tags.find((tag) => compareStableTags(tag, currentTag) === -1) ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const currentTag = process.argv[2];
  if (!/^v\d+\.\d+\.\d+$/.test(currentTag ?? "")) {
    throw new Error("Expected the current stable version tag");
  }
  const tags = execFileSync("git", ["tag", "--sort=-version:refname"], { encoding: "utf8" })
    .trim().split(/\r?\n/);
  console.log(selectPreviousStableTag(tags, currentTag));
}
