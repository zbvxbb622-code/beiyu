import { PrivacyToggleScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'enable',
    label: '推荐可能认识的人给我',
    description: '开启后系统将根据共同关注、共同好友为你推荐可能认识的人',
  },
];

export default function SettingsPrivacyRecommendToMeScreen() {
  return <PrivacyToggleScreen title="推荐可能认识的人给我" initialValues={{ enable: true }} rows={ROWS} />;
}