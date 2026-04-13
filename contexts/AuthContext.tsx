import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/types';
import { authService } from '../services/authService';
import { getSupabaseClient } from '@/template';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Register auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setIsLoading(false);
      } else if (session?.user) {
        try {
          const u = await authService.getStoredUser();
          setUser(u);
        } catch {
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      }
    });

    // Load initial session — always resolves isLoading
    authService.getStoredUser()
      .then(u => { setUser(u); })
      .catch(() => { setUser(null); })
      .finally(() => { setIsLoading(false); });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const u = await authService.login(email, password);
    setUser(u);
  };

  const register = async (name: string, email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> => {
    const result = await authService.register(name, email, password);
    if (!result.needsEmailConfirmation) {
      setUser(result.user);
    }
    return { needsEmailConfirmation: result.needsEmailConfirmation };
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const upgradeToPro = async () => {
    if (!user) return;
    const updated = await authService.upgradeToPro(user.id);
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, upgradeToPro }}>
      {children}
    </AuthContext.Provider>
  );
}
