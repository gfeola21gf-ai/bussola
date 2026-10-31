/* persone.js — le PERSONE semplici e le USCITE (dal 2026-10-29; anteprima approvata: anteprima/persone.html).
   L'utente: «l'app deve facilitarmi, non essere un impegno in più». Quindi una persona ha solo nome e ogni quanto,
   e «sentito» si segna quasi da solo:
     · dal calendario: un evento passato col suo nome nel titolo («Cena con Marco») → sentito quel giorno (daCalendario)
     · dal «+»: «sentito Marco», «chiamato mamma», «visto Anna» (rapide.js → sentito)
     · spuntando un'azione con quella persona («Chiamare Marco») (rapide.js → daAzione)
     · scorrendo a destra sul nome (gesti qui sotto)
   Chiavi:
     persona:<id> { nome, ogni (7 | 14 | 30 | 0 = ogni tanto), ultimo (AAAA-MM-GG), ultimoDa (titolo dell'evento) }
                  (tel e note delle versioni vecchie restano nei dati ma non si usano più)
     uscita:<id>  { persona, sett (lunedì), dur (minuti), stato: proporre | attesa | fissata | fatta, sue (il suo messaggio
                  incollato), giorno, da, a, creata }
   Uscita: «Copia per WhatsApp» = le tue disponibilità della settimana; incolli le sue → capisciDate() le legge (regole,
   niente intelligenza artificiale) → proposte() le incrocia con i tuoi spazi liberi (Calendar, stacco, viaggi; meglio nella
   finestra Persone) → un tocco = blocco in Calendar (fonte "uscita:<id>"). Passata la data → fatta e persona sentita.
   Usa SOLO attributi data-ps / data-psid / data-psc e classi .ps-* (gli altri sono di app.js, pianifica.js, rapide.js). */
import * as G from "./gcal.js?v=20261031181718";
let C, X;
/** C = strumenti di app.js; X = quelli di pianifica.js (blocchiSettimana, salvaBlocco, togliDaFonte, metodo, tragitto, …) */
export function init(ctx, extra) { C = ctx; X = extra; }
const $ = s => document.querySelector(s);
const nid = () => C.nuovoId();
const OGNI = [[7, "Ogni settimana"], [14, "Ogni 2 sett."], [30, "Ogni mese"], [0, "Ogni tanto"]];
const GG = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const F = { foglio: null };

// =========================================================
// DATI
// =========================================================
export const tutte = () => C.tutte("persona:");
const leggiP = id => { const p = C.D.leggi("persona:" + id); return p ? { ...p, id } : null; };
const scriviP = (pe, cambia) => { const { id, ...resto } = pe; C.D.scrivi("persona:" + id, { ...resto, ...cambia }); };
const ogniN = pe => pe.ogni === 0 || pe.ogni === "0" ? 0 : Number(pe.ogni) || 14;
export const ogniTesto = pe => (OGNI.find(o => o[0] === ogniN(pe)) || OGNI[1])[1].toLowerCase();
/** quanto è «in ritardo»: giorni passati / ogni quanto (sopra 1 = rosso). Ogni tanto = 0, mai segnato = giallo */
function ritardo(pe) {
  if (!ogniN(pe)) return 0;
  if (!pe.ultimo) return .8;
  return C.giorniTra(pe.ultimo, C.oggi()) / ogniN(pe);
}
export function stato(pe) {
  const gg = pe.ultimo ? C.giorniTra(pe.ultimo, C.oggi()) : null, r = ritardo(pe);
  const c = !ogniN(pe) ? "grigio" : r > 1 ? "rosso" : r > .75 ? "giallo" : "verde";
  return { c, gg, r, testo: gg == null ? "non ancora segnato" : gg === 0 ? "sentito oggi" : gg === 1 ? "ieri" : `${gg} giorni fa` };
}
export const ordinate = () => tutte().sort((a, b) => ritardo(b) - ritardo(a) || a.nome.localeCompare(b.nome));
export const uscite = () => C.tutte("uscita:").filter(u => leggiP(u.persona));
const aperte = () => uscite().filter(u => u.stato !== "fatta").sort((a, b) => (a.giorno || a.sett).localeCompare(b.giorno || b.sett));
const uscitaDi = pid => aperte().find(u => u.persona === pid);
const dataCorta = iso => { const d = C.daIso(iso); return `${GG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESI[d.getMonth()]}`; };
const giornoCorto = iso => { const d = C.daIso(iso); return `${GG[(d.getDay() + 6) % 7].toLowerCase()} ${d.getDate()}`; };

/** segna «sentito» (con Annulla nell'avviso). quando = giorno; non torna indietro se c'è già una data più recente */
export function sentito(id, { quando = C.oggi(), da = "", avviso = true } = {}) {
  const pe = leggiP(id);
  if (!pe) return null;
  if (!pe.ultimo || quando >= pe.ultimo) scriviP(pe, { ultimo: quando, ultimoDa: da });
  if (avviso) C.avvisa(`${pe.nome}: sentito ${quando === C.oggi() ? "oggi" : giornoCorto(quando)}`, true, "spunta");
  return pe;
}
export function nuova(nome, ogni = 14, extra = {}) {
  const id = nid();
  C.D.scrivi("persona:" + id, { nome: nome.trim(), ogni, ultimo: null, ...extra });
  return id;
}

// ---------- riconoscere le persone nei testi ----------
const norm = t => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const PAROLE_VUOTE = new Set(["e", "di", "con", "la", "il", "lo", "le", "gli", "da", "del", "della"]);
const parole = nome => norm(nome).split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !PAROLE_VUOTE.has(w));
const contiene = (t, w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t);
/** le persone nominate in un testo («Cena con Marco e Luca» → Marco, Luca) */
export function personeDaTesto(testo) {
  const t = norm(testo);
  return tutte().filter(pe => parole(pe.nome).some(w => contiene(t, w)));
}
/** un'azione spuntata parla di una persona? («Chiamare Marco», «Scrivere a Sara», o col campo persona) → sentita */
const VERBI = /chiam|scriv|sent|messagg|vocal|telefon|video|vede|vedo|incontr|usci|esco|caff|cena|pranzo|aperitiv|auguri/;
export function daAzione(v) {
  const chi = v.persona ? [leggiP(v.persona)].filter(Boolean) : VERBI.test(norm(v.testo)) ? personeDaTesto(v.testo) : [];
  chi.forEach(pe => sentito(pe.id, { da: v.testo, avviso: false }));
  return chi.map(pe => pe.nome);
}
/** gli eventi passati di Google Calendar (questa settimana e la scorsa) col nome di una persona → sentita quel giorno.
    Anche le uscite fissate e passate diventano «fatte». Scrive solo se cambia qualcosa (si chiama a ogni disegno). */
export function daCalendario() {
  const ora = new Date(), lun = C.lunediDi(ora);
  C.D.senzaRegistro(() => {
    if (G.collegato()) [lun, C.piuGiorni(lun, -7)].forEach(s => {
      (G.eventiInCache(s) || G.eventiVecchi(s) || []).forEach(e => {
        if (e.tuttoIlGiorno || e.fine > ora || /^finestra\b/i.test(e.titolo)) return;
        personeDaTesto(e.titolo).forEach(pe => { if (!pe.ultimo || e.giorno > pe.ultimo) scriviP(pe, { ultimo: e.giorno, ultimoDa: e.titolo }); });
      });
    });
    uscite().filter(u => u.stato === "fissata" && u.giorno && (u.giorno < C.oggi() || (u.giorno === C.oggi() && X.hm(u.a) <= ora.getHours() * 60 + ora.getMinutes()))).forEach(u => {
      C.D.scrivi("uscita:" + u.id, { ...C.D.leggi("uscita:" + u.id), stato: "fatta" });
      const pe = leggiP(u.persona);
      if (pe && (!pe.ultimo || u.giorno > pe.ultimo)) scriviP(pe, { ultimo: u.giorno, ultimoDa: `Uscita con ${pe.nome}` });
    });
  });
}

// =========================================================
// DISEGNO: righe, «Da sentire» in Oggi, la vista Persone
// =========================================================
function tag(pe) {
  const u = uscitaDi(pe.id);
  if (!u) return "";
  return u.stato === "fissata" ? `<span class="ps-tag fissata">${giornoCorto(u.giorno)}</span>`
    : `<span class="ps-tag">${u.stato === "attesa" ? "aspetto date" : "uscita da proporre"}</span>`;
}
function riga(pe) {
  const st = stato(pe);
  return `<li class="ps-li" data-psid="${pe.id}"><div class="ps-sw">${C.ico("spunta")}Sentito oggi</div>
    <div class="ps-it"><i class="pallino ${st.c}"></i><div class="ps-tx"><b>${C.esc(pe.nome)}</b><small>${st.testo} · ${ogniTesto(pe)}</small></div>${tag(pe)}</div></li>`;
}
const STATI = { proporre: "Da proporre", attesa: "Aspetto le sue date", fissata: "Fissata", fatta: "Fatta" };
function rigaUscita(u) {
  const pe = leggiP(u.persona);
  return `<button class="ps-uscita" data-ps="uscita" data-id="${u.id}"><span class="ic">${C.ico("persone")}</span>
    <span class="tx"><b>Uscita con ${C.esc(pe.nome)}</b><small>${u.stato === "fissata" ? `${dataCorta(u.giorno)} · ${u.da}` : `${STATI[u.stato]} · ${settTesto(u.sett)}`}</small></span>${C.ico("dopo")}</button>`;
}
const settTesto = s => { const n = C.giorniTra(C.lunediDi(new Date()), s) / 7; return n === 0 ? "questa settimana" : n === 1 ? "la prossima settimana" : `settimana del ${giornoCorto(s)}`; };
/** il riquadro di Oggi: al massimo 3 persone da sentire + le uscite aperte. Chi è in regola non si vede. */
export function htmlDaSentire({ titolo = true } = {}) {
  daCalendario();
  const L = tutte();
  if (!L.length) return "";
  const da = ordinate().filter(pe => ritardo(pe) > .75).slice(0, 3), U = aperte();
  return `<section class="ps-box">${titolo ? `<div class="rp-tit"><h3 class="H">Da sentire</h3><button class="ps-link" data-azione="vista" data-v="persone">Tutte ›</button></div>` : ""}
    ${da.length ? `<ul class="ps-lista">${da.map(riga).join("")}</ul>` : `<p class="ps-vuota">Tutti sentiti di recente.</p>`}
    ${U.map(rigaUscita).join("")}</section>`;
}
/** quante persone da sentire + uscite aperte (il numero sulla pillola di Oggi) */
export const quanteDaSentire = () => tutte().length ? ordinate().filter(pe => ritardo(pe) > .75).slice(0, 3).length + aperte().length : 0;
/** l'elenco completo: da sentire · in regola · ogni tanto (sta nella vista Persone e nelle impostazioni) */
export function htmlLista() {
  daCalendario();
  const L = ordinate(), gruppi = [["Da sentire", L.filter(pe => ritardo(pe) > .75)], ["In regola", L.filter(pe => ogniN(pe) && ritardo(pe) <= .75)], ["Ogni tanto", L.filter(pe => !ogniN(pe))]];
  return `${L.length ? gruppi.filter(g => g[1].length).map(([t, G]) => `<div class="ps-gruppo">${t}</div><ul class="ps-lista">${G.map(riga).join("")}</ul>`).join("")
      : `<p class="ps-vuota">Ancora nessuna persona. Aggiungi quelle a cui tieni: Bussola ti dice chi non senti da troppo.</p>`}
    ${aperte().length ? `<div class="ps-gruppo">Uscite</div>${aperte().map(rigaUscita).join("")}` : ""}
    <button class="ps-agg" data-ps="nuova">+ Aggiungi una persona</button>`;
}
export function vista() {
  return `<div class="testa"><div><h1 class="H"><button class="tondo ps-indietro" data-azione="vista" data-v="oggi" aria-label="Torna a Oggi">${C.ico("prima")}</button>Persone</h1>
    <p>Scorri a destra = sentito. Tocca = dettagli.</p></div></div>
    <div class="ps-vista">${htmlLista()}</div>`;
}

// =========================================================
// LE TUE DISPONIBILITÀ e l'INCROCIO con le sue
// =========================================================
const INIZIO = 9 * 60, FINE = 24 * 60;
/** gli spazi liberi di un giorno (minuti), con lo stacco e il viaggio prima e dopo ogni impegno */
function liberi(giorno, salta = "") {
  const sett = C.lunediDi(C.daIso(giorno)), g = C.giorniTra(sett, giorno), st = Number(X.metodo().stacco || 10);
  const tutti = X.blocchiSettimana(sett).blocchi.filter(b => b.g === g);
  const occ = tutti.filter(b => X.occupa(b) && b.fonte !== salta).map(b => ({ b, da: X.hm(b.da) - st - X.tragitto("Casa", b.luogo), a: X.fine(b) + st + X.tragitto(b.luogo, "Casa") })).sort((x, y) => x.da - y.da);
  const ora = new Date(), adesso = ora.getHours() * 60 + ora.getMinutes();
  let t = giorno === C.oggi() ? Math.max(INIZIO, Math.ceil((adesso + 30) / 15) * 15) : INIZIO;
  if (giorno < C.oggi()) return { spazi: [], occ, persone: [] };
  const spazi = [];
  for (const o of [...occ, { da: FINE, a: FINE }]) { if (o.da > t) spazi.push([t, Math.min(o.da, FINE)]); t = Math.max(t, o.a); if (t >= FINE) break; }
  const persone = tutti.filter(b => b.tipo === "finestra" && b.sotto === "persone").map(b => [X.hm(b.da), X.fine(b)]);
  return { spazi: spazi.filter(([a, b]) => b > a), occ, persone };
}
const su15 = m => Math.ceil(m / 15) * 15, giu15 = m => Math.floor(m / 15) * 15;
/** dentro uno spazio libero [da, a]: se c'è la finestra Persone, parto da lì (se ci sta tutta l'uscita) */
function partenza(P, da, a, dur) {
  for (const [x] of P) { const s = su15(Math.max(da, x)); if (s >= da && s + dur <= a && x < a) return s; }
  return su15(da);
}
const oraBreve = m => m % 60 ? X.fmt(m) : String(Math.floor(m / 60) % 24 || 24);
const nellaFinestra = (P, da, a) => P.some(([x, y]) => x < a && y > da);
/** le tue disponibilità della settimana dell'uscita: un pezzo per giorno (meglio nella finestra Persone), al massimo 4 */
function mie(u) {
  const C7 = Array.from({ length: 7 }, (_, i) => C.piuGiorni(u.sett, i)), out = [];
  C7.forEach(giorno => {
    const { spazi, persone } = liberi(giorno, "uscita:" + u.id), feriale = (C.daIso(giorno).getDay() + 6) % 7 < 5;
    // un'uscita è di pomeriggio o di sera: nei giorni feriali propongo dalle 15
    const buoni = spazi.map(([da, a]) => [su15(Math.max(da, feriale ? 15 * 60 : 10 * 60)), giu15(a)]).filter(([da, a]) => a - da >= u.dur);
    if (!buoni.length) return;
    const best = buoni.sort((x, y) => nellaFinestra(persone, y[0], y[1]) - nellaFinestra(persone, x[0], x[1]) || (y[1] - y[0]) - (x[1] - x[0]))[0];
    out.push({ giorno, da: best[0], a: best[1], pers: nellaFinestra(persone, best[0], best[1]) });
  });
  return out.sort((x, y) => y.pers - x.pers).slice(0, 4).sort((x, y) => x.giorno.localeCompare(y.giorno))
    .map(p => ({ ...p, testo: `${giornoCorto(p.giorno)} ${p.a >= FINE - 30 ? `dalle ${oraBreve(p.da)}` : `${oraBreve(p.da)}–${oraBreve(p.a)}`}` }));
}

/* Le sue date, scritte come capita: «martedì sera, giovedì dopo le 19 o sabato pomeriggio», «weekend», «non posso lunedì»,
   «dalle 15 alle 18», «il 5». Ogni orario vale anche per i giorni scritti subito prima senza orario («martedì e giovedì sera»). */
const GIORNO_RE = /\b(lunedi|lun|martedi|mar|mercoledi|mer|giovedi|gio|venerdi|ven|sabato|sab|domenica|dom)\b/g;
const IDX = { lun: 0, mar: 1, mer: 2, gio: 3, ven: 4, sab: 5, dom: 6 };
const ORARI = [[/mattin/, 9 * 60, 13 * 60, "mattina"], [/pranzo/, 12 * 60 + 30, 14 * 60 + 30, "a pranzo"], [/pomerigg/, 14 * 60, 19 * 60, "pomeriggio"],
  [/aperitiv/, 18 * 60, 21 * 60, "aperitivo"], [/\b(sera|serata|stasera|cena)\b/, 19 * 60, FINE, "sera"], [/nott/, 21 * 60, FINE, "notte"]];
const ore = (h, m) => { h = Number(h); if (h > 0 && h <= 7) h += 12; return (h === 0 ? 24 : h) * 60 + (Number(m) || 0); };
function orarioDi(s, dur) {
  let m;
  if ((m = s.match(/dalle?\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:alle?|a|-|–)\s*(\d{1,2})(?:[:.](\d{2}))?/)) || (m = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?\b/)))
    return { da: ore(m[1], m[2]), a: ore(m[3], m[4]), et: `${oraBreve(ore(m[1], m[2]))}–${oraBreve(ore(m[3], m[4]))}` };
  if ((m = s.match(/\b(?:dopo|dalle|da)\s+(?:le\s+)?(\d{1,2})(?:[:.](\d{2}))?/))) return { da: ore(m[1], m[2]), a: FINE, et: `dalle ${oraBreve(ore(m[1], m[2]))}` };
  if ((m = s.match(/\b(?:prima|entro|fino)\s+(?:alle?|le|a)\s+(\d{1,2})(?:[:.](\d{2}))?/))) return { da: INIZIO, a: ore(m[1], m[2]), et: `fino alle ${oraBreve(ore(m[1], m[2]))}` };
  if ((m = s.match(/\balle\s+(\d{1,2})(?:[:.](\d{2}))?/))) return { da: ore(m[1], m[2]), a: ore(m[1], m[2]) + dur, et: `alle ${oraBreve(ore(m[1], m[2]))}`, preciso: true };
  const W = ORARI.filter(([re]) => re.test(s));
  if (W.length) return { da: Math.min(...W.map(w => w[1])), a: Math.max(...W.map(w => w[2])), et: W.map(w => w[3]).join(" e ") };
  return null;
}
function giorniDi(s, sett) {
  const G7 = Array.from({ length: 7 }, (_, i) => C.piuGiorni(sett, i)), out = new Set();
  for (const m of s.matchAll(GIORNO_RE)) out.add(G7[IDX[m[1].slice(0, 3)]]);
  if (/weekend|fine settimana/.test(s)) { out.add(G7[5]); out.add(G7[6]); }
  if (/tutti i giorni|quando vuoi|sempre|qualsiasi giorno/.test(s)) G7.forEach(g => out.add(g));
  if (/\bdopodomani\b/.test(s)) out.add(C.piuGiorni(C.oggi(), 2)); else if (/\bdomani\b/.test(s)) out.add(C.piuGiorni(C.oggi(), 1));
  if (/\bstasera\b|\boggi\b/.test(s)) out.add(C.oggi());
  for (const m of s.matchAll(/\b(?:il|l')\s*(\d{1,2})\b/g)) { const d = Number(m[1]); const g = Array.from({ length: 28 }, (_, i) => C.piuGiorni(sett, i - 7)).find(x => Number(x.slice(8)) === d && x >= C.oggi()); if (g) out.add(g); }
  return [...out].sort();
}
/** il suo messaggio → [{ giorno, da, a, et }] (un pezzo per giorno) + i giorni in cui non può */
export function capisciDate(testo, sett, dur = 150) {
  const pezzi = norm(testo).replace(/\s+e\s+(?=(lun|mar|mer|gio|ven|sab|dom|domani|dopodomani|weekend|il \d))/g, " , ")
    .split(/[,;\n]|\s+o\s+|\s+oppure\s+|\s+ma\s+|\.\s/).map(x => x.trim()).filter(Boolean);
  const out = [], no = new Set();
  let attesa = [], ultimi = [];
  pezzi.forEach(s => {
    const gg = giorniDi(s, sett);
    if (/\b(non|tranne|no)\b/.test(s)) { gg.forEach(g => no.add(g)); return; }
    const o = orarioDi(s, dur);
    if (o) {
      const quali = gg.length ? [...attesa, ...gg] : attesa.length ? attesa : ultimi.length ? ultimi : Array.from({ length: 7 }, (_, i) => C.piuGiorni(sett, i));
      quali.forEach(g => out.push({ giorno: g, ...o }));
      ultimi = quali; attesa = [];
    } else if (gg.length) attesa.push(...gg);
  });
  attesa.forEach(g => out.push({ giorno: g, da: INIZIO, a: FINE, et: "tutto il giorno" }));
  const visti = new Set();
  return { voci: out.filter(v => !no.has(v.giorno) && !visti.has(v.giorno + v.et) && visti.add(v.giorno + v.et)).sort((a, b) => a.giorno.localeCompare(b.giorno) || a.da - b.da), no: [...no] };
}
/** per ogni sua disponibilità: il momento migliore che va bene anche a te (o perché no). Le prime 3, le migliori prima */
function proposte(u, voci) {
  const ok = [], scarti = [];
  voci.forEach(v => {
    const nome = `${GG[(C.daIso(v.giorno).getDay() + 6) % 7]} ${v.et}`;
    if (v.giorno < C.oggi()) return scarti.push({ v, perche: `${nome}: è già passato` });
    const { spazi, occ, persone } = liberi(v.giorno, "uscita:" + u.id);
    const cand = spazi.map(([a, b]) => [su15(Math.max(a, v.da)), Math.min(b, v.a)]).filter(([a, b]) => b - a >= Math.min(u.dur, v.a - v.da));
    if (!cand.length) {
      const b = occ.find(o => o.b && o.da < v.a && o.a > v.da)?.b;
      return scarti.push({ v, perche: `${nome} no: ${b ? `c'è «${b.titolo}» ${b.da}–${b.a}` : "non resta abbastanza tempo libero"}` });
    }
    const [c0, fineLib] = cand.sort((x, y) => nellaFinestra(persone, y[0], y[1]) - nellaFinestra(persone, x[0], x[1]) || x[0] - y[0])[0];
    const da = v.preciso ? c0 : partenza(persone, c0, fineLib, Math.min(u.dur, fineLib - c0)), a = Math.min(da + u.dur, fineLib), pers = nellaFinestra(persone, da, a);
    ok.push({ v, giorno: v.giorno, da, a, fineLib, pers, punti: (pers ? 10 : 0) + (da <= 21 * 60 ? 2 : 0) - C.giorniTra(C.oggi(), v.giorno) * .1 });
  });
  const visti = new Set();
  return { ok: ok.sort((x, y) => y.punti - x.punti).filter(p => !visti.has(p.giorno + p.da) && visti.add(p.giorno + p.da)).slice(0, 3), scarti };
}

// =========================================================
// FOGLI: persona · nuova persona · uscita
// =========================================================
export function apriPersona(id) { F.foglio = { tipo: "persona", id }; disegnaFoglio(); }
export function apriUscita(id) { F.foglio = { tipo: "uscita", id }; disegnaFoglio(); }
function apriNuova(nome = "") { F.foglio = { tipo: "nuova", nome, ogni: 14 }; disegnaFoglio(); setTimeout(() => $("#ps-foglio .campo")?.focus(), 60); }
function chiudi() { F.foglio = null; disegnaFoglio(); }
const chipsOgni = (val, k = "ogni") => `<div class="chips">${OGNI.map(([n, t]) => `<button type="button" class="chip${n === val ? " on" : ""}" data-ps="${k}" data-v="${n}">${t}</button>`).join("")}</div>`;
/** una nuova uscita con questa persona (settimana di partenza: questa fino a giovedì, poi la prossima) */
export function nuovaUscita(pid, sett = null) {
  const d = new Date(), lun = C.lunediDi(d), id = nid();
  C.D.scrivi("uscita:" + id, { persona: pid, sett: sett || ((d.getDay() + 6) % 7 >= 4 ? C.piuGiorni(lun, 7) : lun), dur: 150, stato: "proporre", sue: "", creata: Date.now() });
  return id;
}
function disegnaFoglio() {
  const f = $("#ps-foglio"), s = F.foglio;
  if (!f) return;
  if (!s) { f.hidden = true; f.innerHTML = ""; return; }
  let dentro = "";
  if (s.tipo === "persona") {
    const pe = leggiP(s.id);
    if (!pe) return chiudi();
    const st = stato(pe), u = uscitaDi(pe.id);
    dentro = `<input class="ps-nome H" data-psc="nome" value="${C.esc(pe.nome)}" aria-label="Nome">
      <p class="ps-sub">${st.gg == null ? "Non ancora segnato" : st.gg === 0 ? "Sentito oggi" : `Sentito ${st.testo}`}</p>
      ${pe.ultimoDa ? `<div class="ps-dalcal">${C.ico("spunta")}<span>Ultima volta: <b>${C.esc(pe.ultimoDa)}</b>, ${dataCorta(pe.ultimo)}</span></div>` : ""}
      <div class="rp-et">Ogni quanto vuoi sentirlo</div>${chipsOgni(ogniN(pe))}
      <div class="ps-due"><button type="button" class="btn ps-verde H" data-ps="sentito-f">${C.ico("spunta")}Sentito oggi</button>
        ${u ? `<button type="button" class="btn" data-ps="uscita" data-id="${u.id}">Uscita: ${u.stato === "fissata" ? giornoCorto(u.giorno) : "aspetto"} ›</button>`
          : `<button type="button" class="btn" data-ps="nuova-uscita" data-id="${pe.id}">${C.ico("persone")}Un'uscita</button>`}</div>
      <button type="button" class="ps-elimina" data-ps="elimina-p">Elimina ${C.esc(pe.nome)}</button>`;
  } else if (s.tipo === "nuova") {
    dentro = `<h3 class="H">Nuova persona</h3><div class="rp-et">Nome</div>
      <input class="campo" data-psc="n-nome" value="${C.esc(s.nome)}" placeholder="Es. Giulia" autocomplete="off" enterkeyhint="done">
      <div class="rp-et">Ogni quanto vuoi sentirla</div>${chipsOgni(s.ogni, "n-ogni")}
      <button type="button" class="btn pieno H rp-fisso" data-ps="n-crea">Aggiungi</button>`;
  } else {
    const u = C.D.leggi("uscita:" + s.id), pe = u && leggiP(u.persona);
    if (!pe) return chiudi();
    const ordine = ["proporre", "attesa", "fissata", "fatta"], i = ordine.indexOf(u.stato), lun = C.lunediDi(new Date());
    const stati = `<div class="ps-stati">${ordine.map((k, j) => `<div class="${j < i ? "ok" : j === i ? "ora" : ""}">${["Da proporre", "Sue date", "Fissata", "Fatta"][j]}</div>`).join("")}</div>`;
    const testa = `<h3 class="H">Uscita con ${C.esc(pe.nome)}</h3>${stati}`;
    if (u.stato === "fissata" || u.stato === "fatta") {
      dentro = `${testa}<div class="rp-esito"><div class="ok">${C.ico("spunta")}</div><h3 class="H">${dataCorta(u.giorno)} · ${u.da}</h3>
        <p>${u.stato === "fatta" ? `Fatta: ${C.esc(pe.nome)} è segnato come sentito.` : `${G.collegato() ? "È in Google Calendar." : "È nella tua settimana."} Quando passa, ${C.esc(pe.nome)} diventa verde da solo.`}</p></div>
        <div class="ps-due">${u.stato === "fissata" ? `<button type="button" class="btn" data-ps="u-cambia">Cambia data</button>` : ""}<button type="button" class="btn pieno H" data-ps="chiudi">Ok</button></div>
        <button type="button" class="ps-elimina" data-ps="u-elimina">Elimina l'uscita</button>`;
    } else {
      const M = mie(u);
      dentro = `${testa}
        <div class="rp-et">Quando · quanto dura</div><div class="chips">${[0, 7, 14].map(n => { const w = C.piuGiorni(lun, n); return `<button type="button" class="chip${u.sett === w ? " on" : ""}" data-ps="u-sett" data-v="${w}">${["Questa sett.", "La prossima", "Tra 2 sett."][n / 7]}</button>`; }).join("")}
          ${[60, 120, 150, 240].map(m => `<button type="button" class="chip${u.dur === m ? " on" : ""}" data-ps="u-dur" data-v="${m}">${X.oreTxt(m)}</button>`).join("")}</div>
        <div class="rp-et">Le tue disponibilità</div>
        <div class="ps-mie">${M.length ? `<p>${M.map(p => p.testo[0].toUpperCase() + p.testo.slice(1)).join(" · ")}</p>
          <button type="button" class="btn" data-ps="u-copia">${C.ico("copia")}Copia per WhatsApp</button>` : `<p>Settimana piena: prova la prossima o una durata più corta.</p>`}</div>
        <div class="rp-et">Incolla le sue date</div>
        <textarea class="campo ps-sue" data-psc="sue" rows="2" placeholder="Es. io posso martedì sera, giovedì dopo le 19 o sabato pomeriggio">${C.esc(u.sue || "")}</textarea>
        <div id="ps-risultati">${htmlRisultati(u)}</div>
        <button type="button" class="ps-elimina" data-ps="u-elimina">Elimina l'uscita</button>`;
    }
  }
  f.hidden = false;
  f.innerHTML = `<div class="velo" data-ps="chiudi"></div><div class="foglio paper rp-foglio ps-foglio">${dentro}</div>`;
}
function htmlRisultati(u) {
  if (!String(u.sue || "").trim()) return `<p class="rp-capito">Scrivile come te le ha mandate: capisco giorni e orari, e ti dico quando va bene a tutti e due.</p>`;
  const { voci } = capisciDate(u.sue, u.sett, u.dur);
  if (!voci.length) return `<p class="rp-capito">Non capisco i giorni: prova con «martedì sera», «sabato dalle 15», «weekend».</p>`;
  const { ok, scarti } = proposte(u, voci);
  return `<div class="chips ps-capite">${voci.map(v => `<span class="chip${scarti.some(x => x.v === v) ? " no" : ""}">${GG[(C.daIso(v.giorno).getDay() + 6) % 7]} ${Number(v.giorno.slice(8))} · ${v.et}</span>`).join("")}</div>
    ${ok.length ? `<div class="rp-et">Ecco quando va bene a tutti e due</div><div class="rp-posti">${ok.map((p, i) => `<button type="button" class="rp-posto${i ? "" : " meglio"}" data-ps="u-fissa" data-v="${p.giorno}|${p.da}|${p.a}">
        <div><b>${dataCorta(p.giorno)} · ${X.fmt(p.da)}–${X.fmt(p.a)}</b><small>${p.pers ? "Nella tua finestra Persone · " : ""}${p.fineLib >= FINE ? "libero fino a sera" : `libero fino alle ${X.fmt(p.fineLib)}`}</small></div>${i ? "" : `<span>MEGLIO</span>`}</button>`).join("")}</div>`
      : `<p class="rp-capito"><b>Nessun momento in comune.</b> Mandagli le tue disponibilità qui sopra.</p>`}
    ${scarti.length ? `<p class="ps-scarti">${scarti.map(x => C.esc(x.perche)).join(" · ")}</p>` : ""}`;
}

// ---------- tocchi nei fogli e nelle righe ----------
document.addEventListener("click", e => {
  const r = e.target.closest("[data-ps]");
  if (!r) {   // tocco su una riga = foglio della persona
    const it = e.target.closest(".ps-it");
    if (it && Date.now() - finito > 300) apriPersona(it.parentElement.dataset.psid);
    return;
  }
  const k = r.dataset.ps, v = r.dataset.v, s = F.foglio;
  if (k === "chiudi") return chiudi();
  if (k === "nuova") return apriNuova();
  if (k === "uscita") return apriUscita(r.dataset.id);
  if (k === "nuova-uscita") { const id = nuovaUscita(r.dataset.id); C.disegna(); return apriUscita(id); }
  if (!s) return;
  if (s.tipo === "persona") {
    const pe = leggiP(s.id);
    if (!pe) return chiudi();
    if (k === "ogni") { scriviP(pe, { ogni: Number(v) }); disegnaFoglio(); return C.disegna(); }
    if (k === "sentito-f") { chiudi(); sentito(pe.id); return C.disegna(); }
    if (k === "elimina-p") { chiudi(); C.D.scrivi("persona:" + pe.id, null); C.avvisa(`${pe.nome}: eliminata`, true); return C.disegna(); }
  } else if (s.tipo === "nuova") {
    if (k === "n-ogni") { s.nome = $("#ps-foglio [data-psc=n-nome]").value; s.ogni = Number(v); return disegnaFoglio(); }
    if (k === "n-crea") {
      const nome = $("#ps-foglio [data-psc=n-nome]").value.trim();
      if (!nome) { C.avvisa("Scrivi prima il nome"); return $("#ps-foglio .campo")?.focus(); }
      nuova(nome, s.ogni); chiudi(); C.avvisa(`${nome}: aggiunta`, true, "spunta"); return C.disegna();
    }
  } else {
    const u = C.D.leggi("uscita:" + s.id), cambia = c => C.D.scrivi("uscita:" + s.id, { ...C.D.leggi("uscita:" + s.id), ...c });
    if (!u) return chiudi();
    const pe = leggiP(u.persona);
    if (k === "u-sett") { cambia({ sett: v }); return disegnaFoglio(); }
    if (k === "u-dur") { cambia({ dur: Number(v) }); return disegnaFoglio(); }
    if (k === "u-copia") {
      const testo = `Io sono libero ${mie(u).map(p => p.testo).join(", ")}. Tu quando puoi?`;
      (navigator.clipboard?.writeText(testo) || Promise.reject()).then(() => C.avvisa("Copiato: incollalo su WhatsApp", false, "copia")).catch(() => C.avvisa(testo));
      if (u.stato === "proporre") { cambia({ stato: "attesa" }); disegnaFoglio(); C.disegna(); }
      return;
    }
    if (k === "u-fissa") {
      const [giorno, da, a] = v.split("|"), sett = C.lunediDi(C.daIso(giorno));
      X.salvaBlocco(sett, { id: nid(), g: C.giorniTra(sett, giorno), da: X.fmt(Number(da)), a: X.fmt(Number(a)), titolo: `Uscita con ${pe.nome}`, tipo: "persona", luogo: "", fonte: "uscita:" + s.id }, () => {}, { nuovo: true });
      cambia({ stato: "fissata", giorno, da: X.fmt(Number(da)), a: X.fmt(Number(a)) });
      disegnaFoglio(); return C.disegna();
    }
    if (k === "u-cambia") { X.togliDaFonte(C.lunediDi(C.daIso(u.giorno)), "uscita:" + s.id); cambia({ stato: "attesa", giorno: null, da: null, a: null }); disegnaFoglio(); return C.disegna(); }
    if (k === "u-elimina") {
      if (u.giorno && u.stato === "fissata") X.togliDaFonte(C.lunediDi(C.daIso(u.giorno)), "uscita:" + s.id);
      C.D.scrivi("uscita:" + s.id, null); chiudi(); C.avvisa("Uscita eliminata", true); return C.disegna();
    }
  }
});
let tSue;
document.addEventListener("input", e => {
  const c = e.target.closest?.("#ps-foglio [data-psc]");
  if (!c || !F.foglio) return;
  if (c.dataset.psc === "sue") {
    const u = C.D.leggi("uscita:" + F.foglio.id);
    if (!u) return;
    clearTimeout(tSue);
    tSue = setTimeout(() => {
      const nuovo = { ...u, sue: c.value, stato: u.stato === "proporre" && c.value.trim() ? "attesa" : u.stato };
      C.D.scrivi("uscita:" + F.foglio.id, nuovo, { unisci: true });
      $("#ps-risultati").innerHTML = htmlRisultati(nuovo);
      if (nuovo.stato !== u.stato) $("#ps-foglio .ps-stati").outerHTML = `<div class="ps-stati"><div class="ok">Da proporre</div><div class="ora">Sue date</div><div>Fissata</div><div>Fatta</div></div>`;
    }, 250);
  }
});
document.addEventListener("change", e => {
  const c = e.target.closest?.("#ps-foglio [data-psc=nome]");
  if (!c || F.foglio?.tipo !== "persona") return;
  const pe = leggiP(F.foglio.id), nome = c.value.trim();
  if (pe && nome && nome !== pe.nome) { scriviP(pe, { nome }); C.disegna(); }
});
document.addEventListener("keydown", e => {
  if (!F.foglio) return;
  if (e.key === "Escape") return chiudi();
  if (e.key === "Enter" && e.target.matches?.("#ps-foglio input")) { e.preventDefault(); e.target.dataset.psc === "nome" ? e.target.blur() : $("#ps-foglio .rp-fisso")?.click(); }
});

// ---------- gesto: scorri a destra = sentito oggi ----------
let g = null, finito = 0;
document.addEventListener("pointerdown", e => {
  const it = e.target.closest(".ps-it");
  if (!it || e.button > 0 || e.target.closest("button, a, input")) return;
  g = { it, li: it.parentElement, x: e.clientX, y: e.clientY, modo: null };
});
document.addEventListener("pointermove", e => {
  if (!g) return;
  const dx = e.clientX - g.x, dy = e.clientY - g.y;
  if (!g.modo) {
    if (Math.hypot(dx, dy) < 8) return;
    if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.3) g.modo = "swipe"; else { g = null; return; }   // il dito scorreva la pagina
  }
  g.li.classList.add("scorre");
  g.it.style.transition = "none"; g.it.style.transform = `translateX(${Math.max(0, dx)}px)`;
});
document.addEventListener("touchmove", e => { if (g?.modo) e.preventDefault(); }, { passive: false });
function fineGesto(e) {
  if (!g) return;
  const x = g; g = null;
  if (!x.modo) return;
  finito = Date.now();
  const dx = e.clientX - x.x;
  x.it.style.transition = "";
  if (dx > 90) { x.it.style.transform = "translateX(110%)"; setTimeout(() => { sentito(x.li.dataset.psid); C.disegna(); }, 180); }
  else { x.it.style.transform = ""; x.li.classList.remove("scorre"); }
}
document.addEventListener("pointerup", fineGesto);
document.addEventListener("pointercancel", fineGesto);
document.addEventListener("contextmenu", e => { const it = e.target.closest(".ps-it"); if (it) { e.preventDefault(); apriPersona(it.parentElement.dataset.psid); } });
