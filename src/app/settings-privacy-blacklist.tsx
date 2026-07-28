import { PrivacyEmptyScreen } from '@/components/mixology/SettingsPrivacyScreens';
import { Ban } from 'lucide-react-native';
import { colors } from '@/styles/mixologyTheme';

export default function SettingsPrivacyBlacklistScreen() {
  return (
    <PrivacyEmptyScreen
      title="黑名单"
      illustration={
        <Ban color={colors.textMuted} size={64} strokeWidth={1.4} />
      }
      emptyTitle="黑名单为空"
      emptyDescription="加入黑名单的用户将无法与你互动，仍可在对方黑名单中解除"
      actionLabel="添加"
    />
  );
}