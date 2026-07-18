import { useContext } from 'react';
import { FrameContext } from '../contexts/FrameContext';

export function useFrames() {
  const context = useContext(FrameContext);
  if (!context) throw new Error('useFrames must be used within FrameProvider');

  return context;
}
