import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  ScanEye,
  TrendingUp,
  ShieldCheck,
  Sparkles,
  Activity,
  FileText,
} from 'lucide-react-native';
import { Logo } from '../src/components/Logo';
import { useAuth } from '../src/lib/auth-context';
import { colors, commonStyles } from '../src/theme';

export default function IndexScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <SafeAreaView style={commonStyles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Logo compact />
        <View style={[commonStyles.row, { gap: 8 }]}>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => router.push('/login')}>
            <Text style={styles.ghostBtnText}>Sign in</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSmall} onPress={() => router.push('/signup')}>
            <Text style={styles.ctaSmallText}>Get started</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 28 }}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.pillBadge}>
            <Sparkles size={13} color={colors.primaryGlow} />
            <Text style={styles.pillText}>AI-powered wellness, in your pocket</Text>
          </View>
          <Text style={styles.heroTitle}>
            Notice changes in your skin{' '}
            <Text style={{ color: colors.primaryGlow }}>before they become concerns.</Text>
          </Text>
          <Text style={styles.heroSub}>
            Snap a photo of your skin, eyes, or palms. SkinScope AI analyzes color, tracks trends
            across your reports, and gives you clear, friendly insights — so you know when to relax
            and when to check in with a doctor.
          </Text>
          <View style={{ gap: 10, marginTop: 18 }}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/signup')}>
              <Text style={styles.primaryBtnText}>Start free analysis</Text>
              <ArrowRight size={16} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/login')}>
              <Text style={styles.outlineBtnText}>I already have an account</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.disclaimerSmall}>
            Educational wellness tool · Not a medical device · Always consult a healthcare
            professional
          </Text>
        </View>

        {/* Features */}
        <View style={{ gap: 12 }}>
          <Text style={commonStyles.h2}>Built for clarity & continuity</Text>
          <Text style={commonStyles.subtitle}>
            Three pillars that turn a single photo into meaningful insight.
          </Text>
          {[
            {
              Icon: ScanEye,
              title: 'Hybrid AI analysis',
              body: 'A vision model and on-device color extraction (RGB + HSV) work together to evaluate yellowing, redness, and tone shifts.',
            },
            {
              Icon: TrendingUp,
              title: 'History-aware trends',
              body: 'Each new scan is compared with your past reports to detect whether things are improving, stable, or worsening.',
            },
            {
              Icon: ShieldCheck,
              title: 'Private by design',
              body: 'Your images and reports stay tied to your account with row-level security. You can delete them any time.',
            },
          ].map((f) => (
            <View key={f.title} style={commonStyles.card}>
              <View style={styles.featureIcon}>
                <f.Icon size={20} color={colors.primaryGlow} />
              </View>
              <Text style={[commonStyles.h3, { marginTop: 10 }]}>{f.title}</Text>
              <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>{f.body}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <View style={{ gap: 12 }}>
          <Text style={commonStyles.h2}>Three steps. One report.</Text>
          {[
            {
              n: '01',
              Icon: Activity,
              t: 'Upload an image',
              d: 'Choose the region — eye, skin, or palm — then snap or upload a photo.',
            },
            {
              n: '02',
              Icon: Sparkles,
              t: 'AI + color analysis',
              d: 'We blend a vision model with on-device pixel analysis tuned for that region.',
            },
            {
              n: '03',
              Icon: FileText,
              t: 'Get a clear report',
              d: 'Severity, observations, trend vs. history, and a downloadable PDF.',
            },
          ].map((s) => (
            <View key={s.n} style={commonStyles.card}>
              <View style={commonStyles.rowBetween}>
                <Text style={styles.stepNum}>{s.n}</Text>
                <s.Icon size={18} color={colors.primaryGlow} />
              </View>
              <Text style={[commonStyles.h3, { marginTop: 8 }]}>{s.t}</Text>
              <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>{s.d}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Logo compact />
          <Text style={[commonStyles.subtitle, { fontSize: 12, marginTop: 8 }]}>
            Important: SkinScope AI is an educational wellness tool, not a medical device, and does
            not provide medical advice, diagnosis, or treatment. Always consult a qualified
            healthcare professional for any concerning symptoms.
          </Text>
          <Text style={[commonStyles.subtitle, { fontSize: 11, marginTop: 8 }]}>
            © {new Date().getFullYear()} SkinScope AI
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ghostBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostBtnText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
  },
  ctaSmall: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaSmallText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 22,
  },
  pillBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    borderColor: 'rgba(6, 182, 212, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillText: {
    color: colors.primaryGlow,
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: colors.foreground,
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginTop: 14,
    letterSpacing: -0.5,
  },
  heroSub: {
    color: colors.mutedForeground,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  outlineBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.input,
  },
  outlineBtnText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  disclaimerSmall: {
    color: colors.mutedForeground,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.45)',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 20,
  },
});
