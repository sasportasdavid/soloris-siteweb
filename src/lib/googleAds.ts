/**
 * Client minimal Google Ads API (REST) pour l'import de conversions hors-ligne.
 * Aucune dépendance : échange refresh_token → access_token puis appel
 * uploadClickConversions. Secrets lus via process.env (runtime Vercel fiable).
 *
 * Variables d'environnement requises (à définir dans Vercel) :
 *   GOOGLE_ADS_DEVELOPER_TOKEN      jeton développeur Google Ads API
 *   GOOGLE_ADS_CLIENT_ID           OAuth client id
 *   GOOGLE_ADS_CLIENT_SECRET       OAuth client secret
 *   GOOGLE_ADS_REFRESH_TOKEN       refresh token OAuth (scope adwords)
 *   GOOGLE_ADS_CUSTOMER_ID         compte cible, chiffres seuls (ex. 3850992250)
 *   GOOGLE_ADS_LOGIN_CUSTOMER_ID   (optionnel) MCC si l'accès passe par un manager
 *   GADS_RDV_CONVERSION_ACTION_ID  id de l'action « Soloris - RDV pris » (ex. 7824378207)
 *   GOOGLE_ADS_API_VERSION         (optionnel) version API, défaut "v21"
 */

const P = typeof process !== 'undefined' && process.env ? process.env : ({} as Record<string, string | undefined>);

const API_VERSION = P.GOOGLE_ADS_API_VERSION || 'v21';
const DEVELOPER_TOKEN = P.GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID = P.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = P.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = P.GOOGLE_ADS_REFRESH_TOKEN;
const CUSTOMER_ID = (P.GOOGLE_ADS_CUSTOMER_ID || '').replace(/\D/g, '');
const LOGIN_CUSTOMER_ID = (P.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/\D/g, '');
const CONVERSION_ACTION_ID = (P.GADS_RDV_CONVERSION_ACTION_ID || '').replace(/\D/g, '');

export function googleAdsConfigured(): boolean {
  return Boolean(
    DEVELOPER_TOKEN && CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && CUSTOMER_ID && CONVERSION_ACTION_ID,
  );
}

/** Format exigé par Google : "yyyy-MM-dd HH:mm:ss+00:00" (UTC ici). */
export function toGoogleAdsDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`
  );
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token error ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error('OAuth: access_token manquant');
  return j.access_token;
}

export type OfflineConversion = {
  /** Identifiant de clic : Google en exige UN SEUL (gclid, sinon gbraid, sinon wbraid). */
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  conversionDateTime: string; // via toGoogleAdsDateTime()
  value: number;
  orderId: string; // id du lead = clé de déduplication Google
};

/** Un seul identifiant par conversion : gclid prioritaire, puis gbraid, puis wbraid (clics iOS). */
export function clickId(c: Pick<OfflineConversion, 'gclid' | 'gbraid' | 'wbraid'>): Record<string, string> {
  if (c.gclid) return { gclid: c.gclid };
  if (c.gbraid) return { gbraid: c.gbraid };
  if (c.wbraid) return { wbraid: c.wbraid };
  return {};
}

export type UploadResult = {
  ok: boolean;
  status: number;
  partialFailure?: unknown;
  error?: string;
};

/**
 * Remonte un lot de conversions hors-ligne vers l'action « RDV pris ».
 * partialFailureEnabled = true (exigé par Google) → un lead en erreur n'empêche
 * pas les autres ; les rejets reviennent dans partialFailureError.
 */
export async function uploadClickConversions(conversions: OfflineConversion[]): Promise<UploadResult> {
  if (!googleAdsConfigured()) {
    return { ok: false, status: 0, error: 'Google Ads non configuré (variables d’environnement manquantes)' };
  }
  const accessToken = await getAccessToken();
  const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}:uploadClickConversions`;
  const conversionActionRes = `customers/${CUSTOMER_ID}/conversionActions/${CONVERSION_ACTION_ID}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
    'developer-token': DEVELOPER_TOKEN!,
  };
  if (LOGIN_CUSTOMER_ID) headers['login-customer-id'] = LOGIN_CUSTOMER_ID;

  const body = {
    conversions: conversions.map((c) => ({
      ...clickId(c),
      conversionAction: conversionActionRes,
      conversionDateTime: c.conversionDateTime,
      conversionValue: c.value,
      currencyCode: 'EUR',
      orderId: c.orderId,
    })),
    partialFailureEnabled: true,
  };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, error: text };
  }
  let parsed: any = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    /* réponse vide = succès */
  }
  return { ok: true, status: res.status, partialFailure: parsed?.partialFailureError };
}
