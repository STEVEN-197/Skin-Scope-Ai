import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { CalendarClock, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { ChipSelect, DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

const SPECIALISTS = [
  'General Physician',
  'Dermatologist',
  'Hepatologist',
  'Ophthalmologist',
  'Endocrinologist',
  'Cardiologist',
  'Other',
];

const SPECIALIST_OPTS = SPECIALISTS.map((s) => ({ label: s, value: s }));

interface Appt {
  id: string;
  specialist_type: string;
  doctor_name: string | null;
  clinic: string | null;
  scheduled_at: string;
  reason: string | null;
  status: string;
}

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<Appt[]>([]);
  const [specialist, setSpecialist] = useState(SPECIALISTS[0]);
  const [doctor, setDoctor] = useState('');
  const [clinic, setClinic] = useState('');
  const [when, setWhen] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd HH:mm'));
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true });
    setItems((data ?? []) as Appt[]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async () => {
    if (!user || !when.trim()) return;
    const parsedDate = new Date(when.trim().replace(' ', 'T'));
    if (Number.isNaN(parsedDate.getTime())) {
      toast.error('Please enter date as YYYY-MM-DD HH:mm');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('appointments').insert({
      user_id: user.id,
      specialist_type: specialist,
      doctor_name: doctor.trim() || null,
      clinic: clinic.trim() || null,
      scheduled_at: parsedDate.toISOString(),
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Appointment booked');
    setDoctor('');
    setClinic('');
    setReason('');
    load();
  };

  const remove = (id: string) => {
    Alert.alert('Cancel Appointment', 'Cancel this appointment?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Appointment',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('appointments').delete().eq('id', id);
          if (error) return toast.error(error.message);
          load();
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View>
        <View style={[commonStyles.row, { gap: 8 }]}>
          <CalendarClock size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Appointments</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Schedule consultations and follow-ups with healthcare professionals.
        </Text>
      </View>

      <DisclaimerBanner text="This is a personal scheduling tool — it does not communicate with clinics. Confirm appointments directly with your provider." />

      <View style={[commonStyles.card, { gap: 12 }]}>
        <Text style={commonStyles.h2}>Book new appointment</Text>
        <View>
          <Text style={commonStyles.label}>Specialist</Text>
          <ChipSelect options={SPECIALIST_OPTS} value={specialist} onChange={setSpecialist} />
        </View>
        <View>
          <Text style={commonStyles.label}>Doctor (optional)</Text>
          <TextInput
            value={doctor}
            onChangeText={setDoctor}
            placeholder="Dr. Smith"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>Clinic / hospital (optional)</Text>
          <TextInput
            value={clinic}
            onChangeText={setClinic}
            placeholder="City Medical Center"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>When (YYYY-MM-DD HH:mm)</Text>
          <TextInput
            value={when}
            onChangeText={setWhen}
            placeholder="2026-11-10 10:30"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>Reason</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
            placeholder="e.g. Follow-up on skin scan"
            placeholderTextColor={colors.mutedForeground}
            style={[commonStyles.input, { minHeight: 64, textAlignVertical: 'top' }]}
          />
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, (saving || !when.trim()) && { opacity: 0.55 }]}
          disabled={saving || !when.trim()}
          onPress={add}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Plus size={16} color="#FFF" />
          )}
          <Text style={styles.bookBtnText}>Book appointment</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {items.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>No appointments yet.</Text>
          </View>
        ) : (
          items.map((a) => {
            const past = new Date(a.scheduled_at) < new Date();
            return (
              <View key={a.id} style={[commonStyles.card, commonStyles.rowBetween]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={[commonStyles.row, { gap: 8 }]}>
                    <View
                      style={[
                        styles.statusBadge,
                        past
                          ? { backgroundColor: colors.secondary }
                          : { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>
                        {past ? 'Past' : 'Upcoming'}
                      </Text>
                    </View>
                    <Text style={commonStyles.h3}>{a.specialist_type}</Text>
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 13 }}>
                    {format(new Date(a.scheduled_at), 'EEE, MMM d yyyy · h:mm a')}
                  </Text>
                  {a.doctor_name && (
                    <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                      Dr. {a.doctor_name}
                      {a.clinic ? ` · ${a.clinic}` : ''}
                    </Text>
                  )}
                  {a.reason && <Text style={commonStyles.subtitle}>{a.reason}</Text>}
                </View>
                <TouchableOpacity onPress={() => remove(a.id)} style={{ padding: 6 }}>
                  <Trash2 size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  bookBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
