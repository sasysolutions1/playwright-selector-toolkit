import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

async function files(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(root)) {
    if (['node_modules', 'dist', '.selector-artifacts', '.git'].includes(entry)) continue;
    const path = resolve(root, entry);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
}

function localLinks(markdown: string): string[] {
  return [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)]
    .map((match) => match[1]?.trim() ?? '')
    .filter((value) => value && !/^(?:https?:|mailto:|#)/iu.test(value))
    .map((value) => value.split('#')[0] ?? '')
    .filter(Boolean);
}

describe('documentation links', () => {
  it('points every local Markdown link at an existing file', async () => {
    const root = process.cwd();
    const markdownFiles = (await files(root)).filter((path) => extname(path) === '.md');
    const missing: string[] = [];
    for (const markdownPath of markdownFiles) {
      const markdown = await readFile(markdownPath, 'utf8');
      for (const link of localLinks(markdown)) {
        const target = resolve(dirname(markdownPath), decodeURIComponent(link));
        try {
          await stat(target);
        } catch {
          missing.push(`${markdownPath}: ${link}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
