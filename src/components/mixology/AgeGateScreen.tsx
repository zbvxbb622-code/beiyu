import { ShieldCheck, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';
import { useMixology } from '@/state/MixologyState';

export function AgeGateScreen() {
  const { verifyAge } = useMixology();

  return (
    <ScreenShell>
      <View className="flex-1 justify-center">
        <View className="mb-8 h-16 w-16 items-center justify-center rounded-2xl border border-neonCyan/40 bg-white/10">
          <Sparkles color="#2fe7ff" size={28} />
        </View>
        <Text className="text-4xl font-black leading-tight text-white">Mixology AI</Text>
        <Text className="mt-4 text-base leading-6 text-muted">
          这是一款面向成年人的调酒和饮品推荐 App。继续前请确认你已达到所在地合法饮酒年龄。
        </Text>

        <View className="mt-8 rounded-lg border border-white/10 bg-white/10 p-5">
          <View className="flex-row items-center gap-3">
            <ShieldCheck color="#b7ff4a" size={24} />
            <Text className="flex-1 text-lg font-black text-white">隐私优先</Text>
          </View>
          <Text className="mt-3 text-sm leading-6 text-muted">
            第一版不会上传你的年龄确认、酒柜材料或 AI 输入内容。这些信息只保存在本机。
          </Text>
        </View>

        <Pressable onPress={verifyAge} className="mt-8 rounded-lg bg-neonPink px-5 py-4">
          <Text className="text-center text-base font-black text-white">我已满 18 岁，进入 App</Text>
        </Pressable>
        <Text className="mt-4 text-center text-xs leading-5 text-muted">请理性饮酒。AI 不会鼓励过量饮酒。</Text>
      </View>
    </ScreenShell>
  );
}
