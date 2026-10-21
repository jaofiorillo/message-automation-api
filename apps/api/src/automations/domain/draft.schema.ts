import { z } from 'zod';

// Shape of the editor state, modelled after ManyChat's flow/setDraft batch.
// Drafts are allowed to be incomplete; graph rules are checked on publish
// (see publish-validation.ts).

const oid = z.string().trim().min(1).max(64);

const contentButton = z.object({
  oid,
  caption: z.string().max(20),
  action: z.literal('content'),
  targetOid: oid.optional(),
});

const urlButton = z.object({
  oid,
  caption: z.string().max(20),
  action: z.literal('url'),
  url: z.url({ protocol: /^https?$/ }),
});

const button = z.discriminatedUnion('action', [contentButton, urlButton]);

const message = z.object({
  oid,
  type: z.literal('text'),
  text: z.string().max(1000),
  buttons: z.array(button).max(3).default([]),
});

const content = z.object({
  oid,
  type: z.literal('message'),
  caption: z.string().max(100).default(''),
  messages: z.array(message).max(10),
  targetOid: oid.nullable().default(null),
  removed: z.boolean().default(false),
});

const coordinates = z
  .record(oid, z.object({ x: z.number(), y: z.number() }))
  .refine((value) => Object.keys(value).length <= 500, {
    message: 'Too many coordinates',
  });

const contents = z.array(content).max(500);

export const draftSchema = z.object({
  rootContent: oid,
  contents,
  coordinates: coordinates.default({}),
});

export const draftPatchSchema = z
  .object({
    rootContent: oid.optional(),
    contents: contents.optional(),
    coordinates: coordinates.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'Patch must change rootContent, contents or coordinates',
  });

export type Draft = z.infer<typeof draftSchema>;
export type DraftPatch = z.infer<typeof draftPatchSchema>;
export type DraftContent = Draft['contents'][number];
