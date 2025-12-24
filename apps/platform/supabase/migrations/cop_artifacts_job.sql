alter table public.cop_artifacts
  add column task_id uuid references public.cop_tasks(id) on delete cascade,
  add column task_step_id uuid references public.cop_steps(id) on delete cascade;
