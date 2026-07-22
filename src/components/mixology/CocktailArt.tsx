import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

const palettes: Record<string, [string, string, string]> = {
  margarita: ['#ff2f9f', '#7a1fff', '#2fe7ff'],
  'gin-tonic': ['#2fe7ff', '#35ff9c', '#f6ff7a'],
  mojito: ['#1cff96', '#2fe7ff', '#153d2f'],
  negroni: ['#ff5c35', '#ff2f9f', '#330814'],
  'moscow-mule': ['#ffb84d', '#ff6d3d', '#2fe7ff'],
};

export function CocktailArt({ id, compact = false }: { id: string; compact?: boolean }) {
  const colors = palettes[id] ?? palettes.margarita;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className={`overflow-hidden rounded-lg ${compact ? 'h-20 w-20' : 'h-44 w-full'}`}>
      <View className="absolute -right-5 -top-7 h-28 w-28 rounded-full bg-white/30" />
      <View className="absolute bottom-3 left-5 h-20 w-16 rounded-b-3xl rounded-t-lg border border-white/60 bg-black/25" />
      <View className="absolute bottom-8 left-8 h-10 w-10 rounded-full bg-white/25" />
      <View className="absolute right-5 top-6 h-16 w-2 rotate-12 rounded-full bg-white/70" />
    </LinearGradient>
  );
}
