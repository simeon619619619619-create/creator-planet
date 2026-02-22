-- ============================================================================
-- AUTO-UPDATE STUDENT HEALTH ON LESSON PROGRESS
-- ============================================================================
-- This trigger automatically recalculates risk_score for ONE student when they
-- make progress on a lesson. Avoids expensive batch operations.
-- ============================================================================

-- Function to auto-update student health for one student
CREATE OR REPLACE FUNCTION auto_update_student_health()
RETURNS TRIGGER AS $$
DECLARE
  v_course_id UUID;
  v_risk_score INTEGER;
  v_status student_status;
  v_last_activity_at TIMESTAMPTZ;
  v_days_since_activity INTEGER;
  v_completion_rate INTEGER;
  v_has_engagement BOOLEAN;
  v_activity_points INTEGER;
  v_completion_points INTEGER;
  v_engagement_points INTEGER;
BEGIN
  -- Get course_id from lesson → module → course
  SELECT c.id INTO v_course_id
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  JOIN courses c ON m.course_id = c.id
  WHERE l.id = NEW.lesson_id;

  IF v_course_id IS NULL THEN
    RETURN NEW; -- No course found, skip
  END IF;

  -- Calculate risk score (simplified version of studentHealthService logic)

  -- Factor 1: Days since activity
  v_last_activity_at := NEW.updated_at;
  v_days_since_activity := EXTRACT(DAY FROM (NOW() - v_last_activity_at));
  v_activity_points := LEAST(v_days_since_activity * 2, 40);

  -- Factor 2: Completion rate
  SELECT
    CASE
      WHEN COUNT(l.id) = 0 THEN 0
      ELSE ROUND((COUNT(lp.id) FILTER (WHERE lp.completed_at IS NOT NULL)::NUMERIC / COUNT(l.id)) * 100)
    END INTO v_completion_rate
  FROM modules m
  JOIN lessons l ON l.module_id = m.id
  LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = NEW.user_id
  WHERE m.course_id = v_course_id;

  v_completion_points := LEAST((100 - COALESCE(v_completion_rate, 0))::NUMERIC * 0.4, 40)::INTEGER;

  -- Factor 3: Community engagement (check for posts/comments in past 7 days)
  SELECT EXISTS (
    SELECT 1 FROM posts p
    JOIN community_channels cc ON p.channel_id = cc.id
    JOIN communities com ON cc.community_id = com.id
    JOIN courses c ON c.community_id = com.id
    WHERE c.id = v_course_id
      AND p.author_id = NEW.user_id
      AND p.created_at >= NOW() - INTERVAL '7 days'
    UNION
    SELECT 1 FROM post_comments pc
    JOIN posts p ON pc.post_id = p.id
    JOIN community_channels cc ON p.channel_id = cc.id
    JOIN communities com ON cc.community_id = com.id
    JOIN courses c ON c.community_id = com.id
    WHERE c.id = v_course_id
      AND pc.author_id = NEW.user_id
      AND pc.created_at >= NOW() - INTERVAL '7 days'
  ) INTO v_has_engagement;

  v_engagement_points := CASE WHEN v_has_engagement THEN 0 ELSE 20 END;

  -- Total risk score
  v_risk_score := LEAST(v_activity_points + v_completion_points + v_engagement_points, 100);

  -- Determine status
  v_status := CASE
    WHEN v_risk_score >= 61 THEN 'at_risk'::student_status
    ELSE 'stable'::student_status
  END;

  -- Upsert student_health
  INSERT INTO student_health (user_id, course_id, risk_score, status, last_activity_at, updated_at)
  VALUES (NEW.user_id, v_course_id, v_risk_score, v_status, v_last_activity_at, NOW())
  ON CONFLICT (user_id, course_id)
  DO UPDATE SET
    risk_score = EXCLUDED.risk_score,
    status = EXCLUDED.status,
    last_activity_at = EXCLUDED.last_activity_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on lesson_progress changes
DROP TRIGGER IF EXISTS on_lesson_progress_change ON lesson_progress;
CREATE TRIGGER on_lesson_progress_change
  AFTER INSERT OR UPDATE OF completed_at, progress_percent
  ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_student_health();

COMMENT ON FUNCTION auto_update_student_health IS 'Auto-recalculates risk_score for one student when lesson_progress changes';
COMMENT ON TRIGGER on_lesson_progress_change ON lesson_progress IS 'Triggers risk_score update when student makes progress';
