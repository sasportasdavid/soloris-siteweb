-- Rollback migration 6 — OCI « RDV pris »
drop function if exists public.gads_rdv_mark_uploaded(text, uuid);
drop function if exists public.gads_rdv_pending(text);
delete from private.app_secrets where key = 'gads_cron_secret';
alter table public.leads drop column if exists gads_rdv_uploaded_at;
-- On conserve le schéma `private` et la table `app_secrets` (peuvent servir
-- à d'autres secrets). Les supprimer manuellement si plus aucun usage.
