import { Alert, Platform } from 'react-native';

/**
 * 从相册选择头像（1:1 裁剪）。
 * 返回图片本地 uri；取消或不可用时返回 null。
 * Web 预览端 expo-image-picker 不可用，降级为提示。
 */
export async function pickAvatarFromLibrary(): Promise<string | null> {
  if (Platform.OS === 'web') {
    Alert.alert('提示', '相册上传仅真机可用，可先选择一个预设头像');
    return null;
  }

  try {
    const ImagePicker = await import('expo-image-picker');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请在系统设置中允许访问相册后重试');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    return result.assets[0].uri;
  } catch {
    Alert.alert('提示', '当前环境不支持相册上传，可先选择一个预设头像');
    return null;
  }
}
