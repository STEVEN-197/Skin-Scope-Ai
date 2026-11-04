import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format, isPast, isToday } from 'date-fns';
import { CalendarCheck, Clock, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';

interface ReminderCardProps {
  id: string;
  label: string;
  dueDate: string;
  status: string;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ReminderCard({ id, label, dueDate, status, onComplete, onDelete }: ReminderCardProps) {
  const due = new Date(dueDate + 'T00:00:00');
  const completed = status === 'completed';
  const dueToday = !completed && isToday(due);
  const overdue = !completed && isPast(due) && !isToday(due);

  const statusConfig = completed
    ? { Icon: CheckCircle2, label: 'Completed', color: colors.success, bg: colors.successBg, border: colors.successBorder }
    : overdue
      ? { Icon: AlertCircle, label: 'Overdue', color: colors.destructive, bg: colors.destructiveBg, border: colors.destructiveBorder }
      : dueToday
        ? { Icon: Clock, label: 'Due today', color: colors.warning, bg: colors.warningBg, border: colors.warningBorder }
        : { Icon: CalendarCheck, label: 'Upcoming', color: colors.primaryGlow, bg: 'rgba(37, 99, 235, 0.12)', border: 'rgba(37, 99, 235, 0.3)' };

  const Icon = statusConfig.Icon;

  return (
    <View style={[styles.card, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
      <View style={styles.left}>
        <Icon size={20} color={statusConfig.color} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.meta}>
            {format(due, 'MMM d, yyyy')} · {statusConfig.label}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {!completed && (
          <TouchableOpacity style={styles.doneBtn} onPress={() => onComplete(id)}>
            <CheckCircle2 size={14} color={colors.success} />
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.delBtn} onPress={() => onDelete(id)}>
          <Trash2 size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    color: colors.mutedForeground,
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  doneText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  delBtn: {
    padding: 6,
  },
});
