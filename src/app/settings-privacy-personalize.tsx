import { PrivacyToggleScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'recommend',
    label: '个性化内容推荐',
    description: '根据浏览记录推荐更符合你口味的内容',
  },
  {
    id: 'ads',
    label: '个性化广告',
    description: '向你推荐更相关的广告内容',
  },
  {
    id: 'explore',
    label: '附近的人',
    description: '基于位置为你推荐附近的用户',
  },
  {
    id: 'data',
    label: '允许数据收集',
    description: '帮助我们改进产品体验',
  },
];

export default function SettingsPrivacyPersonalizeScreen() {
  return (
    <PrivacyToggleScreen
      title="个性化选项"
      initialValues={{ recommend: true, ads: true, explore: false, data: true }}
      rows={ROWS}
      description="控制个性化推荐、广告与数据收集等行为"
    />
  );
}