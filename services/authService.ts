import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
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

    if (data.session) {
      return {
        user,
        needsEmailConfirmation: false,
      };
    }

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

  async deleteAccount(): Promise<void> {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.user) {
      throw new Error('Usuário não autenticado');
    }

    const userId = session.user.id;

    // Best-effort cleanup de arquivos antes da exclusão do usuário
    const buckets: Array<{ bucket: string; limit: number }> = [
      { bucket: 'spinshot-videos', limit: 200 },
      { bucket: 'spinshot-logos',  limit: 100 },
      { bucket: 'spinshot-frames', limit: 100 },
    ];

    for (const { bucket, limit } of buckets) {
      try {
        const { data: files } = await supabase.storage.from(bucket).list(userId, { limit });
        if (files?.length) {
          await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
        }
      } catch (e) {
        console.warn(`[deleteAccount] failed to remove files from ${bucket}`, e);
      }
    }

    // Chama a Edge Function via SDK (garante URL e auth corretos automaticamente)
    const { error: fnError } = await supabase.functions.invoke('delete-account', {
      body: {},
    });

    if (fnError) {
      let msg = fnError.message ?? 'Erro ao excluir conta';
      if (fnError instanceof FunctionsHttpError) {
        try {
          const text = await fnError.context?.text();
          if (text) msg = text;
        } catch {}
      }
      throw new Error(msg);
    }

    // Limpa sessão local após exclusão bem-sucedida
    await supabase.auth.signOut();
  },

  async upgradeToPro(_userId: string): Promise<User> {
    const current = await authService.getStoredUser();
    if (!current) {
      throw new Error('Usuário não encontrado');
    }

    return { ...current, plan: 'pro' };
  },
};
