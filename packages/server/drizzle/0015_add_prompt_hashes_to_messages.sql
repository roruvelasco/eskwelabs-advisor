alter table messages
  add column if not exists prompt_snapshot_hash text,
  add column if not exists system_prompt_hash text;
