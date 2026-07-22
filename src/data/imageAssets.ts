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
  barInterior: require('../../assets/mixology/online/bar-interior.jpg'),
  barShelf: require('../../assets/mixology/online/bar-shelf.jpg'),
  bartender: require('../../assets/mixology/online/bartender.jpg'),
  communityGrid: require('../../assets/mixology/online/bar-shelf.jpg'),
  communityDetail: require('../../assets/mixology/online/bar-interior.jpg'),
  barsList: require('../../assets/mixology/online/bar-interior.jpg'),
  barDetail: require('../../assets/mixology/online/hero-neon.jpg'),
  sharedCellar: require('../../assets/mixology/online/cocktail-margarita.jpg'),
  cardDetail: require('../../assets/mixology/online/cocktail-mojito.jpg'),
  avatarOne: require('../../assets/mixology/online/bartender.jpg'),
  avatarTwo: require('../../assets/mixology/online/cocktail-blue-lagoon.jpg'),
  avatarThree: require('../../assets/mixology/online/cocktail-old-fashioned.jpg'),
};

export const imageAssetKeys = Object.keys(imageAssets);

export function getImageAsset(imageKey: string) {
  return imageAssets[imageKey] ?? imageAssets.homeHero;
}
