-- Migration: Add hazard game tables and missions
-- Run this in your Supabase SQL editor

-- Create hazard_game_sessions table
CREATE TABLE hazard_game_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    analysis_result jsonb NOT NULL,
    score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    hazards_detected integer NOT NULL DEFAULT 0,
    overall_safety integer NOT NULL DEFAULT 1 CHECK (overall_safety >= 1 AND overall_safety <= 5),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for efficient queries
CREATE INDEX idx_hazard_game_sessions_user_id ON hazard_game_sessions(user_id);
CREATE INDEX idx_hazard_game_sessions_created_at ON hazard_game_sessions(created_at);
CREATE INDEX idx_hazard_game_sessions_score ON hazard_game_sessions(score);

-- Enable RLS (Row Level Security)
ALTER TABLE hazard_game_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own game sessions" ON hazard_game_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game sessions" ON hazard_game_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hazard_game_sessions_updated_at 
    BEFORE UPDATE ON hazard_game_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert hazard game missions
INSERT INTO missions (title, description, period, target_value, reward_points, reward_badge_id, target_type) VALUES
('写真危険発見ゲーム初回プレイ', '写真から危険を発見するゲームを1回プレイしよう', 'daily', 1, 50, NULL, 'hazard_game_play'),
('写真危険発見ゲーム3回プレイ', '写真から危険を発見するゲームを3回プレイしよう', 'daily', 3, 100, NULL, 'hazard_game_play'),
('高スコア達成', '写真危険発見ゲームで80点以上を取ろう', 'daily', 1, 150, NULL, 'hazard_game_high_score'),
('週間ゲームマスター', '1週間で写真危険発見ゲームを10回プレイしよう', 'weekly', 10, 300, NULL, 'hazard_game_play'),
('完璧な安全分析', '写真危険発見ゲームで90点以上を取ろう', 'weekly', 1, 400, NULL, 'hazard_game_high_score');

-- Create function to update mission progress for hazard game
CREATE OR REPLACE FUNCTION update_mission_progress(
    p_user_id uuid,
    p_mission_type text,
    p_increment integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    mission_record RECORD;
    current_progress integer;
    new_progress integer;
BEGIN
    -- Get all missions of the specified type
    FOR mission_record IN 
        SELECT id, target_value, reward_points, reward_badge_id
        FROM missions 
        WHERE target_type = p_mission_type
    LOOP
        -- Get current progress or create new record
        SELECT COALESCE(progress, 0) INTO current_progress
        FROM user_mission_progress 
        WHERE user_id = p_user_id AND mission_id = mission_record.id;
        
        IF current_progress IS NULL THEN
            current_progress := 0;
        END IF;
        
        -- Calculate new progress
        new_progress := current_progress + p_increment;
        
        -- Insert or update progress
        INSERT INTO user_mission_progress (user_id, mission_id, progress, completed, updated_at)
        VALUES (p_user_id, mission_record.id, new_progress, new_progress >= mission_record.target_value, NOW())
        ON CONFLICT (user_id, mission_id) 
        DO UPDATE SET 
            progress = new_progress,
            completed = new_progress >= mission_record.target_value,
            updated_at = NOW();
            
        -- Award points and badge if mission completed
        IF new_progress >= mission_record.target_value AND current_progress < mission_record.target_value THEN
            -- Award points
            IF mission_record.reward_points IS NOT NULL THEN
                PERFORM increment_user_points(p_user_id, mission_record.reward_points);
            END IF;
            
            -- Award badge
            IF mission_record.reward_badge_id IS NOT NULL THEN
                INSERT INTO user_badges (user_id, badge_id, acquired_at)
                VALUES (p_user_id, mission_record.reward_badge_id, NOW())
                ON CONFLICT (user_id, badge_id) DO NOTHING;
            END IF;
        END IF;
    END LOOP;
END;
$$;