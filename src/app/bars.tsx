import { ChevronLeft, MapPin } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BarVenueCard } from '@/components/mixology/BarVenueCard';
import { ScreenShell } from '@/components/mixology/ScreenShell';
import { getBarVenues } from '@/services/contentService';
import { useMixology } from '@/state/MixologyState';
import { colors, radii, spacing } from '@/styles/mixologyTheme';

export default function BarsScreen() {
  const { interactionState, toggleVenueFavorite } = useMixology();
  const venues = getBarVenues();

  return (
    <ScreenShell>
      <View style={styles.header}>
        <ChevronLeft color={colors.pink} size={32} />
        <Text style={styles.title}>附近酒吧</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.locationNotice}>
        <MapPin color={colors.pink} size={17} />
        <Text style={styles.locationText}>当前位置使用 Mock 距离，不请求真实定位权限</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {venues.map((venue) => (
          <BarVenueCard
            key={venue.id}
            venue={venue}
            favorite={interactionState.favoriteVenueIds.includes(venue.id)}
            onToggleFavorite={() => toggleVenueFavorite(venue.id)}
          />
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  placeholder: {
    width: 32,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 18,
  },
  locationText: {
    color: colors.textMuted,
    fontSize: 13,
    flex: 1,
  },
  list: {
    paddingBottom: spacing.bottomNavPadding,
  },
});
