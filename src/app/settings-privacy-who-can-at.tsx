import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'default', label: '默认', description: '我关注的人以及共同关注的人' },
  { id: 'mutual', label: '互相关注的人', description: '只有互相关注的用户可以 @ 你' },
  { id: 'all', label: '所有人', description: '所有人都可以 @ 你' },
];

export default function SettingsPrivacyWhoCanAtScreen() {
  return (
    <PrivacyPickerScreen
      title="谁可以@我"
      initialSelected="all"
      options={OPTIONS}
      description="设置可以 @ 你的用户范围"
    />
  );
}