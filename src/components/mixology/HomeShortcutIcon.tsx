import { Image } from 'react-native';

import { getImageAsset } from '@/data/imageAssets';

// 设计稿抠出的宫格图标（白线 + 粉色点缀），尺寸为设计稿像素 ÷2（pt）
const iconSources: Record<string, { key: string; width: number; height: number }> = {
  box: { key: 'iconBlindBox', width: 34, height: 32 },
  book: { key: 'iconDrinkKnowledge', width: 39.5, height: 33 },
  cards: { key: 'iconClassicSeries', width: 38, height: 26.5 },
  cellar: { key: 'iconSharedCellar', width: 41, height: 34 },
};

export function HomeShortcutIcon({ icon, scale = 1 }: { icon: string; scale?: number }) {
  const source = iconSources[icon] ?? iconSources.box;

  return (
    <Image
      source={getImageAsset(source.key)}
      style={{ width: source.width * scale, height: source.height * scale }}
      resizeMode="contain"
    />
  );
}
