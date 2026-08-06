import type { FrameHtmlPayload, ResolvedSanitizedHtmlOptions } from '../../types/snapshot.js';

/**
 * Serialized by Playwright and executed inside a frame. Keep this function self-contained.
 */
export function serializeSanitizedFrameHtml(
  options: ResolvedSanitizedHtmlOptions,
): FrameHtmlPayload {
  const omittedTags = new Set(['script', 'noscript']);
  if (!options.includeStyles) omittedTags.add('style');

  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
  const phonePattern = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gu;
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/gu;
  const cardPattern = /\b(?:\d[ -]*?){13,19}\b/gu;
  const jwtPattern =
    /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/giu;
  const secretPattern = /\b(?:sk|pk|api|token|secret)[-_][A-Za-z0-9_-]{16,}\b/giu;
  const sensitiveAttributeNames = new Set([
    'value',
    'srcdoc',
    'nonce',
    'integrity',
    'password',
    'data-token',
    'data-secret',
    'data-password',
  ]);
  const urlAttributeNames = new Set(['href', 'src', 'action', 'formaction', 'poster', 'cite']);
  const booleanAttributes = new Set([
    'checked',
    'disabled',
    'hidden',
    'multiple',
    'readonly',
    'required',
    'selected',
  ]);

  let visitedNodeCount = 0;
  let serializedElementCount = 0;
  let shadowRootCount = 0;
  let omittedNodeCount = 0;
  let omittedAttributeCount = 0;
  let redactionCount = 0;

  function escapeText(value: string): string {
    return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;');
  }

  function escapeAttribute(value: string): string {
    return escapeText(value).replace(/"/gu, '&quot;');
  }

  function redact(value: string): string {
    if (!options.redact) return value;
    let result = value;
    const replacements: readonly [RegExp, string][] = [
      [emailPattern, '[REDACTED_EMAIL]'],
      [phonePattern, '[REDACTED_PHONE]'],
      [ssnPattern, '[REDACTED_SSN]'],
      [cardPattern, '[REDACTED_PAYMENT_CARD]'],
      [jwtPattern, '[REDACTED_TOKEN]'],
      [secretPattern, '[REDACTED_SECRET]'],
    ];
    for (const [pattern, replacement] of replacements) {
      pattern.lastIndex = 0;
      result = result.replace(pattern, () => {
        redactionCount += 1;
        return replacement;
      });
    }
    return result;
  }

  function sanitizeUrl(value: string): string {
    if (!options.redact) return value;
    try {
      const parsed = new URL(value, document.baseURI);
      if (parsed.search !== '' || parsed.hash !== '') redactionCount += 1;
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return redact(value);
    }
  }

  function normalizedText(value: string): string {
    return value.replace(/\s+/gu, ' ').trim();
  }

  function serializeAttributes(element: Element): string {
    const attributes = Array.from(element.attributes)
      .filter((attribute) => {
        const name = attribute.name.toLowerCase();
        if (name.startsWith('on')) {
          omittedAttributeCount += 1;
          return false;
        }
        if (sensitiveAttributeNames.has(name)) {
          omittedAttributeCount += 1;
          return false;
        }
        return true;
      })
      .map((attribute) => {
        const name = attribute.name.toLowerCase();
        let value = attribute.value;
        if (urlAttributeNames.has(name)) value = sanitizeUrl(value);
        else value = redact(value);
        if (booleanAttributes.has(name) && value === '') return name;
        return `${name}="${escapeAttribute(value)}"`;
      })
      .sort((left, right) => left.localeCompare(right));
    return attributes.length === 0 ? '' : ` ${attributes.join(' ')}`;
  }

  function serializeNode(node: Node): string {
    visitedNodeCount += 1;

    if (node.nodeType === Node.TEXT_NODE) {
      const parent = node.parentElement;
      if (
        parent instanceof HTMLInputElement ||
        parent instanceof HTMLTextAreaElement ||
        parent?.getAttribute('contenteditable') === 'true'
      ) {
        omittedNodeCount += 1;
        return '';
      }
      const text = normalizedText(node.textContent ?? '');
      return text === '' ? '' : escapeText(redact(text));
    }

    if (node.nodeType === Node.COMMENT_NODE) {
      omittedNodeCount += 1;
      return '';
    }

    if (!(node instanceof Element)) {
      omittedNodeCount += 1;
      return '';
    }

    const tagName = node.tagName.toLowerCase();
    if (omittedTags.has(tagName)) {
      omittedNodeCount += 1;
      return '';
    }

    serializedElementCount += 1;
    const attributes = serializeAttributes(node);
    const voidTags = new Set([
      'area',
      'base',
      'br',
      'col',
      'embed',
      'hr',
      'img',
      'input',
      'link',
      'meta',
      'param',
      'source',
      'track',
      'wbr',
    ]);

    if (voidTags.has(tagName)) return `<${tagName}${attributes}>`;

    const children: string[] = [];
    if (!(node instanceof HTMLTextAreaElement)) {
      for (const child of Array.from(node.childNodes)) children.push(serializeNode(child));
    } else {
      omittedNodeCount += node.childNodes.length;
    }

    if (node.shadowRoot !== null && node.shadowRoot.mode === 'open') {
      shadowRootCount += 1;
      const shadowChildren = Array.from(node.shadowRoot.childNodes)
        .map((child) => serializeNode(child))
        .join('');
      children.push(
        `<template data-selector-toolkit-shadow-root="open">${shadowChildren}</template>`,
      );
    }

    return `<${tagName}${attributes}>${children.join('')}</${tagName}>`;
  }

  const documentElement = document.documentElement;
  let html = documentElement === null ? '' : `<!doctype html>\n${serializeNode(documentElement)}`;
  let truncated = false;
  if (html.length > options.maxFrameCharacters) {
    html = `${html.slice(0, options.maxFrameCharacters)}\n<!-- selector-toolkit: truncated -->`;
    truncated = true;
  }

  return {
    title: redact(document.title),
    html,
    stats: {
      visitedNodeCount,
      serializedElementCount,
      shadowRootCount,
      omittedNodeCount,
      omittedAttributeCount,
      redactionCount,
      truncated,
    },
  };
}
