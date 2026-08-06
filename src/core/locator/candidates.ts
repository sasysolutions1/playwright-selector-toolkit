import type { DomElementSnapshot, DomSnapshot } from '../../types/dom.js';
import type {
  ElementLocatorCandidates,
  LocatorCandidate,
  LocatorGenerationOptions,
  LocatorSpec,
  LocatorStrategy,
  ResolvedLocatorGenerationOptions,
} from '../../types/locator.js';
import { domPathToXPath, escapeCssIdentifier, quoteCssAttribute, quoteXPath } from './escaping.js';
import { resolveLocatorGenerationOptions } from './options.js';
import { serializePlaywrightLocator, serializeRelativeLocator } from './serializer.js';

const REDACTION_MARKER = /\[REDACTED_[A-Z_]+\]/u;

function usable(value: string | null | undefined, maxLength = 200): value is string {
  return (
    value !== null &&
    value !== undefined &&
    value.trim() !== '' &&
    value.length <= maxLength &&
    !REDACTION_MARKER.test(value)
  );
}

function implicitRole(element: DomElementSnapshot): string | null {
  if (element.role !== null) return element.role;
  switch (element.kind) {
    case 'button':
      return 'button';
    case 'link':
      return 'link';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'text-input':
    case 'password-input':
    case 'textarea':
    case 'contenteditable':
      return 'textbox';
    case 'select':
      return element.attributes.multiple === undefined ? 'combobox' : 'listbox';
    default:
      return null;
  }
}

interface DraftCandidate {
  readonly strategy: LocatorStrategy;
  readonly priority: number;
  readonly spec: LocatorSpec;
  readonly rationale: string;
  readonly warnings?: readonly string[];
  readonly sourcePlugin?: string;
  readonly sourceHook?: string;
}

function strategyForSpec(spec: LocatorSpec): LocatorStrategy {
  switch (spec.type) {
    case 'role':
      return 'role';
    case 'label':
      return 'label';
    case 'placeholder':
      return 'placeholder';
    case 'test-id':
      return 'test-id';
    case 'text':
      return 'text';
    case 'attribute':
      return 'attribute';
    case 'css':
      return 'css';
    case 'xpath':
      return 'xpath';
  }
}

function draftCandidates(
  element: DomElementSnapshot,
  options: ResolvedLocatorGenerationOptions & Pick<LocatorGenerationOptions, 'pluginHost'>,
): DraftCandidate[] {
  const drafts: DraftCandidate[] = [];
  const role = implicitRole(element);

  if (role !== null && usable(element.accessibleName)) {
    drafts.push({
      strategy: 'role',
      priority: 10,
      spec: { type: 'role', role, name: element.accessibleName, exact: true },
      rationale: 'Uses the element role and accessible name, matching user-visible semantics.',
    });
  } else if (role !== null && options.includeRoleWithoutName) {
    drafts.push({
      strategy: 'role',
      priority: 45,
      spec: { type: 'role', role, exact: true },
      rationale:
        'Uses the element role without a name because no safe accessible name was captured.',
      warnings: ['Role-only locators are frequently ambiguous.'],
    });
  }

  if (usable(element.label)) {
    drafts.push({
      strategy: 'label',
      priority: 12,
      spec: { type: 'label', value: element.label, exact: true },
      rationale: 'Uses the associated form label.',
    });
  }

  if (usable(element.placeholder)) {
    drafts.push({
      strategy: 'placeholder',
      priority: 25,
      spec: { type: 'placeholder', value: element.placeholder, exact: true },
      rationale: 'Uses visible placeholder text.',
      warnings: ['Placeholder text may change during copy revisions or localization.'],
    });
  }

  for (const [index, attribute] of options.testIdAttributes.entries()) {
    const value = element.attributes[attribute];
    if (!usable(value, 300)) continue;
    drafts.push({
      strategy: 'test-id',
      priority: 15 + index,
      spec: { type: 'test-id', attribute, value },
      rationale: `Uses the explicit ${attribute} testing hook.`,
    });
  }

  if (usable(element.text, 160) && element.tagName !== 'input' && element.tagName !== 'textarea') {
    drafts.push({
      strategy: 'text',
      priority: 30,
      spec: { type: 'text', value: element.text, exact: true },
      rationale: 'Uses exact visible text.',
      warnings: ['Visible text can change with content edits or localization.'],
    });
  }

  const id = element.attributes.id;
  if (usable(id, 300)) {
    const generated = /^(?:ember|react|vue|mui|radix|headlessui|auto|generated)[-_]?\d+/iu.test(id);
    drafts.push({
      strategy: 'css',
      priority: 20,
      spec: { type: 'css', selector: `#${escapeCssIdentifier(id)}` },
      rationale: 'Uses the element id as a CSS selector.',
      warnings: generated ? ['The id appears generated and may be unstable.'] : [],
    });
  }

  const stableAttributeNames = ['name', 'aria-label', 'title', 'alt'] as const;
  for (const [index, attribute] of stableAttributeNames.entries()) {
    const value = element.attributes[attribute];
    if (!usable(value, 300)) continue;
    drafts.push({
      strategy: 'attribute',
      priority: 35 + index,
      spec: {
        type: 'attribute',
        selector: `${element.tagName}[${attribute}=${quoteCssAttribute(value)}]`,
      },
      rationale: `Uses the ${attribute} attribute with the element tag.`,
      warnings:
        attribute === 'title' || attribute === 'alt'
          ? ['User-facing copy attributes may change.']
          : [],
    });
  }

  const type = element.attributes.type;
  if (usable(type, 80) && ['input', 'button'].includes(element.tagName)) {
    drafts.push({
      strategy: 'attribute',
      priority: 55,
      spec: {
        type: 'attribute',
        selector: `${element.tagName}[type=${quoteCssAttribute(type)}]`,
      },
      rationale: 'Uses the native element type as a broad fallback.',
      warnings: ['Type-only selectors are frequently ambiguous.'],
    });
  }

  if (usable(element.domPath, 1000)) {
    drafts.push({
      strategy: 'css',
      priority: 80,
      spec: { type: 'css', selector: element.domPath },
      rationale: 'Uses the structural DOM path captured by the crawler.',
      warnings: ['Structural CSS paths are brittle when page layout changes.'],
    });
  }

  if (options.includeXPath && element.shadowPath.length === 0) {
    if (usable(id, 300)) {
      drafts.push({
        strategy: 'xpath',
        priority: 85,
        spec: { type: 'xpath', selector: `//*[@id=${quoteXPath(id)}]` },
        rationale: 'Uses an XPath id fallback.',
        warnings: ['Prefer user-facing or test-id locators over XPath.'],
      });
    }
    const xpath = domPathToXPath(element.domPath);
    if (xpath !== null) {
      drafts.push({
        strategy: 'xpath',
        priority: 95,
        spec: { type: 'xpath', selector: xpath },
        rationale: 'Uses a structural XPath fallback.',
        warnings: ['Structural XPath is brittle and does not pierce shadow roots.'],
      });
    }
  }

  for (const generated of options.pluginHost?.generateLocatorCandidates(element, options) ?? []) {
    drafts.push({
      strategy: strategyForSpec(generated.spec),
      priority: generated.priority ?? 18,
      spec: generated.spec,
      rationale: generated.rationale,
      warnings: generated.warnings ?? [],
      sourcePlugin: generated.pluginName,
      sourceHook: generated.generatorId,
    });
  }

  return drafts;
}

function deduplicate(drafts: readonly DraftCandidate[]): DraftCandidate[] {
  const seen = new Set<string>();
  const result: DraftCandidate[] = [];
  for (const draft of [...drafts].sort((left, right) => left.priority - right.priority)) {
    const key = `${draft.strategy}:${JSON.stringify(draft.spec)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(draft);
  }
  return result;
}

function toCandidate(
  element: DomElementSnapshot,
  draft: DraftCandidate,
  index: number,
): LocatorCandidate {
  return {
    id: `${element.id}-candidate-${String(index + 1).padStart(2, '0')}`,
    elementId: element.id,
    framePath: element.framePath,
    shadowPath: element.shadowPath,
    strategy: draft.strategy,
    priority: draft.priority,
    spec: draft.spec,
    playwright: serializePlaywrightLocator(draft.spec, element.framePath),
    relativePlaywright: serializeRelativeLocator(draft.spec),
    rationale: draft.rationale,
    warnings: draft.warnings ?? [],
    evaluation: {
      status: 'not-tested',
      count: null,
      visibleCount: null,
      enabledCount: null,
      durationMs: null,
      error: null,
    },
    stability: null,
    ...(draft.sourcePlugin === undefined ? {} : { sourcePlugin: draft.sourcePlugin }),
    ...(draft.sourceHook === undefined ? {} : { sourceHook: draft.sourceHook }),
  };
}

export function generateElementLocatorCandidates(
  element: DomElementSnapshot,
  options: LocatorGenerationOptions = {},
): ElementLocatorCandidates {
  const resolved = resolveLocatorGenerationOptions(options);
  const pluginAwareOptions = {
    ...resolved,
    ...(options.pluginHost === undefined ? {} : { pluginHost: options.pluginHost }),
  };
  const candidates = deduplicate(draftCandidates(element, pluginAwareOptions))
    .slice(0, resolved.maxCandidatesPerElement)
    .map((draft, index) => toCandidate(element, draft, index));

  return {
    element: {
      id: element.id,
      framePath: element.framePath,
      shadowPath: element.shadowPath,
      domPath: element.domPath,
      tagName: element.tagName,
      kind: element.kind,
      role: element.role,
      accessibleName: element.accessibleName,
      text: element.text,
      label: element.label,
      placeholder: element.placeholder,
      attributes: element.attributes,
      visibility: element.visibility,
      sensitive: element.sensitive,
    },
    candidates,
    recommendedCandidateId: null,
  };
}

export function generateLocatorCandidates(
  snapshot: DomSnapshot,
  options: LocatorGenerationOptions = {},
): readonly ElementLocatorCandidates[] {
  return snapshot.frames.flatMap((frame) =>
    frame.elements.map((element) => generateElementLocatorCandidates(element, options)),
  );
}
