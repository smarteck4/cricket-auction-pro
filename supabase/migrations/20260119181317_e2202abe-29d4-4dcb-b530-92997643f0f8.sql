-- Add T5 and Custom to match_format enum, remove Test
ALTER TYPE match_format ADD VALUE IF NOT EXISTS 'T5';
ALTER TYPE match_format ADD VALUE IF NOT EXISTS 'Custom';