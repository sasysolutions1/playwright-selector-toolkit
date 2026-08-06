import { describe, expect, it } from 'vitest';
import { definePlugin, validatePluginDefinition } from '../src/core/plugins/definition.js';
import { PluginError } from '../src/errors/toolkit-error.js';

const valid = {
  apiVersion: '1' as const,
  name: 'example-plugin',
  version: '1.0.0',
  authentication: [{ id: 'login', run: () => undefined }],
};

describe('plugin definitions', () => {
  it('accepts a valid typed plugin', () => {
    expect(definePlugin(valid)).toBe(valid);
  });

  it('rejects unsupported API versions', () => {
    try {
      validatePluginDefinition({ ...valid, apiVersion: '2' });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as PluginError).code).toBe('PLUGIN_API_UNSUPPORTED');
    }
  });

  it('rejects duplicate hook identifiers', () => {
    try {
      validatePluginDefinition({
        ...valid,
        authentication: [
          { id: 'login', run: () => undefined },
          { id: 'login', run: () => undefined },
        ],
      });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PluginError);
      expect((error as PluginError).code).toBe('PLUGIN_INVALID');
    }
  });
});
