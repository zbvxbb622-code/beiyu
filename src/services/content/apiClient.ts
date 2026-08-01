import type { z } from 'zod';

import { normalizeApiV1BaseUrl } from '@/services/api/apiBaseUrl';
import {
  barListSchema,
  contentSnapshotSchema,
  homeResponseSchema,
  ingredientListSchema,
  knowledgeListSchema,
  recipeListSchema,
  type ContentSnapshot,
} from '@/services/content/contentSchemas';

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

type ApiClientOptions = {
  apiBaseUrl: string;
  fetch: FetchLike;
  timeoutMs: number;
};

async function readJson<Schema extends z.ZodType>(
  options: ApiClientOptions,
  path: string,
  schema: Schema
): Promise<z.output<Schema>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await options.fetch(`${normalizeApiV1BaseUrl(options.apiBaseUrl)}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`content-api-${response.status}`);
    }
    return schema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchContentSnapshot(
  options: ApiClientOptions
): Promise<ContentSnapshot> {
  const [home, ingredientList, recipeList, barList, knowledgeList] = await Promise.all([
    readJson(options, '/home', homeResponseSchema),
    readJson(options, '/ingredients?page=1&pageSize=100', ingredientListSchema),
    readJson(options, '/recipes?page=1&pageSize=100', recipeListSchema),
    readJson(options, '/bars?page=1&pageSize=100', barListSchema),
    readJson(options, '/knowledge?page=1&pageSize=100', knowledgeListSchema),
  ]);

  return contentSnapshotSchema.parse({
    ingredients: ingredientList.items,
    recipes: recipeList.items,
    bars: barList.items,
    knowledge: knowledgeList.items,
    banners: home.banners,
    shortcuts: home.shortcuts,
  });
}
