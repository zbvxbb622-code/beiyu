import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

import { rarityConfig } from '@/data/blindBoxCards';
import { getImageAsset } from '@/data/imageAssets';
import { colors, radii } from '@/styles/mixologyTheme';
import type { BlindBoxCard as BlindBoxCardType } from '@/types/mixology';

/**
 * 盲盒酒卡：按稀有度呈现不同边框/光泽
 * common=白银边框  rare=蓝光边框  legendary=金色边框+流动光泽
 */
export function BlindBoxCard({ card }: { card: BlindBoxCardType }) {
  const rarity = rarityConfig[card.rarity];
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (card.rarity !== 'legendary') {
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [card.rarity, shine]);

  const shineTranslate = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-160, 160],
  });

  return (
    <View
      testID="blind-box-card"
      style={[
        styles.outer,
        {
          borderColor: rarity.borderColor,
          shadowColor: rarity.borderColor,
        },
      ]}
    >
      <LinearGradient colors={rarity.gradient} style={styles.inner}>
        {/* 传说卡流动光泽 */}
        {card.rarity === 'legendary' ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.shine, { transform: [{ translateX: shineTranslate }, { rotate: '18deg' }] }]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,236,170,0.35)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shineGradient}
            />
          </Animated.View>
        ) : null}

        {/* 卡面图 */}
        <View style={styles.imageWrap}>
          <Image source={getImageAsset(card.imageKey)} style={styles.image} resizeMode="cover" />
          <View style={[styles.rarityBadge, { backgroundColor: rarity.borderColor }]}>
            <Sparkles color="#1a1a1a" size={12} />
            <Text style={styles.rarityBadgeText}>{rarity.label}</Text>
          </View>
        </View>

        {/* 名称 */}
        <View style={styles.titleRow}>
          <Text style={styles.name}>{card.name}</Text>
          <Text style={[styles.englishName, { color: rarity.borderColor }]}>{card.englishName}</Text>
        </View>

        <View style={[styles.divider, { borderColor: rarity.borderColor }]} />

        {/* 配料 */}
        <Text style={[styles.sectionLabel, { color: rarity.borderColor }]}>INGREDIENTS</Text>
        {card.ingredients.slice(0, 4).map((ingredient) => (
          <View key={`${card.id}-${ingredient.name}`} style={styles.ingredientRow}>
            <Text style={styles.ingredientName}>{ingredient.name}</Text>
            <View style={styles.dots} />
            <Text style={styles.ingredientAmount}>{ingredient.amount}</Text>
          </View>
        ))}

        {/* 做法 */}
        <Text style={[styles.sectionLabel, styles.methodLabel, { color: rarity.borderColor }]}>METHOD</Text>
        {card.steps.slice(0, 3).map((step, index) => (
          <Text key={`${card.id}-step-${index}`} style={styles.step} numberOfLines={2}>
            {index + 1}. {step}
          </Text>
        ))}

        <Text style={styles.bartender}>— {card.bartender}</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 300,
    borderRadius: radii.md,
    borderWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },
  inner: {
    padding: 16,
    paddingBottom: 20,
  },
  shine: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 90,
    zIndex: 2,
  },
  shineGradient: {
    flex: 1,
  },
  imageWrap: {
    borderRadius: radii.sm,
    overflow: 'hidden',
    height: 170,
    marginBottom: 14,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  rarityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  rarityBadgeText: {
    color: '#1a1a1a',
    fontSize: 11,
    fontWeight: '900',
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
  },
  englishName: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 2,
    letterSpacing: 2,
  },
  divider: {
    borderTopWidth: 1,
    opacity: 0.5,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  methodLabel: {
    marginTop: 12,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  ingredientName: {
    color: colors.text,
    fontSize: 13,
  },
  dots: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 6,
    marginBottom: 3,
  },
  ingredientAmount: {
    color: colors.textSoft,
    fontSize: 12,
  },
  step: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  bartender: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'right',
    marginTop: 12,
  },
});
