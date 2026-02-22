import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { PlayCircle } from 'lucide-react';

// =============================================================================
// Video Playback Position Persistence
// Saves and restores playback position for native videos using sessionStorage
// =============================================================================

const STORAGE_KEY_PREFIX = 'video_position_';
const SAVE_INTERVAL_MS = 2000; // Save position every 2 seconds

function getStorageKey(url: string): string {
  // Create a consistent key from the URL
  // Use encodeURIComponent for Unicode safety before btoa
  try {
    const encoded = btoa(encodeURIComponent(url));
    return STORAGE_KEY_PREFIX + encoded.slice(0, 32);
  } catch {
    // Fallback for invalid URLs - simple sanitized key
    return STORAGE_KEY_PREFIX + url.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '_');
  }
}

function savePlaybackPosition(url: string, position: number): void {
  if (!url || position < 1) return;
  try {
    sessionStorage.setItem(getStorageKey(url), String(position));
  } catch {
    // sessionStorage might be full or disabled
  }
}

function getPlaybackPosition(url: string): number {
  if (!url) return 0;
  try {
    const saved = sessionStorage.getItem(getStorageKey(url));
    return saved ? parseFloat(saved) : 0;
  } catch {
    return 0;
  }
}

function clearPlaybackPosition(url: string): void {
  if (!url) return;
  try {
    sessionStorage.removeItem(getStorageKey(url));
  } catch {
    // Ignore errors
  }
}

interface VideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
}

type VideoSource =
  | { type: 'youtube'; embedUrl: string }
  | { type: 'vimeo'; embedUrl: string }
  | { type: 'direct'; url: string }
  | { type: 'embed'; url: string };

/**
 * Parses a video URL and returns the appropriate source type and URL
 */
function parseVideoUrl(url: string): VideoSource {
  if (!url) {
    return { type: 'direct', url: '' };
  }

  const trimmedUrl = url.trim();

  // YouTube patterns
  // - youtube.com/watch?v=VIDEO_ID
  // - youtu.be/VIDEO_ID
  // - youtube.com/embed/VIDEO_ID
  // - youtube.com/v/VIDEO_ID
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return {
        type: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1&enablejsapi=1`,
      };
    }
  }

  // Vimeo patterns
  // - vimeo.com/VIDEO_ID
  // - player.vimeo.com/video/VIDEO_ID
  const vimeoPatterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ];

  for (const pattern of vimeoPatterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return {
        type: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0`,
      };
    }
  }

  // Loom patterns
  // - loom.com/share/VIDEO_ID
  // - loom.com/embed/VIDEO_ID
  const loomPattern = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/;
  const loomMatch = trimmedUrl.match(loomPattern);
  if (loomMatch && loomMatch[1]) {
    return {
      type: 'embed',
      url: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  // Check if it's already an embed/iframe URL (contains 'embed' in path)
  if (trimmedUrl.includes('/embed/') || trimmedUrl.includes('/embed?')) {
    return { type: 'embed', url: trimmedUrl };
  }

  // Check file extension for direct video files
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi'];
  const hasVideoExtension = videoExtensions.some(ext =>
    trimmedUrl.toLowerCase().includes(ext)
  );

  // Check if it's a Supabase storage URL (typically contains 'supabase' and 'storage')
  const isSupabaseStorage = trimmedUrl.includes('supabase') && trimmedUrl.includes('storage');

  if (hasVideoExtension || isSupabaseStorage) {
    return { type: 'direct', url: trimmedUrl };
  }

  // Default: try as embed URL (for other platforms)
  // If it's a full URL with https, assume it might be embeddable
  if (trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('http://')) {
    // Check if it looks like a video hosting site
    const videoHosts = ['wistia', 'vidyard', 'dailymotion', 'twitch', 'facebook.com/video'];
    if (videoHosts.some(host => trimmedUrl.includes(host))) {
      return { type: 'embed', url: trimmedUrl };
    }
  }

  // Default to direct video (let browser try to play it)
  return { type: 'direct', url: trimmedUrl };
}

const VideoPlayer: React.FC<VideoPlayerProps> = React.memo(({ url, title, className = '' }) => {
  const videoSource = useMemo(() => parseVideoUrl(url), [url]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveIntervalRef = useRef<number | null>(null);

  // Save current position
  const savePosition = useCallback(() => {
    if (videoRef.current && videoSource.type === 'direct') {
      const currentTime = videoRef.current.currentTime;
      if (currentTime > 1) {
        savePlaybackPosition(url, currentTime);
      }
    }
  }, [url, videoSource.type]);

  // Restore position when video is ready
  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && videoSource.type === 'direct') {
      const savedPosition = getPlaybackPosition(url);
      const duration = videoRef.current.duration;
      // Restore if saved position is valid and not in the last 5% of the video
      if (savedPosition > 0 && savedPosition < duration * 0.95) {
        videoRef.current.currentTime = savedPosition;
      } else if (savedPosition >= duration * 0.95) {
        // Clear position if user was near the end - let video start fresh
        clearPlaybackPosition(url);
      }
    }
  }, [url, videoSource.type]);

  // Clear saved position when video ends
  const handleEnded = useCallback(() => {
    clearPlaybackPosition(url);
  }, [url]);

  // Set up periodic saving and visibility API handling
  useEffect(() => {
    if (videoSource.type !== 'direct') return;

    // Capture video element reference at effect start for proper cleanup
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      // Start periodic saving when video plays
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = window.setInterval(savePosition, SAVE_INTERVAL_MS);
    };

    const handlePause = () => {
      // Save immediately on pause and clear interval
      savePosition();
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };

    // Handle tab visibility changes - save position when tab becomes hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        savePosition();
      }
    };

    // Handle page unload - save position before leaving
    const handleBeforeUnload = () => {
      savePosition();
    };

    // Add event listeners
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      // Save position on unmount
      savePosition();

      // Clean up interval
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }

      // Remove event listeners - 'video' is captured in this closure
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [url, videoSource.type, savePosition]);

  if (!url) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 ${className}`}>
        <div className="text-center text-white">
          <PlayCircle size={64} className="mx-auto mb-4 opacity-80" />
          <p className="font-medium">Video Content</p>
          <p className="text-sm text-white/60 mt-2">No video URL set</p>
        </div>
      </div>
    );
  }

  // YouTube or Vimeo - use iframe with embed URL
  if (videoSource.type === 'youtube' || videoSource.type === 'vimeo') {
    return (
      <iframe
        src={videoSource.embedUrl}
        title={title || 'Video'}
        className={`w-full h-full ${className}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  // Generic embed URL (Loom, etc.)
  if (videoSource.type === 'embed') {
    return (
      <iframe
        src={videoSource.url}
        title={title || 'Video'}
        className={`w-full h-full ${className}`}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  // Direct video file - use native video element with better attributes
  return (
    <video
      ref={videoRef}
      src={videoSource.url}
      title={title}
      className={`w-full h-full ${className}`}
      controls
      playsInline
      preload="metadata"
      crossOrigin="anonymous"
      onLoadedMetadata={handleLoadedMetadata}
      onEnded={handleEnded}
      onError={(e) => {
        // If crossOrigin fails, retry without it
        const video = e.currentTarget;
        if (video.crossOrigin) {
          video.crossOrigin = '';
          video.load();
        }
      }}
    >
      <source src={videoSource.url} type="video/mp4" />
      <source src={videoSource.url} type="video/webm" />
      Your browser does not support the video tag.
    </video>
  );
});

// Display name for debugging
VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
