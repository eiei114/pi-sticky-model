import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Select a stable baseline from git's descending version-sorted tag list. */
export function selectPreviousStableTag(tags, currentTag) {
  return tags.find((tag) => /^v\d+\.\d+\.\d+$/.test(tag) && tag !== currentTag) ?? "";
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
