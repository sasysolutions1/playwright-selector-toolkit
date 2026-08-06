import { randomUUID } from 'node:crypto';
import { open, readFile, rm, mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { BrowserError } from '../../errors/toolkit-error.js';
import type { BrowserProfileLock, BrowserProfileLockOwner } from '../../types/browser.js';

const LOCK_FILE_NAME = '.selector-toolkit-profile.lock';

export interface AcquireProfileLockOptions {
  readonly pid?: number;
  readonly hostname?: string;
  readonly now?: Date;
  readonly token?: string;
  readonly isProcessAlive?: (pid: number) => boolean;
}

function defaultIsProcessAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readOwner(path: string): Promise<BrowserProfileLockOwner | null> {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<BrowserProfileLockOwner>;

    if (
      typeof parsed.token === 'string' &&
      typeof parsed.pid === 'number' &&
      typeof parsed.hostname === 'string' &&
      typeof parsed.createdAt === 'string'
    ) {
      return {
        token: parsed.token,
        pid: parsed.pid,
        hostname: parsed.hostname,
        createdAt: parsed.createdAt,
      };
    }
  } catch {
    // A corrupt lock is treated as occupied rather than silently removed.
  }

  return null;
}

async function tryCreateLock(path: string, owner: BrowserProfileLockOwner): Promise<boolean> {
  try {
    const handle = await open(path, 'wx', 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(owner, null, 2)}\n`, 'utf8');
    } finally {
      await handle.close();
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw new BrowserError(
      'BROWSER_PROFILE_LOCK_FAILED',
      `Could not create profile lock: ${path}`,
      {
        cause: error,
        details: { path },
      },
    );
  }
}

export async function acquireBrowserProfileLock(
  userDataDir: string,
  options: AcquireProfileLockOptions = {},
): Promise<BrowserProfileLock> {
  const directory = resolve(userDataDir);
  const path = resolve(directory, LOCK_FILE_NAME);
  const currentHostname = options.hostname ?? hostname();
  const currentPid = options.pid ?? process.pid;
  const processAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  const owner: BrowserProfileLockOwner = {
    token: options.token ?? randomUUID(),
    pid: currentPid,
    hostname: currentHostname,
    createdAt: (options.now ?? new Date()).toISOString(),
  };

  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  } catch (error) {
    throw new BrowserError(
      'BROWSER_PROFILE_LOCK_FAILED',
      `Could not create persistent profile directory: ${directory}`,
      { cause: error, details: { directory } },
    );
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await tryCreateLock(path, owner)) {
      let released = false;
      return {
        path,
        owner,
        async release(): Promise<void> {
          if (released) return;
          released = true;

          const currentOwner = await readOwner(path);
          if (currentOwner?.token !== owner.token) return;

          await rm(path, { force: true });
        },
      };
    }

    const existing = await readOwner(path);
    const stale =
      existing !== null && existing.hostname === currentHostname && !processAlive(existing.pid);

    if (stale && attempt === 0) {
      await rm(path, { force: true });
      continue;
    }

    throw new BrowserError(
      'BROWSER_PROFILE_IN_USE',
      `Persistent browser profile is already in use: ${directory}`,
      {
        details: {
          directory,
          lockPath: path,
          owner: existing,
        },
      },
    );
  }

  throw new BrowserError('BROWSER_PROFILE_LOCK_FAILED', `Could not acquire profile lock: ${path}`);
}
