/**
 * Cron quotidien — remontée des RDV vers Google Ads (import conversions hors-ligne).
 *
 * Déclenché par Vercel Cron (voir vercel.json). À chaque passage :
 *   1. lit les leads `rdv_pris` (gclid, non encore remontés) via la fonction
 *      SECURITY DEFINER `gads_rdv_pending` (gardée par jeton) ;
 *   2. uploade une conversion « Soloris - RDV pris » par lead (orderId = id lead
 *      → Google déduplique, un lead déjà remonté ne compte jamais deux fois) ;
 *   3. marque chaque lead remonté (`gads_rdv_mark_uploaded`).
 *
 * Sécurité : Vercel Cron envoie `Authorization: Bearer $CRON_SECRET`. On refuse
 * toute requête sans ce jeton. Le même secret sert de jeton pour les RPC DB.
 */
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON } from '../../../lib/serverEnv';
import {
  googleAdsConfigured,
  toGoogleAdsDateTime,
  uploadClickConversions,
  type OfflineConversion,
} from '../../../lib/googleAds';

export const prerender = false;

const P = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);
const CRON_SECRET = P.CRON_SECRET;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

type PendingLead = { id: string; gclid: string; conversion_datetime: string; value: number };

export const GET: APIRoute = async ({ request }) => {
  // ── Auth : jeton obligatoire (en-tête Vercel Cron ou appel manuel) ──
  const auth = request.headers.get('authorization') || '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return json({ error: 'supabase non configuré' }, 500);
  }
  if (!googleAdsConfigured()) {
    return json({ error: 'google ads non configuré (variables manquantes)' }, 500);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });

  // 1. Leads à remonter.
  const { data, error } = await db.rpc('gads_rdv_pending', { p_token: CRON_SECRET });
  if (error) return json({ error: 'rpc gads_rdv_pending', detail: error.message }, 500);
  const leads = (data || []) as PendingLead[];
  if (!leads.length) return json({ ok: true, pending: 0, uploaded: 0, message: 'aucun RDV à remonter' });

  // 2. Upload groupé (un seul appel API, partial failure géré par Google).
  const conversions: OfflineConversion[] = leads.map((l) => ({
    gclid: l.gclid,
    conversionDateTime: toGoogleAdsDateTime(new Date(l.conversion_datetime)),
    value: Number(l.value) || 0,
    orderId: l.id,
  }));

  const result = await uploadClickConversions(conversions);
  if (!result.ok) {
    return json({ error: 'upload google ads échoué', status: result.status, detail: result.error }, 502);
  }

  // 3. Marque les leads remontés (on ne remarque pas ceux en partial failure
  //    pour qu'ils soient retentés au prochain passage ; orderId protège du double-compte).
  const failedOrderIds = new Set<string>();
  const pf: any = result.partialFailure;
  if (pf && Array.isArray(pf.details)) {
    // Les erreurs partielles référencent l'index de la conversion en échec.
    try {
      for (const d of pf.details) {
        const errs = d?.errors || d?.googleAdsFailure?.errors || [];
        for (const e of errs) {
          const fp: string = e?.location?.fieldPathElements?.find((x: any) => x?.fieldName === 'conversions')?.index;
          if (fp !== undefined && leads[Number(fp)]) failedOrderIds.add(leads[Number(fp)].id);
        }
      }
    } catch {
      /* si le format diffère, on ne marque rien en échec (prudent) */
    }
  }

  let marked = 0;
  for (const l of leads) {
    if (failedOrderIds.has(l.id)) continue;
    const { error: mErr } = await db.rpc('gads_rdv_mark_uploaded', { p_token: CRON_SECRET, p_id: l.id });
    if (!mErr) marked += 1;
  }

  return json({
    ok: true,
    pending: leads.length,
    uploaded: leads.length - failedOrderIds.size,
    marked,
    partial_failures: failedOrderIds.size,
  });
};
