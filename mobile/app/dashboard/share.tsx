import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Share2, Download } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { generateAndShareDoctorReport } from '../../src/lib/doctor-pdf';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

export default function ShareScreen() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [r, m, d, p, i] = await Promise.all([
        supabase
          .from('reports')
          .select('region,condition,severity,confidence,created_at,observations')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('medical_reports')
          .select('report_type,summary,report_date,created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('symptom_diary')
          .select('entry_date,itch,pain,redness')
          .eq('user_id', user.id)
          .order('entry_date', { ascending: false })
          .limit(14),
        supabase
          .from('prescriptions')
          .select('doctor_name,prescribed_date,medicines')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('health_insights')
          .select('summary,observations')
          .eq('user_id', user.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      await generateAndShareDoctorReport({
        userEmail: user.email ?? 'Patient',
        scans: (r.data ?? []) as any,
        meds: (m.data ?? []) as any,
        diary: (d.data ?? []) as any,
        prescriptions: (p.data ?? []) as any,
        insight: (i.data ?? null) as any,
      });
      toast.success('PDF ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <Share2 size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Share with Doctor</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Generate a doctor-friendly PDF combining your scans, lab reports, prescriptions, and
          symptom diary.
        </Text>
      </View>

      <DisclaimerBanner text="The report is for discussion with your healthcare provider. It contains AI-assisted observations and is not a diagnosis." />

      <View style={[commonStyles.card, { gap: 14 }]}>
        <View>
          <Text style={commonStyles.h2}>Doctor-friendly summary</Text>
          <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
            Includes the latest 20 scans, 20 lab reports, recent prescriptions, AI summary, and 14
            days of diary.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, busy && { opacity: 0.6 }]}
          disabled={busy}
          onPress={generate}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Download size={16} color="#FFF" />
          )}
          <Text style={styles.btnText}>{busy ? 'Generating…' : 'Download & Share PDF'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  btnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
