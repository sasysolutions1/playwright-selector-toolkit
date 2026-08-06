import type { FrameDocumentPayload, ResolvedDomCrawlOptions } from '../../types/dom.js';

/**
 * This function is serialized by Playwright and executed inside a frame. Keep it self-contained:
 * it must not close over module values or Node.js APIs.
 */
export function inspectFrameDocument(options: ResolvedDomCrawlOptions): FrameDocumentPayload {
  const interactiveRoles = new Set([
    'button',
    'link',
    'checkbox',
    'radio',
    'switch',
    'textbox',
    'searchbox',
    'combobox',
    'listbox',
    'option',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'tab',
    'slider',
    'spinbutton',
    'treeitem',
    'gridcell',
  ]);
  const inlineHandlers = [
    'onclick',
    'ondblclick',
    'onmousedown',
    'onmouseup',
    'onkeydown',
    'onkeyup',
    'onkeypress',
    'onchange',
    'oninput',
    'onsubmit',
  ];
  const safeAttributes = new Set([
    'id',
    'class',
    'name',
    'type',
    'role',
    'placeholder',
    'title',
    'alt',
    'href',
    'src',
    'target',
    'rel',
    'tabindex',
    'contenteditable',
    'autocomplete',
    'disabled',
    'readonly',
    'required',
    'checked',
    'selected',
    'multiple',
    'hidden',
  ]);
  const testAttributePattern = /^data-(?:testid|test-id|test|qa|cy)$/iu;
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
  const phonePattern = /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/gu;
  const ssnPattern = /\b\d{3}-\d{2}-\d{4}\b/gu;
  const cardPattern = /\b(?:\d[ -]*?){13,19}\b/gu;
  const jwtPattern =
    /\b(?:bearer\s+)?[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/giu;
  const secretPattern = /\b(?:sk|pk|api|token|secret)[-_][A-Za-z0-9_-]{16,}\b/giu;
  let inspectedElementCount = 0;
  let matchedElementCount = 0;
  let shadowRootCount = 0;
  let sequence = 0;
  let truncated = false;
  const elements: FrameDocumentPayload['elements'][number][] = [];

  function redact(value: string): { value: string; count: number } {
    if (!options.redact) return { value, count: 0 };
    let result = value;
    let count = 0;
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
        count += 1;
        return replacement;
      });
    }
    return { value: result, count };
  }

  function sanitizeUrl(value: string): { value: string; count: number } {
    if (!options.redact) return { value, count: 0 };
    try {
      const parsed = new URL(value, document.baseURI);
      const count = parsed.search !== '' || parsed.hash !== '' ? 1 : 0;
      parsed.search = '';
      parsed.hash = '';
      return { value: parsed.toString(), count };
    } catch {
      return redact(value);
    }
  }

  function normalizedText(value: string | null | undefined): string | null {
    if (value === null || value === undefined || options.textLimit === 0) return null;
    const normalized = value.replace(/\s+/gu, ' ').trim();
    if (normalized === '') return null;
    return normalized.slice(0, options.textLimit);
  }

  function directText(element: Element): string | null {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) return null;
    const text = element instanceof HTMLElement ? element.innerText : element.textContent;
    return normalizedText(text);
  }

  function labelText(element: Element): string | null {
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      const labels = element.labels;
      if (labels !== null && labels.length > 0) {
        return normalizedText(
          Array.from(labels)
            .map((label) => label.innerText)
            .join(' '),
        );
      }
    }
    return null;
  }

  function referencedText(element: Element, attributeName: string): string | null {
    const ids = element.getAttribute(attributeName)?.split(/\s+/u).filter(Boolean) ?? [];
    if (ids.length === 0) return null;
    return normalizedText(
      ids
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .filter(Boolean)
        .join(' '),
    );
  }

  function accessibleName(
    element: Element,
    label: string | null,
    text: string | null,
  ): string | null {
    return (
      normalizedText(element.getAttribute('aria-label')) ??
      referencedText(element, 'aria-labelledby') ??
      label ??
      normalizedText(element.getAttribute('alt')) ??
      normalizedText(element.getAttribute('title')) ??
      normalizedText(element.getAttribute('placeholder')) ??
      text
    );
  }

  function elementDescriptor(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const id = element.id === '' ? '' : `#${CSS.escape(element.id)}`;
    return redact(`${tag}${id}`).value;
  }

  function domPath(element: Element, root: Document | ShadowRoot): string {
    const segments: string[] = [];
    let current: Element | null = element;
    while (current !== null) {
      const tag = current.tagName.toLowerCase();
      if (current.id !== '') {
        segments.unshift(`${tag}#${CSS.escape(current.id)}`);
        break;
      }
      const parentElement: Element | null = current.parentElement;
      if (parentElement === null) {
        segments.unshift(tag);
        break;
      }
      const currentTagName = current.tagName;
      const siblings: Element[] = Array.from(parentElement.children).filter(
        (sibling: Element) => sibling.tagName === currentTagName,
      );
      const index = siblings.indexOf(current) + 1;
      segments.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag);
      if (parentElement.parentNode === root) {
        current = parentElement;
        continue;
      }
      current = parentElement;
    }
    return segments.join(' > ');
  }

  function visibility(element: Element) {
    if (!element.isConnected) {
      return { visible: false, reason: 'detached' as const, inViewport: false, boundingBox: null };
    }
    const htmlElement = element instanceof HTMLElement ? element : null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const boundingBox =
      rect.width === 0 && rect.height === 0
        ? null
        : { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    const inViewport =
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    if (htmlElement?.hidden === true) {
      return { visible: false, reason: 'hidden-attribute' as const, inViewport, boundingBox };
    }
    if (element.getAttribute('aria-hidden') === 'true') {
      return { visible: false, reason: 'aria-hidden' as const, inViewport, boundingBox };
    }
    if (style.display === 'none') {
      return { visible: false, reason: 'display-none' as const, inViewport, boundingBox };
    }
    if (style.visibility === 'hidden' || style.visibility === 'collapse') {
      return { visible: false, reason: 'visibility-hidden' as const, inViewport, boundingBox };
    }
    if (Number.parseFloat(style.opacity || '1') === 0) {
      return { visible: false, reason: 'opacity-zero' as const, inViewport, boundingBox };
    }
    if (rect.width === 0 || rect.height === 0) {
      return { visible: false, reason: 'zero-area' as const, inViewport, boundingBox };
    }
    return { visible: true, reason: 'visible' as const, inViewport, boundingBox };
  }

  function interactivity(element: Element, role: string | null) {
    const tag = element.tagName.toLowerCase();
    const sources: Array<
      | 'native-control'
      | 'anchor-href'
      | 'interactive-role'
      | 'contenteditable'
      | 'tabindex'
      | 'inline-handler'
    > = [];
    if (
      tag === 'button' ||
      tag === 'input' ||
      tag === 'select' ||
      tag === 'textarea' ||
      tag === 'summary'
    ) {
      sources.push('native-control');
    }
    if (tag === 'a' && element.hasAttribute('href')) sources.push('anchor-href');
    if (role !== null && interactiveRoles.has(role)) sources.push('interactive-role');
    if (element instanceof HTMLElement && element.isContentEditable)
      sources.push('contenteditable');
    const tabIndex = element instanceof HTMLElement ? element.tabIndex : -1;
    if (tabIndex >= 0) sources.push('tabindex');
    if (inlineHandlers.some((name) => element.hasAttribute(name))) sources.push('inline-handler');
    return { interactive: sources.length > 0, sources };
  }

  function kind(element: Element, role: string | null) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'button' || role === 'button') return 'button' as const;
    if ((tag === 'a' && element.hasAttribute('href')) || role === 'link') return 'link' as const;
    if (tag === 'textarea') return 'textarea' as const;
    if (tag === 'select' || role === 'combobox' || role === 'listbox') return 'select' as const;
    if (element instanceof HTMLInputElement) {
      if (element.type === 'password') return 'password-input' as const;
      if (element.type === 'checkbox') return 'checkbox' as const;
      if (element.type === 'radio') return 'radio' as const;
      if (element.type === 'hidden') return 'form-control' as const;
      return 'text-input' as const;
    }
    if (element instanceof HTMLElement && element.isContentEditable)
      return 'contenteditable' as const;
    if (tag === 'option' || role === 'option') return 'form-control' as const;
    if (role !== null && interactiveRoles.has(role)) return 'interactive' as const;
    return 'element' as const;
  }

  function sensitive(element: Element): boolean {
    const type = element.getAttribute('type')?.toLowerCase();
    const autocomplete = element.getAttribute('autocomplete')?.toLowerCase() ?? '';
    const name = element.getAttribute('name')?.toLowerCase() ?? '';
    return (
      type === 'password' ||
      /password|one-time-code|cc-number|cc-csc|current-password|new-password/u.test(autocomplete) ||
      /password|passwd|secret|token|credit|card|ssn|social-security/u.test(name)
    );
  }

  function safeAttributeMap(element: Element): {
    attributes: Record<string, string>;
    count: number;
  } {
    const attributes: Record<string, string> = {};
    let count = 0;
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      if (
        !safeAttributes.has(name) &&
        !name.startsWith('aria-') &&
        !testAttributePattern.test(name)
      ) {
        continue;
      }
      let transformed: { value: string; count: number };
      if (name === 'href' || name === 'src') transformed = sanitizeUrl(attribute.value);
      else transformed = redact(attribute.value);
      attributes[name] = transformed.value.slice(0, 500);
      count += transformed.count;
    }
    return { attributes, count };
  }

  function visitRoot(root: Document | ShadowRoot, shadowPath: readonly string[]): void {
    const children = root instanceof Document ? [root.documentElement] : Array.from(root.children);
    for (const child of children) {
      if (child !== null) visitElement(child, root, shadowPath);
      if (truncated) return;
    }
  }

  function visitElement(
    element: Element,
    root: Document | ShadowRoot,
    shadowPath: readonly string[],
  ): void {
    if (truncated) return;
    inspectedElementCount += 1;
    const role = normalizedText(element.getAttribute('role'))?.toLowerCase() ?? null;
    const interaction = interactivity(element, role);
    const elementVisibility = visibility(element);
    const matchesScope = options.scope === 'all' || interaction.interactive;
    const matchesVisibility = options.includeHidden || elementVisibility.visible;

    if (matchesScope && matchesVisibility) {
      if (elements.length >= options.maxElements) {
        truncated = true;
        return;
      }
      const rawText = directText(element);
      const rawLabel = labelText(element);
      const rawAccessibleName = accessibleName(element, rawLabel, rawText);
      const textResult = rawText === null ? null : redact(rawText);
      const labelResult = rawLabel === null ? null : redact(rawLabel);
      const nameResult = rawAccessibleName === null ? null : redact(rawAccessibleName);
      const placeholderValue = normalizedText(element.getAttribute('placeholder'));
      const placeholderResult = placeholderValue === null ? null : redact(placeholderValue);
      const attributeResult = safeAttributeMap(element);
      const domPathResult = redact(domPath(element, root));
      const redactionsApplied =
        (textResult?.count ?? 0) +
        (labelResult?.count ?? 0) +
        (nameResult?.count ?? 0) +
        (placeholderResult?.count ?? 0) +
        attributeResult.count +
        domPathResult.count;
      sequence += 1;
      matchedElementCount += 1;
      elements.push({
        id: `element-${String(sequence).padStart(6, '0')}`,
        shadowPath,
        domPath: domPathResult.value,
        tagName: element.tagName.toLowerCase(),
        kind: kind(element, role),
        role,
        accessibleName: nameResult?.value ?? null,
        text: textResult?.value ?? null,
        label: labelResult?.value ?? null,
        placeholder: placeholderResult?.value ?? null,
        attributes: attributeResult.attributes,
        visibility: elementVisibility,
        interactive: interaction.interactive,
        interactivitySources: interaction.sources,
        disabled:
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement) &&
          element.disabled,
        readonly:
          (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) &&
          element.readOnly,
        required:
          (element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement) &&
          element.required,
        checked: element instanceof HTMLInputElement ? element.checked : null,
        selected: element instanceof HTMLOptionElement ? element.selected : null,
        sensitive: sensitive(element),
        redactionsApplied,
      });
    }

    if (element.shadowRoot !== null) {
      shadowRootCount += 1;
      visitRoot(element.shadowRoot, [...shadowPath, elementDescriptor(element)]);
      if (truncated) return;
    }

    for (const child of Array.from(element.children)) {
      visitElement(child, root, shadowPath);
      if (truncated) return;
    }
  }

  visitRoot(document, []);

  return {
    title: document.title,
    language: document.documentElement.lang || null,
    readyState: document.readyState,
    shadowRootCount,
    inspectedElementCount,
    matchedElementCount,
    truncated,
    elements,
  };
}
