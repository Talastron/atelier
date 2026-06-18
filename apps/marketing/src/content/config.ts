// apps/marketing/src/content/config.ts
import { defineCollection, z } from 'astro:content';

const journal = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    kicker: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { journal };
