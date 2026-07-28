import { PrivacyEmptyScreen } from '@/components/mixology/SettingsPrivacyScreens';
import { ShieldOff } from 'lucide-react-native';
import { colors } from '@/styles/mixologyTheme';

export default function SettingsPrivacyBlockFromViewScreen() {
  return (
    <PrivacyEmptyScreen
      title="不让他(她)看"
      illustration={
        <ShieldOff color={colors.textMuted} size={64} strokeWidth={1.4} />
      }
      emptyTitle="还没有不可见的用户"
      emptyDescription="加入后，对方将无法查看你的作品、动态以及个人主页"
      actionLabel="添加"
    />
  );
}