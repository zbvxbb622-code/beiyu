import { LinearGradient } from 'expo-linear-gradient';
import { type Href, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { FlaskConical, PackageOpen, Share2, Sparkles } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { BlindBoxCard } from '@/components/mixology/BlindBoxCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { TopBar } from '@/components/mixology/TopBar';
import { rarityConfig } from '@/data/blindBoxCards';
import { canDrawToday, drawCard as drawRandomCard, todayKey } from '@/services/blindBoxService';
import { useMixology } from '@/state/MixologyState';
import { colors, gradients, radii } from '@/styles/mixologyTheme';
import type { BlindBoxCard as BlindBoxCardType } from '@/types/mixology';

const cardDrawVideo = require('@/assets/mixology/online/card-draw.mp4');

type DrawPhase = 'idle' | 'drawing' | 'revealed';

export default function BlindBoxScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { interactionState, drawBlindBoxCard } = useMixology();

  const [phase, setPhase] = useState<DrawPhase>('idle');
  const [card, setCard] = useState<BlindBoxCardType | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [revealScale] = useState(() => new Animated.Value(0.3));
  const [revealOpacity] = useState(() => new Animated.Value(0));
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 视频播放器（预加载视频源，常驻挂载，仅在 drawing 阶段可见）
  const player = useVideoPlayer(cardDrawVideo);

  const revealCard = useCallback(() => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current);
      fallbackTimer.current = null;
    }
    try {
      player.pause();
    } catch {
      // 播放器可能尚未就绪，忽略
    }
    revealScale.setValue(0.3);
    revealOpacity.setValue(0);
    setPhase('revealed');
    Animated.parallel([
      Animated.spring(revealScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.timing(revealOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [player, revealOpacity, revealScale]);

  useEffect(() => {
    const endSub = player.addListener('playToEnd', () => revealCard());
    const statusSub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'error') {
        revealCard();
      }
    });
    return () => {
      endSub.remove();
      statusSub.remove();
    };
  }, [player, revealCard]);

  // 卡死看门狗：drawing 阶段若播放进度停滞超过 ~1.5s（解码/缓冲卡死），直接揭示结果
  const lastTimeRef = useRef(-1);
  const stallCountRef = useRef(0);
  useEffect(() => {
    if (phase !== 'drawing') {
      return;
    }
    lastTimeRef.current = -1;
    stallCountRef.current = 0;
    const watchdog = setInterval(() => {
      if (!player.playing) {
        return; // 加载中/未播放，不计卡死
      }
      const current = player.currentTime;
      if (current === lastTimeRef.current) {
        stallCountRef.current += 1;
        if (stallCountRef.current >= 3) {
          clearInterval(watchdog);
          revealCard();
        }
      } else {
        stallCountRef.current = 0;
        lastTimeRef.current = current;
      }
    }, 500);
    return () => clearInterval(watchdog);
  }, [phase, player, revealCard]);

  useEffect(
    () => () => {
      if (fallbackTimer.current) {
        clearTimeout(fallbackTimer.current);
      }
    },
    []
  );

  // 今天已抽过：直接展示今日卡牌
  const drawnToday = !canDrawToday(interactionState.lastDrawDate);
  const todayCard =
    drawnToday && interactionState.lastDrawDate === todayKey()
      ? (interactionState.drawnCards[0]?.card ?? null)
      : null;

  // 统一的"视频过场 → 揭示"流程
  const startRevealFlow = (drawn: BlindBoxCardType) => {
    setCard(drawn);
    setPhase('drawing');
    // 兜底：若 playToEnd 未触发（异常/平台差异），8.5s 后强制揭示
    fallbackTimer.current = setTimeout(() => revealCard(), 8500);
    try {
      player.replay();
    } catch {
      revealCard();
    }
  };

  const handleDraw = async () => {
    setErrorMessage(null);
    try {
      const drawn = await drawBlindBoxCard();
      startRevealFlow(drawn);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '抽取失败，请稍后再试');
    }
  };

  // 测试抽卡：不限次数、不写入每日记录（仅本地随机）
  const handleTestDraw = () => {
    setErrorMessage(null);
    startRevealFlow(drawRandomCard());
  };

  // 跳转发帖页并预填卡牌内容，由用户自行编辑后发布
  const handleShare = () => {
    const shareCard = card ?? todayCard;
    if (!shareCard) {
      return;
    }
    const rarity = rarityConfig[shareCard.rarity];
    router.push({
      pathname: '/publish-post',
      params: {
        from: 'blind-box',
        title: `今日盲盒抽中${rarity.label}卡「${shareCard.name}」`,
        body: `每日一抽，今天开到了${rarity.label}卡「${shareCard.name} ${shareCard.englishName}」！\n${
          shareCard.steps[0] ? `做法：${shareCard.steps[0]}` : ''
        }`,
        imageKey: shareCard.imageKey,
      },
    } as unknown as Href);
  };

  const shownCard = card ?? todayCard;
  const videoSize = Math.min(width - 48, 380);
  const stageHeight = Math.min(410, Math.max(330, height * 0.46));
  const cardBackWrapHeight = Math.min(360, Math.max(320, height * 0.42));
  const cardBackHeight = cardBackWrapHeight - 24;
  const cardBackWidth = cardBackHeight * 0.7;
  const cardBackSize = { width: cardBackWidth, height: cardBackHeight };

  return (
    <ScreenShell>
      <TopBar title="经典盲盒" backHref={'/' as Href} />

      <View testID="blind-box-stage" style={[styles.stage, { height: stageHeight }]}>
        {/* 抽卡过场视频 */}
        {phase === 'drawing' ? (
          <Pressable onPress={revealCard} style={[styles.videoWrap, { width: videoSize, height: videoSize }]}>
            <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
            <Text style={styles.skipHint}>轻触跳过</Text>
          </Pressable>
        ) : null}

        {/* 待抽取 / 结果展示 */}
        {phase !== 'drawing' ? (
          shownCard ? (
            <Animated.View
              style={{
                transform: [{ scale: phase === 'revealed' ? revealScale : 1 }],
                opacity: phase === 'revealed' ? revealOpacity : 1,
              }}
            >
              <BlindBoxCard card={shownCard} />
            </Animated.View>
          ) : (
            <View testID="blind-box-card-back-wrap" style={[styles.cardBackWrap, { width: cardBackWidth + 24, height: cardBackWrapHeight }]}>
              <View style={[styles.cardBack, cardBackSize, styles.cardBackRear]} />
              <View style={[styles.cardBack, cardBackSize, styles.cardBackMid]} />
              <LinearGradient colors={gradients.card} style={[styles.cardBack, cardBackSize, styles.cardBackFront]}>
                <PackageOpen color={colors.pink} size={56} />
                <Text style={styles.cardBackText}>今日酒卡待开启</Text>
              </LinearGradient>
            </View>
          )
        ) : null}
      </View>

      {/* 底部操作区 */}
      <View style={styles.footer}>
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {phase === 'idle' && !shownCard ? (
          <>
            <Text style={styles.quotaText}>每日可抽取 1 张酒卡</Text>
            <Pressable onPress={handleDraw} style={styles.drawButton} testID="draw-button">
              <LinearGradient colors={gradients.cta} style={styles.drawButtonGradient}>
                <Sparkles color={colors.text} size={20} />
                <Text style={styles.drawButtonText}>开启今日盲盒</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleTestDraw} style={styles.testButton} testID="test-draw-button">
              <FlaskConical color={colors.textMuted} size={15} />
              <Text style={styles.testButtonText}>测试抽卡 · 不限次数</Text>
            </Pressable>
          </>
        ) : null}

        {phase !== 'drawing' && shownCard ? (
          <>
            <Text style={styles.quotaText}>
              {card ? '抽卡成功！' : '今日已抽卡，明天再来吧'}
            </Text>
            <View style={styles.actionRow}>
              <Pressable onPress={handleShare} style={styles.actionButton} testID="share-button">
                <Share2 color={colors.text} size={18} />
                <Text style={styles.actionButtonText}>分享到社区</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: shownCard.recipeId } } as unknown as Href)}
                style={[styles.actionButton, styles.actionButtonGhost]}
              >
                <Text style={styles.actionButtonText}>查看酒谱</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleTestDraw} style={styles.testButton} testID="test-draw-button">
              <FlaskConical color={colors.textMuted} size={15} />
              <Text style={styles.testButtonText}>再抽一次（测试）</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  videoWrap: {
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
  },
  skipHint: {
    position: 'absolute',
    right: 12,
    bottom: 10,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
  },
  cardBackWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBack: {
    position: 'absolute',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: 'rgba(255,47,159,0.35)',
  },
  cardBackRear: {
    transform: [{ rotate: '-7deg' }],
    backgroundColor: '#17090f',
  },
  cardBackMid: {
    transform: [{ rotate: '5deg' }],
    backgroundColor: '#1f0b14',
  },
  cardBackFront: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    borderColor: colors.pink,
  },
  cardBackText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 18,
    gap: 10,
  },
  quotaText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  errorText: {
    color: '#ff7d7d',
    fontSize: 13,
  },
  drawButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  drawButtonGradient: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  drawButtonText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
    backgroundColor: colors.pinkDark,
  },
  actionButtonGhost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  testButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
  },
  testButtonText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
});
