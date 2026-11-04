import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Send, Sparkles, AlertTriangle, Lock } from 'lucide-react-native';
import { supabase, SUPABASE_URL } from '../integrations/supabase/client';
import { useAuth } from '../lib/auth-context';
import { toast } from '../lib/toast';
import { colors, commonStyles } from '../theme';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTER_PROMPTS = [
  'Summarize my recent health trends.',
  'Explain my most recent lab report.',
  'What lifestyle changes might help my symptoms?',
  'What does my last prescription mean?',
];

export function JarvisChat({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<any>(null);

  const send = async (text: string) => {
    const trimmed = text.trim().slice(0, 4000);
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);

    let acc = '';
    const upsert = (chunk: string) => {
      acc += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: acc } : m));
        }
        return [...prev, { role: 'assistant', content: acc }];
      });
    };

    try {
      const {
        data: { session: curSession },
      } = await supabase.auth.getSession();
      if (!curSession?.access_token) {
        toast.error('Please sign in to chat with JARVIS AI.');
        setLoading(false);
        return;
      }

      const url = `${SUPABASE_URL}/functions/v1/jarvis-chat`;

      // Use XMLHttpRequest for progressive SSE streaming compatibility on React Native Android
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${curSession.access_token}`);

        let processedIndex = 0;
        let lineBuf = '';

        const processChunk = (newText: string) => {
          lineBuf += newText;
          let nl: number;
          while ((nl = lineBuf.indexOf('\n')) !== -1) {
            let line = lineBuf.slice(0, nl);
            lineBuf = lineBuf.slice(nl + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6).trim();
            if (json === '[DONE]') continue;
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content;
              if (c) upsert(c);
            } catch {
              // ignore partial line
            }
          }
        };

        xhr.onprogress = () => {
          const responseText = xhr.responseText || '';
          const delta = responseText.slice(processedIndex);
          processedIndex = responseText.length;
          if (delta) processChunk(delta);
        };

        xhr.onload = () => {
          if (xhr.status === 429) {
            reject(new Error('Rate limit exceeded. Try again shortly.'));
            return;
          }
          if (xhr.status === 402) {
            reject(new Error('AI credits exhausted.'));
            return;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(`Chat failed (${xhr.status})`));
            return;
          }
          const remaining = (xhr.responseText || '').slice(processedIndex);
          if (remaining) processChunk(remaining + '\n');
          resolve();
        };

        xhr.onerror = () => reject(new Error('Network request failed'));
        xhr.send(JSON.stringify({ messages: next }));
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chat failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.wrapper, compact ? { height: 440 } : { flex: 1, minHeight: 460 }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={{ padding: 14, gap: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ gap: 12 }}>
            <View style={styles.heroBanner}>
              <View style={[commonStyles.row, { gap: 8 }]}>
                <Sparkles size={20} color="#FFF" />
                <Text style={styles.heroTitle}>Hi, I&apos;m JARVIS</Text>
              </View>
              <Text style={styles.heroBody}>
                Your personal SkinScope AI health assistant. I have access to your scans, lab
                reports, symptoms, prescriptions, and lifestyle logs.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {STARTER_PROMPTS.map((p) => (
                <TouchableOpacity key={p} style={styles.promptChip} onPress={() => send(p)}>
                  <Text style={styles.promptText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((m, i) => (
          <View
            key={i}
            style={[
              styles.msgRow,
              m.role === 'user' ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
            ]}
          >
            <View
              style={[
                styles.msgBubble,
                m.role === 'user' ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={styles.msgText}>{m.content || '…'}</Text>
            </View>
          </View>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <View style={[styles.msgRow, { justifyContent: 'flex-start' }]}>
            <View style={[styles.msgBubble, styles.assistantBubble, commonStyles.row, { gap: 8 }]}>
              <ActivityIndicator size="small" color={colors.primaryGlow} />
              <Text style={[styles.msgText, { color: colors.mutedForeground }]}>
                JARVIS is thinking…
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.disclaimer}>
        <AlertTriangle size={14} color={colors.warning} />
        <Text style={styles.disclaimerText}>
          AI-assisted insights only — not a medical diagnosis. Always consult a healthcare
          professional.
        </Text>
      </View>

      {!session ? (
        <View style={styles.signInBox}>
          <View style={[commonStyles.row, { gap: 8, flex: 1 }]}>
            <Lock size={16} color={colors.primaryGlow} />
            <Text style={commonStyles.subtitle}>Please sign in to chat with JARVIS AI.</Text>
          </View>
          <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/login')}>
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask JARVIS about your health…"
            placeholderTextColor={colors.mutedForeground}
            editable={!loading}
            multiline
            style={styles.textInput}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (loading || !input.trim()) && { opacity: 0.5 }]}
            disabled={loading || !input.trim()}
            onPress={() => send(input)}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Send size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  chatArea: {
    flex: 1,
    backgroundColor: colors.backgroundSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroBanner: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
  },
  heroTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  heroBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  promptChip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  promptText: {
    color: colors.foreground,
    fontSize: 13,
  },
  msgRow: {
    flexDirection: 'row',
  },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: colors.primary,
  },
  assistantBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  msgText: {
    color: colors.foreground,
    fontSize: 13.5,
    lineHeight: 20,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disclaimerText: {
    flex: 1,
    color: '#FDE68A',
    fontSize: 11,
  },
  signInBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  signInBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 100,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.foreground,
    fontSize: 14,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
