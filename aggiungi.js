/* aggiungi.js — il «+» della versione 4 (dal 2026-10-31; anteprima approvata anteprima/finale-v4.html).
   Un campo solo (una cosa o tante, anche dettate; @ per le persone) → «Controlla»: per ogni riga tipo (Azione / Impegno),
   quando (Oggi · Domani · Questa settimana · Più avanti · Una data…), durata (obbligatoria per gli impegni) e luogo → Conferma.
   Dopo la conferma: azione con un giorno = azione rapida di quel giorno · azione senza giorno = Da sistemare ·
   impegno con un giorno = «Dove lo metto?» (giorni da sfogliare, blocco da trascinare e allungare come in Google Calendar) ·
   impegno senza giorno = Da sistemare con la durata (toccandolo torna qui) · «sentito Marco» = persona sentita oggi.
   Niente nasce prima della conferma. Il testo lo divido con regole semplici (la tappa 4 aggiunge Gemini).
   Usa SOLO data-ag / data-agi (data-p, data-r, data-ds, data-azione sono degli altri). */
import * as G from "./gcal.js?v=20261031181718";
import * as PS from "./persone.js?v=20261031181718";
import * as SD from "./sudime.js?v=20261031181718";
let C, X;
export function init(ctx, extra) { C = ctx; X = extra; }
const $ = s => document.querySelector(s);
const A = { fase: null };
export const aperto = () => !!A.fase;

const QUANDO = [["oggi", "Oggi"], ["domani", "Domani"], ["sett", "Questa settimana"], ["avanti", "Più avanti"], ["data", "Una data…"]];
const DURATE = [10, 15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480];
const GIORNI_S = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const RE_GIORNO = n => new RegExp(`(?:^|\\s)(?:${n.endsWith("ì") ? n.slice(0, -1) + "[iì]" : n})(?=\\s|$|[,.;])`, "i");
const RE_GIORNI = /(?:^|\s)(?:luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)(?=\s|$|[,.;])/gi;
const H0 = 7, H1 = 24, PX = 32;
const durTxt = m => m < 60 ? `${m}'` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}'` : ""}`;
const settDi = iso => C.lunediDi(C.daIso(iso));
const giornoDi = r => r.quando === "oggi" ? C.oggi() : r.quando === "domani" ? C.piuGiorni(C.oggi(), 1) : r.quando === "data" ? r.data : null;
const nomeGiorno = iso => { const n = C.giorniTra(C.oggi(), iso); return n === 0 ? "Oggi" : n === 1 ? "Domani" : C.daIso(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase()); };
const luoghi = () => X.metodo().luoghi.map(l => l.nome).filter(n => n && n !== "Casa");

// =========================================================
// capire il testo (regole; la tappa 4 aggiunge Gemini)
// =========================================================
const RE_SENTITO = /^\s*(?:ho\s+)?(?:sentit[oa]|vist[oa]|parlato\s+con|telefonato\s+a)\s+(.+)/i;
const RE_IMPEGNO = /\b(chiamat|telefonat|videochiamat|call|visita|riunion|appuntament|cena|pranzo con|caff[eè] con|aperitivo|lezion|esame|colloquio|ricevimento|incontr|uscita con)/i;
/** «@Nome Cognome» → la persona (la più lunga che combacia tra le tue), altrimenti una parola = persona nuova */
function personaDa(t) {
  const m = t.match(/@([^@]+)/); if (!m) { const noti = PS.personeDaTesto(t); return noti.length ? { id: noti[0].id, nome: noti[0].nome } : null; }
  const dopo = m[1].toLowerCase(), noti = PS.tutte().filter(p => dopo.startsWith(p.nome.toLowerCase())).sort((a, b) => b.nome.length - a.nome.length);
  if (noti.length) return { id: noti[0].id, nome: noti[0].nome };
  const nome = m[1].trim().split(/\s+/)[0]; return nome ? { nome: nome[0].toUpperCase() + nome.slice(1), nuovo: true } : null;
}
function durataDa(t) {
  let m = t.match(/\b(\d+)\s*h\s*(\d{1,2})\b/i); if (m) return +m[1] * 60 + +m[2];
  m = t.match(/\b(\d+(?:[.,]5)?)\s*(?:h|ore|ora)\b/i); if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * 60);
  m = t.match(/\b(\d+)\s*(?:min|minuti|')/i); if (m) return +m[1];
  if (/mezz'?\s?ora/i.test(t)) return 30;
  return null;
}
function giornoDa(t) {
  if (/\bdopodomani\b/i.test(t)) return { quando: "data", data: C.piuGiorni(C.oggi(), 2) };
  if (/\bdomani\b/i.test(t)) return { quando: "domani" };
  if (/\boggi\b|\bstasera\b|\bstamattina\b/i.test(t)) return { quando: "oggi" };
  const g = GIORNI_S.findIndex(n => RE_GIORNO(n).test(t));
  if (g >= 0) { const oggiG = new Date().getDay(); let d = (g - oggiG + 7) % 7; if (d === 0) d = 7; return d === 1 ? { quando: "domani" } : { quando: "data", data: C.piuGiorni(C.oggi(), d) }; }
  if (/settimana prossima|prossima settimana|prima o poi|un giorno|\bidea\b|più avanti/i.test(t)) return { quando: "avanti" };
  return null;
}
/** con Gemini (funzione bussola-ia): le righe, già nel formato di capisci(). Se non risponde entro 20" → null (si usano le regole) */
async function capisciIA(testo) {
  if (C.D.PROVA || !navigator.onLine) return null;
  const oggi = `${C.oggi()} (${GIORNI_S[new Date().getDay()]})`;
  const r = await Promise.race([C.D.funzione("bussola-ia", { azione: "dividi", testo, oggi, persone: PS.tutte().map(p => p.nome), luoghi: ["Casa", ...luoghi()], fatti: SD.fatti() }).catch(() => null), new Promise(ok => setTimeout(() => ok(null), 20000))]);
  if (!r?.righe?.length) return null;
  const iso = d => /^\d{4}-\d{2}-\d{2}$/.test(d || "") && d >= C.oggi() ? d : null;
  return r.righe.filter(g => g?.t).map(g => {
    const tipo = ["azione", "impegno", "sentito", "ricorda"].includes(g.tipo) ? g.tipo : "azione";
    let quando = ["oggi", "domani", "data", "sett", "avanti"].includes(g.quando) ? g.quando : "sett", data = iso(g.data);
    if (quando === "data" && !data) quando = "sett";
    if (data === C.oggi()) quando = "oggi"; else if (data === C.piuGiorni(C.oggi(), 1)) quando = "domani";
    const noti = ["Casa", ...luoghi()].find(l => l.toLowerCase() === (g.luogo || "").toLowerCase());
    const luogo = g.luogo === "tel" ? "tel" : noti || (g.luogo || "").trim();
    return { t: g.t, tipo, quando, data: quando === "data" ? data : null, ora: /^\d{2}:\d{2}$/.test(g.ora || "") ? g.ora : "",
      dur: g.dur > 0 ? Math.round(g.dur) : null, persona: g.persona ? personaDa("@" + g.persona) : null, luogo,
      nuovoLuogo: !!luogo && !noti && luogo !== "tel", ricorda: true, entro: iso(g.entro) };
  });
}
export function capisci(testo) {
  let t = testo.trim(), base = null;
  const m = t.match(/^entro ([^:]+):\s*/i);
  if (m) {   // «entro venerdì:» è una SCADENZA: senza un giorno preciso vanno in Da sistemare (questa settimana se entro 7 giorni)
    const g = giornoDa(m[1]), entro = g?.quando === "oggi" ? C.oggi() : g?.quando === "domani" ? C.piuGiorni(C.oggi(), 1) : g?.data || null;
    base = { quando: entro && C.giorniTra(C.oggi(), entro) > 7 || g?.quando === "avanti" ? "avanti" : "sett", entro };
    t = t.slice(m[0].length);
  }
  return t.split(/[\n;,]/).map(s => s.trim()).filter(Boolean).map(s => {
    if (/^\s*ricorda(?:ti|mi)?\s+che\s+/i.test(s)) { const t = s.replace(/^\s*ricorda(?:ti|mi)?\s+che\s+/i, ""); return { t: t[0].toUpperCase() + t.slice(1), tipo: "ricorda", quando: "oggi" }; }
    if (RE_SENTITO.test(s)) return { t: s.replace(/@/g, "").replace(/^./, c => c.toUpperCase()), tipo: "sentito", persona: personaDa(s.replace(RE_SENTITO, "@$1")), quando: "oggi" };
    const persona = personaDa(s), dur = durataDa(s), oraM = s.match(/\balle\s*(\d{1,2})(?:[:.](\d{2}))?\b/i);
    const ora = oraM && +oraM[1] < 24 ? `${oraM[1].padStart(2, "0")}:${oraM[2] || "00"}` : "";
    const g = giornoDa(s) || base || { quando: "sett" };
    const racc = /^[^:]{2,20}:\s/.test(s) && !/^entro/i.test(s);
    // «prendere/fissare/prenotare un appuntamento» è un'azione (la telefonata per prenotarlo), non l'appuntamento
    const prenota = /\b(prendere|fissare|prenotare|chiedere|disdire|spostare|cancellare)\b[^,]*\b(appuntament|visita|ricevimento|colloquio)/i.test(s);
    const impegno = !!(dur || (!prenota && RE_IMPEGNO.test(s)));
    let tit = s.replace(/@/g, "").replace(/\balle\s*\d{1,2}(?:[:.]\d{2})?\b/i, "").replace(/\b\d+\s*h\s*\d{1,2}\b|\b\d+(?:[.,]5)?\s*(?:h|ore|ora)\b|\b\d+\s*(?:min|minuti)\b|\b\d+'|mezz'?\s?ora/gi, "")
      .replace(/\b(dopodomani|domani|oggi|stasera|stamattina|prima o poi|settimana prossima|prossima settimana)\b/gi, "").replace(RE_GIORNI, " ").replace(/\s{2,}/g, " ").replace(/^[\s,–-]+|[\s,–-]+$/g, "");
    return { t: tit ? tit[0].toUpperCase() + tit.slice(1) : s, tipo: impegno ? "impegno" : "azione", quando: racc ? "avanti" : g.quando, data: g.data || null, ora, entro: giornoDa(s) ? null : base?.entro || null,
      dur, persona, luogo: impegno && /chiamat|telefonat|videochiamat|call/i.test(s) ? "tel" : luogoIn(s) };
  });
}
function luogoIn(s) { const l = X.metodo().luoghi.find(l => l.nome && new RegExp(`\\b${l.nome}\\b`, "i").test(s) || (l.alias || []).some(a => a && new RegExp(`\\b${a}\\b`, "i").test(s))); return l ? l.nome : ""; }

// =========================================================
// apertura e disegno
// =========================================================
/** tipo "diario" = scrivi nel diario; daVoce = una voce di «Da sistemare» da mettere in agenda (va subito a «Dove lo metto?») */
/** opz (da Pianifica): { dal: "AAAA-MM-GG" da cui cercare, dur, tieni: true = la voce resta (sasso grande), fonte, tipoBlocco } */
export function apri(tipo = "", testo = "", daVoce = null, opz = {}) {
  Object.assign(A, { fase: tipo === "diario" ? "diario" : "scrivi", testo, righe: [], coda: [], nota: "bene", daVoce: null, dg: null, scroll: null });
  if (daVoce && tipo === "impegno") {
    const v = C.D.leggi("voce:" + daVoce) || {};
    const dal = opz.dal && opz.dal > C.oggi() ? opz.dal : null;
    A.coda = [{ t: testo || v.testo, tipo: "impegno", dur: opz.dur || v.dur || 60, luogo: v.luogo || "", persona: v.persona ? { id: v.persona } : null,
      quando: dal ? "data" : "sett", data: dal, daVoce, tieni: !!opz.tieni, fonte: opz.fonte, tipoBlocco: opz.tipoBlocco }];
    A.fase = "dove";
  }
  disegna();
}
function chiudi() { A.fase = null; disegna(); }
function disegna() {
  let f = $("#ag-foglio");
  if (!f) { f = document.createElement("div"); f.id = "ag-foglio"; document.body.appendChild(f); }
  if (!A.fase) { f.hidden = true; f.innerHTML = ""; return; }
  f.hidden = false;
  const [corpo, piede] = A.fase === "scrivi" ? fScrivi() : A.fase === "diario" ? fDiario() : A.fase === "pensa" ? fPensa() : A.fase === "controllo" ? fControllo() : fDove();
  f.innerHTML = `<div class="ag-velo" data-ag="chiudi"></div><div class="ag-scheda"><div class="ag-maniglia"></div><div class="ag-corpo">${corpo}</div><div class="ag-piede">${piede}</div></div>`;
  if (A.fase === "scrivi" || A.fase === "diario") { const t = $("#ag-testo"); t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  if (A.fase === "dove") { const box = $("#ag-fin"); if (box) box.scrollTop = A.scroll ?? Math.max(0, (A.da - 90 - H0 * 60) / 60 * PX); }
}
function fScrivi() {
  return [`<h2>Aggiungi</h2><div class="ag-campo"><textarea id="ag-testo" rows="4" placeholder="Una cosa o tante, anche col microfono.\nEs. entro venerdì: chiamata @Chiara 30', esercizi di fisica, regalo di laurea">${C.esc(A.testo)}</textarea><div class="ag-sugg" id="ag-sugg" hidden></div></div>
    <p class="ag-aiuto">«@» per scegliere una persona · una cosa per riga o separate da virgole · «entro martedì:» vale per tutte</p>
    <button class="ag-link" data-ag="diario">Scrivi sul diario ›</button>`,
    `<button class="ag-b" data-ag="chiudi">Annulla</button><button class="ag-b blu" data-ag="avanti">Avanti</button>`];
}
function fPensa() {
  return [`<h2>Un attimo…</h2><div class="ag-pensa"><i></i><p>L'assistente sta dividendo quello che hai scritto.</p></div>`,
    `<button class="ag-b" data-ag="scrivi">Indietro</button><button class="ag-b" data-ag="senza-ia">Fai senza</button>`];
}
function fDiario() {
  return [`<h2>Diario</h2><div class="ag-chips">${C.NOTE.map(n => `<button class="ag-chip${A.nota === n.k ? " on" : ""}" data-ag="nota" data-v="${n.k}">${n.nome}</button>`).join("")}</div>
    <div class="ag-campo"><textarea id="ag-testo" rows="4" placeholder="Com'è andata?">${C.esc(A.testo)}</textarea></div>
    <button class="ag-link" data-ag="scrivi">‹ Torna ad Aggiungi</button>`,
    `<button class="ag-b" data-ag="chiudi">Annulla</button><button class="ag-b blu" data-ag="salva-diario">Salva</button>`];
}
function fControllo() {
  const vive = A.righe.filter(r => !r.via), mancano = vive.filter(r => r.tipo === "impegno" && !r.dur).length;
  const sel = (i, campo, opz, val, cls = "") => `<select class="ag-sel ${cls}" data-agi="${i}" data-campo="${campo}">${opz.map(([v, n]) => `<option value="${v}" ${String(val ?? "") === String(v) ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  const riga = (r, i) => {
    if (r.tipo === "ricorda") return `<div class="ag-r${r.via ? " via" : ""}"><div class="ag-r1"><b>${C.esc(r.t)}</b><button class="ag-x" data-ag="togli" data-agi="${i}" aria-label="Togli">×</button></div>
      <div class="ag-r2"><span class="ag-tipo sentito">Lo ricordo in «Cosa so di te»</span></div></div>`;
    if (r.tipo === "sentito") return `<div class="ag-r${r.via ? " via" : ""}"><div class="ag-r1"><b>${C.esc(r.t)}</b><button class="ag-x" data-ag="togli" data-agi="${i}" aria-label="Togli">×</button></div>
      <div class="ag-r2"><span class="ag-tipo sentito">Sentito oggi</span>${r.persona ? `<span class="ag-pers">${C.esc(r.persona.nome)}${r.persona.nuovo ? " (nuova)" : ""}</span>` : `<span class="ag-manca">Di chi? Scrivi @nome</span>`}</div></div>`;
    const quando = QUANDO.map(([k, n]) => [k, k === "data" && r.data ? nomeGiorno(r.data) : n]);
    const durate = [["", "Durata?"], ...DURATE.map(d => [d, durTxt(d)]), ...(r.dur && !DURATE.includes(r.dur) ? [[r.dur, durTxt(r.dur)]] : []), ["altro", "Altro…"]];
    const dove = [["", "Dove?"], ["Casa", "Casa"], ...luoghi().map(l => [l, l]), ["tel", "Al telefono"], ...(r.luogo && !["Casa", "tel", "altro", ...luoghi()].includes(r.luogo) ? [[r.luogo, r.luogo]] : []), ["altro", "Altro luogo…"]];
    return `<div class="ag-r${r.via ? " via" : ""}"><div class="ag-r1"><b>${C.esc(r.t)}</b>${r.persona && !r.t.toLowerCase().includes(r.persona.nome.toLowerCase().split(" ")[0]) ? `<span class="ag-pers">${C.esc(r.persona.nome)}</span>` : ""}${r.ora ? `<span class="ag-pers">alle ${r.ora}</span>` : ""}${r.entro && !giornoDi(r) ? `<span class="ag-pers">entro ${C.esc(nomeGiorno(r.entro).toLowerCase())}</span>` : ""}<button class="ag-x" data-ag="togli" data-agi="${i}" aria-label="Togli">×</button></div>
      <div class="ag-r2"><button class="ag-tipo ${r.tipo}" data-ag="tipo" data-agi="${i}">${r.tipo === "impegno" ? "Impegno" : "Azione"}</button>${sel(i, "quando", quando, r.quando)}
        ${r.tipo === "impegno" ? sel(i, "dur", durate, r.dur, r.dur ? "dur" : "dur vuota") + sel(i, "luogo", dove, r.luogo) : ""}</div>
      ${r.quando === "data" && r.chiediData ? `<div class="ag-r2"><input type="date" class="ag-in" data-agi="${i}" data-campo="data" value="${r.data || C.oggi()}" min="${C.oggi()}"></div>` : ""}
      ${r.chiediDur ? `<div class="ag-r2"><input class="ag-in" data-agi="${i}" data-campo="durAltro" placeholder="Es. 6h30 o 50'" autofocus></div>` : ""}
      ${r.chiediLuogo ? `<div class="ag-r2"><input class="ag-in" data-agi="${i}" data-campo="luogoAltro" placeholder="Es. Biblioteca di Lettere" autofocus><label class="ag-sp"><input type="checkbox" data-agi="${i}" data-campo="ricorda" ${r.ricorda !== false ? "checked" : ""}> Ricordalo</label></div>` : ""}</div>`;
  };
  return [`<h2>Controlla</h2><p class="ag-aiuto">${A.da_ia ? "Diviso dall'assistente. " : C.D.PROVA ? "" : "Diviso con le regole (l'assistente non ha risposto). "}Tocca un'etichetta per cambiarla, la × per togliere una riga.</p>
    <div class="ag-lista">${A.righe.map(riga).join("")}</div>${mancano ? `<p class="ag-avviso">Manca la durata di ${mancano === 1 ? "un impegno" : `${mancano} impegni`}.</p>` : ""}`,
    `<button class="ag-b" data-ag="scrivi">Indietro</button><button class="ag-b blu" data-ag="conferma" ${mancano || !vive.length ? "disabled" : ""}>Conferma${vive.length > 1 ? ` (${vive.length})` : ""}</button>`];
}

// =========================================================
// «Dove lo metto?»: proposte, giorni da sfogliare, blocco da trascinare
// =========================================================
const giornoDg = dg => C.piuGiorni(C.oggi(), dg);
function blocchiDel(iso) {
  const sett = settDi(iso), g = C.giorniTra(sett, iso), B = X.blocchiSettimana(sett).blocchi.filter(b => b.g === g);
  return { tutto: B.filter(b => b.tuttoIlGiorno), occ: B.filter(b => !b.tuttoIlGiorno && X.occupa(b)), fin: B.filter(b => !b.tuttoIlGiorno && b.tipo === "finestra") };
}
/** spazi liberi (8-22, stacco e viaggio prima/dopo) a partire da un giorno: al massimo 3, prima quelli non di sera */
function proposte(r) {
  const o = C.oggi(), adesso = new Date().getHours() * 60 + new Date().getMinutes(), st = Number(X.metodo().stacco || 10), dove = r.luogo === "tel" ? "Casa" : r.luogo || "Casa";
  const da = giornoDi(r) || o, P = [];
  for (let i = 0; i < 7 && P.length < 8; i++) {
    const giorno = C.piuGiorni(da, i); let t = 8 * 60, prima = "Casa", trovati = 0;
    if (giorno === o) t = Math.max(t, Math.ceil((adesso + 15) / 15) * 15);
    const B = blocchiDel(giorno).occ.sort((a, b) => X.hm(a.da) - X.hm(b.da));
    for (const b of [...B, { da: "22:00", luogo: "Casa", fine: true }]) {
      const q = { g: (C.daIso(giorno).getDay() + 6) % 7, min: t };
      const vai = X.tragitto(prima, dove, q) || 0, torna = X.tragitto(dove, b.luogo ?? "Casa", { ...q, min: X.hm(b.da) }) || 0;
      const inizio = Math.ceil((t + vai) / 15) * 15;
      if (X.hm(b.da) - st - torna - inizio >= r.dur && inizio + r.dur <= 22 * 60) {
        P.push({ giorno, da: inizio, perche: b.fine ? "Libero fino a sera" : `Libero, poi «${b.titolo}» alle ${b.da}`, sera: inizio >= 20 * 60 });
        if (++trovati >= 2) break;
      }
      if (X.hm(b.da) < 22 * 60) { t = Math.max(t, X.fine(b) + st); prima = b.luogo || "Casa"; }
    }
  }
  return P.sort((a, b) => a.sera - b.sera || a.giorno.localeCompare(b.giorno) || a.da - b.da).slice(0, 6);
}
/** l'assistente rimette in ordine gli spazi (le tue abitudini) e dice perché; se non hai già spostato il blocco, lo sposta sulla prima */
function ordinaIA(r) {
  if (C.D.PROVA || !navigator.onLine || A.prop.length < 2) { A.prop = A.prop.slice(0, 3); return; }
  const prop = A.propTutte = A.prop; A.pensa = true;
  const spazi = prop.map(p => ({ giorno: `${nomeGiorno(p.giorno)} (${p.giorno})`, da: X.fmt(p.da), nota: p.perche + (p.sera ? ", è sera" : "") }));
  const pe = r.persona?.id ? C.D.leggi("persona:" + r.persona.id)?.nome : r.persona?.nome;
  Promise.race([C.D.funzione("bussola-ia", { azione: "ordina", titolo: r.t, dur: r.dur, luogo: r.luogo === "tel" ? "al telefono" : r.luogo, persona: pe || "", oggi: C.oggi(), spazi, fatti: SD.fatti() }).catch(() => null),
    new Promise(ok => setTimeout(() => ok(null), 14000))]).then(ris => {
    if (A.coda[0] !== r || A.propTutte !== prop) return;   // nel frattempo sei passato oltre
    A.pensa = false;
    const scelte = (ris?.scelte || []).filter(s => prop[s.i]).slice(0, 3);
    if (scelte.length) {
      A.prop = scelte.map(s => ({ ...prop[s.i], perche: s.perche, ia: true }));
      if (!A.mosso) { A.dg = Math.max(0, C.giorniTra(C.oggi(), A.prop[0].giorno)); A.da = A.prop[0].da; A.scroll = null; }
    } else A.prop = prop.slice(0, 3);
    disegna();
  });
  A.prop = prop.slice(0, 3);
}
function fDove() {
  const r = A.coda[0];
  if (A.dg == null) {
    A.prop = proposte(r);
    const g = giornoDi(r), p0 = r.ora && g ? { giorno: g, da: X.hm(r.ora) } : A.prop[0] || { giorno: g || C.oggi(), da: 18 * 60 };
    A.dg = Math.max(0, C.giorniTra(C.oggi(), p0.giorno)); A.da = p0.da; A.scroll = null; A.mosso = !!(r.ora && g);
    ordinaIA(r);
  }
  const iso = giornoDg(A.dg), { tutto, occ, fin } = blocchiDel(iso), fine = A.da + r.dur;
  const sov = occ.find(b => A.da < X.fine(b) && fine > X.hm(b.da));
  const y = m => (m - H0 * 60) / 60 * PX;
  let griglia = "";
  for (let h = H0; h < H1; h++) griglia += `<i class="ag-linea" style="top:${y(h * 60)}px"></i><span class="ag-ora" style="top:${y(h * 60)}px">${h}</span>`;
  griglia += fin.map(b => `<div class="ag-bl fin" style="top:${y(X.hm(b.da))}px;height:${Math.max(14, y(X.fine(b)) - y(X.hm(b.da)) - 2)}px">${C.esc(b.titolo)}</div>`).join("");
  griglia += occ.map(b => `<div class="ag-bl" style="top:${y(X.hm(b.da))}px;height:${Math.max(14, y(X.fine(b)) - y(X.hm(b.da)) - 2)}px">${C.esc(b.titolo)}${y(X.fine(b)) - y(X.hm(b.da)) > 30 ? `<small>${b.da}–${b.a}</small>` : ""}</div>`).join("");
  griglia += A.prop.map((p, i) => ({ ...p, i })).filter(p => p.giorno === iso && p.da !== A.da).map(p => `<div class="ag-bl prop" data-ag="prop" data-agi="${p.i}" style="top:${y(p.da)}px;height:${r.dur / 60 * PX - 2}px">${p.i + 1}. ${C.esc(r.t)}</div>`).join("");
  griglia += `<div class="ag-bl mio" id="ag-mio" style="top:${y(A.da)}px;height:${r.dur / 60 * PX - 2}px">${C.esc(r.t)}<small>${X.fmt(A.da)}–${X.fmt(fine)}</small><u class="ag-man"></u></div>`;
  if (A.dg === 0) { const now = new Date().getHours() * 60 + new Date().getMinutes(); if (now >= H0 * 60) griglia += `<div class="ag-adesso" style="top:${y(now)}px"></div>`; }
  const vai = r.luogo && r.luogo !== "Casa" && r.luogo !== "tel" ? X.tragitto("Casa", r.luogo, { g: (C.daIso(iso).getDay() + 6) % 7, min: A.da }) : 0;
  const stato = `${nomeGiorno(iso)} · ${X.fmt(A.da)}–${X.fmt(fine)} (${durTxt(r.dur)})${sov ? ` · si sovrappone a «${C.esc(sov.titolo)}»` : " · libero"}${vai ? ` · parti alle ${X.fmt(A.da - vai)}` : ""}`;
  return [`<h2>Dove lo metto?</h2><p class="ag-aiuto"><b>${C.esc(r.t)}</b>${A.coda.length > 1 ? ` · poi altri ${A.coda.length - 1}` : ""}</p>
    <div class="ag-pager"><button data-ag="giorno" data-v="-1" ${A.dg === 0 ? "disabled" : ""} aria-label="Giorno prima">${C.ico("prima")}</button><b>${nomeGiorno(iso)}</b><button data-ag="giorno" data-v="1" ${A.dg >= 13 ? "disabled" : ""} aria-label="Giorno dopo">${C.ico("dopo")}</button></div>
    <div class="ag-cal">${tutto.length ? `<div class="ag-tutto">Tutto il giorno · ${tutto.map(b => C.esc(b.titolo)).join(" · ")}</div>` : ""}<div class="ag-fin" id="ag-fin"><div class="ag-griglia" style="height:${(H1 - H0) * PX + 8}px">${griglia}</div></div></div>
    <div class="${sov ? "ag-avviso" : "ag-ok"}" id="ag-stato">${stato}</div>
    ${A.prop.length ? `<div class="ag-lab">${A.pensa ? "Proposte · l'assistente sta scegliendo…" : A.prop[0]?.ia ? "Scelte pensando a te" : "Proposte"}</div><div class="ag-prop">${A.prop.map((p, i) => `<button data-ag="prop" data-agi="${i}" class="${p.giorno === iso && p.da === A.da ? "on" : ""}"><span class="n">${i + 1}</span><span><b>${nomeGiorno(p.giorno)} · ${X.fmt(p.da)}</b><small>${C.esc(p.perche)}${p.sera && !p.ia ? " · è sera" : ""}</small></span></button>`).join("")}</div>` : `<p class="ag-aiuto">Nessuno spazio libero tra le 8 e le 22: scegli tu trascinando il blocco.</p>`}
    <p class="ag-aiuto">Trascina il blocco per spostarlo, tira la lineetta in basso per la durata. Frecce o scorri di lato = altro giorno.</p>`,
    `<button class="ag-b" data-ag="dopo">Più tardi</button><button class="ag-b blu" data-ag="metti">Metti in calendario</button>`];
}

// =========================================================
// salvare
// =========================================================
function idPersona(p) { if (!p) return null; if (p.id) return p.id; return PS.nuova(p.nome, 14); }
function conferma() {
  const vive = A.righe.filter(r => !r.via), o = C.oggi(), lun = C.lunediDi(new Date());
  let az = 0, ds = 0, se = 0, ri = 0; const coda = [];
  vive.forEach(r => {
    if (r.tipo === "sentito") { const id = idPersona(r.persona); if (id) { PS.sentito(id, { avviso: false }); se++; } return; }
    if (r.tipo === "ricorda") { SD.aggiungi(r.t); ri++; return; }
    const giorno = giornoDi(r), persona = idPersona(r.persona);
    if (r.tipo === "azione") {
      if (giorno) {
        const idA = C.nuovoId();
        C.D.scrivi("voce:" + idA, { testo: r.t, tipo: "todo", settimana: settDi(giorno), giorno, ora: r.ora || "", ruolo: null, fatto: false, ordine: Date.now(), persona });
        if (r.ora && G.collegato()) { const sett = settDi(giorno), da = X.hm(r.ora); X.salvaBlocco(sett, { id: C.nuovoId(), g: C.giorniTra(sett, giorno), da: X.fmt(da), a: X.fmt(da + 15), titolo: r.t, tipo: "altro", luogo: "Casa", fonte: "azione:" + idA }, () => {}, { nuovo: true }); }
        az++;
      } else if (r.quando === "sett") { C.D.scrivi("voce:" + C.nuovoId(), { testo: r.t, tipo: "todo", settimana: lun, giorno: null, ora: "", ruolo: null, fatto: false, ordine: Date.now(), persona, entro: r.entro || null }); ds++; }
      else { C.D.scrivi("voce:" + C.nuovoId(), { ...X.leggiRacc(r.t), tipo: "parcheggio", ritorna: null, parcheggiato: o, sasso: false, padre: null, fatto: false, creato: Date.now(), persona, entro: r.entro || null }); ds++; }
      return;
    }
    if (r.luogo && r.ricorda && r.nuovoLuogo) aggiungiLuogo(r.luogo);
    if (giorno) coda.push({ ...r, persona: persona ? { id: persona } : null });
    else { salvaInDs(r, persona); ds++; }
  });
  const msg = [az && `${az} nelle azioni`, ds && `${ds} in Da sistemare`, se && `${se} ${se === 1 ? "persona sentita" : "persone sentite"}`, ri && "ricordato"].filter(Boolean).join(" · ");
  if (msg) C.avvisa(msg, true, "spunta");
  C.disegna();
  if (coda.length) { A.coda = coda; A.fase = "dove"; A.dg = null; return disegna(); }
  chiudi();
}
/** un impegno senza giorno (o rimandato con «Più tardi») va in Da sistemare con durata e luogo: toccandolo torna a «Dove lo metto?» */
function salvaInDs(r, persona) {
  const base = { testo: r.t, impegno: true, dur: r.dur, luogo: r.luogo || "", persona: persona || null, entro: r.entro || null, fatto: false, creato: Date.now(), padre: null };
  if (r.quando === "avanti") C.D.scrivi("voce:" + C.nuovoId(), { ...base, tipo: "parcheggio", ritorna: null, parcheggiato: C.oggi(), sasso: false });
  else C.D.scrivi("voce:" + C.nuovoId(), { ...base, tipo: "inbox" });
}
function aggiungiLuogo(nome) {
  const m = X.metodo(); if (m.luoghi.some(l => l.nome.toLowerCase() === nome.toLowerCase())) return;
  C.D.scrivi("metodo", { ...m, luoghi: [...m.luoghi, { nome, alias: [] }] });
}
function mettiInCalendario() {
  const r = A.coda[0], iso = giornoDg(A.dg), sett = settDi(iso), luogo = r.luogo === "tel" ? "Casa" : r.luogo || "";
  X.salvaBlocco(sett, { id: C.nuovoId(), g: C.giorniTra(sett, iso), da: X.fmt(A.da), a: X.fmt(Math.min(A.da + r.dur, 24 * 60 - 1)), titolo: r.t, tipo: r.tipoBlocco || "imprevisto", luogo, fonte: r.fonte || "imprevisto" }, () => {}, { nuovo: true });
  if (r.daVoce && !r.tieni) C.D.scrivi("voce:" + r.daVoce, null);   // un sasso grande (tieni) resta: il blocco è legato a lui con la fonte
  SD.registra(r.t, A.da);
  C.avvisa(`${G.collegato() ? "In Calendar" : "Nella settimana"}: ${r.t} · ${nomeGiorno(iso).toLowerCase()} ${X.fmt(A.da)}`, true, "spunta");
  prossimo();
}
function prossimo() { A.coda.shift(); A.dg = null; C.disegna(); if (A.coda.length) disegna(); else chiudi(); }

// =========================================================
// eventi
// =========================================================
function leggiTesto() { const t = $("#ag-testo"); if (t) A.testo = t.value; }
document.addEventListener("click", e => {
  const b = e.target.closest("[data-ag]"); if (!b || !A.fase) return;
  const k = b.dataset.ag, i = Number(b.dataset.agi), r = A.righe[i];
  if (k === "chiudi") return chiudi();
  if (k === "diario") { leggiTesto(); A.fase = "diario"; return disegna(); }
  if (k === "scrivi") { if (A.fase === "diario") leggiTesto(); A.fase = "scrivi"; return disegna(); }
  if (k === "nota") { leggiTesto(); A.nota = b.dataset.v; return disegna(); }
  if (k === "salva-diario") {
    leggiTesto(); if (!A.testo.trim()) return $("#ag-testo").focus();
    C.D.scrivi("nota:" + C.nuovoId(), { settimana: C.lunediDi(new Date()), tipo: A.nota, testo: A.testo.trim(), quando: Date.now() });
    C.avvisa("Scritto nel diario", true, "spunta"); C.disegna(); return chiudi();
  }
  if (k === "sugg") {
    const t = $("#ag-testo"), pos = t.selectionStart, prima = t.value.slice(0, pos).replace(/@[^@\s]*$/, "@" + b.dataset.v + " ");
    t.value = prima + t.value.slice(pos); A.testo = t.value; $("#ag-sugg").hidden = true; t.focus(); t.setSelectionRange(prima.length, prima.length); return;
  }
  if (k === "avanti") {
    leggiTesto(); if (!A.testo.trim()) return $("#ag-testo").focus();
    const testo = A.testo, giro = A.giro = (A.giro || 0) + 1;
    if (C.D.PROVA || !navigator.onLine) { A.righe = capisci(testo); A.da_ia = false; A.fase = "controllo"; return disegna(); }
    A.fase = "pensa"; disegna();
    const fine = righe => {
      if (A.fase !== "pensa" || A.giro !== giro) return;   // nel frattempo hai premuto «Fai senza» o chiuso
      A.righe = righe || capisci(testo); A.da_ia = !!righe; A.fase = "controllo"; disegna();
    };
    // qualunque errore (rete, funzione, risposta strana) = si va avanti con le regole
    Promise.resolve().then(() => capisciIA(testo)).then(fine, err => { console.error("assistente", err); fine(null); });
    return;
  }
  if (k === "senza-ia") { A.righe = capisci(A.testo); A.da_ia = false; A.fase = "controllo"; return disegna(); }
  if (k === "togli") { r.via = !r.via; return disegna(); }
  if (k === "tipo") { r.tipo = r.tipo === "impegno" ? "azione" : "impegno"; return disegna(); }
  if (k === "conferma") return conferma();
  if (k === "giorno") return cambiaGiorno(Number(b.dataset.v));
  if (k === "prop") { const p = A.prop[i]; A.dg = C.giorniTra(C.oggi(), p.giorno); A.da = p.da; A.scroll = null; A.mosso = true; return disegna(); }
  if (k === "metti") return mettiInCalendario();
  if (k === "dopo") { const r0 = A.coda[0]; if (!r0.daVoce) salvaInDs({ ...r0, quando: "sett" }, r0.persona?.id); C.avvisa("Resta in Da sistemare", true); return prossimo(); }
});
document.addEventListener("change", e => {
  const el = e.target; if (!el.closest?.("#ag-foglio") || el.dataset.agi == null) return;
  const r = A.righe[Number(el.dataset.agi)], c = el.dataset.campo, v = el.value;
  if (c === "quando") { r.quando = v; r.chiediData = v === "data"; if (v === "data" && !r.data) r.data = C.piuGiorni(C.oggi(), 2); }
  else if (c === "data") { r.data = v; r.chiediData = false; }
  else if (c === "dur") { if (v === "altro") r.chiediDur = true; else { r.dur = Number(v) || null; r.chiediDur = false; } }
  else if (c === "durAltro") { const d = durataDa(v.replace(/(\d+)h(\d+)/i, "$1h $2")) ?? (/^\d+$/.test(v.trim()) ? +v : null); if (d >= 5) { r.dur = d; r.chiediDur = false; } }
  else if (c === "luogo") { if (v === "altro") r.chiediLuogo = true; else { r.luogo = v; r.chiediLuogo = false; } }
  else if (c === "luogoAltro") { if (v.trim()) { r.luogo = v.trim(); r.nuovoLuogo = true; r.ricorda = r.ricorda !== false; r.chiediLuogo = false; } }
  else if (c === "ricorda") { r.ricorda = el.checked; return; }
  disegna();
});
// @ → l'elenco delle tue persone
document.addEventListener("input", e => {
  if (e.target.id !== "ag-testo" || A.fase !== "scrivi") return;
  A.testo = e.target.value;
  const m = e.target.value.slice(0, e.target.selectionStart).match(/@([^@\s]*)$/), s = $("#ag-sugg");
  if (!m) { s.hidden = true; return; }
  const q = m[1].toLowerCase(), L = PS.tutte().filter(p => p.nome.toLowerCase().includes(q)).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 6);
  s.innerHTML = `<div class="ag-sugg-t">Chi intendi?</div>${L.map(p => `<button data-ag="sugg" data-v="${C.esc(p.nome)}">${C.ico("persone")}${C.esc(p.nome)}</button>`).join("")}${q && !L.some(p => p.nome.toLowerCase() === q) ? `<button data-ag="sugg" data-v="${C.esc(m[1][0].toUpperCase() + m[1].slice(1))}">+ Nuova persona «${C.esc(m[1])}»</button>` : ""}`;
  s.hidden = !L.length && !q;
});
document.addEventListener("keydown", e => {
  if (!A.fase) return;
  if (e.key === "Escape") { e.preventDefault(); return chiudi(); }
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); $("#ag-foglio .ag-b.blu:not([disabled])")?.click(); }
});

// trascinare il blocco (sposta / allunga a scatti di 15') e scorrere di lato per cambiare giorno
let T = null;
document.addEventListener("pointerdown", e => {
  if (A.fase !== "dove") return;
  const m = e.target.closest("#ag-mio");
  if (m) { e.preventDefault(); T = { m, y: e.clientY, da0: A.da, dur0: A.coda[0].dur, allunga: !!e.target.closest(".ag-man") }; m.setPointerCapture?.(e.pointerId); return; }
  if (e.target.closest("#ag-fin")) T = { giro: true, x: e.clientX, y: e.clientY };
});
document.addEventListener("pointermove", e => {
  if (!T || T.giro) return;
  const r = A.coda[0], dm = Math.round((e.clientY - T.y) / PX * 4) * 15;
  if (T.allunga) r.dur = Math.max(15, Math.min(24 * 60 - A.da, T.dur0 + dm));
  else A.da = Math.max(H0 * 60, Math.min(24 * 60 - r.dur, T.da0 + dm));
  T.m.style.top = (A.da - H0 * 60) / 60 * PX + "px"; T.m.style.height = r.dur / 60 * PX - 2 + "px";
  T.m.querySelector("small").textContent = `${X.fmt(A.da)}–${X.fmt(A.da + r.dur)}`;
});
document.addEventListener("touchmove", e => { if (T && !T.giro) e.preventDefault(); }, { passive: false });
document.addEventListener("pointerup", e => {
  if (!T) return;
  const t = T; T = null;
  if (t.giro) { const dx = e.clientX - t.x, dy = e.clientY - t.y; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) cambiaGiorno(dx < 0 ? 1 : -1); return; }
  A.mosso = true; A.scroll = $("#ag-fin")?.scrollTop; disegna();
});
function cambiaGiorno(d) { const n = A.dg + d; if (n < 0 || n > 13) return; A.scroll = $("#ag-fin")?.scrollTop; A.dg = n; A.mosso = true; disegna(); }
