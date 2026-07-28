import { PrivacyToggleScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'show',
    label: '聊天标识',
    description: '开启后对方可在聊天窗口看到你的小红书主页入口',
  },
];

export default function SettingsPrivacyChatTagScreen() {
  return <PrivacyToggleScreen title="聊天标识" initialValues={{ show: true }} rows={ROWS} />;
}