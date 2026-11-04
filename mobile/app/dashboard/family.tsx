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
import { Users, Plus, Trash2 } from 'lucide-react-native';
import { supabase } from '../../src/integrations/supabase/client';
import { useAuth } from '../../src/lib/auth-context';
import { toast } from '../../src/lib/toast';
import { DisclaimerBanner } from '../../src/components/ui';
import { colors, commonStyles } from '../../src/theme';

interface Member {
  id: string;
  name: string;
  relation: string | null;
  date_of_birth: string | null;
  notes: string | null;
}

export default function FamilyScreen() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setMembers((data ?? []) as Member[]);
  };

  useEffect(() => {
    load();
  }, [user?.id]);

  const add = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('family_members').insert({
      user_id: user.id,
      name: name.trim(),
      relation: relation.trim() || null,
      date_of_birth: dob || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Family member added');
    setName('');
    setRelation('');
    setDob('');
    setNotes('');
    load();
  };

  const remove = (id: string) => {
    Alert.alert('Remove Member', 'Remove this family member?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('family_members').delete().eq('id', id);
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
          <Users size={24} color={colors.primaryGlow} />
          <Text style={commonStyles.h1}>Family Health</Text>
        </View>
        <Text style={[commonStyles.subtitle, { marginTop: 4 }]}>
          Add family members to track their health alongside yours and watch for hereditary
          patterns.
        </Text>
      </View>

      <DisclaimerBanner text="Hereditary observations are AI-assisted insights based on shared visible patterns — not a genetic diagnosis." />

      <View style={[commonStyles.card, { gap: 12 }]}>
        <Text style={commonStyles.h2}>Add family member</Text>
        <View>
          <Text style={commonStyles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>Relation</Text>
          <TextInput
            value={relation}
            onChangeText={setRelation}
            placeholder="e.g. Mother, Brother"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>Date of birth (YYYY-MM-DD, optional)</Text>
          <TextInput
            value={dob}
            onChangeText={setDob}
            placeholder="1990-05-15"
            placeholderTextColor={colors.mutedForeground}
            style={commonStyles.input}
          />
        </View>
        <View>
          <Text style={commonStyles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
            placeholder="Known conditions, allergies, or family-relevant context"
            placeholderTextColor={colors.mutedForeground}
            style={[commonStyles.input, { minHeight: 68, textAlignVertical: 'top' }]}
          />
        </View>
        <TouchableOpacity
          style={[styles.addBtn, (saving || !name.trim()) && { opacity: 0.55 }]}
          disabled={saving || !name.trim()}
          onPress={add}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Plus size={16} color="#FFF" />
          )}
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 10 }}>
        {members.length === 0 ? (
          <View style={commonStyles.card}>
            <Text style={commonStyles.subtitle}>No family members yet.</Text>
          </View>
        ) : (
          members.map((m) => (
            <View key={m.id} style={commonStyles.card}>
              <View style={commonStyles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={commonStyles.h3}>{m.name}</Text>
                  <Text style={[commonStyles.subtitle, { fontSize: 12 }]}>
                    {m.relation || '—'}{' '}
                    {m.date_of_birth && `· born ${format(new Date(m.date_of_birth), 'MMM yyyy')}`}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => remove(m.id)} style={{ padding: 6 }}>
                  <Trash2 size={16} color={colors.destructive} />
                </TouchableOpacity>
              </View>
              {m.notes ? (
                <Text style={[commonStyles.subtitle, { marginTop: 8 }]}>{m.notes}</Text>
              ) : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
