import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', '.turbo']);

/** Recursively collects file paths under `rootDir` whose basename satisfies `matches`, skipping build/vcs dirs. */
export async function walkFiles(rootDir: string, matches: (fileName: string) => boolean): Promise<string[]> {
  const results: string[] = [];
  const queue = [rootDir];
  while (queue.length) {
    const dir = queue.shift();
    if (!dir) continue;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name)) queue.push(fullPath);
      } else if (matches(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

export interface MappedLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  componentName?: string;
}

export function componentNameFromPath(filePath: string): string {
  let base = filePath.split(/[/\\]/).pop() ?? filePath;
  base = base.replace(/\.component\.(html|ts)$/, '');
  base = base.replace(/\.(jsx|tsx|vue|html|ts)$/, '');
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
