-- Migration to support 'False Choice' (False Dilemma) voting option
-- Converts vote_value from BOOLEAN to TEXT

-- 1. Alter the column type, casting existing values
ALTER TABLE public.votes
ALTER COLUMN vote_value TYPE text
USING CASE
    WHEN vote_value = true THEN 'approve'
    WHEN vote_value = false THEN 'disapprove'
    WHEN vote_value IS NULL THEN 'neutral' -- 'null' in DB meant 'Blank/Neutral'
END;

-- 2. Add constraint ensuring valid values
ALTER TABLE public.votes
ADD CONSTRAINT vote_value_check
CHECK (vote_value IN ('approve', 'disapprove', 'neutral', 'false_choice'));
