import type { DomElementSnapshot } from '../../types/dom.js';

const STABLE_ATTRIBUTES = [
  'id',
  'name',
  'type',
  'role',
  'data-testid',
  'data-test-id',
  'data-test',
  'data-qa',
  'data-cy',
  'aria-label',
  'aria-labelledby',
] as const;

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/gu, ' ');
}

function tokenSimilarity(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  const a = normalize(left);
  const b = normalize(right);
  if (a === '' && b === '') return 1;
  if (a === b) return 1;
  if (a === '' || b === '') return 0;
  const leftTokens = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const rightTokens = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

function stableAttributeSimilarity(left: DomElementSnapshot, right: DomElementSnapshot): number {
  const leftEntries = STABLE_ATTRIBUTES.flatMap((name) => {
    const value = left.attributes[name];
    return value === undefined || value === '' ? [] : [`${name}=${normalize(value)}`];
  });
  const rightEntries = new Set(
    STABLE_ATTRIBUTES.flatMap((name) => {
      const value = right.attributes[name];
      return value === undefined || value === '' ? [] : [`${name}=${normalize(value)}`];
    }),
  );
  if (leftEntries.length === 0 && rightEntries.size === 0) return 1;
  const union = new Set([...leftEntries, ...rightEntries]);
  const intersection = leftEntries.filter((entry) => rightEntries.has(entry)).length;
  return union.size === 0 ? 0 : intersection / union.size;
}

export function elementSimilarity(left: DomElementSnapshot, right: DomElementSnapshot): number {
  if (left.tagName !== right.tagName && left.kind !== right.kind) return 0;
  const components: readonly [number, number][] = [
    [left.tagName === right.tagName ? 1 : 0, 0.12],
    [left.kind === right.kind ? 1 : 0, 0.15],
    [normalize(left.role) === normalize(right.role) ? 1 : 0, 0.09],
    [tokenSimilarity(left.accessibleName, right.accessibleName), 0.2],
    [tokenSimilarity(left.label, right.label), 0.12],
    [tokenSimilarity(left.placeholder, right.placeholder), 0.07],
    [tokenSimilarity(left.text, right.text), 0.08],
    [stableAttributeSimilarity(left, right), 0.12],
    [left.framePath === right.framePath ? 1 : 0, 0.025],
    [JSON.stringify(left.shadowPath) === JSON.stringify(right.shadowPath) ? 1 : 0, 0.015],
  ];
  const score = components.reduce((total, [value, weight]) => total + value * weight, 0);
  return Math.max(0, Math.min(1, Number(score.toFixed(4))));
}
