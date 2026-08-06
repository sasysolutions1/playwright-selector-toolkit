import { describe, expect, it } from 'vitest';
import { getToolkitVersion } from '../src/core/version.js';

describe('getToolkitVersion', () => {
  it('reads the package version', () => {
    expect(getToolkitVersion()).toBe('0.18.0');
  });
});
