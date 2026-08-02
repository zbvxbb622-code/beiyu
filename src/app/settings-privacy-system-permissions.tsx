import { PrivacyEmptyScreen } from '@/components/mixology/SettingsPrivacyScreens';

export default function SettingsPrivacySystemPermissionsScreen() {
  return (
    <PrivacyEmptyScreen
      title="系统权限管理"
      emptyTitle="暂未开放"
      emptyDescription="真实权限状态需要接入系统权限 API 后再展示，当前版本不再使用静态授权状态。"
    />
  );
}
