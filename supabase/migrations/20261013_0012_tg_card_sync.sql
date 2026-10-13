-- Suivi de la resynchronisation des cartes Telegram (cron /api/cron/resync-cartes).
-- Une ligne par lead dont la carte a été réécrite depuis la base : permet de reprendre un
-- lot interrompu (limite de débit Telegram) sans tout recommencer. RLS activée sans politique :
-- accessible uniquement avec la clé service (serveur), jamais depuis le navigateur.
create table if not exists public.tg_card_sync (
  lead_id   uuid primary key references public.leads(id) on delete cascade,
  synced_at timestamptz not null default now()
);
alter table public.tg_card_sync enable row level security;
