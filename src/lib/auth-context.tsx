import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const syncSession = (nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const safeSync = (nextSession: Session | null) => {
      if (!mounted) return;
      syncSession(nextSession);
    };

    if (
      typeof window !== "undefined" &&
      localStorage.getItem("mock-user-logged-in") === "true"
    ) {
      safeSync({
        access_token: "mock-token",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "mock-refresh",
        user: {
          id: "mock-user-id",
          email: "test@example.com",
          created_at: new Date().toISOString(),
          app_metadata: {},
          user_metadata: {},
          aud: "authenticated",
          role: "authenticated",
        },
      });
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      safeSync(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        safeSync(data.session ?? null);
      })
      .catch((error) => {
        console.error("Failed to restore session", error);
        safeSync(null);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("mock-user-logged-in");
    }
    syncSession(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signOut,
        setSession: syncSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
