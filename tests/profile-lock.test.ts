import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { acquireBrowserProfileLock } from '../src/core/browser/profile-lock.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

async function profileDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'selector-profile-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('persistent profile lock', () => {
  it('prevents concurrent owners and permits reuse after release', async () => {
    const directory = await profileDirectory();
    const first = await acquireBrowserProfileLock(directory, {
      pid: 100,
      hostname: 'test-host',
      token: 'first',
      isProcessAlive: () => true,
    });

    await expect(
      acquireBrowserProfileLock(directory, {
        pid: 200,
        hostname: 'test-host',
        token: 'second',
        isProcessAlive: () => true,
      }),
    ).rejects.toMatchObject({ code: 'BROWSER_PROFILE_IN_USE' });

    await first.release();
    const second = await acquireBrowserProfileLock(directory, {
      pid: 200,
      hostname: 'test-host',
      token: 'second',
      isProcessAlive: () => true,
    });
    await second.release();
  });

  it('reclaims a stale same-host lock without allowing the old owner to delete the new one', async () => {
    const directory = await profileDirectory();
    const first = await acquireBrowserProfileLock(directory, {
      pid: 100,
      hostname: hostname(),
      token: 'first',
      isProcessAlive: () => true,
    });

    const second = await acquireBrowserProfileLock(directory, {
      pid: 200,
      hostname: hostname(),
      token: 'second',
      isProcessAlive: () => false,
    });

    await first.release();
    await expect(
      acquireBrowserProfileLock(directory, {
        pid: 300,
        hostname: hostname(),
        token: 'third',
        isProcessAlive: () => true,
      }),
    ).rejects.toMatchObject({ code: 'BROWSER_PROFILE_IN_USE' });

    await second.release();
  });

  it('fails closed for an unreadable or corrupt lock', async () => {
    const directory = await profileDirectory();
    await writeFile(join(directory, '.selector-toolkit-profile.lock'), 'not-json', 'utf8');

    await expect(acquireBrowserProfileLock(directory)).rejects.toMatchObject({
      code: 'BROWSER_PROFILE_IN_USE',
    });
  });
});
