import { useContext } from 'react';
import { VideoContext } from '../contexts/VideoContext';

export function useVideos() {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error('useVideos must be used within VideoProvider');
  return ctx;
}
