import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Production build output. Run `pnpm build` first (pnpm test:dist). */
export const distDir = join(import.meta.dirname, '..', '..', 'dist');

export interface Page {
  file: string;
  html: string;
}

async function findFiles(directory: string, extension: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return findFiles(path, extension);
      }
      return entry.name.endsWith(extension) ? [path] : [];
    }),
  );
  return nested.flat();
}

function assertDistExists(): void {
  if (!existsSync(distDir)) {
    throw new Error('dist/ not found. Run "pnpm build" before "pnpm test:dist".');
  }
}

export async function readPages(): Promise<Page[]> {
  assertDistExists();
  const files = await findFiles(distDir, '.html');
  return Promise.all(files.map(async (file) => ({ file, html: await readFile(file, 'utf8') })));
}

export async function readStylesheets(): Promise<Page[]> {
  assertDistExists();
  const files = await findFiles(distDir, '.css');
  return Promise.all(files.map(async (file) => ({ file, html: await readFile(file, 'utf8') })));
}

export async function readDistFile(name: string): Promise<string> {
  assertDistExists();
  return readFile(join(distDir, name), 'utf8');
}
