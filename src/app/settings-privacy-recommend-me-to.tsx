import { PrivacyToggleScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'enable',
    label: '把我推荐给可能认识的人',
    description: '开启后你可能出现在他人的「可能认识的人」推荐中',
  },
];

export default function SettingsPrivacyRecommendMeToScreen() {
  return <PrivacyToggleScreen title="把我推荐给可能认识的人" initialValues={{ enable: true }} rows={ROWS} />;
}