import type { Draft, DraftPatch } from './draft.schema.js';

// Applies a flow/patchDraft-style partial update: contents are upserted by
// oid (keeping their position), coordinates are merged by oid.
export function mergeDraft(current: Draft | null, patch: DraftPatch): Draft {
  const base: Draft = current ?? {
    rootContent: patch.rootContent ?? '',
    contents: [],
    coordinates: {},
  };

  const contents = [...base.contents];
  for (const incoming of patch.contents ?? []) {
    const index = contents.findIndex((content) => content.oid === incoming.oid);
    if (index === -1) contents.push(incoming);
    else contents[index] = incoming;
  }

  return {
    rootContent: patch.rootContent ?? base.rootContent,
    contents,
    coordinates: { ...base.coordinates, ...patch.coordinates },
  };
}
