import type { ToolkitConfig } from '../../types/config.js';
import type {
  BaselineSaveReport,
  SnapshotBundleOptions,
  SnapshotBundleReport,
} from '../../types/snapshot.js';
import { captureSnapshotBundle } from '../snapshot/bundle.js';
import { saveBaseline } from './store.js';

export interface CaptureBaselineDependencies {
  readonly capture?: (
    config: ToolkitConfig,
    url: string,
    options?: SnapshotBundleOptions,
  ) => Promise<SnapshotBundleReport>;
  readonly save?: typeof saveBaseline;
}

export async function captureBaseline(
  config: ToolkitConfig,
  name: string,
  url: string,
  options: SnapshotBundleOptions = {},
  dependencies: CaptureBaselineDependencies = {},
): Promise<BaselineSaveReport> {
  const snapshot = await (dependencies.capture ?? captureSnapshotBundle)(config, url, {
    ...options,
    command: options.command ?? 'baseline-save',
    name: options.name ?? name,
  });
  const baseline = await (dependencies.save ?? saveBaseline)(config, name, snapshot);
  return { snapshot, baseline };
}
