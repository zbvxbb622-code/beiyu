import type { ImageSourcePropType } from 'react-native';

export const imageAssets: Record<string, ImageSourcePropType> = {
  homeHero: require('../../assets/mixology/online/hero-cocktail.jpg'),
  heroBar: require('../../assets/mixology/online/hero-bar.jpg'),
  heroNeon: require('../../assets/mixology/online/hero-neon.jpg'),
  welcome: require('../../assets/mixology/online/hero-neon.jpg'),
  loginBg: require('../../assets/mixology/online/hero-neon.jpg'),
  margarita: require('../../assets/mixology/online/cocktail-margarita.jpg'),
  oldFashioned: require('../../assets/mixology/online/cocktail-old-fashioned.jpg'),
  negroni: require('../../assets/mixology/online/cocktail-negroni.jpg'),
  mojito: require('../../assets/mixology/online/cocktail-mojito.jpg'),
  blueLagoon: require('../../assets/mixology/online/cocktail-blue-lagoon.jpg'),
  ginTonic: require('../../assets/mixology/online/cocktail-gin-tonic.jpg'),
  // —— 经典系列扩充：每款鸡尾酒独立匹配的实拍图（Wikimedia Commons CC 授权）——
  cocktailMoscowMule: require('../../assets/mixology/online/cocktail-moscow-mule.jpg'),
  cocktailManhattan: require('../../assets/mixology/online/cocktail-manhattan.jpg'),
  cocktailItalianLady: require('../../assets/mixology/online/cocktail-italian-lady.jpg'),
  cocktailGinSour: require('../../assets/mixology/online/cocktail-gin-sour.jpg'),
  cocktailWhiskeySour: require('../../assets/mixology/online/cocktail-whiskey-sour.jpg'),
  cocktailLongIsland: require('../../assets/mixology/online/cocktail-long-island.jpg'),
  cocktailDryMartini: require('../../assets/mixology/online/cocktail-dry-martini.jpg'),
  cocktailDaiquiri: require('../../assets/mixology/online/cocktail-daiquiri.jpg'),
  cocktailSidecar: require('../../assets/mixology/online/cocktail-sidecar.jpg'),
  cocktailBoulevardier: require('../../assets/mixology/online/cocktail-boulevardier.jpg'),
  cocktailCosmopolitan: require('../../assets/mixology/online/cocktail-cosmopolitan.jpg'),
  cocktailEspressoMartini: require('../../assets/mixology/online/cocktail-espresso-martini.jpg'),
  cocktailBloodyMary: require('../../assets/mixology/online/cocktail-bloody-mary.jpg'),
  cocktailSingaporeSling: require('../../assets/mixology/online/cocktail-singapore-sling.jpg'),
  cocktailBellini: require('../../assets/mixology/online/cocktail-bellini.jpg'),
  cocktailAperolSpritz: require('../../assets/mixology/online/cocktail-aperol-spritz.jpg'),
  cocktailFrench75: require('../../assets/mixology/online/cocktail-french-75.jpg'),
  barInterior: require('../../assets/mixology/online/bar-interior.jpg'),
  barShelf: require('../../assets/mixology/online/bar-shelf.jpg'),
  bartender: require('../../assets/mixology/online/bartender.jpg'),
  communityGrid: require('../../assets/mixology/online/bar-shelf.jpg'),
  communityDetail: require('../../assets/mixology/online/bar-interior.jpg'),
  barsList: require('../../assets/mixology/online/bar-interior.jpg'),
  barDetail: require('../../assets/mixology/online/hero-neon.jpg'),
  sharedCellar: require('../../assets/mixology/online/cocktail-margarita.jpg'),
  cardDetail: require('../../assets/mixology/online/cocktail-mojito.jpg'),
  // —— 默认头像：使用真实人像占位图（randomuser.me，免费可商用）——
  avatarDefault: require('../../assets/mixology/online/avatar-default.jpg'),
  avatarFemale: require('../../assets/mixology/online/avatar-female.jpg'),
  avatarMale2: require('../../assets/mixology/online/avatar-male-2.jpg'),
  avatarOne: require('../../assets/mixology/online/avatar-default.jpg'),
  avatarTwo: require('../../assets/mixology/online/avatar-female.jpg'),
  avatarThree: require('../../assets/mixology/online/avatar-male-2.jpg'),
  // —— 首页设计稿 1:1 裁剪素材 ——
  homeBanner: require('../../assets/mixology/design/home-banner.jpg'),
  homeItalianLady: require('../../assets/mixology/design/home-italian-lady.png'),
  homeOldFashioned: require('../../assets/mixology/design/home-old-fashioned.png'),
  homeGinSour: require('../../assets/mixology/design/home-gin-sour.png'),
  homeBlueLove: require('../../assets/mixology/design/home-blue-love.png'),
  // 宫格图标（设计稿抠图，白线+粉色双色）
  iconBlindBox: require('../../assets/mixology/design/icon-blind-box.png'),
  iconDrinkKnowledge: require('../../assets/mixology/design/icon-drink-knowledge.png'),
  iconClassicSeries: require('../../assets/mixology/design/icon-classic-series.png'),
  iconSharedCellar: require('../../assets/mixology/design/icon-shared-cellar.png'),
  // 底部导航图标（设计稿抠图蒙版，配合 tintColor 着色）
  tabHome: require('../../assets/mixology/design/tab-home.png'),
  tabCommunity: require('../../assets/mixology/design/tab-community.png'),
  tabBars: require('../../assets/mixology/design/tab-bars.png'),
  tabProfile: require('../../assets/mixology/design/tab-profile.png'),
  tabAiGlyph: require('../../assets/mixology/design/tab-ai-glyph.png'),
};

export const imageAssetKeys = Object.keys(imageAssets);

export function getImageAsset(imageKey: string) {
  return imageAssets[imageKey] ?? imageAssets.homeHero;
}
