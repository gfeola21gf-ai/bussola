/* app.js — Bussola: disegna le schermate e risponde ai tocchi.
   I dati li tiene dati.js. Le chiavi usate:
     ruolo:<id>   { settimana, nome, colore, obiettivo, obiettivoFatto, ordine }
     voce:<id>    { testo, fatto, tipo: "todo"|"ruolo"|"ciclo", settimana, ruolo, ordine,
                    quadrante: null|"q1".."q4", ordM (ordine nella matrice), priorita, fattoIl,
                    inMatrice (solo azioni dei ruoli: compaiono nella matrice solo se messe lì),
                    check (solo azioni dei ruoli: true = col quadratino, altrimenti punto elenco),
                    padre (id della voce "grande" che la contiene: un solo livello), chiuso (gruppo richiuso) }
     nota:<id>    { settimana, tipo: "bene"|"migliora"|"idea", testo, ordine }
     evento:<id>  { titolo, inizio, fine (AAAA-MM-GG), colore, note }
   settimana = data del lunedì (AAAA-MM-GG). I cicli aperti non hanno settimana: valgono sempre. */
import * as D from "./dati.js?v=20261031181718";
import * as PX from "./pianifica.js?v=20261031181718";
import * as RP from "./rapide.js?v=20261031181718";
import * as DS from "./dasistemare.js?v=20261031181718";
import { COLORI, col } from "./colori.js?v=20261031181718";

const stileCol = k => `--c:${col(k).c};--t:${col(k).t || "#fff"}`;
const QUADRANTI = [
  { k: "q1", nome: "Fai subito", sotto: "Importante e urgente", colore: "corallo" },
  { k: "q2", nome: "Pianifica", sotto: "Importante, non urgente", colore: "verde" },
  { k: "q3", nome: "Delega", sotto: "Urgente, non importante", colore: "giallo" },
  { k: "q4", nome: "Elimina", sotto: "Né urgente né importante", colore: "viola" },
];
const NOTE = [
  { k: "bene", nome: "Ha funzionato", corto: "Funzionato", c: "#3A9A28" },
  { k: "migliora", nome: "Da migliorare", corto: "Migliorare", c: "#E2502E" },
  { k: "idea", nome: "Idea", corto: "Idea", c: "#8E44E0" },
];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const LOGO = `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 9.5C18.7 15.3 20.7 17.3 26.5 18C20.7 18.7 18.7 20.7 18 26.5C17.3 20.7 15.3 18.7 9.5 18C15.3 17.3 17.3 15.3 18 9.5Z" fill="currentColor"/></svg>`;
// icone disegnate (niente emoji): tratto arrotondato come quelle della barra laterale
const ICO = {
  piu: `<path d="M12 5v14M5 12h14"/>`,
  prima: `<path d="M14.5 6 8.5 12l6 6"/>`,
  dopo: `<path d="m9.5 6 6 6-6 6"/>`,
  giu: `<path d="m6 9.5 6 6 6-6"/>`,
  annulla: `<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>`,
  esci: `<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>`,
  allerta: `<path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4M12 17h.01"/>`,
  matita: `<path d="M15.5 4.5l4 4L8 20H4v-4Z"/><path d="m13.5 6.5 4 4"/>`,
  copia: `<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>`,
  stella: `<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z"/>`,
  avanti: `<path d="M4 12h15M13 6l6 6-6 6"/>`,
  indietro: `<path d="M20 12H5M11 6l-6 6 6 6"/>`,
  cestino: `<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/><path d="M10 11v5.5M14 11v5.5"/>`,
  spunta: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  dentro: `<path d="M4 5v6a3 3 0 0 0 3 3h12"/><path d="m15 10 4 4-4 4"/>`,
  fuori: `<path d="M20 19v-6a3 3 0 0 0-3-3H5"/><path d="m9 6-4 4 4 4"/>`,
  elenco: `<path d="M10 6h10M10 12h10M10 18h10"/><circle cx="4.5" cy="6" r=".8" fill="currentColor"/><circle cx="4.5" cy="12" r=".8" fill="currentColor"/><circle cx="4.5" cy="18" r=".8" fill="currentColor"/>`,
  bersaglio: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>`,
  luna: `<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>`,
  persone: `<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 2.8 3 6"/>`,
  lampo: `<path d="M13 3 5 14h6l-1 7 8-11h-6Z"/>`,
  bussola: `<path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/>`,
  ingranaggio: `<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>`,
  smista: `<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M17 14v6M14 17h6"/>`,
};
const ico = n => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
const PUNTINI = `<svg class="ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`;

const $ = s => document.querySelector(s);
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nuovoId = () => crypto.randomUUID().slice(0, 8);
function ricorda(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; }
}

// ---------- date ----------
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daIso = s => { const [y, m, g] = s.split("-").map(Number); return new Date(y, m - 1, g); };
const piuGiorni = (s, n) => { const d = daIso(s); d.setDate(d.getDate() + n); return iso(d); };
const giorniTra = (a, b) => Math.round((daIso(b) - daIso(a)) / 864e5);
const lunediDi = d => { d = new Date(d); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
const oggi = () => iso(new Date());
const meseDi = s => s.slice(0, 7);
const piuMesi = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
function numSettimana(s) {
  const d = daIso(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const g4 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - g4) / 864e5 - 3 + ((g4.getDay() + 6) % 7)) / 7);
}
function intervallo(lun) {
  const a = daIso(lun), b = daIso(piuGiorni(lun, 6));
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${MESI[b.getMonth()]}`
    : `${a.getDate()} ${MESI[a.getMonth()]} – ${b.getDate()} ${MESI[b.getMonth()]}`;
}

// stato della schermata (non salvato online)
const S = {
  vista: ricorda("bussola.vista") === "persone" ? "metodo" : ["settimana", "pianifica", "mesi", "metodo", "oggi"].includes(ricorda("bussola.vista")) ? ricorda("bussola.vista") : "oggi",   // le persone ora stanno nelle impostazioni
  sett: lunediDi(new Date()),
  mese: meseDi(oggi()),
  nMesi: Number(ricorda("bussola.nMesi")) || 2,
  aperti: new Set(),      // ruoli e «pillole» aperti nella Settimana
  modoSett: ricorda("bussola.modoSett") === "griglia" ? "griglia" : "elenco",   // Settimana: Elenco o Griglia
  tabSett: "sett",   // Settimana: «La settimana» o «Da sistemare» (v4)
  chiusi: false,          // elenco dei cicli chiusi aperto?
  edita: null,            // "chiave|campo" in modifica
  aggiungi: null,         // lista in cui si sta aggiungendo
  menu: null,             // { k, x, y }
  foglio: null,           // { tipo: "evento", id, dati }
  selezione: null,        // giorni scelti trascinando nei mesi { da, a }
  evAnteprima: null,      // evento mentre lo trascini { id, inizio, fine }
  pop: null,              // obiettivo appena raggiunto (animazione)
};

// ---------- lettura dati ----------
const perOrdine = campo => (a, b) => (a[campo] ?? 0) - (b[campo] ?? 0);
const tutte = pref => D.elenco(pref).map(([k, v]) => ({ ...v, id: k.slice(pref.length) }));
const voci = () => tutte("voce:");
const ruoli = (sett = S.sett) => tutte("ruolo:").filter(r => r.settimana === sett).sort(perOrdine("ordine"));
const eventi = () => tutte("evento:").map(e => S.evAnteprima?.id === e.id ? { ...e, ...S.evAnteprima } : e);
const senzaId = ({ id, ...resto }) => resto;
/** scrive solo se qualcosa è cambiato (così l'annulla non si riempie di passi vuoti) */
function salva(gen, x) {
  const k = gen + ":" + x.id, nuovo = senzaId(x);
  if (JSON.stringify(D.leggi(k)) !== JSON.stringify(nuovo)) D.scrivi(k, nuovo);
}

/** tutte le voci che compaiono nella matrice della settimana mostrata */
function pool() {
  const idRuoli = new Set(ruoli().map(r => r.id)), fine = piuGiorni(S.sett, 6);
  return voci().filter(v =>
    !v.padre && (v.tipo === "todo" && v.settimana === S.sett) ||
    !v.padre && (v.tipo === "ruolo" && idRuoli.has(v.ruolo) && (v.quadrante || v.inMatrice)) ||   // le azioni dei ruoli solo se ce le metti tu
    !v.padre && (v.tipo === "ciclo" && (!v.fatto || (v.fattoIl >= S.sett && v.fattoIl <= fine))));
}
const campoOrdine = L => /^q\d$|^smista$/.test(L) ? "ordM" : "ordine";
function lista(L) {
  if (L.startsWith("n:")) return tutte("nota:").filter(n => n.settimana === S.sett && n.tipo === L.slice(2)).sort(perOrdine("ordine"));
  if (L.startsWith("sub:")) return figli(L.slice(4));
  let V;
  const sopra = voci().filter(v => !v.padre);   // le sotto-attività stanno dentro la loro voce "grande"
  if (L === "todo") V = sopra.filter(v => v.tipo === "todo" && v.settimana === S.sett);
  else if (L.startsWith("r:")) V = sopra.filter(v => v.tipo === "ruolo" && v.ruolo === L.slice(2) && !v.sasso);
  else if (L === "margine") V = sopra.filter(v => v.tipo === "margine" && v.settimana === S.sett);
  else if (L === "cicli") V = sopra.filter(v => v.tipo === "ciclo" && !v.fatto);
  else if (L === "chiusi") return sopra.filter(v => v.tipo === "ciclo" && v.fatto).sort((a, b) => (b.fattoIl || "").localeCompare(a.fattoIl || "")).slice(0, 15);
  else if (L === "smista") V = pool().filter(v => !v.quadrante && !v.fatto);
  else V = pool().filter(v => v.quadrante === L);
  return V.sort(perOrdine(campoOrdine(L)));
}
/** la lista "di casa" di una voce (per duplicare e spostare) */
const figli = id => voci().filter(v => v.padre === id).sort(perOrdine("ordine"));
const listaDi = v => v.padre ? "sub:" + v.padre : v.tipo === "todo" ? "todo" : v.tipo === "ruolo" ? "r:" + v.ruolo : v.tipo === "margine" ? "margine" : "cicli";
/** cosa cambia in una voce quando la lasci nella lista L */
function assegna(v, L) {
  if (L.startsWith("sub:")) {
    const p = D.leggi("voce:" + L.slice(4));
    return { ...v, padre: L.slice(4), tipo: p.tipo, settimana: p.settimana, ruolo: p.ruolo, quadrante: null, inMatrice: false };
  }
  if (L === "todo") return { ...v, padre: null, tipo: "todo", settimana: S.sett, ruolo: null };
  if (L.startsWith("r:")) { const r = D.leggi("ruolo:" + L.slice(2)); return { ...v, padre: null, tipo: "ruolo", ruolo: L.slice(2), settimana: r?.settimana || S.sett }; }
  if (L === "cicli") return { ...v, padre: null, tipo: "ciclo", settimana: null, ruolo: null, fatto: false, fattoIl: null };
  if (L === "margine") return { ...v, padre: null, tipo: "margine", settimana: S.sett, sasso: false };
  if (L === "smista") return { ...v, quadrante: null, inMatrice: v.tipo === "ruolo" || !!v.inMatrice };
  if (/^q\d$/.test(L)) return { ...v, quadrante: L, inMatrice: v.tipo === "ruolo" || !!v.inMatrice };
  if (L.startsWith("n:")) return { ...v, tipo: L.slice(2) };
  return v;
}
/** mette l'elemento k nella lista L alla posizione idx e rinumera la lista */
function sposta(k, L, idx) {
  const [gen, id] = k.split(":");
  const x = { ...D.leggi(k), id };
  if (gen === "ruolo") {
    const arr = ruoli(x.settimana).filter(r => r.id !== id);
    arr.splice(idx, 0, x);
    arr.forEach((r, i) => salva("ruolo", { ...r, ordine: i }));
    return;
  }
  const campo = campoOrdine(L), nuovo = assegna(x, L);
  const arr = lista(L).filter(y => y.id !== id);
  arr.splice(Math.min(idx, arr.length), 0, nuovo);
  arr.forEach((y, i) => salva(gen, { ...y, [campo]: i }));
  if (gen !== "voce") return;
  allineaFigli(id);
  if (x.padre && x.padre !== nuovo.padre) aggiornaPadre(x.padre);
  if (nuovo.padre) aggiornaPadre(nuovo.padre);
}
/** le sotto-attività seguono la loro voce "grande" (stessa lista, settimana, ruolo) */
function allineaFigli(id) {
  const p = D.leggi("voce:" + id);
  if (p) figli(id).forEach(f => salva("voce", { ...f, tipo: p.tipo, settimana: p.settimana, ruolo: p.ruolo }));
}
/** la voce "grande" è fatta quando sono fatte tutte le sue sotto-attività */
function aggiornaPadre(pid) {
  const ff = figli(pid), p = D.leggi("voce:" + pid);
  if (!ff.length || !p) return;
  const tutte = ff.every(f => f.fatto);
  if (!!p.fatto !== tutte) salva("voce", { ...p, id: pid, fatto: tutte, fattoIl: tutte ? oggi() : null });
}
const ultimoOrdine = L => lista(L).reduce((m, x) => Math.max(m, x[campoOrdine(L)] ?? 0), -1) + 1;

// ---------- creare ----------
function creaVoce(L, testo) {
  const id = nuovoId();
  let v = assegna({ testo, fatto: false, tipo: "todo", settimana: S.sett, ruolo: null, quadrante: null, priorita: false }, L.startsWith("q") ? "todo" : L);
  if (/^q\d$/.test(L)) v = { ...v, quadrante: L, ordM: ultimoOrdine(L) };
  v.ordine = ultimoOrdine(listaDi(v));
  D.scrivi("voce:" + id, v);
  if (v.padre) aggiornaPadre(v.padre);
}
function creaNota(L, testo) {
  D.scrivi("nota:" + nuovoId(), { settimana: S.sett, tipo: L.slice(2), testo, ordine: ultimoOrdine(L) });
}
function creaRuolo() {
  const R = ruoli(), usati = new Set(R.map(r => r.colore));
  const colore = (COLORI.find(c => !usati.has(c.k)) || COLORI[R.length % COLORI.length]).k;
  const id = nuovoId();
  D.scrivi("ruolo:" + id, { settimana: S.sett, nome: "Nuovo ruolo", colore, obiettivo: "", obiettivoFatto: false, ordine: R.length ? Math.max(...R.map(r => r.ordine ?? 0)) + 1 : 0 });
  S.aperti.add(id); S.edita = "ruolo:" + id + "|nome";
}
function duplicaRuolo(id, sett) {
  const r = D.leggi("ruolo:" + id), nid = nuovoId();
  D.scrivi("ruolo:" + nid, { ...r, settimana: sett, obiettivoFatto: false, ordine: sett === r.settimana ? (r.ordine ?? 0) + .5 : ruoli(sett).length });
  lista("r:" + id).forEach(v => { if (sett === r.settimana || !v.fatto) D.scrivi("voce:" + nuovoId(), { ...senzaId(v), ruolo: nid, settimana: sett, fatto: sett === r.settimana ? v.fatto : false }); });
  if (sett === r.settimana) ruoli(sett).forEach((x, i) => salva("ruolo", { ...x, ordine: i }));
}
/** settimana vuota: riporta i ruoli della settimana prima e sposta qui le cose non fatte */
function riprendi() {
  const prec = piuGiorni(S.sett, -7), mappa = {};
  ruoli(prec).forEach(r => {
    const nid = nuovoId(); mappa[r.id] = nid;
    D.scrivi("ruolo:" + nid, { ...senzaId(r), settimana: S.sett, obiettivoFatto: false });
  });
  voci().forEach(v => {
    if (v.fatto || v.padre) return;   // le sotto-attività seguono la loro voce "grande"
    if (v.tipo === "todo" && v.settimana === prec) salva("voce", { ...v, settimana: S.sett });
    else if (v.tipo === "ruolo" && mappa[v.ruolo]) salva("voce", { ...v, ruolo: mappa[v.ruolo], settimana: S.sett });
    else return;
    allineaFigli(v.id);
  });
}
/** dentro i ruoli le voci sono un elenco puntato: hanno il quadratino solo se scegli "da spuntare" (o se le metti in matrice) */
const spuntabile = v => v.tipo !== "ruolo" || !!(v.check || v.quadrante || v.inMatrice || v.sasso);
/** sasso grande: «8 lezioni» → totale 8; fatti = quante ne hai segnate con +1 */
const totaleSasso = v => Number(String(v.misura || "").match(/\d+/)?.[0]) || 0;
const nonFatteDi = sett => {
  const idR = new Set(ruoli(sett).map(r => r.id));
  return voci().filter(v => !v.fatto && ((v.tipo === "todo" && v.settimana === sett) || (v.tipo === "ruolo" && idR.has(v.ruolo) && spuntabile(v))) && !v.padre).length;
};

// =========================================================
// DISEGNO
// =========================================================
function disegna() {
  if (!D.PROVA && !D.chiSei()) return disegnaAccesso();
  const main = $("main"), roles = $(".roles");
  const scroll = { m: main?.scrollTop || 0, r: roles?.scrollLeft || 0 };
  if (!$("aside")) $("#app").innerHTML = htmlBarra() + `<main></main>`;
  aggiornaBarra();
  const aperti = S.vista === vistaDisegnata ? statoRiquadri() : new Map();
  if (PX.viste.includes(S.vista)) $("main").innerHTML = PX.disegna(S.vista);
  else $("main").innerHTML = htmlTesta() + (S.vista === "matrice" ? vistaMatrice() : S.vista === "mesi" ? vistaMesi() : vistaSettimana());
  statoRiquadri().forEach((d, k) => { if (aperti.has(k)) d.el.open = aperti.get(k).open; });   // i riquadri aperti restano aperti
  vistaDisegnata = S.vista;
  $("main").scrollTop = scroll.m;
  if ($(".roles")) $(".roles").scrollLeft = scroll.r;
  disegnaMenu();
  const f = $("[data-fuoco]");
  if (f) {
    f.focus({ preventScroll: true });
    if (f.dataset.seleziona != null) f.select(); else if (f.setSelectionRange) f.setSelectionRange(f.value.length, f.value.length);
    allunga(f);
    const r = f.getBoundingClientRect();
    if (r.bottom > innerHeight - 20 || r.top < 0) f.scrollIntoView({ block: "center" });
  }
  S.pop = null;
}
/** i riquadri richiudibili (<details>) della pagina, riconosciuti dal loro titolo: dopo ogni ridisegno
    restano aperti o chiusi come li avevi lasciati (prima si richiudevano a ogni tocco) */
let vistaDisegnata = null;
function statoRiquadri() {
  const m = new Map();
  document.querySelectorAll("main details").forEach(d => {
    const t = (d.querySelector("summary")?.firstChild?.textContent || "").trim();
    let k = t, n = 1;
    while (m.has(k)) k = t + "#" + ++n;
    m.set(k, { el: d, open: d.open });
  });
  return m;
}
let daRidisegnare = false;
/** ridisegna, ma non mentre stai scrivendo o tieni premuto (rovinerebbe il tocco in corso) */
function ridisegnaPoi() {
  if (document.activeElement?.classList.contains("ed") || document.activeElement?.isContentEditable || document.activeElement?.dataset?.sd || document.activeElement?.dataset?.red || P) { daRidisegnare = true; return; }
  disegna();
}

const ICONE = {
  oggi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></svg>`,
  pianifica: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="5"/></svg>`,
  persone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 2.8 3 6"/></svg>`,
  metodo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>`,
  settimana: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>`,
  matrice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>`,
  mesi: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h13"/></svg>`,
};
function htmlBarra() {
  return `<aside>
    <svg class="onda" viewBox="0 0 36 1000" preserveAspectRatio="none"><path fill="#2E62E8" d="M0 0H8C34 70 4 140 16 220C28 300 0 360 14 450C30 540 2 600 16 690C30 780 0 850 14 920C22 960 10 990 8 1000H0Z"/></svg>
    <div class="logo H">${LOGO}<span>Bussola</span></div>
    <nav>${[["oggi", "Oggi"], ["settimana", "Settimana"], ["pianifica", "Pianifica"], ["mesi", "Mesi"]]
      .map(([v, n]) => `<button class="H nav-${v}" data-azione="vista" data-v="${v}" title="${n}">${ICONE[v]}<span>${n}</span></button>`).join("")}
      </nav>
    <button class="nav-piu-fuori" data-r="piu" title="Aggiungi (N)" aria-label="Aggiungi">${ico("piu")}</button>
    <button class="cattura H" data-r="piu" title="Aggiungi (tasto N)">${ico("piu")}<span>Aggiungi</span><kbd>N</kbd></button>
    <div class="piede">
      <button class="btn-s imp nav-metodo" data-azione="vista" data-v="metodo" title="Impostazioni e ruoli">${ico("ingranaggio")}<span class="chi"> Ruoli, persone e impostazioni</span></button>
      <div class="stato"><span></span></div>
      <div class="riga"><button class="btn-s" data-azione="annulla" title="Annulla (⌘Z)">${ico("annulla")}<span class="chi"> Annulla</span></button>
      <button class="btn-s" data-azione="esci" title="Esci">${ico("esci")}<span class="chi"> Esci</span></button></div>
      <div class="chi">${D.PROVA ? "Modalità prova" : esc(D.chiSei()?.email)}</div>
    </div>
  </aside>`;
}
function aggiornaBarra() {
  document.querySelectorAll("nav button, .imp").forEach(b => b.classList.toggle("on", b.dataset.v === S.vista));
  const st = $(".stato"), s = D.PROVA ? "ok" : D.stato_();
  if (st) {
    st.className = "stato " + s;
    st.querySelector("span").textContent = D.PROVA ? "Solo su questo dispositivo" : s === "ok" ? "Tutto salvato" : s === "invio" ? "Salvo…" : "Offline: salvo dopo";
  }
  const a = $("[data-azione=annulla]");
  if (a) a.disabled = !D.puoiAnnullare();
}

function htmlTesta() {
  let t, p, nav;
  const navSett = `<button class="tondo" data-azione="sett" data-d="-7" aria-label="Settimana prima">${ico("prima")}</button><button class="oggi H" data-azione="sett" data-d="0">Oggi</button><button class="tondo" data-azione="sett" data-d="7" aria-label="Settimana dopo">${ico("dopo")}</button>`;
  const n = numSettimana(S.sett), questa = S.sett === lunediDi(new Date());
  if (S.vista === "settimana") {
    t = "Settimana " + n;
    p = `${intervallo(S.sett)} · ${questa ? "questa settimana" : S.sett < lunediDi(new Date()) ? "settimana passata" : "settimana futura"}`;
    nav = navSett;
  } else if (S.vista === "matrice") {
    t = "Cosa conta davvero?";
    p = `Settimana ${n} (${intervallo(S.sett)}) · trascina le attività nel quadrante giusto`;
    nav = navSett;
  } else {
    const a = S.mese, b = piuMesi(S.mese, S.nMesi - 1), nome = ym => MESI[Number(ym.slice(5)) - 1];
    t = "Il quadro dei mesi";
    p = (S.nMesi === 1 ? `${nome(a)} ${a.slice(0, 4)}` : `${nome(a)} – ${nome(b)} ${b.slice(0, 4)}`) + " · tocca un giorno o trascina su più giorni";
    nav = `<div class="seg H"><button data-azione="nmesi" data-n="1" class="${S.nMesi === 1 ? "on" : ""}">1 mese</button><button data-azione="nmesi" data-n="2" class="${S.nMesi === 2 ? "on" : ""}">2 mesi</button></div>
      <button class="tondo" data-azione="mese" data-d="-1" aria-label="Mese prima">${ico("prima")}</button><button class="oggi H" data-azione="mese" data-d="0">Oggi</button><button class="tondo" data-azione="mese" data-d="1" aria-label="Mese dopo">${ico("dopo")}</button>`;
  }
  return `<div class="testa"><div><h1 class="H">${t}<button class="aiuto" data-p="aiuto" data-v="${S.vista}" aria-label="Come funziona">?</button></h1><p>${p}</p></div><div class="nav-t">${nav}</div></div>`;
}

/** un testo che si modifica toccandolo */
function testo(k, campo, valore, { cls = "tx", tag = "span", vuoto = "" } = {}) {
  if (S.edita === k + "|" + campo)
    return `<textarea class="ed" rows="1" data-salva="${k}" data-campo="${campo}" data-fuoco ${campo === "nome" ? "data-seleziona" : ""}>${esc(valore)}</textarea>`;
  return `<${tag} class="${cls}${valore ? "" : " vuoto"}" data-azione="edita" data-k="${k}" data-campo="${campo}">${valore ? esc(valore) : vuoto}</${tag}>`;
}
function htmlAggiungi(L, etichetta = "Aggiungi") {
  if (S.aggiungi === L) return `<div class="nuovo-riga"><textarea class="ed" rows="1" data-nuovo="${L}" placeholder="Scrivi e premi Invio" data-fuoco></textarea></div>`;
  return `<button class="add" data-azione="aggiungi" data-l="${L}">${ico("piu")}${etichetta}</button>`;
}
function htmlVoce(v, { tag = false } = {}) {
  let t = "";
  if (tag) {
    if (v.tipo === "ruolo") { const r = D.leggi("ruolo:" + v.ruolo); t = `<em class="tag" style="${stileCol(r?.colore)}"><i></i>${esc(r?.nome || "Ruolo")}</em>`; }
    else t = `<em class="tag">${v.tipo === "ciclo" ? "Ciclo" : "To-do"}</em>`;
  }
  const ff = figli(v.id), sub = "sub:" + v.id, aggiungendo = !tag && S.aggiungi === sub;
  const contaF = ff.some(spuntabile) ? `<em class="conta-g">${ff.filter(f => spuntabile(f) && f.fatto).length}/${ff.filter(spuntabile).length}</em>` : "";
  const aperto = !v.chiuso || aggiungendo;
  const gruppo = !tag && (ff.length || aggiungendo)
    ? (aperto ? `<ul class="lista sub" data-lista="${sub}" data-tipo="voce">${ff.map(f => htmlVoce(f)).join("")}</ul>${aggiungendo ? htmlAggiungi(sub) : ""}` : "")
    : "";
  return `<li class="it ${v.fatto ? "done" : ""} ${v.priorita && v.tipo === "ciclo" ? "hot" : ""} ${gruppo || ff.length ? "gruppo" : ""}" data-drag="voce:${v.id}">
    ${ff.length && !tag ? `<button class="freccia ${aperto ? "aperta" : ""}" data-azione="gruppo" data-id="${v.id}" aria-label="${aperto ? "Chiudi" : "Apri"} il gruppo">${ico("dopo")}</button>` : ""}
    ${spuntabile(v) ? `<button class="ck" data-azione="spunta" data-id="${v.id}" aria-label="Fatto"></button>`
      : `<button class="punto" data-azione="rendi-check" data-id="${v.id}" title="Tocca per renderla da spuntare" aria-label="Rendi da spuntare"></button>`}
    ${t ? `<div class="corpo">${testo("voce:" + v.id, "testo", v.testo)}${t}</div>` : testo("voce:" + v.id, "testo", v.testo)}
    ${contaF}${v.priorita && v.tipo === "ciclo" && !tag ? `<em class="pill">Priorità</em>` : ""}
    <button class="mn" data-azione="menu" data-k="voce:${v.id}" aria-label="Altre azioni">${PUNTINI}</button>${gruppo}</li>`;
}
const htmlLista = (L, gen, html) => `<ul class="lista" data-lista="${L}" data-tipo="${gen}">${html}</ul>`;

// ---------- SETTIMANA ----------
// I ruoli scelti per la settimana (3-5), poi diario di bordo, lista del margine e azioni rapide.
/* Settimana, stile semplice: ogni ruolo è una riga sola (etichetta, sasso grande, barra) che si apre col tocco;
   azioni rapide, margine e diario sono «pillole» chiuse. In alto l'interruttore Elenco / Griglia. */
function htmlPill(k, titolo, conta, colore, dentro, zona = "") {
  const aperta = S.aperti.has(k);
  return `<section class="pillola ${aperta ? "aperta" : ""} pl-${k}" ${aperta && zona ? `data-zona="${zona}"` : ""}><button class="pill-t" data-azione="apri" data-id="${k}" aria-expanded="${aperta}">
      <i class="pallino-p" style="background:${colore}"></i><b>${titolo}</b><span class="n">${conta}</span>${ico("dopo")}</button>
    ${aperta ? `<div class="pill-d">${dentro}</div>` : ""}</section>`;
}
function vistaSettimana() {
  const R = ruoli(), todo = lista("todo"), fatti = todo.filter(v => v.fatto).length, marg = lista("margine");
  const prec = piuGiorni(S.sett, -7), nRp = ruoli(prec).length;
  const vuota = !R.length ? `<div class="pianifica-cta"><b class="H">Questa settimana non è ancora pianificata</b>
      <p>Scegli i ruoli, i sassi grandi e le persone: 30 minuti con la guida.</p>
      <div class="riga-b"><button class="H" data-azione="vista" data-v="pianifica">${ico("bussola")}Pianifica la settimana</button>
      ${nRp ? `<button class="H sec" data-azione="riprendi">Riprendi i ruoli della settimana scorsa</button>` : ""}</div></div>` : "";
 
  const diario = tutte("nota:").filter(n => n.settimana === S.sett).sort((a, b) => (b.quando || 0) - (a.quando || 0));
  const NT = Object.fromEntries(NOTE.map(t => [t.k, t]));
  const htmlDiario = (diario.length ? diario.map(n => `<div class="voce-d it" data-drag="nota:${n.id}"><div class="voce-d-t"><span class="tag-d" style="background:${NT[n.tipo]?.c || "#888"}">${NT[n.tipo]?.corto || ""}</span>
        <time>${n.quando ? quandoBreve(n.quando) : ""}</time><button class="mn" data-azione="menu" data-k="nota:${n.id}" aria-label="Altre azioni">${PUNTINI}</button></div>
        ${testo("nota:" + n.id, "testo", n.testo)}</div>`).join("")
      : `<p class="vuota">Scrivi sul momento: com'è andata, cosa migliorare, un'idea.</p>`) + `<button class="add" data-p="diario">${ico("piu")}Scrivi nel diario</button>`;
  // un solo «focus»: una card per ruolo (ruolo + obiettivo; toccandola si apre con sassi e promemoria),
  // poi la settimana: griglia a 7 giorni oppure le azioni rapide per giorno
  // in cima l'interruttore «La settimana / Da sistemare» (v4): Da sistemare = tutto ciò che non ha ancora un giorno (dasistemare.js)
  const nDs = DS.quante();
  const tab = `<div class="seg fc-tab"><button data-azione="tabsett" data-t="sett" class="${S.tabSett !== "ds" ? "on" : ""}">La settimana</button><button data-azione="tabsett" data-t="ds" class="${S.tabSett === "ds" ? "on" : ""}">Da sistemare${nDs ? `<span class="n">${nDs}</span>` : ""}</button></div>`;
  if (S.tabSett === "ds") return tab + `<div class="ds-box">${DS.html()}</div>`;
  return tab + `
  ${R.length ? `<div class="rp-tit"><h3 class="H">Il focus della settimana</h3></div>
    <div class="ruoli fc-lista" data-lista="ruoli" data-tipo="ruolo">${R.map(htmlRuolo).join("")}</div>` : vuota}
  <div class="rp-tit fc-sett"><h3 class="H">La settimana</h3></div>
  <div class="seg H fc-modo"><button data-azione="modo" data-m="griglia" class="${S.modoSett === "griglia" ? "on" : ""}">Griglia</button><button data-azione="modo" data-m="elenco" class="${S.modoSett === "elenco" ? "on" : ""}">Azioni rapide</button></div>
  ${S.modoSett === "griglia" ? `<div class="paper gs-carta">${PX.grigliaSettimana(S.sett)}</div>` : RP.htmlSettimana(S.sett, { titolo: false })}
  <div class="tre-pill">
    ${htmlPill("margine", "Margine", marg.length, "#B9B09C",
      `<p class="sub">Se avanza tempo o salta un impegno: un premio, non un dovere.</p>${htmlLista("margine", "voce", marg.map(v => htmlVoce(v)).join(""))}${htmlAggiungi("margine")}`, "margine")}
    ${htmlPill("diario", "Diario di bordo", diario.length, "var(--blue)", htmlDiario)}
  </div>`;
}
function quandoBreve(t) {
  const d = new Date(t);
  return `${["dom", "lun", "mar", "mer", "gio", "ven", "sab"][d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function htmlSasso(v) {
  const tot = totaleSasso(v), fatti = Math.min(v.fatti || 0, tot || 0);
  return `<div class="sg ${v.fatto ? "fatto" : ""}" data-drag="voce:${v.id}">
    <div class="sg-t"><small class="H">Sasso grande</small>${testo("voce:" + v.id, "testo", v.testo)}</div>
    ${tot ? `<div class="sg-p"><span>${fatti}/${tot}${v.misura ? " " + esc(v.misura.replace(/^\s*\d+\s*/, "")) : ""}</span><div class="prog"><i style="width:${fatti / tot * 100}%"></i></div>
      <button class="piu1" data-azione="avanza" data-id="${v.id}" aria-label="Segna un passo fatto">+1</button></div>`
      : `<button class="ck" data-azione="spunta" data-id="${v.id}" aria-label="Fatto"></button>`}
    <button class="mn" data-azione="menu" data-k="voce:${v.id}" aria-label="Altre azioni">${PUNTINI}</button></div>`;
}
function htmlRuolo(r) {
  const L = "r:" + r.id, it = lista(L), k = "ruolo:" + r.id;
  const sassi = voci().filter(v => v.tipo === "ruolo" && v.ruolo === r.id && v.sasso && !v.padre).sort(perOrdine("ordine"));
  if (!S.aperti.has(r.id)) {
    // chiuso = card del focus: il ruolo e l'obiettivo della settimana, nient'altro
    return `<article class="ruolo fc it" data-drag="${k}" style="${stileCol(r.colore)}">
      <button class="fc-t" data-azione="apri" data-id="${r.id}" aria-expanded="false"><span class="pill-r H">${esc(r.nome || "Senza nome")}</span>
        <span class="fc-ob">${r.obiettivo ? (r.obiettivoFatto ? "Raggiunto · " : "") + esc(r.obiettivo) : "Tocca per scrivere l'obiettivo"}</span>${ico("dopo")}</button>
    </article>`;   // v4: solo ruolo + obiettivo della settimana (sassi e promemoria si vedono aprendo la card)
  }
  return `<article class="role ruolo aperta it" data-drag="${k}" data-zona="${L}" style="${stileCol(r.colore)}">
    <header><button class="ruolo-chiudi H" data-azione="apri" data-id="${r.id}" aria-expanded="true">Ruolo ${ico("dopo")}</button><button class="mn" data-azione="menu" data-k="${k}" aria-label="Altre azioni">${PUNTINI}</button></header>
    ${testo(k, "nome", r.nome, { cls: "H", tag: "h3", vuoto: "Senza nome" })}
    <div class="goal ${r.obiettivoFatto ? "done" : ""} ${S.pop === r.id ? "pop" : ""}"><button class="big" data-azione="obiettivo" data-id="${r.id}" aria-label="Obiettivo raggiunto"></button>
      <div><small class="H">Obiettivo</small>${testo(k, "obiettivo", r.obiettivo, { vuoto: "Tocca per scriverlo" })}</div></div>
    ${sassi.map(htmlSasso).join("")}
    ${htmlLista(L, "voce", it.map(v => htmlVoce(v)).join(""))}
    ${htmlAggiungi(L)}
  </article>`;
}

// ---------- MATRICE ----------
function vistaMatrice() {
  const smista = lista("smista");
  const q = Q => `<section class="q" style="${stileCol(Q.colore)}" data-zona="${Q.k}"><h3 class="H">${Q.nome}</h3><small>${Q.sotto}</small>
    ${htmlLista(Q.k, "voce", lista(Q.k).map(v => htmlVoce(v, { tag: true })).join(""))}${htmlAggiungi(Q.k)}</section>`;
  return `<div class="mx">
    <div class="matrix">
      <div></div><div class="asse H">Urgente</div><div class="asse H">Non urgente</div>
      <div class="asse v H">Importante</div>${q(QUADRANTI[0])}${q(QUADRANTI[1])}
      <div class="asse v H">Non importante</div>${q(QUADRANTI[2])}${q(QUADRANTI[3])}
    </div>
    <section class="paper smista" data-zona="smista">
      <div class="ribbon H" style="--c:var(--blue)">Da smistare</div>
      <p class="sub" style="margin-bottom:10px">To-do e cicli aperti</p>
      ${htmlLista("smista", "voce", smista.map(v => htmlVoce(v, { tag: true })).join(""))}
      ${smista.length ? "" : `<p class="vuota">${ico("spunta")}Tutto smistato</p>`}
    </section>
  </div>`;
}

// ---------- MESI ----------
function vistaMesi() {
  const mesi = Array.from({ length: S.nMesi }, (_, i) => piuMesi(S.mese, i));
  return `<div class="months n${S.nMesi}">${mesi.map(htmlMese).join("")}</div>`;
}
function htmlMese(ym) {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = iso(new Date(y, m, 0));
  let ws = lunediDi(daIso(ym + "-01")), righe = "";
  const E = eventi();
  while (ws <= ultimo) { righe += htmlRiga(ws, ym, E); ws = piuGiorni(ws, 7); }
  return `<section class="paper mese"><div class="ribbon H" style="--c:${m % 2 ? "var(--coral)" : "var(--blue)"}">${MESI[m - 1]} ${y}</div>
    <div class="dow H">${"Lun Mar Mer Gio Ven Sab Dom".split(" ").map(d => `<span>${d}</span>`).join("")}</div>${righe}</section>`;
}
function htmlRiga(ws, ym, E) {
  const we = piuGiorni(ws, 6), occupate = [];
  const tel = matchMedia("(max-width: 640px)").matches, passo = tel ? 19 : 27, su = tel ? 24 : 30;   // sul telefono un mese sta in una schermata
  const qui = E.filter(e => e.fine >= ws && e.inizio <= we)
    .sort((a, b) => a.inizio.localeCompare(b.inizio) || giorniTra(b.inizio, b.fine) - giorniTra(a.inizio, a.fine) || (a.titolo || "").localeCompare(b.titolo || ""));
  let barre = "";
  for (const e of qui) {
    const a = Math.max(0, giorniTra(ws, e.inizio)), b = Math.min(6, giorniTra(ws, e.fine));
    let l = 0;
    while (occupate[l]?.some(([x, y]) => a <= y && b >= x)) l++;
    (occupate[l] ||= []).push([a, b]);
    const iniziaQui = e.inizio >= ws, finisceQui = e.fine <= we;
    barre += `<div class="ev ${iniziaQui ? "" : "cont-s"} ${finisceQui ? "" : "cont-e"} ${S.evAnteprima?.id === e.id ? "mosso" : ""}" data-ev="${e.id}"
      style="${stileCol(e.colore)};left:calc(${a} / 7 * 100% + 3px);width:calc(${b - a + 1} / 7 * 100% - 6px);top:${su + l * passo}px" title="${esc(e.titolo)}">
      ${iniziaQui ? "" : ico("prima")}${esc(e.titolo) || "Senza titolo"}
      ${iniziaQui ? `<span class="maniglia i" data-lato="i"></span>` : ""}${finisceQui ? `<span class="maniglia f" data-lato="f"></span>` : ""}</div>`;
  }
  const alt = tel ? Math.max(46, 28 + occupate.length * passo) : Math.max(S.nMesi === 1 ? 112 : 88, 36 + occupate.length * 27);
  const sel = S.selezione ? [S.selezione.da, S.selezione.a].sort() : null, oggiS = oggi();
  let giorni = "";
  for (let i = 0; i < 7; i++) {
    const g = piuGiorni(ws, i);
    giorni += `<div class="day ${meseDi(g) !== ym ? "out" : ""} ${i > 4 ? "fs" : ""} ${g === oggiS ? "oggi-g" : ""} ${sel && g >= sel[0] && g <= sel[1] ? "sel" : ""}" data-giorno="${g}"><span>${Number(g.slice(8))}</span></div>`;
  }
  return `<div class="wk" style="min-height:${alt}px">${giorni}${barre}</div>`;
}

// ---------- menu (•••) ----------
function apriMenu(k, el, x, y) {
  if (el) { const r = el.getBoundingClientRect(); x = r.right; y = r.bottom; }
  S.menu = { k, x, y };
  S.edita = null; S.aggiungi = null;
  disegna();
}
function disegnaMenu() {
  const m = $("#menu");
  if (!S.menu || !D.leggi(S.menu.k)) { S.menu = null; m.hidden = true; m.innerHTML = ""; return; }
  const [gen, id] = S.menu.k.split(":"), x = D.leggi(S.menu.k);
  const b = (op, icona, txt, extra = "") => `<button class="voce-m ${extra}" data-azione="m" data-op="${op}">${ico(icona)}${txt}</button>`;
  let h = "";
  if (gen === "voce") {
    h += b("edita", "matita", "Modifica") + b("duplica", "copia", "Duplica");
    if (x.tipo === "ruolo" && !x.padre) h += x.sasso ? b("sasso", "elenco", "Non è più il sasso grande") : b("sasso", "bersaglio", "Rendilo il sasso grande");
    if (x.tipo === "ruolo" && !x.sasso) h += x.check ? b("check", "elenco", "Rendi punto elenco") : b("check", "spunta", "Rendi da spuntare");
    if (!x.padre) {
      h += b("sotto", "piu", "Aggiungi sotto-attività");
      const fratelli = lista(listaDi(x)), i = fratelli.findIndex(y => y.id === id);
      if (i > 0 && !figli(id).length) h += b("dentro", "dentro", "Metti dentro quella sopra");
    } else h += b("fuori", "fuori", "Togli dal gruppo");
    const dest = [["todo", "Azioni rapide", "#E0A21B"], ...ruoli(x.tipo === "ruolo" ? x.settimana : S.sett).map(r => ["r:" + r.id, r.nome, col(r.colore).c]), ["margine", "Lista del margine", "#8A857A"]]
      .filter(([L]) => L !== listaDi(x));
    h += `<hr><div class="tit-m">SPOSTA IN</div>` + dest.map(([L, n, c]) => `<button class="voce-m" data-azione="m" data-op="sposta" data-l="${L}"><i class="pall" style="--c:${c}"></i>${esc(n)}</button>`).join("");
    h += b("parcheggio", "avanti", "Nel parcheggio (non ora)");
    h += b("prossima", "avanti", "Alla settimana prossima");
    h += "<hr>" + b("elimina", "cestino", "Elimina", "rosso");
  } else if (gen === "ruolo") {
    const R = ruoli(x.settimana), i = R.findIndex(r => r.id === id);
    h += b("edita", "matita", "Rinomina") + `<div class="tit-m">COLORE</div><div class="colori">${COLORI.map(c => `<button style="--c:${c.c}" class="${x.colore === c.k ? "on" : ""}" data-azione="m" data-op="colore" data-c="${c.k}" aria-label="${c.nome}" title="${c.nome}"></button>`).join("")}</div><hr>`;
    h += b("duplica", "copia", "Duplica (con le azioni)") + b("copia-prossima", "avanti", "Copia nella settimana prossima");
    if (i > 0) h += b("sinistra", "prima", "Sposta a sinistra");
    if (i < R.length - 1) h += b("destra", "dopo", "Sposta a destra");
    h += "<hr>" + b("elimina", "cestino", "Elimina ruolo", "rosso");
  } else if (gen === "nota") {
    h += b("edita", "matita", "Modifica") + `<hr><div class="tit-m">È UNA NOTA DI TIPO</div>`
      + NOTE.filter(t => t.k !== x.tipo).map(t => `<button class="voce-m" data-azione="m" data-op="tipo-nota" data-t="${t.k}"><i class="pall" style="--c:${t.c}"></i>${t.nome}</button>`).join("")
      + "<hr>" + b("elimina", "cestino", "Elimina", "rosso");
  }
  m.innerHTML = h;
  m.hidden = false;
  const w = m.offsetWidth, hh = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(S.menu.x - w, innerWidth - w - 8)) + "px";
  m.style.top = (S.menu.y + 6 + hh > innerHeight - 8 ? Math.max(8, S.menu.y - hh - 30) : S.menu.y + 6) + "px";
}
function azioneMenu(op, d) {
  const k = S.menu.k, [gen, id] = k.split(":"), x = { ...D.leggi(k), id };
  S.menu = null;
  if (op === "edita") { S.edita = k + "|" + (gen === "ruolo" ? "nome" : "testo"); if (gen === "ruolo") S.aperti.add(id); }
  else if (op === "elimina") {
    D.scrivi(k, null);
    if (gen === "ruolo") lista("r:" + id).forEach(v => { D.scrivi("voce:" + v.id, null); figli(v.id).forEach(f => D.scrivi("voce:" + f.id, null)); });
    if (gen === "voce") { figli(id).forEach(f => D.scrivi("voce:" + f.id, null)); if (x.padre) aggiornaPadre(x.padre); }
    avvisa(gen === "ruolo" ? "Ruolo eliminato" : "Eliminato", true);
  }
  else if (op === "duplica") {
    if (gen === "ruolo") duplicaRuolo(id, x.settimana);
    else {
      const nid = nuovoId(), L = gen === "nota" ? "n:" + x.tipo : listaDi(x);
      D.scrivi(gen + ":" + nid, { ...senzaId(x), fatto: false });
      sposta(gen + ":" + nid, L, lista(L).findIndex(y => y.id === id) + 1);
      if (x.quadrante) sposta(gen + ":" + nid, x.quadrante, lista(x.quadrante).findIndex(y => y.id === id) + 1);
      if (gen === "voce") figli(id).forEach(f => D.scrivi("voce:" + nuovoId(), { ...senzaId(f), padre: nid, fatto: false }));
    }
    avvisa("Duplicato", true);
  }
  else if (op === "sotto") { salva("voce", { ...x, chiuso: false }); S.aggiungi = "sub:" + id; }
  else if (op === "dentro") {
    const fratelli = lista(listaDi(x)), sopra = fratelli[fratelli.findIndex(y => y.id === id) - 1];
    salva("voce", { ...D.leggi("voce:" + sopra.id), id: sopra.id, chiuso: false });
    sposta(k, "sub:" + sopra.id, figli(sopra.id).length);
    avvisa("Messo dentro «" + sopra.testo + "»", true);
  }
  else if (op === "fuori") {
    const p = { ...D.leggi("voce:" + x.padre), id: x.padre }, L = listaDi(p);
    sposta(k, L, lista(L).findIndex(y => y.id === p.id) + 1);
  }
  else if (op === "check") salva("voce", { ...x, check: !x.check, fatto: x.check ? false : !!x.fatto });
  else if (op === "sasso") salva("voce", { ...x, sasso: !x.sasso, check: true, fatto: false });
  else if (op === "parcheggio") {
    const r = x.ruolo ? D.leggi("ruolo:" + x.ruolo) : null;
    salva("voce", { ...x, tipo: "parcheggio", padre: null, sasso: false, ritorna: piuGiorni(lunediDi(new Date()), 7), parcheggiato: oggi(), racc: x.racc || r?.nome || undefined });
    figli(id).forEach(f => salva("voce", { ...f, tipo: "parcheggio", padre: null, ritorna: piuGiorni(lunediDi(new Date()), 7), parcheggiato: oggi() }));
    avvisa("Nel parcheggio: torna la settimana prossima", true);
  }
  else if (op === "priorita") salva("voce", { ...x, priorita: !x.priorita });
  else if (op === "quad") {
    if (d.q && d.q !== x.quadrante) sposta(k, d.q, lista(d.q).length);
    else salva("voce", { ...x, quadrante: null, inMatrice: false });
  }
  else if (op === "sposta") { sposta(k, d.l, lista(d.l).length); avvisa("Spostato", true); }
  else if (op === "prossima") {
    const sett = piuGiorni(x.settimana || S.sett, 7);
    salva("voce", { ...x, padre: null, tipo: "todo", ruolo: null, settimana: sett, ordine: 999 });
    allineaFigli(id);
    if (x.padre) aggiornaPadre(x.padre);
    avvisa("Spostato alla settimana " + numSettimana(sett), true);
  }
  else if (op === "colore") salva("ruolo", { ...x, colore: d.c });
  else if (op === "tipo-nota") salva("nota", { ...x, tipo: d.t });
  else if (op === "sinistra" || op === "destra") {
    const R = ruoli(x.settimana), i = R.findIndex(r => r.id === id);
    sposta(k, "ruoli", op === "sinistra" ? i - 1 : i + 1);
  }
  else if (op === "copia-prossima") { duplicaRuolo(id, piuGiorni(x.settimana, 7)); avvisa("Copiato nella settimana " + numSettimana(piuGiorni(x.settimana, 7)), true); }
  disegna();
}

// ---------- foglio dell'evento ----------
function apriEvento(id, dati) {
  S.foglio = { tipo: "evento", id, dati: id ? { ...D.leggi("evento:" + id) } : { titolo: "", colore: "blu", note: "", ...dati } };
  disegnaFoglio();
}
function disegnaFoglio() {
  const f = $("#foglio");
  if (!S.foglio) { f.hidden = true; f.innerHTML = ""; return; }
  const { id, dati: e } = S.foglio;
  f.innerHTML = `<div class="velo" data-azione="chiudi-foglio"></div>
    <form class="foglio paper" data-form="evento" autocomplete="off">
      <div><span class="ribbon H" style="${stileCol(e.colore)};background:var(--c)">${id ? "Evento" : "Nuovo evento"}</span></div>
      <label class="campo">TITOLO<input type="text" name="titolo" value="${esc(e.titolo)}" placeholder="Es. Weekend corso, esami, vacanza…" enterkeyhint="done"></label>
      <div class="due"><label class="campo">DAL<input type="date" name="inizio" value="${e.inizio}" required></label><label class="campo">AL<input type="date" name="fine" value="${e.fine}" required></label></div>
      <div class="campo" style="font-weight:700;font-size:13px;color:var(--soft)">COLORE<div class="colori" style="padding:6px 0">${COLORI.map(c => `<label style="--c:${c.c}" title="${c.nome}"><input type="radio" name="colore" value="${c.k}" ${e.colore === c.k ? "checked" : ""}><i></i></label>`).join("")}</div></div>
      <label class="campo">NOTE<textarea name="note" rows="2" placeholder="Facoltative">${esc(e.note)}</textarea></label>
      <div class="azioni">
        ${id ? `<button type="button" class="btn rosso" data-azione="elimina-evento">Elimina</button><button type="button" class="btn" data-azione="duplica-evento">Duplica</button>` : ""}
        <span class="spazio"></span><button type="button" class="btn" data-azione="chiudi-foglio">Annulla</button><button class="btn pieno">${id ? "Salva" : "Crea"}</button>
      </div>
    </form>`;
  f.hidden = false;
  if (!id) setTimeout(() => f.querySelector("[name=titolo]")?.focus(), 30);
}
function chiudiFoglio() { S.foglio = null; disegnaFoglio(); }

// ---------- avvisi ----------
let timerAvviso;
function avvisa(testo, annullabile = false, icona = "") {
  const a = $("#avviso");
  a.innerHTML = `${icona ? ico(icona) : ""}<span>${esc(testo)}</span>${annullabile ? `<button data-azione="annulla">Annulla</button>` : ""}`;
  a.hidden = false;
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => { a.hidden = true; }, annullabile ? 5000 : 2200);
}

// un errore nascosto (soprattutto sul telefono, dove la console non si vede) compare come avviso
window.addEventListener("error", e => avvisa("Errore: " + (e.message || "sconosciuto").slice(0, 90)));
window.addEventListener("unhandledrejection", e => avvisa("Errore: " + String(e.reason?.message || e.reason || "sconosciuto").slice(0, 90)));

// ---------- accesso ----------
let nuovoAccount = false;
function disegnaAccesso(errore = "") {
  $("#app").innerHTML = `<div class="accesso"><form class="foglio paper" data-form="accesso">
    <h1 class="H"><span style="color:var(--blue);display:flex">${LOGO}</span>Bussola</h1>
    <p class="sub" style="font-size:15px">Ruoli, obiettivi, cicli aperti e il quadro dei prossimi mesi. ${nuovoAccount ? "Crea il tuo account." : "Accedi con l'account delle tue app."}</p>
    <label class="campo">EMAIL<input type="email" name="email" autocomplete="email" required></label>
    <label class="campo">PASSWORD<input type="password" name="password" autocomplete="${nuovoAccount ? "new-password" : "current-password"}" required minlength="6"></label>
    ${errore ? `<p class="errore">${esc(errore)}</p>` : ""}
    <button class="btn pieno H" style="font-size:18px">${nuovoAccount ? "Crea account" : "Accedi"}</button>
    <button type="button" class="link" data-azione="nuovo-account">${nuovoAccount ? "Ho già un account" : "Non hai un account? Crealo"}</button>
    <a class="link" href="?prova" style="font-size:14px">Prova senza account (dati solo su questo dispositivo)</a>
  </form></div>`;
}

// =========================================================
// TOCCHI E CLIC
// =========================================================
document.addEventListener("click", e => {
  const el = e.target.closest("[data-azione]");
  if (S.menu && !e.target.closest("#menu")) {
    S.menu = null; disegnaMenu();
    if (!el) { e.stopImmediatePropagation(); return; }   // il tocco serviva solo a chiudere il menu
  }
  if (!el) return;
  const a = el.dataset.azione, d = el.dataset;
  switch (a) {
    case "vista": S.vista = d.v; ricorda("bussola.vista", d.v); S.edita = S.aggiungi = null; $("main").scrollTop = 0; disegna(); break;
    case "apri": S.aperti.has(d.id) ? S.aperti.delete(d.id) : S.aperti.add(d.id); S.edita = S.aggiungi = null; disegna(); break;
    case "modo": S.modoSett = d.m; ricorda("bussola.modoSett", d.m); disegna(); break;
    case "tabsett": S.tabSett = d.t; disegna(); break;
    case "sett": S.sett = d.d === "0" ? lunediDi(new Date()) : piuGiorni(S.sett, Number(d.d)); S.edita = S.aggiungi = null; disegna(); break;
    case "mese": S.mese = d.d === "0" ? meseDi(oggi()) : piuMesi(S.mese, Number(d.d)); disegna(); break;
    case "nmesi": S.nMesi = Number(d.n); ricorda("bussola.nMesi", d.n); disegna(); break;
    case "aggiungi": S.aggiungi = d.l; S.edita = null; disegna(); break;
    case "edita": S.edita = d.k + "|" + d.campo; S.aggiungi = null; disegna(); break;
    case "spunta": {
      const v = { ...D.leggi("voce:" + d.id), id: d.id }, fatto = !v.fatto;
      salva("voce", { ...v, fatto, fattoIl: fatto ? oggi() : null });
      figli(v.id).forEach(f => salva("voce", { ...f, fatto, fattoIl: fatto ? oggi() : null }));   // la voce grande spunta tutto il gruppo
      if (v.padre) aggiornaPadre(v.padre);
      if (v.tipo === "ciclo" && fatto) avvisa("Ciclo chiuso", true, "spunta");
      disegna(); break;
    }
    case "gruppo": { const v = { ...D.leggi("voce:" + d.id), id: d.id }; salva("voce", { ...v, chiuso: !v.chiuso }); disegna(); break; }
    case "avanza": {
      const v = { ...D.leggi("voce:" + d.id), id: d.id }, tot = totaleSasso(v), fatti = Math.min((v.fatti || 0) + 1, tot || 999);
      salva("voce", { ...v, fatti, fatto: tot ? fatti >= tot : v.fatto });
      if (tot && fatti >= tot) avvisa("Sasso grande completato!", false, "bersaglio"); else avvisa(`${fatti} di ${tot}`, true, "spunta");
      disegna(); break;
    }
    case "rendi-check": salva("voce", { ...D.leggi("voce:" + d.id), id: d.id, check: true }); avvisa("Ora è da spuntare", true, "spunta"); disegna(); break;
    case "obiettivo": {
      const r = { ...D.leggi("ruolo:" + d.id), id: d.id };
      salva("ruolo", { ...r, obiettivoFatto: !r.obiettivoFatto });
      if (!r.obiettivoFatto) { S.pop = d.id; avvisa("Obiettivo raggiunto!", false, "bersaglio"); }
      disegna(); break;
    }
    case "menu": apriMenu(d.k, el); break;
    case "m": azioneMenu(d.op, d); break;
    case "nuovo-ruolo": creaRuolo(); disegna(); break;
    case "riprendi": riprendi(); avvisa("Ripreso dalla settimana scorsa", true); disegna(); break;
    case "chiusi": S.chiusi = !S.chiusi; disegna(); break;
    case "annulla": if (D.annulla()) { S.edita = S.aggiungi = null; avvisa("Annullato"); disegna(); } break;
    case "esci":
      if (D.PROVA) { location.href = location.pathname; break; }
      D.esci().then(() => { $("#app").innerHTML = ""; disegnaAccesso(); });
      break;
    case "nuovo-account": nuovoAccount = !nuovoAccount; disegnaAccesso(); break;
    case "chiudi-foglio": chiudiFoglio(); break;
    case "elimina-evento": D.scrivi("evento:" + S.foglio.id, null); chiudiFoglio(); avvisa("Evento eliminato", true); disegna(); break;
    case "duplica-evento": {
      const nid = nuovoId();
      D.scrivi("evento:" + nid, { ...D.leggi("evento:" + S.foglio.id) });
      chiudiFoglio(); avvisa("Duplicato: trascinalo dove vuoi", true); disegna(); break;
    }
  }
});

// clic su un giorno o su un evento nei mesi (quando non è un trascinamento)
document.addEventListener("click", e => {
  if (e.target.closest("[data-azione]")) return;
  const ev = e.target.closest(".ev[data-ev]");
  if (ev) return apriEvento(ev.dataset.ev);
  const g = e.target.closest("[data-giorno]");
  if (g) apriEvento(null, { inizio: g.dataset.giorno, fine: g.dataset.giorno });
});

document.addEventListener("contextmenu", e => {
  const it = e.target.closest("[data-drag]");
  if (!it || e.target.closest("textarea")) return;
  e.preventDefault();
  apriMenu(it.dataset.drag, null, e.clientX + 230, e.clientY - 10);
});

// ---------- scrivere ----------
function allunga(t) { if (t.tagName === "TEXTAREA") { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; } }
document.addEventListener("input", e => { if (e.target.classList.contains("ed")) allunga(e.target); });

function conferma(t) {
  if (t.dataset.fatto) return;
  t.dataset.fatto = "1";
  const val = t.value.trim();
  if (t.dataset.nuovo) {
    const L = t.dataset.nuovo;
    if (!val) { S.aggiungi = null; return; }
    if (L.startsWith("n:")) creaNota(L, val); else creaVoce(L, val);
    return;
  }
  const k = t.dataset.salva, campo = t.dataset.campo, x = D.leggi(k);
  S.edita = null;
  if (!x) return;
  if (!val && campo === "testo") { D.scrivi(k, null); avvisa("Eliminato", true); }
  else if (!val && campo === "nome") { /* il nome non resta vuoto */ }
  else if (val !== (x[campo] || "")) D.scrivi(k, { ...x, [campo]: val });
}
document.addEventListener("keydown", e => {
  const t = e.target;
  if (t.classList?.contains("ed")) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const nuovo = t.dataset.nuovo && t.value.trim();
      conferma(t);
      if (!nuovo) S.aggiungi = null;   // Invio a vuoto chiude, altrimenti resta pronto per la prossima
      disegna();
    } else if (e.key === "Escape") {
      t.dataset.fatto = "1"; S.edita = null; S.aggiungi = null; disegna();
    }
    return;
  }
  if (e.key === "Escape") { if (S.foglio) chiudiFoglio(); else if (S.menu) { S.menu = null; disegnaMenu(); } return; }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA/.test(t.tagName)) {
    e.preventDefault();
    if (e.shiftKey ? D.ripeti() : D.annulla()) { avvisa(e.shiftKey ? "Ripristinato" : "Annullato"); disegna(); }
  }
});
document.addEventListener("focusout", e => {
  const t = e.target;
  if (!t.classList?.contains("ed") || t.dataset.fatto) return;
  const aggiungendo = !!t.dataset.nuovo;
  conferma(t);
  if (aggiungendo) S.aggiungi = null;
  // ridisegno dopo il clic in corso (se ridisegnassi ora, il pulsante appena toccato sparirebbe)
  setTimeout(() => { if (!document.activeElement?.classList.contains("ed") && !document.activeElement?.isContentEditable) { if (P) daRidisegnare = true; else disegna(); } }, 120);
});

document.addEventListener("submit", async e => {
  const f = e.target;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (f.dataset.form === "accesso") {
    f.querySelector("button").disabled = true;
    try { await D.accedi(v.email.trim(), v.password, nuovoAccount); $("#app").innerHTML = ""; disegna(); }
    catch (err) { disegnaAccesso(err.message === "Invalid login credentials" ? "Email o password sbagliate." : err.message); }
  } else if (f.dataset.form === "evento") {
    let { inizio, fine } = v;
    if (!inizio) return;
    if (!fine) fine = inizio;
    if (fine < inizio) [inizio, fine] = [fine, inizio];
    const id = S.foglio.id || nuovoId();
    D.scrivi("evento:" + id, { titolo: v.titolo.trim() || "Senza titolo", inizio, fine, colore: v.colore || "blu", note: v.note.trim() });
    chiudiFoglio();
    disegna();
  }
});

// =========================================================
// TRASCINARE (mouse e dito)
//   mouse: tieni premuto e muovi · dito: tieni premuto un attimo, poi muovi
// =========================================================
let P = null;
document.addEventListener("pointerdown", e => {
  if (e.button || P || S.foglio) return;
  const t = e.target;
  if (t.closest("textarea, input, select, button, a, #menu, #foglio, #avviso")) return;
  const ev = t.closest(".ev[data-ev]"), dr = t.closest("[data-drag]"), gi = t.closest("[data-giorno]");
  const tipo = ev ? "ev" : dr ? "lista" : gi ? "giorni" : null;
  if (!tipo) return;
  P = { tipo, el: ev || dr || gi, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType !== "mouse", avviato: false, lato: t.closest(".maniglia")?.dataset.lato };
  if (P.touch) P.timer = setTimeout(() => { if (P && !P.avviato) { avviaTrascina(); muoviTrascina(); } }, 330);
});
document.addEventListener("pointermove", e => {
  if (!P) return;
  P.x = e.clientX; P.y = e.clientY;
  const dist = Math.hypot(P.x - P.x0, P.y - P.y0);
  if (!P.avviato) {
    if (P.touch) { if (dist > 9) { clearTimeout(P.timer); P = null; } return; }   // è uno scorrimento
    if (dist < (P.lato ? 2 : 5)) return;
    avviaTrascina();
  }
  muoviTrascina();
});
function rilascia() {
  if (!P) return;
  clearTimeout(P.timer);
  const fatto = P.avviato;
  if (fatto) { lasciaTrascina(); bloccaClic(); }
  P = null;
  stopScorri();
  if (daRidisegnare || fatto) { daRidisegnare = false; disegna(); }
}
document.addEventListener("pointerup", rilascia);
document.addEventListener("mouseup", rilascia);   // riserva, se il browser perde il pointerup
document.addEventListener("pointercancel", () => {
  if (!P) return;
  clearTimeout(P.timer);
  if (P.avviato) { P.dest = null; P.annullato = true; lasciaTrascina(); }
  P = null; stopScorri(); disegna();
});
// mentre trascini col dito la pagina non deve scorrere
document.addEventListener("touchmove", e => { if (P?.avviato) e.preventDefault(); }, { passive: false });
document.addEventListener("selectstart", e => { if (P?.avviato) e.preventDefault(); });
function bloccaClic() {
  const blocca = e => { e.stopPropagation(); e.preventDefault(); };
  document.addEventListener("click", blocca, true);
  setTimeout(() => document.removeEventListener("click", blocca, true), 60);
}

function avviaTrascina() {
  P.avviato = true;
  navigator.vibrate?.(12);
  document.body.classList.add("trascina");
  S.menu = null; disegnaMenu();
  if (P.tipo === "lista") {
    const el = P.el, r = el.getBoundingClientRect();
    P.k = el.dataset.drag; P.gen = P.k.split(":")[0];
    P.dx = P.x0 - r.left; P.dy = P.y0 - r.top;
    P.ghost = el.cloneNode(true);
    P.ghost.classList.add("fantasma");
    P.ghost.style.width = r.width + "px";
    if (P.gen === "voce" || P.gen === "nota") P.ghost.style.color = getComputedStyle(el).color === "rgb(255, 255, 255)" ? "var(--ink)" : "";
    document.body.append(P.ghost);
    el.classList.add("trascinato");
    P.ph = document.createElement(P.gen === "ruolo" ? "div" : "li");
    P.ph.className = "segnaposto" + (P.gen === "ruolo" ? " v" : "");
    if (P.gen !== "ruolo") P.ph.style.height = Math.min(r.height, 60) + "px";
  } else if (P.tipo === "ev") {
    P.id = P.el.dataset.ev;
    const e = D.leggi("evento:" + P.id);
    P.orig = { inizio: e.inizio, fine: e.fine };
    P.g0 = giornoSotto(P.x0, P.y0) || e.inizio;
    S.evAnteprima = { id: P.id, ...P.orig };
  } else {
    S.selezione = { da: P.el.dataset.giorno, a: P.el.dataset.giorno };
    segnaSelezione();
  }
}
function giornoSotto(x, y) { return document.elementFromPoint(x, y)?.closest("[data-giorno]")?.dataset.giorno || null; }
function segnaSelezione() {
  const [a, b] = [S.selezione.da, S.selezione.a].sort();
  document.querySelectorAll("[data-giorno]").forEach(d => d.classList.toggle("sel", d.dataset.giorno >= a && d.dataset.giorno <= b));
}

function muoviTrascina() {
  scorriVicinoAiBordi(P.x, P.y);
  if (P.tipo === "giorni") {
    const g = giornoSotto(P.x, P.y);
    if (g && g !== S.selezione.a) { S.selezione.a = g; segnaSelezione(); }
    return;
  }
  if (P.tipo === "ev") {
    const g = giornoSotto(P.x, P.y);
    if (!g) return;
    const d = giorniTra(P.g0, g), o = P.orig;
    let inizio = o.inizio, fine = o.fine;
    if (P.lato === "f") fine = piuGiorni(o.fine, d) < o.inizio ? o.inizio : piuGiorni(o.fine, d);
    else if (P.lato === "i") inizio = piuGiorni(o.inizio, d) > o.fine ? o.fine : piuGiorni(o.inizio, d);
    else { inizio = piuGiorni(o.inizio, d); fine = piuGiorni(o.fine, d); }
    if (inizio !== S.evAnteprima.inizio || fine !== S.evAnteprima.fine) {
      S.evAnteprima = { id: P.id, inizio, fine };
      const scroll = $("main").scrollTop;
      $("main").innerHTML = htmlTesta() + vistaMesi();
      $("main").scrollTop = scroll;
    }
    return;
  }
  // elementi delle liste
  P.ghost.style.transform = `translate(${P.x - P.dx}px, ${P.y - P.dy}px)`;
  const sotto = document.elementFromPoint(P.x, P.y);
  let zona = sotto?.closest(`[data-lista][data-tipo="${P.gen}"]`);
  if (!zona && P.gen !== "ruolo") zona = sotto?.closest("[data-zona]")?.querySelector(`[data-lista][data-tipo="${P.gen}"]`);
  if (P.gen === "voce") {
    const id = P.k.slice(5), haFigli = voci().some(v => v.padre === id);
    while (zona?.dataset.lista.startsWith("sub:") && (haFigli || zona.dataset.lista === "sub:" + id))
      zona = zona.parentElement.closest(`[data-lista][data-tipo="voce"]`);
  }
  if (!zona) { P.ph.remove(); P.dest = null; return; }
  const items = [...zona.children].filter(c => c.classList.contains("it") && !c.classList.contains("trascinato"));
  const orizz = false, griglia = !!zona.closest(".q");   // nei quadranti le attività stanno su più colonne
  let idx = items.length;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    const prima = griglia ? P.y < r.top || (P.y < r.bottom && P.x < r.left + r.width / 2)
      : orizz ? P.x < r.left + r.width / 2 : P.y < r.top + r.height / 2;
    if (prima) { idx = i; break; }
  }
  if (idx < items.length) items[idx].before(P.ph);
  else if (items.length) items[items.length - 1].after(P.ph);
  else zona.prepend(P.ph);
  P.dest = { lista: zona.dataset.lista, idx };
}

function lasciaTrascina() {
  document.body.classList.remove("trascina");
  if (P.tipo === "lista") {
    P.ghost.remove(); P.ph.remove(); P.el.classList.remove("trascinato");
    if (P.dest) sposta(P.k, P.dest.lista, P.dest.idx);
  } else if (P.tipo === "ev") {
    const a = S.evAnteprima;
    S.evAnteprima = null;
    if (!P.annullato && a && (a.inizio !== P.orig.inizio || a.fine !== P.orig.fine))
      D.scrivi("evento:" + P.id, { ...D.leggi("evento:" + P.id), inizio: a.inizio, fine: a.fine });
  } else {
    const [da, a] = [S.selezione.da, S.selezione.a].sort();
    S.selezione = null;
    if (!P.annullato) setTimeout(() => apriEvento(null, { inizio: da, fine: a }), 0);
  }
}

// scorrimento automatico quando trascini vicino ai bordi
let scorri = null;
function scorriVicinoAiBordi(x, y) {
  const main = $("main"), roles = P.gen === "ruolo" ? $(".roles") : null;
  const m = main.getBoundingClientRect();
  let dy = y < m.top + 60 ? -12 : y > m.bottom - 60 ? 12 : 0, dx = 0;
  if (roles) { const r = roles.getBoundingClientRect(); dx = x < r.left + 60 ? -14 : x > r.right - 60 ? 14 : 0; }
  stopScorri();
  if (dx || dy) scorri = setInterval(() => { main.scrollTop += dy; if (roles) roles.scrollLeft += dx; if (P?.avviato && P.tipo !== "ev") muoviTrascina(); }, 16);
}
function stopScorri() { clearInterval(scorri); scorri = null; }

// =========================================================
// AVVIO
// =========================================================
function datiDiProva() {
  if (D.chiavi().length) return;
  D.senzaRegistro(() => {
    const s = S.sett, ruolo = (nome, colore, obiettivo, todo, ordine) => {
      const id = nuovoId();
      D.scrivi("ruolo:" + id, { settimana: s, nome, colore, obiettivo, obiettivoFatto: false, ordine });
      todo.forEach((t, i) => D.scrivi("voce:" + nuovoId(), { testo: t, fatto: false, tipo: "ruolo", ruolo: id, settimana: s, ordine: i }));
    };
    ruolo("Coach", "viola", "Chiudere 3 iscrizioni all'open day", ["Chiamate contatti", "Preparare slide"], 0);
    ruolo("Atleta", "giallo", "3 allenamenti + 1 corsa lunga", ["Organizzare allenamenti"], 1);
    ruolo("Amico", "corallo", "Esserci per Gaia e Chiaretta", ["Regalo Gaia", "Regalo Chiaretta (patente con obiettivo)"], 2);
    const v = (testo, tipo, i, extra = {}) => D.scrivi("voce:" + nuovoId(), { testo, fatto: false, tipo, settimana: tipo === "todo" ? s : null, ruolo: null, ordine: i, ...extra });
    ["Fissare appuntamento GPL", "Mandare agenda a Marta e Marco", "Organizzare pasti settimanali", "Comprare scarpe corsa", "Accorciare magliette"]
      .forEach((t, i) => v(t, "todo", i, i === 0 ? { quadrante: "q1", fatto: true, fattoIl: s } : i === 2 ? { quadrante: "q2" } : {}));
    ["Convention $", "Rispondi Lorenzo", "Chiedi a Fra", "iPad", "Chiamate Romics", "Organizzare vacanza estiva"]
      .forEach((t, i) => v(t, "ciclo", i, i < 2 ? { priorita: true } : {}));
    D.scrivi("nota:" + nuovoId(), { settimana: s, tipo: "bene", testo: "Chiamate fatte la mattina presto", ordine: 0 });
    D.scrivi("nota:" + nuovoId(), { settimana: s, tipo: "migliora", testo: "Troppi cicli aperti il venerdì", ordine: 0 });
    [["Marco", 14, -18], ["Mamma", 7, -9], ["Sara", 30, -26], ["Luca", 14, -6], ["Nonna", 7, -2], ["Davide", 0, -60]]
      .forEach(([nome, ogni, gg]) => D.scrivi("persona:" + nuovoId(), { nome, ogni, ultimo: piuGiorni(oggi(), gg) }));
    const m = meseDi(oggi()), m1 = piuMesi(m, 1);
    D.scrivi("evento:" + nuovoId(), { titolo: "Weekend corso", inizio: m1 + "-06", fine: m1 + "-08", colore: "viola", note: "" });
    D.scrivi("evento:" + nuovoId(), { titolo: "Esami", inizio: m1 + "-16", fine: m1 + "-20", colore: "verde", note: "" });
    D.scrivi("evento:" + nuovoId(), { titolo: "Open day", inizio: m1 + "-12", fine: m1 + "-12", colore: "corallo", note: "" });
  });
}

D.suCambio(ridisegnaPoi);
D.suStato(aggiornaBarra);
D.suRegistro(aggiornaBarra);
// a mezzanotte di lunedì (o tornando sull'app dopo giorni) la settimana "di oggi" cambia
let lunediVisto = lunediDi(new Date());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  if (D.chiSei() || D.PROVA) { RP.rollover(); ridisegnaPoi(); }
  const l = lunediDi(new Date());
  if (l !== lunediVisto) { if (S.sett === lunediVisto) S.sett = l; lunediVisto = l; ridisegnaPoi(); }
});

PX.init({ D, S, esc, ico, stileCol, col, COLORI, LOGO, NOTE, ruoli, voci, tutte, eventi, piuGiorni, lunediDi, iso, daIso, giorniTra, oggi,
  numSettimana, intervallo, avvisa, nuovoId, salva, totaleSasso, htmlSasso, ricorda, disegna: () => disegna() });
D.suCambio(() => PX.disegnaFoglio && !document.activeElement?.closest?.("#pf-foglio") && PX.disegnaFoglio());

(async () => {
  const dentro = await D.avvia();
  if (!dentro) return disegnaAccesso();
  if (D.PROVA) datiDiProva();
  D.senzaRegistro(() => PX.migra());
  RP.rollover();
  $("#app").innerHTML = "";
  disegna();
  PX.avvio();
})();
