import { createHash } from 'node:crypto';
import type { DomElementSnapshot, DomSnapshot } from '../../types/dom.js';
import type {
  ElementFingerprintIndex,
  ElementFingerprintRecord,
  ElementFingerprintSummary,
} from '../../types/snapshot.js';
import { getToolkitVersion } from '../version.js';

const STABLE_ATTRIBUTE_NAMES = [
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

function sortedObject(value: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function stableAttributes(element: DomElementSnapshot): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const name of STABLE_ATTRIBUTE_NAMES) {
    const value = element.attributes[name];
    if (value !== undefined && value !== '') result[name] = value;
  }
  return sortedObject(result);
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function semanticFingerprintPayload(element: DomElementSnapshot): unknown {
  return {
    version: '1.0',
    tagName: element.tagName,
    kind: element.kind,
    role: element.role,
    accessibleName: element.accessibleName,
    label: element.label,
    placeholder: element.placeholder,
    attributes: stableAttributes(element),
    interactive: element.interactive,
    interactivitySources: [...element.interactivitySources].sort(),
    sensitive: element.sensitive,
  };
}

export function structuralFingerprintPayload(element: DomElementSnapshot): unknown {
  return {
    version: '1.0',
    framePath: element.framePath,
    shadowPath: element.shadowPath,
    domPath: element.domPath,
    tagName: element.tagName,
    attributes: stableAttributes(element),
  };
}

export function semanticElementFingerprint(element: DomElementSnapshot): string {
  return hash(semanticFingerprintPayload(element));
}

export function structuralElementFingerprint(element: DomElementSnapshot): string {
  return hash(structuralFingerprintPayload(element));
}

export function summarizeElementFingerprints(
  records: readonly ElementFingerprintRecord[],
): ElementFingerprintSummary {
  const semanticCounts = new Map<string, number>();
  const structuralHashes = new Set<string>();
  for (const record of records) {
    semanticCounts.set(record.semanticHash, (semanticCounts.get(record.semanticHash) ?? 0) + 1);
    structuralHashes.add(record.structuralHash);
  }
  return {
    elementCount: records.length,
    uniqueSemanticHashCount: semanticCounts.size,
    duplicateSemanticGroupCount: [...semanticCounts.values()].filter((count) => count > 1).length,
    uniqueStructuralHashCount: structuralHashes.size,
  };
}

export function createElementFingerprintIndex(
  snapshot: DomSnapshot,
  options: { readonly now?: Date; readonly toolkitVersion?: string } = {},
): ElementFingerprintIndex {
  const ordinals = new Map<string, number>();
  const records: ElementFingerprintRecord[] = [];

  for (const frame of snapshot.frames) {
    for (const element of frame.elements) {
      const semanticHash = semanticElementFingerprint(element);
      const semanticOrdinal = (ordinals.get(semanticHash) ?? 0) + 1;
      ordinals.set(semanticHash, semanticOrdinal);
      records.push({
        elementId: element.id,
        framePath: element.framePath,
        shadowPath: element.shadowPath,
        domPath: element.domPath,
        tagName: element.tagName,
        role: element.role,
        accessibleName: element.accessibleName,
        kind: element.kind,
        semanticHash,
        structuralHash: structuralElementFingerprint(element),
        semanticOrdinal,
      });
    }
  }

  return {
    schemaVersion: '1.0',
    toolkitVersion: options.toolkitVersion ?? getToolkitVersion(),
    generatedAt: (options.now ?? new Date()).toISOString(),
    algorithm: 'sha256',
    sourceSnapshotSchemaVersion: snapshot.schemaVersion,
    summary: summarizeElementFingerprints(records),
    records,
  };
}
