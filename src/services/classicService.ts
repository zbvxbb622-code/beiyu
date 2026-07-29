import { cocktailRecipes } from '@/data/recipes';
import type { CocktailRecipe } from '@/types/mixology';

// 简单稳定的字符串哈希，用于把"日期"映射成固定索引
function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
}

// 以本地日期为种子（YYYY-MM-DD），保证当天结果稳定、隔天自动轮换
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// 每日推荐：从全部经典酒款中按日期确定性随机选取 1 款，
// 当天稳定、隔天自动轮换。
export function getDailyClassicFeature(date?: Date): CocktailRecipe;
export function getDailyClassicFeature(
  date: Date,
  pool: CocktailRecipe[]
): CocktailRecipe | undefined;
export function getDailyClassicFeature(
  date: Date = new Date(),
  pool: CocktailRecipe[] = cocktailRecipes
): CocktailRecipe | undefined {
  if (pool.length === 0) {
    return undefined;
  }
  const index = hashString(formatDateKey(date)) % pool.length;

  return pool[index];
}
