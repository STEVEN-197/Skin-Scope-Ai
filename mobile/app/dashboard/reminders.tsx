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
import { addDays, format } from 'date-fns';
import { Bell, Plus, Sparkles } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { ReminderCard } from '../../src/components/ReminderCard';
import { colors, commonStyles } from '../../src/theme';

interface Reminder {
  id: string;
  label: string;
  due_date: string;
  status: string;
  created_at: string;
}

const QUICK_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

export default function RemindersScreen() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Follow-up scan');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);

  const fetchReminders = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true });
    if (!error && data) setReminders(data as unknown as Reminder[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchReminders();
  }, [user]);

  const handleCreate = async () => {
    if (!user || !dueDate) return;
    setSaving(true);
    const { error } = await supabase
      .from('reminders')
      .insert([{ user_id: user.id, label: label.trim() || 'Follow-up scan', due_date: dueDate }]);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Reminder set!');
    setShowForm(false);
    setLabel('Follow-up scan');
    setDueDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
    fetchReminders();
  };

  const handleComplete = async (id: string) => {
    const { error } = await supabase
      .from('reminders')
      .update({ status: 'completed' })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Marked as completed');
    fetchReminders();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Reminder', 'Delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('reminders').delete().eq('id', id);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success('Reminder deleted');
          fetchReminders();
        },
      },
    ]);
  };

  const upcoming = reminders.filter((r) => r.status !== 'completed');
  const completed = reminders.filter((r) => r.status === 'completed');

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
            Reminders
          </Text>
          <Text style={[commonStyles.h1, { marginTop: 2 }]}>Scan reminders</Text>
          <Text style={commonStyles.subtitle}>
            Schedule follow-up scans so you never miss a check-in.
          </Text>
        </View>
        {!showForm && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)}>
            <Plus size={16} color="#FFF" />
            <Text style={styles.newBtnText}>New reminder</Text>
          </TouchableOpacity>
        )}
      </View>

      {showForm && (
        <View style={[commonStyles.card, { gap: 12 }]}>
          <Text style={commonStyles.h2}>Set a reminder</Text>
          <View>
            <Text style={commonStyles.label}>Label</Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Re-scan skin"
              placeholderTextColor={colors.mutedForeground}
              style={commonStyles.input}
            />
          </View>
          <View>
            <Text style={commonStyles.label}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="2026-11-11"
              placeholderTextColor={colors.mutedForeground}
              style={commonStyles.input}
            />
          </View>
          <View>
            <Text style={commonStyles.label}>Quick set</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {QUICK_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.days}
                  style={styles.quickChip}
                  onPress={() => setDueDate(format(addDays(new Date(), opt.days), 'yyyy-MM-dd'))}
                >
                  <Text style={{ color: colors.foreground, fontSize: 12 }}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[commonStyles.row, { gap: 10 }]}>
            <TouchableOpacity
              style={[styles.setBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={handleCreate}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Bell size={16} color="#FFF" />
              )}
              <Text style={styles.newBtnText}>Set reminder</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
              <Text style={{ color: colors.foreground, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading && <Text style={commonStyles.subtitle}>Loading…</Text>}

      {!loading && reminders.length === 0 && !showForm && (
        <View style={[commonStyles.card, { alignItems: 'center', paddingVertical: 32, gap: 8 }]}>
          <Sparkles size={26} color={colors.primaryGlow} />
          <Text style={commonStyles.h3}>No reminders yet</Text>
          <Text style={commonStyles.subtitle}>Set a follow-up reminder after your next scan.</Text>
          <TouchableOpacity
            style={[styles.newBtn, { marginTop: 8 }]}
            onPress={() => setShowForm(true)}
          >
            <Plus size={15} color="#FFF" />
            <Text style={styles.newBtnText}>Set first reminder</Text>
          </TouchableOpacity>
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={commonStyles.label}>Active</Text>
          {upcoming.map((r) => (
            <ReminderCard
              key={r.id}
              id={r.id}
              label={r.label}
              dueDate={r.due_date}
              status={r.status}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))}
        </View>
      )}

      {completed.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={commonStyles.label}>Completed</Text>
          {completed.map((r) => (
            <ReminderCard
              key={r.id}
              id={r.id}
              label={r.label}
              dueDate={r.due_date}
              status={r.status}
              onComplete={handleComplete}
              onDelete={handleDelete}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  newBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  setBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
});
