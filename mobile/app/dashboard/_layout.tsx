import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Slot, usePathname, useRouter } from 'expo-router';
import {
  LayoutDashboard,
  Upload,
  FileText,
  LogOut,
  Menu,
  X,
  BookOpen,
  Bell,
  BarChart3,
  Activity,
  FlaskConical,
  Sparkles,
  Pill,
  Users,
  CalendarClock,
  Heart,
  Brain,
  GitCompareArrows,
  Share2,
} from 'lucide-react-native';
import { useAuth } from '../../src/lib/auth-context';
import { Logo } from '../../src/components/Logo';
import { FloatingJarvis } from '../../src/components/FloatingJarvis';
import { colors, commonStyles } from '../../src/theme';

const navItems = [
  { to: '/dashboard', label: 'Overview', Icon: LayoutDashboard },
  { to: '/dashboard/jarvis', label: 'JARVIS Assistant', Icon: Sparkles },
  { to: '/dashboard/analyze', label: 'New Analysis', Icon: Upload },
  { to: '/dashboard/reports', label: 'Scan Reports', Icon: FileText },
  { to: '/dashboard/medical-reports', label: 'Medical Reports', Icon: FlaskConical },
  { to: '/dashboard/prescriptions', label: 'Prescriptions', Icon: Pill },
  { to: '/dashboard/timeline', label: 'Health Timeline', Icon: Activity },
  { to: '/dashboard/twin', label: 'Health Twin', Icon: Brain },
  { to: '/dashboard/compare', label: 'What Changed', Icon: GitCompareArrows },
  { to: '/dashboard/intelligence', label: 'AI Intelligence', Icon: Sparkles },
  { to: '/dashboard/diary', label: 'Symptom Diary', Icon: BookOpen },
  { to: '/dashboard/lifestyle', label: 'Lifestyle', Icon: Heart },
  { to: '/dashboard/family', label: 'Family', Icon: Users },
  { to: '/dashboard/appointments', label: 'Appointments', Icon: CalendarClock },
  { to: '/dashboard/reminders', label: 'Reminders', Icon: Bell },
  { to: '/dashboard/insights', label: 'Trend Insights', Icon: BarChart3 },
  { to: '/dashboard/share', label: 'Share with Doctor', Icon: Share2 },
] as const;

export default function DashboardLayout() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <SafeAreaView style={[commonStyles.screen, styles.center]}>
        <ActivityIndicator size="large" color={colors.primaryGlow} />
        <Text style={[commonStyles.subtitle, { marginTop: 10 }]}>Loading dashboard…</Text>
      </SafeAreaView>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={commonStyles.screen} edges={['top', 'bottom']}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.push('/dashboard')}>
          <Logo compact />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setDrawerOpen(true)}>
          <Menu size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={{ flex: 1 }}>
        <Slot />
      </View>

      {/* Floating JARVIS Assistant */}
      <FloatingJarvis />

      {/* Navigation Drawer */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <View style={styles.drawerContent}>
            <View style={[commonStyles.rowBetween, { marginBottom: 14 }]}>
              <Logo compact />
              <TouchableOpacity onPress={() => setDrawerOpen(false)} style={{ padding: 6 }}>
                <X size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {navItems.map((item) => {
                const active =
                  item.to === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname?.startsWith(item.to);
                const Icon = item.Icon;
                return (
                  <TouchableOpacity
                    key={item.to}
                    style={[styles.navItem, active && styles.navItemActive]}
                    onPress={() => {
                      setDrawerOpen(false);
                      router.push(item.to as any);
                    }}
                  >
                    <Icon
                      size={18}
                      color={active ? colors.primaryGlow : colors.mutedForeground}
                    />
                    <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.drawerFooter}>
              <View style={styles.userBox}>
                <Text style={styles.signedInCaption}>SIGNED IN</Text>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
              <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                <LogOut size={16} color={colors.mutedForeground} />
                <Text style={styles.signOutText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setDrawerOpen(false)}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.sidebar,
  },
  menuBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: colors.input,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContent: {
    width: 285,
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    marginBottom: 2,
  },
  navItemActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryGlow,
  },
  navLabel: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: '500',
  },
  navLabelActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  userBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  signedInCaption: {
    color: colors.mutedForeground,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  userEmail: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  signOutText: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: '600',
  },
});
