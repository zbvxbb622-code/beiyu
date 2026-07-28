import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'public', label: '公开', description: '所有人都可以看到你的收藏' },
  { id: 'mutual', label: '互相关注的人', description: '只有互相关注的用户可看到' },
  { id: 'self', label: '仅自己', description: '仅你本人可以查看' },
];

export default function SettingsPrivacyFavoritesScreen() {
  return (
    <PrivacyPickerScreen
      title="我的收藏"
      initialSelected="public"
      options={OPTIONS}
      description="设置可以查看你收藏的用户范围"
    />
  );
}