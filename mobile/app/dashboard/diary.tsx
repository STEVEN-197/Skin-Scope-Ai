import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { format } from 'date-fns';
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { SymptomForm, type DiaryFormData } from '../../src/components/SymptomForm';
import { colors, commonStyles } from '../../src/theme';

interface DiaryEntry {
  id: string;
  entry_date: string;
  itch: number;
  pain: number;
  redness: number;
  dryness: number;
  irritation: number;
  swelling: number;
  products_used: string[];
  triggers: string[];
  notes: string;
  created_at: string;
}

const SYMPTOM_KEYS = ['itch', 'pain', 'redness', 'dryness', 'irritation', 'swelling'] as const;
const SYMPTOM_COLORS: Record<string, string> = {
  itch: '#FB923C',
  pain: '#EF4444',
  redness: '#F43F5E',
  dryness: '#F59E0B',
  irritation: '#EC4899',
  swelling: '#A855F7',
};

export default function DiaryScreen() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('symptom_diary')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(50);
    if (!error && data) setEntries(data as unknown as DiaryEntry[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntries();
  }, [user]);

  const handleCreate = async (data: DiaryFormData) => {
    if (!user) return;
    const { error } = await supabase
      .from('symptom_diary')
      .insert([{ ...data, user_id: user.id }]);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Diary entry saved!');
    setShowForm(false);
    fetchEntries();
  };

  const handleUpdate = async (data: DiaryFormData) => {
    if (!editingId) return;
    const { error } = await supabase.from('symptom_diary').update(data).eq('id', editingId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Entry updated!');
    setEditingId(null);
    fetchEntries();
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Entry', 'Delete this diary entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('symptom_diary').delete().eq('id', id);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success('Entry deleted');
          fetchEntries();
        },
      },
    ]);
  };

  const editEntry = entries.find((e) => e.id === editingId);

  return (
    <ScrollView contentContainerStyle={commonStyles.scrollContent}>
      <View style={commonStyles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.primaryGlow, fontSize: 13, fontWeight: '600' }}>
            Symptom diary
          </Text>
          <Text style={[commonStyles.h1, { marginTop: 2 }]}>Track your symptoms</Text>
          <Text style={commonStyles.subtitle}>
            Log daily symptoms, products, and triggers to spot patterns over time.
          </Text>
        </View>
        {!showForm && !editingId && (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowForm(true)}>
            <Plus size={16} color="#FFF" />
            <Text style={styles.newBtnText}>New entry</Text>
          </TouchableOpacity>
        )}
      </View>

      {showForm && (
        <View style={commonStyles.card}>
          <Text style={[commonStyles.h2, { marginBottom: 12 }]}>New diary entry</Text>
          <SymptomForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitLabel="Save entry"
          />
        </View>
      )}

      {editingId && editEntry && (
        <View style={commonStyles.card}>
          <Text style={[commonStyles.h2, { marginBottom: 12 }]}>Edit entry</Text>
          <SymptomForm
            initial={editEntry}
            onSubmit={handleUpdate}
            onCancel={() => setEditingId(null)}
            submitLabel="Update entry"
          />
        </View>
      )}

      <View style={{ gap: 10 }}>
        {loading && <Text style={commonStyles.subtitle}>Loading…</Text>}
        {!loading && entries.length === 0 && !showForm && (
          <View style={[commonStyles.card, { alignItems: 'center', paddingVertical: 32, gap: 8 }]}>
            <Sparkles size={26} color={colors.primaryGlow} />
            <Text style={commonStyles.h3}>No entries yet</Text>
            <Text style={commonStyles.subtitle}>
              Start logging your symptoms to build a health timeline.
            </Text>
            <TouchableOpacity
              style={[styles.newBtn, { marginTop: 8 }]}
              onPress={() => setShowForm(true)}
            >
              <Plus size={15} color="#FFF" />
              <Text style={styles.newBtnText}>Add first entry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading &&
          entries.map((entry) => {
            const expanded = expandedId === entry.id;
            const maxSev = Math.max(
              entry.itch,
              entry.pain,
              entry.redness,
              entry.dryness,
              entry.irritation,
              entry.swelling,
            );
            return (
              <View key={entry.id} style={commonStyles.card}>
                <TouchableOpacity
                  style={commonStyles.rowBetween}
                  onPress={() => setExpandedId(expanded ? null : entry.id)}
                >
                  <View style={[commonStyles.row, { gap: 10, flex: 1 }]}>
                    <View style={styles.iconBox}>
                      <BookOpen size={16} color={colors.primaryGlow} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={commonStyles.h3}>
                        {format(new Date(entry.entry_date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}
                      </Text>
                      <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                        Peak severity: {maxSev}/10
                        {entry.triggers?.length > 0 &&
                          ` · ${entry.triggers.length} trigger${entry.triggers.length > 1 ? 's' : ''}`}
                      </Text>
                    </View>
                  </View>
                  {expanded ? (
                    <ChevronUp size={18} color={colors.mutedForeground} />
                  ) : (
                    <ChevronDown size={18} color={colors.mutedForeground} />
                  )}
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.symGrid}>
                      {SYMPTOM_KEYS.map((k) => (
                        <View key={k} style={styles.symItem}>
                          <View
                            style={[styles.symDot, { backgroundColor: SYMPTOM_COLORS[k] }]}
                          />
                          <Text style={[commonStyles.subtitle, { flex: 1, fontSize: 12 }]}>
                            {k}
                          </Text>
                          <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 12 }}>
                            {entry[k]}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {entry.triggers?.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <Text style={commonStyles.label}>Triggers</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {entry.triggers.map((t) => (
                            <View key={t} style={styles.tag}>
                              <Text style={{ color: colors.foreground, fontSize: 11 }}>{t}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {entry.products_used?.length > 0 && (
                      <View style={{ gap: 4 }}>
                        <Text style={commonStyles.label}>Products</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {entry.products_used.map((p) => (
                            <View key={p} style={styles.tag}>
                              <Text style={{ color: colors.primaryGlow, fontSize: 11 }}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {entry.notes ? (
                      <View style={{ gap: 4 }}>
                        <Text style={commonStyles.label}>Notes</Text>
                        <Text style={[commonStyles.subtitle, { color: colors.foreground }]}>
                          {entry.notes}
                        </Text>
                      </View>
                    ) : null}

                    <View style={[commonStyles.row, { gap: 10, marginTop: 6 }]}>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => {
                          setEditingId(entry.id);
                          setShowForm(false);
                          setExpandedId(null);
                        }}
                      >
                        <Pencil size={14} color={colors.foreground} />
                        <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>
                          Edit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.delBtn}
                        onPress={() => handleDelete(entry.id)}
                      >
                        <Trash2 size={14} color={colors.destructive} />
                        <Text style={{ color: colors.destructive, fontSize: 12, fontWeight: '600' }}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
      </View>
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
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 12,
    gap: 12,
  },
  symGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  symItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  symDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  delBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.destructiveBg,
  },
});
