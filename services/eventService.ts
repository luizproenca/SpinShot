import { getSupabaseClient } from '@/template';
import { Event } from './types';
import { EVENT_COLORS } from '../constants/config';
import * as FileSystem from 'expo-file-system';

const supabase = getSupabaseClient();

// `Date.toISOString()` always converts to UTC first — for a date picked as
// a plain calendar day (no time component), that shifts the stored date
// backward by one day for anyone in a positive UTC offset (e.g. Japan,
// UTC+9): local midnight Aug 11 becomes "2026-08-10T15:00:00Z", and slicing
// the first 10 chars gives Aug 10, not Aug 11. This reads the Date's own
// local year/month/day instead, so the stored value always matches what
// was actually selected on the picker, regardless of timezone.
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Mirrors the server-side window check in supabase/functions/process-video —
// unlock_source alone isn't enough to know if an event actually renders clean
// today; it also has to fall within the window around the real event date.
// Display-only: process-video is still the real source of truth for gating.
export type EventUnlockStatus = 'unlocked' | 'scheduled' | 'expired' | 'locked';

export function getEventUnlockStatus(event: Event): EventUnlockStatus {
  if (!event.unlockSource || !event.eventDate) return 'locked';

  // The date window only protects the paid one-off unlock against reuse —
  // the free first event isn't a purchase, so there's nothing to reuse and
  // no reason to withhold it until the event date gets close.
  if (event.unlockSource === 'free_first_event') return 'unlocked';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const eventDateMs = new Date(event.eventDate).getTime();
  const windowStart = eventDateMs - DAY_MS;
  const windowEnd = eventDateMs + 2 * DAY_MS;
  const now = Date.now();

  if (now < windowStart) return 'scheduled';
  if (now > windowEnd) return 'expired';
  return 'unlocked';
}

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
    eventDate: row.event_date || undefined,
    unlockSource: row.unlock_source || undefined,
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
        event_date: data.eventDate || null,
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
