export const sourceImportLockKeys = {
  "home-assistant": 7_405_001,
  plex: 7_405_002
} as const;

export type SourceSlug = keyof typeof sourceImportLockKeys;

export function getSourceImportLockKey(slug: SourceSlug) {
  return sourceImportLockKeys[slug];
}
