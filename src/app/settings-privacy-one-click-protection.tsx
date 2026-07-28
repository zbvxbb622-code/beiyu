import { PrivacyToggleScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'protection',
    label: '一键防护',
    description: '开启后自动隐藏可能打扰的评论、私信与陌生人消息',
  },
];

export default function SettingsPrivacyOneClickProtectionScreen() {
  return <PrivacyToggleScreen title="一键防护" initialValues={{ protection: false }} rows={ROWS} />;
}