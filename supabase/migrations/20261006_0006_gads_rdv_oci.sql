-- ============================================================================
-- Migration 6 — Import de conversions hors-ligne « RDV pris » vers Google Ads (OCI)
-- Additif. Permet au cron Vercel (/api/cron/gads-rdv-upload) de remonter à Google
-- Ads les leads passés en statut `rdv_pris` (gclid présent), pour que le Smart
-- Bidding optimise vers le RDV réel et plus seulement le formulaire.
--
-- Sécurité : la clé anon est PUBLIQUE. On n'expose donc PAS les gclid via une
-- lecture directe. Deux fonctions SECURITY DEFINER gardées par un jeton secret
-- (stocké dans le schéma `private`, non exposé par PostgREST) font le travail.
-- Rollback : 20261006_0006_gads_rdv_oci.down.sql
-- ============================================================================

-- Colonne de suivi : horodatage de la remontée réussie (NULL = pas encore remonté).
alter table public.leads
  add column if not exists gads_rdv_uploaded_at timestamptz;

-- Schéma privé pour les secrets applicatifs (jamais exposé via l'API REST).
create schema if not exists private;

create table if not exists private.app_secrets (
  key   text primary key,
  value text not null
);

-- ── gads_rdv_pending(token) : les leads RDV à remonter ───────────────────────
-- Retourne id + gclid + date de conversion + valeur. Gardé par jeton.
-- Fenêtre 85 j : l'upload hors-ligne Google doit se faire < 90 j après le clic
-- (le clic précède `created_at`), on garde une marge.
create or replace function public.gads_rdv_pending(p_token text)
returns table (id uuid, gclid text, conversion_datetime timestamptz, value numeric)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_token is null
     or p_token <> coalesce((select s.value from private.app_secrets s where s.key = 'gads_cron_secret'), '\x00') then
    raise exception 'unauthorized';
  end if;

  return query
    select
      l.id,
      l.gclid,
      -- Date de conversion = moment où le lead est passé en RDV (updated_at),
      -- jamais rdv_at (= date du RDV planifié, possiblement future → rejet Google).
      coalesce(l.updated_at, l.created_at) as conversion_datetime,
      -- Valeur = prix réel si connu, sinon estimation, sinon défaut 200 €.
      coalesce(l.prix_total_ttc, l.montant::numeric, l.estimation::numeric, 200)::numeric as value
    from public.leads l
    where l.statut = 'rdv_pris'
      and l.gclid is not null
      and l.gclid <> ''
      and l.gads_rdv_uploaded_at is null
      and l.created_at >= now() - interval '85 days';
end;
$$;

-- ── gads_rdv_mark_uploaded(token, id) : marque un lead comme remonté ─────────
create or replace function public.gads_rdv_mark_uploaded(p_token text, p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if p_token is null
     or p_token <> coalesce((select s.value from private.app_secrets s where s.key = 'gads_cron_secret'), '\x00') then
    raise exception 'unauthorized';
  end if;

  update public.leads set gads_rdv_uploaded_at = now() where id = p_id;
end;
$$;

-- Accès : seules ces fonctions (gardées par jeton) sont exécutables par anon.
-- Le schéma `private` et sa table ne sont JAMAIS accessibles à anon/authenticated.
revoke all on function public.gads_rdv_pending(text) from public;
revoke all on function public.gads_rdv_mark_uploaded(text, uuid) from public;
grant execute on function public.gads_rdv_pending(text) to anon, authenticated;
grant execute on function public.gads_rdv_mark_uploaded(text, uuid) to anon, authenticated;
