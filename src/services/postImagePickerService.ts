import { Alert, Platform } from 'react-native';

/**
 * 从相册选择笔记图片（支持多选）。
 * 返回图片本地 uri 数组；取消或不可用时返回空数组。
 * Web 预览端 expo-image-picker 不可用，降级为提示（可改用内置图库）。
 */
export async function pickPostImagesFromLibrary(remainingSlots: number): Promise<string[]> {
  if (remainingSlots <= 0) {
    return [];
  }

  if (Platform.OS === 'web') {
    Alert.alert('提示', '相册上传仅真机可用，可先从内置图库选择图片');
    return [];
  }

  try {
    const ImagePicker = await import('expo-image-picker');

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('需要相册权限', '请在系统设置中允许访问相册后重试');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
      return [];
    }

    return result.assets
      .map((asset) => asset.uri)
      .filter((uri): uri is string => Boolean(uri))
      .slice(0, remainingSlots);
  } catch {
    Alert.alert('提示', '当前环境不支持相册上传，可先从内置图库选择图片');
    return [];
  }
}
