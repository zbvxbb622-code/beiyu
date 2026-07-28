import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'all', label: '所有人', description: '所有人都可以看到你的在线状态' },
  { id: 'mutual', label: '互相关注的人', description: '只有互相关注的用户可看到你的在线状态' },
  { id: 'none', label: '不展示', description: '对所有人隐藏你的在线状态' },
];

export default function SettingsPrivacyOnlineStatusScreen() {
  return (
    <PrivacyPickerScreen
      title="在线状态"
      initialSelected="mutual"
      options={OPTIONS}
      description="选择哪些用户可以看到你的在线状态"
    />
  );
}