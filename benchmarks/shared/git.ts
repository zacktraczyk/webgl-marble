import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GitMetadata } from "./types.ts";

function git(cwd: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function collectGitMetadata(cwd = process.cwd()): GitMetadata {
  const commit = git(cwd, ["rev-parse", "HEAD"]);
  if (commit === null) {
    return { commit: null, branch: null, dirty: null, diffHash: null };
  }

  const branch = git(cwd, ["branch", "--show-current"]);
  const status = git(cwd, ["status", "--porcelain=v1", "-z"]);
  const dirty = status === null ? null : status.length > 0;
  let diffHash: string | null = null;

  if (dirty) {
    const diff = git(cwd, ["diff", "HEAD", "--binary", "--no-ext-diff"]);
    const untracked =
      git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"])
        ?.split("\0")
        .filter(Boolean) ?? [];
    const hash = createHash("sha256");
    hash.update(status ?? "");
    hash.update("\0");
    hash.update(diff ?? "");
    // `git diff HEAD` omits untracked content. Hash it without storing it in
    // the result, so two dirty worktrees with the same filenames remain distinct.
    for (const relativePath of untracked.sort()) {
      hash.update("\0");
      hash.update(relativePath);
      hash.update("\0");
      try {
        hash.update(readFileSync(resolve(cwd, relativePath)));
      } catch {
        hash.update("<unreadable>");
      }
    }
    diffHash = hash.digest("hex");
  }

  return { commit, branch: branch || null, dirty, diffHash };
}
