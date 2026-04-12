import { getSupabaseClient } from '@/template';
import { Event } from './types';
import { EVENT_COLORS } from '../constants/config';
import * as FileSystem from 'expo-file-system';

const supabase = getSupabaseClient();

function toEvent(row: any): Event {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    logoUri: row.logo_url,
    music: row.music,
    frameId: row.frame_id || undefined,
    frameCloudinaryId: row.frame_cloudinary_id || undefined,
    createdAt: row.created_at,
    videoCount: row.video_count ?? 0,
  };
}

async function uploadLogoFile(userId: string, localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const ext = localUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  const contentType = mimeMap[ext] || 'image/jpeg';
  const fileName = `${userId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('spinshot-logos')
    .upload(fileName, bytes.buffer as ArrayBuffer, { contentType, upsert: false });

  if (error) throw new Error('Upload do logo falhou: ' + error.message);

  const { data } = supabase.storage.from('spinshot-logos').getPublicUrl(fileName);
  return data.publicUrl;
}

export const eventService = {
  async getEvents(userId: string): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(toEvent);
  },

  async createEvent(userId: string, data: Partial<Event> & { logoLocalUri?: string }): Promise<Event> {
    let logoUrl: string | null = null;

    if (data.logoLocalUri && data.logoLocalUri.startsWith('file://')) {
      try {
        logoUrl = await uploadLogoFile(userId, data.logoLocalUri);
      } catch (e) {
        console.error('Logo upload failed:', e);
      }
    } else if (data.logoUri) {
      logoUrl = data.logoUri;
    }

    const { data: row, error } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        name: data.name || 'Novo Evento',
        color: data.color || EVENT_COLORS[0],
        logo_url: logoUrl,
        music: data.music || null,
        frame_id: data.frameId || null,
        frame_cloudinary_id: data.frameCloudinaryId || null,
        video_count: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEvent(row);
  },

  async updateEvent(userId: string, eventId: string, data: Partial<Event> & { logoLocalUri?: string }): Promise<Event> {
    let logoUrl: string | undefined = data.logoUri;

    if (data.logoLocalUri && data.logoLocalUri.startsWith('file://')) {
      try {
        logoUrl = await uploadLogoFile(userId, data.logoLocalUri);
      } catch {}
    }

    const updates: Record<string, any> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.color !== undefined) updates.color = data.color;
    if (data.music !== undefined) updates.music = data.music;
    if (logoUrl !== undefined) updates.logo_url = logoUrl;
    // Allow explicit null to clear frame
    if ('frameId' in data) updates.frame_id = data.frameId || null;
    if ('frameCloudinaryId' in data) updates.frame_cloudinary_id = data.frameCloudinaryId || null;

    const { data: row, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toEvent(row);
  },

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const { data: ev } = await supabase
      .from('events')
      .select('logo_url')
      .eq('id', eventId)
      .single();

    if (ev?.logo_url) {
      try {
        const url = new URL(ev.logo_url);
        const pathParts = url.pathname.split('/spinshot-logos/');
        if (pathParts[1]) {
          await supabase.storage.from('spinshot-logos').remove([pathParts[1]]);
        }
      } catch {}
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  async refreshVideoCount(eventId: string): Promise<number> {
    const { count } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    const total = count ?? 0;

    await supabase
      .from('events')
      .update({ video_count: total })
      .eq('id', eventId);

    return total;
  },

  async incrementVideoCount(eventId: string): Promise<void> {
    const { data } = await supabase
      .from('events')
      .select('video_count')
      .eq('id', eventId)
      .single();

    if (data) {
      await supabase
        .from('events')
        .update({ video_count: (data.video_count || 0) + 1 })
        .eq('id', eventId);
    }
  },
};
