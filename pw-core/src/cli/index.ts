import { defineCommand, runMain, runCommand } from 'citty';
import { init } from './commands/init.ts';
import { dev, build, preview } from './commands/astro.ts';
import { check } from './commands/check.ts';
import { newNote } from './commands/new.ts';
import { theme } from './commands/theme.ts';
import { importCmd } from './commands/import.ts';
import { add } from './commands/add.ts';

export const cli = defineCommand({
  meta: { name: 'paperwhite', version: '0.1.0', description: 'Obsidian in, Lighthouse 100 out.' },
  subCommands: { init, dev, build, preview, check, new: newNote, theme, add, import: importCmd },
});

export async function main() {
  const rawArgs = process.argv.slice(2);
  // citty's runMain handles --help/--version (and prints usage); everything else runs
  // directly so expected problems (no site, bad config) print one clear line, not a stack trace.
  if (!rawArgs.length || rawArgs.some((a) => a === '--help' || a === '-h' || a === '--version' || a === '-v')) {
    await runMain(cli);
    return;
  }
  try {
    await runCommand(cli, { rawArgs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\x1b[31m✖\x1b[0m ${msg}`);
    if (/Unknown command|No command specified/i.test(msg)) console.error('Run `paperwhite --help` for the list of commands.');
    if (process.env.DEBUG && e instanceof Error) console.error(e.stack);
    process.exitCode = 1;
  }
}
