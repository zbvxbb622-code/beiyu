import { PrivacyEmptyScreen } from '@/components/mixology/SettingsPrivacyScreens';
import { EyeOff } from 'lucide-react-native';
import { colors } from '@/styles/mixologyTheme';

export default function SettingsPrivacyBlockViewScreen() {
  return (
    <PrivacyEmptyScreen
      title="不看他(她)"
      illustration={
        <EyeOff color={colors.textMuted} size={64} strokeWidth={1.4} />
      }
      emptyTitle="还没有不看的人"
      emptyDescription="加入后，你将不再看到对方的作品、动态以及个人主页"
      actionLabel="添加"
    />
  );
}