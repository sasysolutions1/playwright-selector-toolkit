import { describe, expect, it } from 'vitest';
import { selectorManifestSchema } from '../src/core/validation/schema.js';

describe('selector manifest schema', () => {
  it('applies safe defaults', () => {
    const result = selectorManifestSchema.parse({
      schemaVersion: '1.0',
      selectors: [{ id: 'save', locator: { type: 'role', role: 'button', name: 'Save' } }],
    });
    expect(result).toMatchObject({
      name: 'Selector validation manifest',
      waitUntil: 'domcontentloaded',
      selectors: [
        {
          id: 'save',
          name: 'save',
          required: true,
          framePath: 'main',
          assertions: { count: 1 },
          locator: { type: 'role', role: 'button', name: 'Save', exact: true },
        },
      ],
    });
  });

  it('supports count ranges and state assertions', () => {
    const result = selectorManifestSchema.parse({
      schemaVersion: '1.0',
      selectors: [
        {
          id: 'items',
          required: false,
          locator: { type: 'css', selector: '.item' },
          assertions: { count: { min: 1, max: 4 }, visible: 'all', enabled: 'any' },
        },
      ],
    });
    expect(result.selectors[0]?.assertions).toEqual({
      count: { min: 1, max: 4 },
      visible: 'all',
      enabled: 'any',
    });
  });

  it('rejects duplicate IDs', () => {
    const result = selectorManifestSchema.safeParse({
      schemaVersion: '1.0',
      selectors: [
        { id: 'same', locator: { type: 'css', selector: '#one' } },
        { id: 'same', locator: { type: 'css', selector: '#two' } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid count range', () => {
    const result = selectorManifestSchema.safeParse({
      schemaVersion: '1.0',
      selectors: [
        {
          id: 'bad',
          locator: { type: 'css', selector: '.bad' },
          assertions: { count: { min: 4, max: 2 } },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
