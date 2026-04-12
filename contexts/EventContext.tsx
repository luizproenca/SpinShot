import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { Event } from '../services/types';
import { eventService } from '../services/eventService';
import { AuthContext } from './AuthContext';

interface EventContextType {
  events: Event[];
  activeEvent: Event | null;
  isLoading: boolean;
  setActiveEvent: (event: Event) => void;
  refreshEvents: () => Promise<void>;
  createEvent: (data: Partial<Event> & { logoLocalUri?: string }) => Promise<Event>;
  updateEvent: (eventId: string, data: Partial<Event> & { logoLocalUri?: string }) => Promise<Event>;
  deleteEvent: (eventId: string) => Promise<void>;
  refreshVideoCount: (eventId: string) => Promise<void>;
}

export const EventContext = createContext<EventContextType | undefined>(undefined);

export function EventProvider({ children }: { children: ReactNode }) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user;

  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvent, setActiveEventState] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshEvents = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await eventService.getEvents(user.id);
      setEvents(data);
      // Keep active event in sync with latest data
      setActiveEventState(prev => {
        if (!prev && data.length > 0) return data[0];
        if (prev) {
          const updated = data.find(e => e.id === prev.id);
          return updated || (data.length > 0 ? data[0] : null);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshEvents();
    } else {
      setEvents([]);
      setActiveEventState(null);
    }
  }, [user]);

  const setActiveEvent = (event: Event) => {
    setActiveEventState(event);
  };

  const createEvent = async (data: Partial<Event> & { logoLocalUri?: string }) => {
    if (!user) throw new Error('Usuário não autenticado');
    const newEvent = await eventService.createEvent(user.id, data);
    setEvents(prev => [newEvent, ...prev]);
    return newEvent;
  };

  const updateEvent = async (eventId: string, data: Partial<Event> & { logoLocalUri?: string }) => {
    if (!user) throw new Error('Usuário não autenticado');
    const updated = await eventService.updateEvent(user.id, eventId, data);
    setEvents(prev => prev.map(e => (e.id === eventId ? updated : e)));
    if (activeEvent?.id === eventId) setActiveEventState(updated);
    return updated;
  };

  const deleteEvent = async (eventId: string) => {
    if (!user) return;
    await eventService.deleteEvent(user.id, eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
    if (activeEvent?.id === eventId) {
      setActiveEventState(prev => {
        const remaining = events.filter(e => e.id !== eventId);
        return remaining.length > 0 ? remaining[0] : null;
      });
    }
  };

  const refreshVideoCount = async (eventId: string) => {
    if (!user) return;
    const count = await eventService.refreshVideoCount(eventId);
    setEvents(prev =>
      prev.map(e => (e.id === eventId ? { ...e, videoCount: count } : e))
    );
    if (activeEvent?.id === eventId) {
      setActiveEventState(prev => prev ? { ...prev, videoCount: count } : prev);
    }
  };

  return (
    <EventContext.Provider value={{
      events, activeEvent, isLoading,
      setActiveEvent, refreshEvents,
      createEvent, updateEvent, deleteEvent, refreshVideoCount,
    }}>
      {children}
    </EventContext.Provider>
  );
}
