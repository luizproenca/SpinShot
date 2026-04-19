import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../services/types';
import { authService } from '../services/authService';
import { getSupabaseClient } from '@/template';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  upgradeToPro: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSessionUserToUser(sessionUser: any): User {
  return {
    id: sessionUser.id,
    name:
      sessionUser.user_metadata?.username ||
      sessionUser.user_metadata?.name ||
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split('@')[0] ||
      'Usuário',
    email: sessionUser.email || '',
    plan: 'free',
    createdAt: sessionUser.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let mounted = true;

    const syncUserFromSession = async (session: any) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const storedUser = await authService.getStoredUser();

        if (!mounted) return;

        if (storedUser && storedUser.id === session.user.id) {
          setUser(storedUser);
        } else {
          setUser(mapSessionUserToUser(session.user));
        }
      } catch {
        if (!mounted) return;
        setUser(mapSessionUserToUser(session.user));
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUserFromSession(session);
    });

    const loadInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        await syncUserFromSession(session);
      } catch {
        if (!mounted) return;
        setUser(null);
        setIsLoading(false);
      }
    };

    void loadInitialSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const u = await authService.login(email, password);
      setUser(u);
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ needsEmailConfirmation: boolean }> => {
    setIsLoading(true);
    try {
      const result = await authService.register(name, email, password);

      if (!result.needsEmailConfirmation) {
        setUser(result.user);
      } else {
        setIsLoading(false);
      }

      return { needsEmailConfirmation: result.needsEmailConfirmation };
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

   const deleteAccount = async () => {
    await authService.deleteAccount();
    setUser(null);
  };

  const upgradeToPro = async () => {
    if (!user) return;
    const updated = await authService.upgradeToPro(user.id);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, deleteAccount, upgradeToPro }}
    >
      {children}
    </AuthContext.Provider>
  );
}