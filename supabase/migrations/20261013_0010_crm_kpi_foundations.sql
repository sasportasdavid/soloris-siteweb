-- ============================================================================
-- Migration 10 — Fondations CRM / KPI
-- 1. first_contact_at : horodatage du 1er contact (speed-to-lead).
-- 2. motif_perte : raison d'un lead « perdu » (analyse des pertes).
-- 3. lead_activity : journal horodaté « qui a fait quoi quand » (timeline).
-- 4. tg_set_status : pose first_contact_at au 1er statut actif + journalise l'activité.
-- ============================================================================

alter table public.leads add column if not exists first_contact_at timestamptz;
alter table public.leads add column if not exists motif_perte text;

-- Journal d'activité (changements de statut, assignations, notes serveur…)
create table if not exists public.lead_activity (
  id       bigint generated always as identity primary key,
  lead_id  uuid not null references public.leads(id) on delete cascade,
  ts       timestamptz not null default now(),
  type     text not null,              -- 'statut' | 'assignation' | 'note' | …
  detail   text,
  par      text                        -- opérateur (nom), si connu
);
create index if not exists lead_activity_lead_idx on public.lead_activity (lead_id, ts desc);

alter table public.lead_activity enable row level security;
drop policy if exists "admin_read_lead_activity" on public.lead_activity;
create policy "admin_read_lead_activity" on public.lead_activity
  for select to authenticated using (true);

-- tg_set_status : + first_contact_at (1er statut ≠ nouveau) + journal
create or replace function public.tg_set_status(p_id uuid, p_statut text, p_traite_par text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_row leads;
begin
  if p_statut not in ('nouveau','contacte','a_recontacter','rdv_pris','realise','facture','perdu') then
    return jsonb_build_object('ok', false, 'error', 'bad_statut');
  end if;
  update leads set
      statut = p_statut,
      first_contact_at = case when first_contact_at is null and p_statut <> 'nouveau' then now() else first_contact_at end,
      traite_par = coalesce(nullif(p_traite_par,''), traite_par),
      updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  insert into lead_activity (lead_id, type, detail, par)
    values (p_id, 'statut', p_statut, nullif(p_traite_par,''));

  return jsonb_build_object('ok', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'nom', v_row.nom, 'telephone', v_row.telephone, 'type_demande', v_row.type_demande,
    'secteur', v_row.secteur, 'estimation', v_row.estimation, 'statut', v_row.statut,
    'traite_par', v_row.traite_par, 'telegram_message_id', v_row.telegram_message_id
  ));
end;
$function$;
