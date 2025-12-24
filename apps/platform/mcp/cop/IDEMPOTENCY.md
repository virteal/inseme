# Idempotency & Actor Model Patterns

- Write intent (task & step) to persistent storage before performing external actions or publishing
  events (write-ahead).
- Use `source_event_id` on `cop_task` to deduplicate task creation for the same incoming event.
- Use unique indexes (task_id+name) for `cop_step` and (source_task_id,source_step_id,type) for
  `cop_artifact` to make upserts idempotent.
- When processing a step, set `cop_step.status` to `running` and publish a `task_step_started` event
  before heavy work.
- Persist partial results and checkpoints in `cop_step.checkpoint` so actors can resume.
- Agents should be stateless and reconstruct their state from DB: always query
  `cop_task`/`cop_step`/`cop_artifact` to know progress.
- When an agent fails, ensure `last_error`/`status_reason` are recorded, clear worker lease, and let
  task leasing retry.

These rules support Erlang-style "let it crash" semantics by ensuring that replays of messages and
restarts are safe and non-destructive.
