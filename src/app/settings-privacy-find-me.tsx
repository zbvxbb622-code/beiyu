import { PrivacyPickerScreen } from '@/components/mixology/SettingsPrivacyScreens';

const OPTIONS = [
  { id: 'phone', label: '手机号', description: '允许他人通过手机号搜索到你' },
  { id: 'email', label: '邮箱', description: '允许他人通过邮箱搜索到你' },
  { id: 'recommend', label: '推荐给可能认识的人', description: '出现在「可能认识的人」推荐中' },
];

export default function SettingsPrivacyFindMeScreen() {
  return (
    <PrivacyPickerScreen
      title="找到我的方式"
      initialSelected="phone"
      options={OPTIONS}
      description="选择允许他人通过哪些方式找到你，至少保留一项"
    />
  );
}