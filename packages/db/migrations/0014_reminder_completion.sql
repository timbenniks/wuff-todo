-- Completion is an invariant across domain updates, GitHub reconciliation and
-- rolling clients. Reopening never restores an earlier personal reminder.
CREATE FUNCTION wuff_cancel_completed_reminders() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE wuff_reminder_jobs
  SET enabled = false, scheduling = 'cancelled', version = version + 1
  WHERE task_id = NEW.id AND enabled = true;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER wuff_task_completion_cancels_reminders
AFTER UPDATE OF completed ON wuff_tasks
FOR EACH ROW WHEN (NEW.completed = true AND OLD.completed = false)
EXECUTE FUNCTION wuff_cancel_completed_reminders();
