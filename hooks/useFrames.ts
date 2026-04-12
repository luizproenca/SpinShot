import { useContext, useEffect } from 'react';
import { FrameContext } from '../contexts/FrameContext';

export function useFrames() {
  const context = useContext(FrameContext);
  if (!context) throw new Error('useFrames must be used within FrameProvider');

  useEffect(() => {
    if (context.frames.length === 0 && !context.isLoading) {
      context.refreshFrames();
    }
  }, []);

  return context;
}
