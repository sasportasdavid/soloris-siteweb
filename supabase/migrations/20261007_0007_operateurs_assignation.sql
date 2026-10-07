-- ============================================================================
-- Migration 7 — Opérateurs (équipe) + assignation des leads + carte Telegram (Soloris)
-- Additive.
-- - Table `operateurs` : membres de l'équipe (nom, email, téléphone, rôle, actif, lien
--   facultatif vers auth.users = accès au back-office).
-- - `leads.assigne_a` : opérateur en charge du lead.
-- - RPC security definer : `get_lead_for_card` (contenu complet d'un lead pour réécrire sa
--   carte Telegram — lecture, anon + authenticated, uuid non devinable comme get_lead_for_rdv),
--   `set_lead_assignee` (assignation + traçabilité — refuse tout appel non authentifié via
--   auth.role(), ce qui évite un REVOKE : l'outil d'application bloque les ordres destructifs).
-- Appliquée en production le 07/10/2026 en 3 blocs (table, colonne + seed, fonctions).
-- - Seed : un opérateur « admin » par compte auth existant (nom déduit de l'email).
-- Rollback : 20261007_0007_operateurs_assignation.down.sql
-- ============================================================================

create table if not exists public.operateurs (
  id            uuid primary key default gen_random_uuid(),
  nom           text not null,
  email         text unique,
  telephone     text,
  role          text not null default 'commercial' check (role in ('admin','commercial','diagnostiqueur')),
  actif         boolean not null default true,
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.operateurs enable row level security;
create policy operateurs_select on public.operateurs for select to authenticated using (true);
create policy operateurs_insert on public.operateurs for insert to authenticated with check (true);
create policy operateurs_update on public.operateurs for update to authenticated using (true) with check (true);
-- (pas de suppression : un opérateur se désactive, l'historique des leads reste lisible)

alter table public.leads add column if not exists assigne_a uuid references public.operateurs(id) on delete set null;
create index if not exists leads_assigne_a_idx on public.leads(assigne_a);

-- Seed idempotent : chaque compte auth existant devient un opérateur admin.
insert into public.operateurs (nom, email, role, auth_user_id)
select initcap(replace(split_part(u.email, '@', 1), '.', ' ')), u.email, 'admin', u.id
from auth.users u
where u.email is not null
  and not exists (select 1 from public.operateurs o where o.auth_user_id = u.id or lower(o.email) = lower(u.email));

-- ── Contenu complet d'un lead pour (ré)écrire sa carte Telegram ──
create or replace function public.get_lead_for_card(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads; v_op text;
begin
  select * into v_row from leads where id = p_id;
  if v_row.id is null then return jsonb_build_object('found', false); end if;
  select nom into v_op from operateurs where id = v_row.assigne_a;
  return jsonb_build_object('found', true, 'lead', jsonb_build_object(
    'id', v_row.id, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'lead_status', v_row.lead_status, 'source', v_row.source,
    'type_demande', v_row.type_demande, 'type_bien', v_row.type_bien, 'age_bien', v_row.age_bien,
    'surface', v_row.surface, 'secteur', v_row.secteur, 'ville', v_row.ville, 'estimation', v_row.estimation,
    'annexe', v_row.annexe, 'annexe_type', v_row.annexe_type,
    'nom', v_row.nom, 'telephone', v_row.telephone, 'email', v_row.email, 'message', v_row.message,
    'gads_keyword', v_row.gads_keyword, 'campaign', v_row.campaign, 'landing_path', v_row.landing_path,
    'statut', v_row.statut, 'traite_par', v_row.traite_par,
    'rdv_at', v_row.rdv_at, 'rdv_adresse', v_row.rdv_adresse, 'prestation', v_row.prestation,
    'prix_total_ttc', v_row.prix_total_ttc, 'montant', v_row.montant,
    'telegram_message_id', v_row.telegram_message_id, 'assigne_a', v_row.assigne_a, 'assigne_nom', v_op
  ));
end;
$function$;

-- ── Assignation d'un lead à un opérateur actif (null = désassigner) ──
create or replace function public.set_lead_assignee(p_id uuid, p_operateur uuid, p_traite_par text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_row leads;
begin
  -- Réservé aux utilisateurs connectés du back-office (aucun appel anonyme).
  if coalesce(auth.role(), '') <> 'authenticated' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_operateur is not null and not exists (select 1 from operateurs where id = p_operateur and actif) then
    return jsonb_build_object('ok', false, 'error', 'operateur_inconnu');
  end if;
  update leads set assigne_a = p_operateur, traite_par = coalesce(nullif(p_traite_par,''), traite_par), updated_at = now()
    where id = p_id returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'assigne_a', v_row.assigne_a);
end;
$function$;

grant execute on function public.get_lead_for_card(uuid) to anon, authenticated;
grant execute on function public.set_lead_assignee(uuid, uuid, text) to authenticated;
