import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { supabase } from '../src/integrations/supabase/client';
import { useAuth } from '../src/lib/auth-context';
import { toast } from '../src/lib/toast';
import { Logo } from '../src/components/Logo';
import { colors, commonStyles } from '../src/theme';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

export default function LoginScreen() {
  const { user, loading, setSession } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const failedAttempts = useRef(0);
  const lockedUntil = useRef<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      const remaining = lockedUntil.current ? Math.max(0, lockedUntil.current - Date.now()) : 0;
      setLockoutRemaining(remaining);
      if (remaining === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async () => {
    if (lockedUntil.current && Date.now() < lockedUntil.current) {
      const remaining = Math.ceil((lockedUntil.current - Date.now()) / 1000);
      toast.error(`Too many failed attempts. Please wait ${remaining}s before trying again.`);
      return;
    }
    if (!email.trim() || !password) {
      toast.error('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setSubmitting(false);

      if (error) {
        failedAttempts.current += 1;
        if (failedAttempts.current >= MAX_ATTEMPTS) {
          lockedUntil.current = Date.now() + LOCKOUT_DURATION_MS;
          setLockoutRemaining(LOCKOUT_DURATION_MS);
          toast.error('Too many failed attempts. Account temporarily locked for 5 minutes.');
          failedAttempts.current = 0;
          return;
        }
        const message = error.message.toLowerCase().includes('invalid login credentials')
          ? "Couldn't sign in. Check your email/password, and if you just signed up, confirm your email first."
          : error.message;
        toast.error(message);
        return;
      }

      failedAttempts.current = 0;
      lockedUntil.current = null;
      toast.success('Signed in — taking you to your dashboard.');

      if (data?.session) {
        setSession(data.session);
        router.replace('/dashboard');
      }
    } catch (err: any) {
      setSubmitting(false);
      toast.error(err?.message || 'An unexpected error occurred during sign in.');
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      toast.error('Enter your email first.');
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Confirmation email sent.');
  };

  return (
    <SafeAreaView style={commonStyles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <ArrowLeft size={16} color={colors.mutedForeground} />
            <Text style={styles.backText}>Back to home</Text>
          </TouchableOpacity>

          <View style={commonStyles.cardStrong}>
            <View style={{ alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Logo />
              <Text style={[commonStyles.h1, { fontSize: 22, marginTop: 6 }]}>Welcome back</Text>
              <Text style={commonStyles.subtitle}>Sign in to continue your analysis</Text>
            </View>

            {lockoutRemaining > 0 && (
              <View style={styles.lockoutBanner}>
                <Text style={styles.lockoutText}>
                  Account locked. Try again in {Math.ceil(lockoutRemaining / 1000)}s.
                </Text>
              </View>
            )}

            <View style={{ gap: 14 }}>
              <View>
                <Text style={commonStyles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.mutedForeground}
                  style={commonStyles.input}
                />
              </View>

              <View>
                <Text style={commonStyles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.mutedForeground}
                  style={commonStyles.input}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, (submitting || lockoutRemaining > 0) && { opacity: 0.6 }]}
                disabled={submitting || lockoutRemaining > 0}
                onPress={handleSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={() => router.push('/signup')}>
                <Text style={commonStyles.subtitle}>
                  New to SkinScope?{' '}
                  <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>
                    Create an account
                  </Text>
                </Text>
              </TouchableOpacity>
              <Text style={[commonStyles.subtitle, { fontSize: 11, textAlign: 'center' }]}>
                If you just signed up, confirm your email before signing in.
              </Text>
              <TouchableOpacity onPress={handleResendConfirmation} disabled={resending}>
                <Text style={{ color: colors.primaryGlow, fontSize: 12, fontWeight: '600' }}>
                  {resending ? 'Sending confirmation…' : 'Resend confirmation email'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  lockoutBanner: {
    backgroundColor: colors.destructiveBg,
    borderColor: colors.destructiveBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  lockoutText: {
    color: colors.destructive,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  submitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
