import React, { useState, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';

// =============================================================================
// VSL Video State Persistence
// Persists video playing state across tab switches using sessionStorage
// =============================================================================

const VSL_STATE_KEY = 'vsl_video_playing';

function getVSLPlayingState(videoId?: string, videoUrl?: string): boolean {
  try {
    const key = videoId || videoUrl || 'default';
    return sessionStorage.getItem(`${VSL_STATE_KEY}_${key}`) === 'true';
  } catch {
    return false;
  }
}

function setVSLPlayingState(playing: boolean, videoId?: string, videoUrl?: string): void {
  try {
    const key = videoId || videoUrl || 'default';
    if (playing) {
      sessionStorage.setItem(`${VSL_STATE_KEY}_${key}`, 'true');
    } else {
      sessionStorage.removeItem(`${VSL_STATE_KEY}_${key}`);
    }
  } catch {
    // sessionStorage might be disabled
  }
}

interface VSLSectionProps {
  videoUrl?: string;
  videoId?: string;
  thumbnailUrl?: string;
  headline?: string;
}

const VSLSection: React.FC<VSLSectionProps> = ({
  videoUrl,
  videoId,
  thumbnailUrl,
  headline = "See Founders Club in Action"
}) => {
  // Initialize from sessionStorage to restore state after tab switch
  const [showVideo, setShowVideo] = useState(() => getVSLPlayingState(videoId, videoUrl));

  // Construct iframe URL from videoId or use videoUrl directly
  // Add enablejsapi=1 for better iframe control
  const embedUrl = videoUrl || (videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1` : '');

  // Persist playing state to sessionStorage
  const handlePlayClick = useCallback(() => {
    setShowVideo(true);
    setVSLPlayingState(true, videoId, videoUrl);
  }, [videoId, videoUrl]);

  // Sync with sessionStorage on mount and visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && showVideo) {
        // Ensure state is persisted when tab becomes visible
        setVSLPlayingState(true, videoId, videoUrl);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [showVideo, videoId, videoUrl]);

  return (
    <section className="py-20 px-4 bg-[#0A0A0A]">
      <div className="max-w-4xl mx-auto">
        {/* Headline */}
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-12 text-[#FAFAFA]">
          {headline}
        </h2>

        {/* Video Container */}
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-[#1F1F1F]">
          {!showVideo ? (
            // Thumbnail with Play Button Overlay
            <div
              className="relative w-full h-full cursor-pointer group"
              onClick={handlePlayClick}
            >
              {/* Thumbnail Image */}
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt="Video thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#1F1F1F] flex items-center justify-center">
                  <p className="text-[#FAFAFA] text-xl font-semibold">Click to Play</p>
                </div>
              )}

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
                </div>
              </div>
            </div>
          ) : (
            // Video iFrame
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video Sales Letter"
            />
          )}
        </div>

        {/* Optional Caption */}
        {!showVideo && (
          <p className="text-center text-[#A0A0A0] mt-6 text-sm">
            Watch the full demo to see how Founders Club replaces 5+ tools
          </p>
        )}
      </div>
    </section>
  );
};

export default VSLSection;
