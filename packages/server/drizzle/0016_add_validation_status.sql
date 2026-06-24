alter table prompt_snapshots
  add column if not exists validation_status text,
  add column if not exists validation_reason text;

alter table dna_digests
  add column if not exists validation_status text,
  add column if not exists validation_reason text;
