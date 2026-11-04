import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconBox}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke="#FFFFFF" strokeWidth="2" />
          <Circle cx="12" cy="12" r="3" fill="#FFFFFF" />
          <Path
            d="M12 3v2M12 19v2M3 12h2M19 12h2"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View>
        <Text style={[styles.title, compact && { fontSize: 16 }]}>SkinScope AI</Text>
        <Text style={styles.subtitle}>HEALTH INTELLIGENCE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primaryGlow,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    color: colors.foreground,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.6,
    marginTop: 1,
  },
});
