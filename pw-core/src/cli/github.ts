import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export interface GitHubSource {
  owner: string;
  repo: string;
  /** tag, branch or commit; undefined = latest release, else default branch */
  ref?: string;
}

/** `owner/repo`, `owner/repo#ref`, `https://github.com/owner/repo`, `…/tree/ref`. */
export function parseGitHubSource(spec: string): GitHubSource | undefined {
  const url = /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#]+?)(?:\.git)?(?:\/tree\/([^\s]+))?\/?$/.exec(spec);
  if (url) return { owner: url[1]!, repo: url[2]!, ref: url[3] };
  const short = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:#(.+))?$/.exec(spec);
  if (short && !spec.startsWith('.') && !path.isAbsolute(spec)) return { owner: short[1]!, repo: short[2]!, ref: short[3] };
  return undefined;
}

const UA = { 'User-Agent': 'paperwhite-cli', Accept: 'application/vnd.github+json' };

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  return token ? { ...UA, Authorization: `Bearer ${token}` } : UA;
}

export interface Release {
  tag: string;
  url: string;
  publishedAt?: string;
  notes?: string;
}

/** Latest release of a repository, or undefined when it has none. Throws on network/rate-limit errors. */
export async function latestRelease(src: GitHubSource): Promise<Release | undefined> {
  const res = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/releases/latest`, { headers: headers() });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${src.owner}/${src.repo}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { tag_name: string; html_url: string; published_at?: string; body?: string };
  return { tag: json.tag_name, url: json.html_url, publishedAt: json.published_at, notes: json.body ?? undefined };
}

/** Newest tag by semver order, for repositories that tag without publishing releases. */
export async function latestTag(src: GitHubSource): Promise<string | undefined> {
  const res = await fetch(`https://api.github.com/repos/${src.owner}/${src.repo}/tags?per_page=100`, { headers: headers() });
  if (!res.ok) return undefined;
  const tags = ((await res.json()) as { name: string }[]).map((t) => t.name).filter((n) => parseSemver(n));
  return tags.sort(compareSemver).at(-1);
}

export function parseSemver(v: string): [number, number, number, string] | undefined {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] ?? ''] : undefined;
}

/** -1, 0, 1 like a comparator; non-semver strings sort first. A pre-release is lower than its release. */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return pa ? 1 : pb ? -1 : 0;
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] as number) < (pb[i] as number) ? -1 : 1;
  if (pa[3] === pb[3]) return 0;
  if (!pa[3]) return 1;
  if (!pb[3]) return -1;
  return pa[3] < pb[3] ? -1 : 1;
}

/**
 * Download `ref` of a repository (or its latest release, else the default branch) as a tarball
 * and extract it into a fresh temp directory. Returns the directory and the ref that was used.
 */
export async function downloadRepo(src: GitHubSource): Promise<{ dir: string; ref: string }> {
  let ref = src.ref;
  if (!ref) ref = (await latestRelease(src))?.tag ?? (await latestTag(src)) ?? 'HEAD';
  const url = `https://codeload.github.com/${src.owner}/${src.repo}/tar.gz/${encodeURIComponent(ref)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA['User-Agent'] } });
  if (!res.ok) throw new Error(`Could not download ${src.owner}/${src.repo}@${ref} (${res.status}). Is the repository public and the ref correct?`);
  const tgz = Buffer.from(await res.arrayBuffer());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paperwhite-add-'));
  extractTarGz(tgz, dir);
  return { dir, ref };
}

/** Extract with the system `tar` (present on macOS, Linux and Windows 10+), dropping the top-level folder GitHub adds. */
export function extractTarGz(tgz: Buffer, dest: string): void {
  const r = spawnSync('tar', ['-xzf', '-', '--strip-components=1', '-C', dest], { input: tgz, stdio: ['pipe', 'pipe', 'pipe'] });
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr?.toString().trim() || `exit ${r.status}`}`);
}
