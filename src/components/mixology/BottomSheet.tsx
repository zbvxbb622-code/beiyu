import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { colors, radii } from '@/styles/mixologyTheme';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} testID={testID ? `${testID}-backdrop` : undefined}>
          <View style={styles.backdropInner} />
        </Pressable>

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {title ? <Text style={styles.title}>{title}</Text> : <View style={styles.titleSpacer} />}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closePressable, pressed ? styles.pressed : null]}
              testID={testID ? `${testID}-close` : undefined}
            >
              <View style={styles.closeInner}>
                <X color={colors.textMuted} size={20} />
              </View>
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropInner: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingBottom: 28,
    paddingHorizontal: 18,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  titleSpacer: {
    flex: 1,
  },
  closePressable: {
    width: 36,
    height: 36,
  },
  closeInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 4,
  },
  pressed: {
    opacity: 0.7,
  },
});
