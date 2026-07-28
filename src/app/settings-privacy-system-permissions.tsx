import { PrivacySystemPermissionsScreen } from '@/components/mixology/SettingsPrivacyScreens';

const ROWS = [
  {
    id: 'camera',
    label: '相机',
    description: '用于拍摄作品、扫描二维码',
    status: 'granted' as const,
  },
  {
    id: 'photos',
    label: '相册',
    description: '用于上传图片、视频至作品 / 聊天',
    status: 'granted' as const,
  },
  {
    id: 'microphone',
    label: '麦克风',
    description: '用于发布语音笔记、视频通话',
    status: 'granted' as const,
  },
  {
    id: 'location',
    label: '位置',
    description: '用于发布带位置的内容',
    status: 'granted' as const,
  },
  {
    id: 'notifications',
    label: '通知',
    description: '用于推送消息、互动提醒',
    status: 'granted' as const,
  },
  {
    id: 'contacts',
    label: '通讯录',
    description: '用于发现通讯录中的好友',
    status: 'denied' as const,
  },
];

export default function SettingsPrivacySystemPermissionsScreen() {
  return <PrivacySystemPermissionsScreen title="系统权限管理" rows={ROWS} />;
}