-- ============================================
-- Migration: Add custom avatars for chatbots
-- ============================================
-- Allows creators to set a custom image for each chatbot
-- instead of using the default role emoji

-- Add avatar_url column to community_chatbots
ALTER TABLE community_chatbots
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add show_avatar column to toggle avatar visibility (default true)
ALTER TABLE community_chatbots
ADD COLUMN IF NOT EXISTS show_avatar BOOLEAN DEFAULT true;

-- Comment for clarity
COMMENT ON COLUMN community_chatbots.avatar_url IS 'Custom avatar image URL for the chatbot';
COMMENT ON COLUMN community_chatbots.show_avatar IS 'Whether to show the avatar/emoji (false = no icon)';
