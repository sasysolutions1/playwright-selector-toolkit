import { describe, expect, it } from 'vitest';
import {
  serializePlaywrightLocator,
  serializeRelativeLocator,
} from '../src/core/locator/serializer.js';

describe('locator serialization', () => {
  it('serializes semantic Playwright locators', () => {
    expect(
      serializeRelativeLocator({ type: 'role', role: 'button', name: 'Save', exact: true }),
    ).toBe('getByRole("button", { name: "Save", exact: true })');
    expect(serializeRelativeLocator({ type: 'label', value: 'Email', exact: true })).toBe(
      'getByLabel("Email", { exact: true })',
    );
  });

  it('serializes custom test IDs and XPath', () => {
    expect(
      serializeRelativeLocator({ type: 'test-id', attribute: 'data-qa', value: 'save' }),
    ).toContain('locator(');
    expect(serializeRelativeLocator({ type: 'xpath', selector: '//button' })).toContain(
      'xpath=//button',
    );
  });

  it('uses page for main and frame for children', () => {
    const spec = { type: 'css' as const, selector: '#save' };
    expect(serializePlaywrightLocator(spec, 'main')).toBe('page.locator("#save")');
    expect(serializePlaywrightLocator(spec, 'main/frame[0]:child')).toBe('frame.locator("#save")');
  });
});
