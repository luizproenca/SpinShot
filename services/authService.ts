import { getSupabaseClient } from '@/template';
import { User } from './types';

const supabase = getSupabaseClient();

function mapAuthUserToUser(authUser: any, profile?: any): User {
  return {
    id: authUser.id,
    email: authUser.email || '',
    name:
      profile?.username ||
      authUser.user_metadata?.username ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'Usuário',
    plan: profile?.plan || 'free',
    createdAt: authUser.created_at,
  };
}

async function getUserProfileSafe(userId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[authService] profile lookup failed:', error.message);
      return null;
    }

    return data ?? null;
  } catch (error: any) {
    console.warn('[authService] profile lookup exception:', error?.message || error);
    return null;
  }
}

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Usuário não retornado no login');
    }

    const profile = await getUserProfileSafe(data.user.id);

    return mapAuthUserToUser(data.user, profile);
  },

  async register(
    name: string,
    email: string,
    password: string
  ): Promise<{ user: User; needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: name, name },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Erro ao criar conta');
    }

    const user = mapAuthUserToUser(data.user, {
      username: name,
      plan: 'free',
    });

    // Se session existe, confirmação por email está desativada
    if (data.session) {
      return {
        user,
        needsEmailConfirmation: false,
      };
    }

    // Sem session, precisa confirmar email
    return {
      user,
      needsEmailConfirmation: true,
    };
  },

  async getStoredUser(): Promise<User | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    if (!session?.user) {
      return null;
    }

    const profile = await getUserProfileSafe(session.user.id);

    return mapAuthUserToUser(session.user, profile);
  },

  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  },

  async upgradeToPro(_userId: string): Promise<User> {
    const current = await authService.getStoredUser();
    if (!current) {
      throw new Error('Usuário não encontrado');
    }

    return { ...current, plan: 'pro' };
  },
};