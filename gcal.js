/* gcal.js — il collegamento con Google Calendar.
   Bussola legge TUTTI i calendari dell'utente (lezioni, Genio, ripetizioni…) e scrive i blocchi nuovi nel calendario
   principale. Accesso con il flusso "implicito" di Google: si va alla pagina di Google, si dà il permesso, si torna su
   Bussola con un gettone (access token) che vale circa un'ora. Funziona anche nell'app sulla Home dell'iPhone.
   Il gettone resta solo su questo dispositivo (localStorage). Il client id è pubblico (config.js), nessun segreto qui.
   Gli eventi creati da Bussola hanno extendedProperties.private = { bussola: "1", tipo, fonte } per riconoscerli. */
import { GOOGLE_CLIENT_ID, GOOGLE_PER_SEMPRE } from "./config.js?v=20261031181718";
import { funzione } from "./dati.js?v=20261031181718";
import { colG } from "./colori.js?v=20261031181718";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events";
const API = "https://www.googleapis.com/calendar/v3";
const K = "bussola.gtoken";
export const disponibile = () => !!GOOGLE_CLIENT_ID;

function gettone() {
  try { const t = JSON.parse(localStorage.getItem(K) || "null"); return t && t.scade > Date.now() + 60000 ? t.t : null; } catch { return null; }
}
/* «per sempre» (dal 2026-10-29): il permesso lungo (refresh token) sta su Supabase, funzione google-token; qui resta solo
   il segno «collegato per sempre» e il gettone di un'ora, che si rinnova da solo quando scade. */
const KS = "bussola.gsempre";
export const perSempre = () => { try { return GOOGLE_PER_SEMPRE && localStorage.getItem(KS) === "1"; } catch { return false; } };
function salvaGettone(t, dura) { try { localStorage.setItem(K, JSON.stringify({ t, scade: Date.now() + (Number(dura) || 3600) * 1000 })); } catch { /* niente */ } }
export const collegato = () => !!gettone() || perSempre();
export function scollega({ ovunque = false } = {}) {
  try { localStorage.removeItem(K); if (ovunque) localStorage.removeItem(KS); } catch { /* niente */ }
  if (ovunque && GOOGLE_PER_SEMPRE) funzione("google-token", { azione: "scollega" }).catch(() => {});
  cache.clear(); calendariCache = null;
}
let rinnovo = null;
/** chiede a Supabase un gettone nuovo (una richiesta sola anche se la chiedono in tanti) */
function rinnova() {
  return rinnovo ||= funzione("google-token", { azione: "rinnova" })
    .then(d => { if (d?.access_token) { salvaGettone(d.access_token, d.expires_in); return d.access_token; } if (d?.errore === "scollegato") try { localStorage.removeItem(KS); } catch { /* niente */ } return null; })
    .catch(() => null).finally(() => { rinnovo = null; });
}

/** porta alla pagina di Google per dare il permesso; al ritorno leggiRitorno() salva il gettone */
export function collega(email = "") {
  const q = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID, redirect_uri: location.origin + location.pathname, response_type: GOOGLE_PER_SEMPRE ? "code" : "token",
    scope: SCOPE, include_granted_scopes: "true", state: "bussola", prompt: GOOGLE_PER_SEMPRE ? "consent select_account" : "select_account",
  });
  if (GOOGLE_PER_SEMPRE) q.set("access_type", "offline");   // così Google dà anche il permesso lungo
  if (email) q.set("login_hint", email);
  location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + q;
}
/** al ritorno da Google l'indirizzo contiene #access_token=…: lo salvo e pulisco l'indirizzo */
export function leggiRitorno() {
  const qs = new URLSearchParams(location.search);
  if (qs.get("code") && qs.get("state") === "bussola") {   // flusso «per sempre»: il codice lo scambia la funzione, dopo l'accesso
    try { sessionStorage.setItem("bussola.gcode", qs.get("code")); } catch { /* niente */ }
    ["code", "state", "scope", "authuser", "prompt", "hd"].forEach(k => qs.delete(k));
    history.replaceState(null, "", location.pathname + (qs.toString() ? "?" + qs : ""));
    return true;
  }
  if (!location.hash.includes("access_token")) return false;
  const h = new URLSearchParams(location.hash.slice(1));
  const t = h.get("access_token");
  if (t) salvaGettone(t, h.get("expires_in"));
  history.replaceState(null, "", location.pathname + location.search);
  return !!t;
}

/** dopo l'accesso a Bussola: se Google ha appena dato il codice, lo scambio (Supabase) e resto collegato per sempre */
export async function completaRitorno() {
  let code = null;
  try { code = sessionStorage.getItem("bussola.gcode"); sessionStorage.removeItem("bussola.gcode"); } catch { /* niente */ }
  if (!code) return false;
  const d = await funzione("google-token", { azione: "scambia", code, redirect: location.origin + location.pathname }).catch(() => null);
  if (!d?.access_token) return false;
  salvaGettone(d.access_token, d.expires_in);
  if (d.lungo) try { localStorage.setItem(KS, "1"); } catch { /* niente */ }
  cache.clear();
  return true;
}

async function api(percorso, opz = {}, ancora = true) {
  let t = gettone();
  if (!t && perSempre()) t = await rinnova();
  if (!t) throw new Error("scollegato");
  const r = await fetch(API + percorso, { ...opz, headers: { Authorization: "Bearer " + t, "Content-Type": "application/json", ...(opz.headers || {}) } });
  if (r.status === 401) {
    try { localStorage.removeItem(K); } catch { /* niente */ }
    if (ancora && perSempre()) return api(percorso, opz, false);   // gettone scaduto prima del previsto: ne prendo uno nuovo
    scollega(); throw new Error("scollegato");
  }
  if (r.status === 204) return null;
  if (!r.ok) throw new Error("Google Calendar: " + r.status + " " + (await r.text()).slice(0, 200));
  return r.json();
}

// ---------- leggere ----------
let calendariCache = null;
export async function calendari() {
  if (calendariCache) return calendariCache;
  const d = await api("/users/me/calendarList?maxResults=100");
  calendariCache = (d.items || []).filter(c => !c.hidden).map(c => ({ id: c.id, nome: c.summaryOverride || c.summary, colore: c.backgroundColor, principale: !!c.primary, scrivibile: ["owner", "writer"].includes(c.accessRole) }));
  return calendariCache;
}
export const calendariNoti = () => calendariCache;

const pad = n => String(n).padStart(2, "0");
const isoLocale = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cache = new Map();   // lunedì → { quando, eventi }
const vecchi = new Map();  // lunedì → l'ultima lettura (resta anche dopo uno svuotamento: niente «Leggo…» a ogni modifica)
/** tutti gli eventi della settimana (lun-dom) di tutti i calendari, già "appiattiti" (ripetizioni espanse) */
export async function eventiSettimana(lun, { forza = false, escludi = [] } = {}) {
  const c = cache.get(lun);
  if (c && !forza && Date.now() - c.quando < 3 * 60000) return c.eventi;
  const [y, m, g] = lun.split("-").map(Number), da = new Date(y, m - 1, g), a = new Date(y, m - 1, g + 7);
  const C = (await calendari()).filter(x => !escludi.includes(x.id));
  const liste = await Promise.all(C.map(cal => api(`/calendars/${encodeURIComponent(cal.id)}/events?` + new URLSearchParams({
    timeMin: da.toISOString(), timeMax: a.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: "250",
  })).then(d => (d.items || []).map(e => normalizza(e, cal))).catch(() => [])));
  const eventi = liste.flat().filter(e => e && e.stato !== "cancelled").sort((x, y) => (x.inizio < y.inizio ? -1 : 1));
  cache.set(lun, { quando: Date.now(), eventi }); vecchi.set(lun, eventi);
  return eventi;
}
export const eventiInCache = lun => cache.get(lun)?.eventi || null;
export const eventiVecchi = lun => vecchi.get(lun) || null;
/** cambio subito l'evento nelle letture già fatte, così la modifica si vede prima che Google risponda */
function ritocca(id, { titolo, giorno, da, a, luogo }) {
  for (const L of [...[...cache.values()].map(c => c.eventi), ...vecchi.values()])
    for (const e of L) if (e.id === id) {
      if (!giorno) { if (titolo) e.titolo = titolo; continue; }
      const ini = new Date(`${giorno}T${da}:00`), fin = new Date(`${giorno}T${a}:00`);
      if (fin <= ini) fin.setDate(fin.getDate() + 1);
      Object.assign(e, { titolo: titolo ?? e.titolo, inizio: ini, fine: fin, giorno, luogo: luogo ?? e.luogo });
    }
}
export const dimentica = lun => cache.delete(lun);
function normalizza(e, cal) {
  const tutto = !!e.start?.date;
  const ini = tutto ? new Date(e.start.date + "T00:00:00") : new Date(e.start.dateTime);
  const fin = tutto ? new Date(e.end.date + "T00:00:00") : new Date(e.end.dateTime);
  const p = e.extendedProperties?.private || {};
  return {
    id: e.id, calId: cal.id, cal: cal.nome, colore: e.colorId ? colG(e.colorId).c : cal.colore, colorId: e.colorId || "", titolo: e.summary || "(senza titolo)", luogo: e.location || "",
    tuttoIlGiorno: tutto, inizio: ini, fine: fin, giorno: isoLocale(ini), stato: e.status, libero: e.transparency === "transparent",
    bussola: p.bussola === "1", tipo: p.tipo || "", fonte: p.fonte || "",
  };
}

// ---------- scrivere (nel calendario principale) ----------
const quando = (giorno, ora) => ({ dateTime: `${giorno}T${ora}:00`, timeZone: "Europe/Rome" });
/** avviso = minuti prima dell'inizio in cui il telefono suona (il viaggio + 5': «parti adesso») */
function corpo({ titolo, giorno, da, a, tipo, fonte, luogo, note, colore, avviso }) {
  let giornoFine = giorno;
  if (a <= da) { const [y, m, g] = giorno.split("-").map(Number); giornoFine = isoLocale(new Date(y, m - 1, g + 1)); }   // finisce dopo mezzanotte
  return {
    summary: titolo, start: quando(giorno, da), end: quando(giornoFine, a), colorId: colore || undefined,   // solo uno degli 11 colori che Google accetta; altrimenti il predefinito
    location: luogo && luogo !== "Casa" ? luogo : undefined, description: note || "Da Bussola",
    extendedProperties: { private: { bussola: "1", tipo: tipo || "", fonte: fonte || "" } },
    ...(avviso ? { reminders: { useDefault: false, overrides: [{ method: "popup", minutes: avviso }] } } : {}),
  };
}
export async function crea(b) { const e = await api("/calendars/primary/events", { method: "POST", body: JSON.stringify(corpo(b)) }); cache.clear(); return e.id; }
export async function aggiorna(id, b, calId = "primary") { await api(`/calendars/${encodeURIComponent(calId)}/events/${id}`, { method: "PATCH", body: JSON.stringify(corpo(b)) }); cache.clear(); }
/** cambia solo alcuni campi (anche di eventi non creati da Bussola: luogo, colore, orari, titolo) */
export async function aggiornaCampi(id, { titolo, giorno, da, a, luogo, descrizione, avviso }, calId = "primary") {
  const c = corpo({ titolo, giorno, da, a, luogo });
  ritocca(id, { titolo, giorno, da, a, luogo });
  // il colore NON si manda: dopo la creazione ogni app tiene il suo (scelta dell'utente)
  const campi = { summary: c.summary, start: c.start, end: c.end };
  if (luogo !== undefined) campi.location = luogo || "";   // senza luogo: quello di Calendar resta com'è
  if (descrizione !== undefined) campi.description = descrizione;
  if (avviso) campi.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: avviso }] };
  if (!giorno) { delete campi.start; delete campi.end; }   // solo titolo / descrizione
  try { await api(`/calendars/${encodeURIComponent(calId)}/events/${id}`, { method: "PATCH", body: JSON.stringify(campi) }); }
  catch (err) { cache.clear(); vecchi.clear(); throw err; }   // non è andata: rileggo tutto da Google
}
export async function elimina(id, calId = "primary") {
  for (const L of [...[...cache.values()].map(c => c.eventi), ...vecchi.values()]) { const i = L.findIndex(e => e.id === id); if (i >= 0) L.splice(i, 1); }
  await api(`/calendars/${encodeURIComponent(calId)}/events/${id}`, { method: "DELETE" }).catch(() => null);
}
