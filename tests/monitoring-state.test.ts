import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createEmptyMonitorState,
  loadMonitorState,
  saveMonitorState,
} from '../src/core/monitoring/state.js';

describe('monitor state store', () => {
  it('returns an empty state when no state file exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-state-'));
    const state = await loadMonitorState(join(root, 'state.json'), 'Health');
    expect(state).toMatchObject({ schemaVersion: '1.0', monitorName: 'Health', targets: {} });
  });

  it('writes state atomically with owner-only file permissions and loads it again', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-state-'));
    const path = join(root, 'nested/state.json');
    const state = createEmptyMonitorState('Health', new Date('2026-07-18T00:00:00.000Z'));
    await saveMonitorState(path, state);
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ monitorName: 'Health' });
    expect(await loadMonitorState(path, 'Health')).toEqual(state);
  });

  it('rejects state belonging to another monitor', async () => {
    const root = await mkdtemp(join(tmpdir(), 'selector-monitor-state-'));
    const path = join(root, 'state.json');
    await saveMonitorState(path, createEmptyMonitorState('One'));
    await expect(loadMonitorState(path, 'Two')).rejects.toMatchObject({
      code: 'MONITOR_STATE_READ_FAILED',
    });
  });
});
