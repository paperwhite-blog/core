import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readUserConfig, normalizePlugins, ConfigError } from '../src/config/load.ts';
import { resolveConfig } from '../src/config.ts';

const site = (yaml: string) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-cfg-'));
  fs.writeFileSync(path.join(dir, 'paperwhite.config.yaml'), yaml);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"t","type":"module"}');
  return dir;
};

describe('paperwhite.config.yaml', () => {
  it('reads a minimal config and applies defaults', () => {
    const dir = site('site:\n  url: https://example.com/\n  title: Blog\n  footer: "© Me"\n');
    const user = readUserConfig(dir);
    expect(user.site.footer).toBe('© Me');
    const c = resolveConfig(user, dir);
    expect(c.site.url).toBe('https://example.com');
    expect(c.theme).toBe('paper');
    expect(c.contentDir).toBe(path.join(dir, 'content'));
    expect(c.plugins).toEqual([]);
  });
  it('rejects the usual mistakes with one clear line', () => {
    expect(() => readUserConfig(site('site:\n  title: Blog\n'))).toThrow(/site\.url/);
    expect(() => readUserConfig(site('site:\n  url: https://x.y\n  title: Blog\nthme: paper\n'))).toThrow(/unknown option "thme"/);
    expect(() => readUserConfig(site('site:\n  url: https://x.y\n  title: Blog\ntheme: [a]\n'))).toThrow(/"theme" must be a string/);
    expect(() => readUserConfig(site('site:\n  url: https://x.y\n  title: Blog\nplugins: [mermaid]\n'))).toThrow(/plugin "mermaid" not found.*plugins\/mermaid\/index\.ts/);
    expect(() => readUserConfig(site('site: [\n'))).toThrow(ConfigError);
    expect(() => readUserConfig(fs.mkdtempSync(path.join(os.tmpdir(), 'pw-none-')))).toThrow(/No paperwhite\.config\.yaml/);
  });
  it('accepts plugin lists in every documented shape', () => {
    expect(normalizePlugins(['a', { b: { x: 1 } }, { name: 'c', options: { y: 2 } }])).toEqual([
      { name: 'a', options: {} },
      { name: 'b', options: { x: 1 } },
      { name: 'c', options: { y: 2 } },
    ]);
    expect(normalizePlugins({ a: null, b: { z: 3 } })).toEqual([
      { name: 'a', options: {} },
      { name: 'b', options: { z: 3 } },
    ]);
    expect(() => normalizePlugins(['Bad Name'])).toThrow(/not a valid plugin name/);
  });
  it('loads plugins from plugins/<name>/index.ts with their options', () => {
    const dir = site('site:\n  url: https://x.y\n  title: Blog\nplugins:\n  - shout:\n      suffix: "!!"\n');
    fs.mkdirSync(path.join(dir, 'plugins/shout'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'plugins/shout/plugin.json'), JSON.stringify({ name: 'shout', pluginApi: 1 }));
    fs.writeFileSync(
      path.join(dir, 'plugins/shout/index.ts'),
      `export default function shout(opts: { suffix?: string } = {}) {
  return { name: 'shout', fences: { shout: (code: string) => \`<p class="shout">\${code.toUpperCase()}\${opts.suffix ?? ''}</p>\` } };
}`,
    );
    const user = readUserConfig(dir);
    expect(user.plugins).toHaveLength(1);
    expect(user.plugins![0]!.name).toBe('shout');
    expect(user.pluginSources).toEqual([path.join(dir, 'plugins/shout')]);
    expect(user.plugins![0]!.fences!.shout!('hi', null)).toBe('<p class="shout">HI!!</p>');
    fs.writeFileSync(path.join(dir, 'plugins/shout/plugin.json'), JSON.stringify({ name: 'shout', pluginApi: 2 }));
    expect(() => readUserConfig(dir)).toThrow(/pluginApi 2/);
  });
});
