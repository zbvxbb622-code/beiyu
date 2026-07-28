import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'default', label: '默认', description: '我关注的人以及共同关注的人' },
  { id: 'mutual', label: '互相关注的人', description: '只有互相关注的用户可评论 / 发弹幕' },
  { id: 'all', label: '所有人', description: '所有人都可以评论 / 发弹幕' },
];

export default function SettingsPrivacyWhoCanCommentScreen() {
  return (
    <PrivacyPickerScreen
      title="谁可以给我评论和发弹幕"
      initialSelected="all"
      options={OPTIONS}
      description="设置可以对你作品评论 / 发弹幕的用户范围"
    />
  );
}