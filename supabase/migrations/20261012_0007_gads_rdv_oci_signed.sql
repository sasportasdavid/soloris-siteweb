-- ============================================================================
-- Migration 7 — OCI « RDV pris » : inclure aussi les DEVIS SIGNÉS
-- Les commerciaux marquent « Signé » (table devis, signed_at) mais laissent souvent
-- le statut du lead sur « contacté ». La remontée ne doit donc PAS dépendre
-- uniquement de statut='rdv_pris' : on ajoute les leads dont un devis est signé.
-- Valeur = montant du devis signé (CA réel) en priorité. Rollback : .down.sql
-- ============================================================================

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
      -- date de conversion : signature du devis si dispo, sinon passage RDV (updated_at)
      coalesce(d.signed_at, l.updated_at, l.created_at) as conversion_datetime,
      -- valeur : montant du devis signé (CA réel) > prix_total_ttc > montant > estimation > 200
      coalesce(d.montant::numeric, l.prix_total_ttc, l.montant::numeric, l.estimation::numeric, 200)::numeric as value
    from public.leads l
    left join lateral (
      select dv.montant, dv.signed_at
      from public.devis dv
      where dv.lead_id = l.id and dv.signed_at is not null
      order by dv.signed_at desc
      limit 1
    ) d on true
    where l.gclid is not null and l.gclid <> ''
      and l.gads_rdv_uploaded_at is null
      and (l.statut = 'rdv_pris' or d.signed_at is not null)   -- RDV pris OU devis signé
      and l.created_at >= now() - interval '85 days';
end;
$$;
