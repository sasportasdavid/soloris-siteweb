/**
 * GET /api/devis/<token>.pdf — génère le PDF d'un devis à partir de son token de
 * signature (accès public par lien unique non devinable). Lecture via la fonction
 * SECURITY DEFINER get_devis_public (aucun service_role exposé).
 */
import type { APIRoute } from 'astro';
import { SUPABASE_URL, SUPABASE_ANON, SITE_URL } from '../../../lib/serverEnv';
import { generateDevisPdf } from '../../../lib/devisPdf';

export const prerender = false;

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function getDevis(token: string): Promise<any | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_devis_public`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON as string, Authorization: `Bearer ${SUPABASE_ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data || null;
}

export const GET: APIRoute = async ({ params }) => {
  const token = String(params.token || '');
  if (!isUuid(token) || !SUPABASE_URL || !SUPABASE_ANON) return new Response('Indisponible.', { status: 400 });

  let d: any;
  try {
    d = await getDevis(token);
  } catch {
    return new Response('Erreur serveur.', { status: 500 });
  }
  if (!d) return new Response('Devis introuvable.', { status: 404 });

  const signUrl = d.statut === 'signe' ? undefined : `${SITE_URL}/devis/signer/${token}`;
  const pdf = await generateDevisPdf(d, { signUrl });

  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="devis-${d.numero || 'soloris'}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
};
