import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { JarvisChat } from '../../src/components/JarvisChat';
import { colors, commonStyles } from '../../src/theme';

export default function JarvisScreen() {
  return (
    <View style={styles.container}>
      <View style={{ marginBottom: 12 }}>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Sparkles size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>JARVIS</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Your AI health assistant. Ask about your scans, labs, symptoms, prescriptions, or
          lifestyle.
        </Text>
      </View>
      <JarvisChat />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
