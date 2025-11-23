BEGIN;

-- =====================================================
-- ADD SENDER TRACKING TO NOTIFICATIONS
-- =====================================================
-- This migration adds sender tracking to notifications
-- so we can display agent/user profile icons

-- Add sender columns to notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS sender_type VARCHAR(50) DEFAULT 'system',
ADD COLUMN IF NOT EXISTS sender_id UUID DEFAULT NULL;

-- Add index for sender lookups
CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_type, sender_id);

-- Add comments for documentation
COMMENT ON COLUMN notifications.sender_type IS 'Type of sender: system, agent, or user';
COMMENT ON COLUMN notifications.sender_id IS 'ID of the sender (agent_id or user_id depending on sender_type)';

COMMIT;
