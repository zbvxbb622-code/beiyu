import { blindBoxCards, rarityConfig } from '@/data/blindBoxCards';
import type { BlindBoxCard, CardRarity } from '@/types/mixology';

export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function canDrawToday(lastDrawDate: string | null): boolean {
  return lastDrawDate !== todayKey();
}

// 按稀有度权重随机抽一张卡
export function drawCard(random: () => number = Math.random): BlindBoxCard {
  const totalWeight = blindBoxCards.reduce((sum, card) => sum + rarityConfig[card.rarity].weight, 0);
  let roll = random() * totalWeight;

  for (const card of blindBoxCards) {
    roll -= rarityConfig[card.rarity].weight;
    if (roll <= 0) {
      return card;
    }
  }

  return blindBoxCards[blindBoxCards.length - 1];
}

export function getRarityLabel(rarity: CardRarity): string {
  return rarityConfig[rarity].label;
}
