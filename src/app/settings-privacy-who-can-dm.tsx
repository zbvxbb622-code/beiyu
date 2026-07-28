import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'default', label: '默认', description: '我关注的人以及共同关注的人' },
  { id: 'mutual', label: '互相关注的人', description: '只有互相关注的用户可以私信' },
  { id: 'all', label: '所有人', description: '所有人（包括陌生人）都可以私信' },
  { id: 'none', label: '不允许任何人', description: '关闭私信功能' },
];

export default function SettingsPrivacyWhoCanDmScreen() {
  return (
    <PrivacyPickerScreen
      title="谁可以私信我"
      initialSelected="default"
      options={OPTIONS}
      description="设置可以向你发送私信的用户范围"
    />
  );
}