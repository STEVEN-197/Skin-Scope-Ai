import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { usePathname } from 'expo-router';
import { Sparkles, X } from 'lucide-react-native';
import { JarvisChat } from './JarvisChat';
import { colors, commonStyles } from '../theme';

export function FloatingJarvis() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  if (pathname?.startsWith('/dashboard/jarvis')) return null;

  return (
    <>
      {!open && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.fab}
          onPress={() => setOpen(true)}
          accessibilityLabel="Open JARVIS assistant"
        >
          <Sparkles size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={[commonStyles.row, { gap: 10 }]}>
                <View style={styles.orbSmall}>
                  <Sparkles size={15} color="#FFF" />
                </View>
                <View>
                  <Text style={styles.headerTitle}>JARVIS</Text>
                  <Text style={styles.headerSub}>HEALTH ASSISTANT · ONLINE</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
                <X size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12 }}>
              <JarvisChat compact />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primaryGlow,
    elevation: 10,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 17, 32, 0.78)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheet: {
    backgroundColor: colors.cardStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  orbSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 6,
  },
});
