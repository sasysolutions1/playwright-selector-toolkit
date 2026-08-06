export interface ArtifactRunDirectories {
  readonly root: string;
  readonly run: string;
  readonly screenshots: string;
  readonly snapshots: string;
  readonly traces: string;
  readonly reports: string;
}

export interface ArtifactRun {
  readonly id: string;
  readonly command: string;
  readonly name?: string;
  readonly createdAt: string;
  readonly directories: ArtifactRunDirectories;
  readonly metadataPath: string;
}

export interface CreateArtifactRunOptions {
  readonly command: string;
  readonly name?: string;
  readonly now?: Date;
  readonly id?: string;
}
