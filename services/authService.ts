import { getSupabaseClient } from '@/template';
import { User } from './types';

const supabase = getSupabaseClient();

export const authService = {
  async login(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return {
      id: data.user.id,
      email: data.user.email || email,
      name: profile?.username || email.split('@')[0],
      plan: 'free',
      createdAt: data.user.created_at,
    };
  },

  async register(name: string, email: string, password: string): Promise<{ user: User; needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: name } },
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Erro ao criar conta');

    // If session is already present, email confirmation is disabled → user is ready
    if (data.session) {
      return {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name,
          plan: 'free',
          createdAt: data.user.created_at,
        },
        needsEmailConfirmation: false,
      };
    }

    // No session → email confirmation required
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email,
        name,
        plan: 'free',
        createdAt: data.user.created_at,
      },
      needsEmailConfirmation: true,
    };
  },

  async getStoredUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const u = session.user;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', u.id)
      .single();

    return {
      id: u.id,
      email: u.email || '',
      name: profile?.username || u.email?.split('@')[0] || 'Usuário',
      plan: 'free',
      createdAt: u.created_at,
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async upgradeToPro(_userId: string): Promise<User> {
    // Placeholder: in production, trigger Stripe payment
    const current = await authService.getStoredUser();
    if (!current) throw new Error('Usuário não encontrado');
    return { ...current, plan: 'pro' };
  },
};
