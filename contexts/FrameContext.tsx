import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
import { VideoFrame } from '../services/types';
import { frameService } from '../services/frameService';
import { AuthContext } from './AuthContext';

interface FrameContextType {
  frames: VideoFrame[];
  defaultFrames: VideoFrame[];
  personalFrames: VideoFrame[];
  isLoading: boolean;
  selectedFrameId: string | null;
  setSelectedFrameId: (id: string | null) => void;
  refreshFrames: () => Promise<void>;
  uploadFrame: (localUri: string, name: string, onProgress?: (step: 'uploading' | 'saving') => void) => Promise<VideoFrame>;
  deleteFrame: (frameId: string) => Promise<void>;
}

export const FrameContext = createContext<FrameContextType | undefined>(undefined);

export function FrameProvider({ children }: { children: ReactNode }) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user;

  const [frames, setFrames] = useState<VideoFrame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  const refreshFrames = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await frameService.getFrames(user.id);
      setFrames(data);
    } catch (e) {
      console.error('Failed to load frames:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const uploadFrame = async (localUri: string, name: string, onProgress?: (step: 'uploading' | 'saving') => void): Promise<VideoFrame> => {
    if (!user) throw new Error('Usuário não autenticado');
    const newFrame = await frameService.uploadCustomFrame(user.id, localUri, name, onProgress);
    setFrames(prev => [...prev, newFrame]);
    return newFrame;
  };

  const deleteFrame = async (frameId: string) => {
    if (!user) return;
    await frameService.deleteFrame(user.id, frameId);
    setFrames(prev => prev.filter(f => f.id !== frameId));
    if (selectedFrameId === frameId) setSelectedFrameId(null);
  };

  const defaultFrames = frames.filter(f => f.isDefault);
  const personalFrames = frames.filter(f => !f.isDefault && f.userId === user?.id);

  return (
    <FrameContext.Provider value={{
      frames, defaultFrames, personalFrames, isLoading,
      selectedFrameId, setSelectedFrameId,
      refreshFrames, uploadFrame, deleteFrame,
    }}>
      {children}
    </FrameContext.Provider>
  );
}
