import React, { useEffect, useState } from 'react';
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

export default function SignupScreen() {
  const { user, loading, setSession } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Please enter your name and email');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('Password must contain at least one uppercase letter and one number');
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      setSession(data.session);
      toast.success('Account created — taking you to your dashboard.');
      router.replace('/dashboard');
      return;
    }
    toast.success('Account created — check your email to confirm your account.');
    router.replace('/login');
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
              <Text style={[commonStyles.h1, { fontSize: 22, marginTop: 6 }]}>
                Create your account
              </Text>
              <Text style={commonStyles.subtitle}>Start tracking your wellness in seconds</Text>
            </View>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={commonStyles.label}>Full name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Alex Morgan"
                  placeholderTextColor={colors.mutedForeground}
                  style={commonStyles.input}
                />
              </View>

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
                <Text style={[commonStyles.subtitle, { fontSize: 11, marginTop: 4 }]}>
                  At least 8 characters, one uppercase letter and one number
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={handleSubmit}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>Create account</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={commonStyles.subtitle}>
                  Already have an account?{' '}
                  <Text style={{ color: colors.primaryGlow, fontWeight: '600' }}>Sign in</Text>
                </Text>
              </TouchableOpacity>
              <Text style={[commonStyles.subtitle, { fontSize: 11, textAlign: 'center' }]}>
                By creating an account you acknowledge SkinScope AI is an educational wellness tool,
                not medical advice.
              </Text>
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
