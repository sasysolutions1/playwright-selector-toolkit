import { describe, expect, it } from 'vitest';
import {
  domPathToXPath,
  escapeCssIdentifier,
  quoteCssAttribute,
  quoteJavaScript,
  quoteXPath,
} from '../src/core/locator/escaping.js';

describe('locator escaping', () => {
  it('quotes JavaScript, CSS attributes, and XPath strings', () => {
    expect(quoteJavaScript('Save "now"')).toBe('"Save \\"now\\""');
    expect(quoteCssAttribute('a"b')).toBe('"a\\"b"');
    expect(quoteXPath("a'b")).toBe('"a\'b"');
    expect(quoteXPath('a\'b"c')).toContain('concat(');
  });

  it('escapes CSS identifiers without browser globals', () => {
    expect(escapeCssIdentifier('save-button')).toBe('save-button');
    expect(escapeCssIdentifier('123')).toBe('\\31 23');
    expect(escapeCssIdentifier('a:b')).toBe('a\\3a b');
  });

  it('converts structural DOM paths to XPath', () => {
    expect(domPathToXPath('html > body > button:nth-of-type(2)')).toBe('/html/body/button[2]');
    expect(domPathToXPath('button#save')).toBe("//*[@id='save']");
    expect(domPathToXPath('button[data-x]')).toBeNull();
  });
});
