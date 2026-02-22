# Video Player Tab-Switch Fix

## Problem Summary

When users start a video and switch browser tabs, the video restarts from the beginning.

## Root Causes (Identified)

1. **VSLSection.tsx** - `showVideo` state managed with `useState` is lost on parent re-renders
2. **VideoPlayer.tsx** - Stateless component that reloads when parent state changes
3. **CourseLMS.tsx** - Frequent `setSelectedCourse()` calls cause cascading re-renders
4. **No Visibility API** - No handlers to save position when tab becomes hidden
5. **Missing YouTube API** - No `enablejsapi=1` parameter for iframe control

---

## Implemented Fixes (2026-01-17)

### 1. VideoPlayer.tsx

**Changes:**
- Wrapped component with `React.memo` to prevent unnecessary re-renders
- Added sessionStorage persistence for native video playback position
- Added `visibilitychange` event listener to save position on tab switch
- Added `beforeunload` listener to save position before page unload
- Added `enablejsapi=1` to YouTube embed URLs
- Periodic position saving every 2 seconds during playback
- Position restoration on video load (skips if user was >95% through)
- Proper event listener cleanup to prevent memory leaks
- Unicode-safe storage key generation

### 2. CourseLMS.tsx

**Changes:**
- Added `key={activeLesson.id}` to VideoPlayer for stable rendering
- Prevents unnecessary remounts when parent state changes

### 3. VSLSection.tsx

**Changes:**
- Added sessionStorage persistence for `showVideo` state
- State initializes from sessionStorage to restore after tab switch
- Added `enablejsapi=1` to YouTube embeds
- Added visibility change handler

---

## Known Limitations

### YouTube/Vimeo Playback Position

The current implementation **does NOT preserve playback position** for YouTube and Vimeo embeds. While `enablejsapi=1` is added to enable future API integration, no JavaScript API integration exists yet.

**Why:** YouTube and Vimeo iframes run in a sandboxed context. To get/set playback position requires:
- YouTube: Loading the YouTube IFrame Player API
- Vimeo: Integrating the `@vimeo/player` SDK

**Impact:** Users watching YouTube/Vimeo videos will still experience restarts on tab switch.

**Future Work:** Add YouTube IFrame API and Vimeo Player.js integration to preserve position for embedded videos.

### Native Videos Only

Playback position persistence works for:
- Direct video files (.mp4, .webm, .ogg, .mov, etc.)
- Supabase storage video URLs

Does NOT work for:
- YouTube embeds
- Vimeo embeds
- Loom embeds
- Other iframe-based video players

---

## Technical Details

### Storage Keys

Video positions are stored in sessionStorage with keys like:
```
video_position_<encoded_url_prefix>
```

The URL is encoded with `encodeURIComponent` + `btoa` for Unicode safety.

### Position Save Triggers

1. Every 2 seconds during playback
2. On video pause
3. On tab visibility change (document becomes hidden)
4. On page unload (beforeunload event)
5. On component unmount

### Position Restoration

- Restored when video metadata loads
- Skipped if saved position is >95% of video duration (assumes video was finished)
- Cleared when video ends

### Event Listener Cleanup

All event listeners are properly cleaned up on component unmount:
- play/pause handlers on video element
- visibilitychange on document
- beforeunload on window
- Interval cleared
