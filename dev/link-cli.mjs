// Puts a `paperwhite` command on your PATH that runs this repo's CLI.
// The symlink goes next to the running `node` binary (already on PATH), so no
// shell profile changes are needed. Undo with `pnpm unlink-cli`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../pw-core/bin/paperwhite.mjs', import.meta.url));
const binDir = path.dirname(process.execPath);
const link = path.join(binDir, process.platform === 'win32' ? 'paperwhite.cmd' : 'paperwhite');

const existing = (() => {
  try {
    return fs.lstatSync(link);
  } catch {
    return undefined;
  }
})();

if (process.argv.includes('--unlink')) {
  if (existing?.isSymbolicLink() && fs.readlinkSync(link) === target) {
    fs.unlinkSync(link);
    console.log(`removed ${link}`);
  } else console.log('nothing to remove (no paperwhite link pointing at this repo)');
  process.exit(0);
}

if (existing) {
  if (existing.isSymbolicLink() && fs.readlinkSync(link) === target) {
    console.log(`already linked: ${link}`);
    process.exit(0);
  }
  console.error(`${link} already exists and is not this repo's CLI; leaving it alone.`);
  process.exit(1);
}

try {
  if (process.platform === 'win32') fs.writeFileSync(link, `@node "${target}" %*\r\n`);
  else {
    fs.chmodSync(target, 0o755);
    fs.symlinkSync(target, link);
  }
  console.log(`linked ${link} -> ${target}\nTry: paperwhite --help`);
} catch (e) {
  console.error(`could not write to ${binDir} (${e.message}).\nAlternative: run commands through pnpm, e.g. \`pnpm dev\`.`);
  process.exit(1);
}
