import React, { createContext, useContext, useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

let externalListener: ((msg: ToastMessage) => void) | null = null;
let nextId = 1;

export const toast = {
  success: (text: string) => {
    externalListener?.({ id: nextId++, text, kind: 'success' });
  },
  error: (text: string) => {
    externalListener?.({ id: nextId++, text, kind: 'error' });
  },
  info: (text: string) => {
    externalListener?.({ id: nextId++, text, kind: 'info' });
  },
};

const ToastContext = createContext({});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastMessage | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    externalListener = (msg) => {
      setCurrent(msg);
      opacity.setValue(0);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2800),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setCurrent((prev) => (prev?.id === msg.id ? null : prev));
      });
    };
    return () => {
      externalListener = null;
    };
  }, [opacity]);

  return (
    <ToastContext.Provider value={{}}>
      {children}
      {current && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            { opacity },
            current.kind === 'error'
              ? styles.toastError
              : current.kind === 'success'
                ? styles.toastSuccess
                : styles.toastInfo,
          ]}
        >
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  current.kind === 'error'
                    ? colors.destructive
                    : current.kind === 'success'
                      ? colors.success
                      : colors.primaryGlow,
              },
            ]}
          />
          <Text style={styles.toastText} numberOfLines={3}>
            {current.text}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: '#0F2922',
    borderColor: colors.successBorder,
  },
  toastError: {
    backgroundColor: '#2C1215',
    borderColor: colors.destructiveBorder,
  },
  toastInfo: {
    backgroundColor: '#172554',
    borderColor: colors.borderStrong,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toastText: {
    flex: 1,
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '500',
  },
});
