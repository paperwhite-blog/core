import { defineCommand, runMain } from 'citty';
import { init } from './commands/init.ts';
import { dev, build, preview } from './commands/astro.ts';
import { check } from './commands/check.ts';
import { newNote } from './commands/new.ts';
import { theme } from './commands/theme.ts';
import { importCmd } from './commands/import.ts';

export const cli = defineCommand({
  meta: { name: 'paperwhite', version: '0.1.0', description: 'Obsidian in, Lighthouse 100 out.' },
  subCommands: { init, dev, build, preview, check, new: newNote, theme, import: importCmd },
});

export async function main() {
  await runMain(cli);
}
