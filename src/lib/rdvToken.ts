/**
 * Liens RDV signés (HMAC-SHA256) — serveur uniquement.
 * Le token ne contient AUCUNE donnée perso du lead : { lead_id (uuid), tg_user
 * (prénom de l'agent), exp }. Signé avec RDV_LINK_SECRET. Expire (48 h par défaut).
 */
import crypto from 'node:crypto';
import { RDV_LINK_SECRET } from './serverEnv';

export interface RdvTokenPayload { lead_id: string; tg_user: string; exp: number; }

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signRdvToken(p: RdvTokenPayload): string {
  const body = b64urlEncode(JSON.stringify(p));
  const sig = crypto.createHmac('sha256', RDV_LINK_SECRET || '').update(body).digest();
  return body + '.' + b64urlEncode(sig);
}

/** Renvoie le payload si signature valide ET non expiré, sinon null. */
export function verifyRdvToken(token: string): RdvTokenPayload | null {
  if (!token || !RDV_LINK_SECRET) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const body = token.slice(0, dot), sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', RDV_LINK_SECRET).update(body).digest();
  let provided: Buffer;
  try { provided = b64urlDecode(sig); } catch { return null; }
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return null;
  let p: any;
  try { p = JSON.parse(b64urlDecode(body).toString('utf8')); } catch { return null; }
  if (!p || typeof p.lead_id !== 'string' || typeof p.exp !== 'number') return null;
  if (Date.now() > p.exp) return null;
  return p as RdvTokenPayload;
}
