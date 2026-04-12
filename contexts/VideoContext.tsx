import React, { createContext, useState, useEffect, useCallback, ReactNode, useContext } from 'react';
import { Video } from '../services/types';
import { videoService } from '../services/videoService';
import { MusicSelection, MusicTrack } from '../constants/music';
import { AuthContext } from './AuthContext';

export type VideoSaveStep = 'uploading' | 'processing' | 'saving';

interface VideoContextType {
  videos: Video[];
  isLoading: boolean;
  refreshVideos: () => Promise<void>;
  saveVideo: (data: Partial<Video> & { musicSelection?: MusicSelection; musicTracks?: MusicTrack[] }, onProgress?: (step: VideoSaveStep) => void) => Promise<Video>;
  deleteVideo: (videoId: string) => Promise<void>;
}

export const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  const authCtx = useContext(AuthContext);
  const user = authCtx?.user;

  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshVideos = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await videoService.getVideos(user.id);
      setVideos(data);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refreshVideos();
    else setVideos([]);
  }, [user]);

  const saveVideo = async (data: Partial<Video> & { musicSelection?: MusicSelection; musicTracks?: MusicTrack[] }, onProgress?: (step: VideoSaveStep) => void) => {
    if (!user) throw new Error('Usuário não autenticado');
    const newVideo = await videoService.saveVideo(user.id, data, onProgress);
    setVideos(prev => [newVideo, ...prev]);
    return newVideo;
  };

  const deleteVideo = async (videoId: string) => {
    if (!user) return;
    await videoService.deleteVideo(user.id, videoId);
    setVideos(prev => prev.filter(v => v.id !== videoId));
  };

  return (
    <VideoContext.Provider value={{ videos, isLoading, refreshVideos, saveVideo, deleteVideo }}>
      {children}
    </VideoContext.Provider>
  );
}
