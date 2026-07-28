import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'all', label: '全部公开', description: '所有人都可以看到你的关注与粉丝列表' },
  { id: 'mutual', label: '仅互相关注的人', description: '只有互相关注的用户可看到完整列表' },
  { id: 'self', label: '仅自己', description: '仅你本人可以查看' },
];

export default function SettingsPrivacyFollowFansScreen() {
  return (
    <PrivacyPickerScreen
      title="关注与粉丝列表"
      initialSelected="all"
      options={OPTIONS}
      description="设置可以查看你关注与粉丝列表的用户范围"
    />
  );
}