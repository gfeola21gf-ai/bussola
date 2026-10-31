/* pianifica.js — il mentore di Bussola: «Oggi», «Pianifica la settimana» (6 passi), «Persone»,
   «Impostazioni» (i tuoi ruoli, paletti, finestre, luoghi, ritmo), i fogli «Cattura» (da fare / diario) e «Imprevisto»,
   la guida e i «?». Riceve da app.js gli strumenti comuni con init(ctx).
   Chiavi in più (vedi supabase/bussola.sql):
     metodo         { ruoli: [{ nome, colore, domanda }]  ← la bacheca: tutti i ruoli (ogni settimana se ne scelgono 3-5),
                      ricorrenti, finestre, luoghi, tragitti, sveglie, sonno, stacco, pienezza, regole }
     piano:<lunedì> { passo, iniziato, blocchi: [{ id, g (0=lun), da, a, titolo, tipo, luogo, fonte, ruolo }], persone, finito }
     persona:<id>   { nome, ogni (giorni), ultimo (AAAA-MM-GG), tel, note }
   Il destino di ogni cosa (passo «Svuota e smista» e «Ruoli»):
     paletto → blocco in agenda · azione rapida → voce tipo "todo" della settimana (persona, msg = testo del messaggio)
     ruolo → voce tipo "ruolo" (sasso: true = sasso grande, misura «8 lezioni», fatti, ore) · margine → voce tipo "margine"
     parcheggio → voce tipo "parcheggio" (ritorna = lunedì in cui riproporla, racc = raccoglitore «Nome: idea»)
   Diario di bordo = nota:<id> { settimana, tipo: bene|migliora|idea, testo, quando }.
   tipi di blocco: paletto · finestra (allenamento, elastici, rito, persone = posto libero per le persone) ·
                   sasso · persona · messaggi (= blocco delle azioni rapide) · margine · imprevisto · altro */
import * as G from "./gcal.js?v=20261031181718";
import * as R from "./rapide.js?v=20261031181718";
import * as V from "./viaggi.js?v=20261031181718";
import * as PS from "./persone.js?v=20261031181718";
import * as DS from "./dasistemare.js?v=20261031181718";
import * as AG from "./aggiungi.js?v=20261031181718";
import * as SD from "./sudime.js?v=20261031181718";
import * as PF from "./pianifica5.js?v=20261031181718";
import { COLORI_G, colG, VERSO_G } from "./colori.js?v=20261031181718";
/** i colori scelti in Bussola per eventi nati in Google Calendar (gcalId → colore): non tornano a Calendar */
const coloriLocali = () => C.D.leggi("coloriEventi") || {};
let C;
export function init(ctx) {
  C = ctx;
  R.init(ctx, { blocchiSettimana, salvaBlocco, togliDaFonte, metodo, tragitto, leggiRacc, datiParch, occupa, hm, fine, fmt, oreTxt, linkWa, bloccoRapide, GS_H0, GS_PX });
  PS.init(ctx, { blocchiSettimana, salvaBlocco, togliDaFonte, metodo, tragitto, occupa, hm, fine, fmt, oreTxt });
  DS.init(ctx);
  SD.init(ctx);
  PF.init(ctx, { sett: () => P.sett, piano, modPiano, metodo, istanzaRuolo, sassi, grigliaSettimana, bloccoRapide, aiuto,
    vaiASettimana: s => { settimanaInGriglia(); C.S.sett = s; document.querySelector('[data-azione="vista"][data-v="settimana"]')?.click(); } });
  AG.init(ctx, { blocchiSettimana, salvaBlocco, metodo, tragitto, occupa, hm, fine, fmt, leggiRacc });
}
G.leggiRitorno();   // di ritorno da Google con il permesso: salvo il gettone e pulisco l'indirizzo
export const viste = ["oggi", "pianifica", "persone", "metodo"];

const $ = s => document.querySelector(s);
const hm = s => { const [h, m] = String(s || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const fmt = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
const durata = b => { let d = hm(b.a) - hm(b.da); return d <= 0 ? d + 1440 : d; };
const fine = b => hm(b.da) + durata(b);
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const GIORNI_L = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
const oreTxt = min => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h && m ? `${h} h ${m}'` : h ? `${h} h` : `${m}'`; };
const maiusc = t => t[0].toUpperCase() + t.slice(1);

// =========================================================
// IL METODO (valori di partenza: quelli decisi insieme nella chat)
// =========================================================
const PASSI = [
  { titolo: "Guarda indietro", domanda: "Cosa ti porti dalla settimana scorsa?", breve: "Rileggi il diario: cosa tieni, cosa cambi. Poi guarda cosa torna dal parcheggio.",
    perche: "Una settimana insegna sempre qualcosa. Se lo scrivi e lo rileggi, la prossima va meglio: un «da migliorare» diventa un'azione o una regola.",
    domande: ["Cosa ha funzionato e voglio ripetere?", "Cosa voglio cambiare?", "Quale idea del parcheggio è il momento di riprendere?"] },
  { titolo: "Svuota e smista", domanda: "Cosa hai in testa?", breve: "Scrivi tutto quello che hai in testa, poi una cosa alla volta: che tipo di cosa è? Fermati al primo «sì».",
    perche: "Finché le cose stanno in testa, la mente le ripete e crea ansia. Smistarle toglie il peso di decidere tutto insieme: ogni cosa trova il suo destino.",
    domande: ["Ha già giorno e ora?", "Si fa in meno di 5 minuti?", "È importante questa settimana?"] },
  { titolo: "Paletti", domanda: "Cosa è già fissato?", breve: "Prima ciò su cui non hai scelta: così la settimana non è mai bianca.",
    perche: "Lezioni, impegni presi, finestre fisse: disegnati questi, gli spazi liberi si vedono da soli e sparisce il panico della pagina bianca.",
    domande: ["Ci sono impegni già presi questa settimana?", "Ci sono giorni speciali (eventi, viaggi, scadenze)?"] },
  { titolo: "Ruoli e sassi grandi", domanda: "Chi vuoi essere questa settimana?", breve: "Scegli 3-5 ruoli. Per ognuno un sasso grande; il resto va nel margine o nel parcheggio. Poi le persone.",
    perche: "Non puoi fare tutto ogni settimana: scegliere i ruoli vuol dire anche dire «non ora». Il sasso grande è l'azione che ti muove verso l'obiettivo: richiede tempo vero e slitta se non gli dai un posto.",
    domande: ["Quali ruoli contano davvero questa settimana?", "Cosa farebbe la versione migliore di me in questo ruolo?", "È misurabile? («8 lezioni», non «recuperare tutto»)", "Chi ha più bisogno di me adesso?"] },
  { titolo: "Metti in agenda", domanda: "Dove li metti?", breve: "Prima i sassi grandi, poi le persone, poi le azioni rapide e il margine. Sotto, il controllo di realtà dal vivo.",
    perche: "Le cose di testa vanno al mattino, quelle leggere più tardi. Se sei già in un posto, fai lì tutto quello che si fa lì. Se pianifichi il 100%, al primo imprevisto crolla tutto: il margine è la ruota di scorta.",
    domande: ["Ho raggruppato per zona?", "C'è lo stacco tra un'attività e l'altra?", "Dormo abbastanza?", "C'è margine?"] },
  { titolo: "Messaggi e calendario", domanda: "Chi aspetta un tuo messaggio?", breve: "Avvia quello che dipende da altre persone, poi metti i blocchi nuovi in Google Calendar.",
    perche: "Chi riceve una proposta ha bisogno di tempo per rispondere: proponi sempre due opzioni precise. E il piano funziona se lo vedi, nel posto che guardi ogni giorno.",
    domande: ["Chi deve rispondermi per primo?", "È tutto in Google Calendar?"] },
];
const METODO_BASE = {
  ruoli: [
    { nome: "Studente", colore: "viola", domanda: "Cosa farebbe questa settimana la versione migliore di me come studente?" },
    { nome: "Atleta", colore: "acqua", domanda: "Cosa mi serve davvero questa settimana per stare bene col corpo?" },
    { nome: "Allievo", colore: "giallo", domanda: "Quale passo concreto mi fa crescere nel corso?" },
    { nome: "Amico", colore: "cielo", domanda: "Chi ha bisogno di me, o lo sto rimandando da troppo?" },
    { nome: "Figlio", colore: "verde", domanda: "Che momento voglio passare con mamma e papà?" },
  ],
  ricorrenti: [
    { g: 0, da: "11:30", a: "17:00", nome: "Lezioni", luogo: "Tor Vergata" },
    { g: 1, da: "17:00", a: "19:00", nome: "Ripetizioni Valeria", luogo: "Valeria" },
    { g: 1, da: "19:45", a: "23:15", nome: "Soft Skills Academy", luogo: "Corso" },
    { g: 2, da: "09:30", a: "11:30", nome: "Lezione", luogo: "Tor Vergata" },
    { g: 3, da: "14:00", a: "16:00", nome: "Lezione", luogo: "Tor Vergata" },
  ],
  finestre: [
    { g: 0, da: "18:00", a: "19:30", nome: "Allenamento", tipo: "allenamento" },
    { g: 2, da: "18:00", a: "19:30", nome: "Allenamento", tipo: "allenamento" },
    { g: 4, da: "18:00", a: "19:30", nome: "Allenamento", tipo: "allenamento" },
    { g: 1, da: "08:30", a: "08:50", nome: "Elastici", tipo: "elastici" },
    { g: 3, da: "08:00", a: "08:20", nome: "Elastici", tipo: "elastici" },
    { g: 5, da: "09:30", a: "09:50", nome: "Elastici", tipo: "elastici" },
    { g: 6, da: "09:30", a: "09:50", nome: "Elastici", tipo: "elastici" },
    { g: 3, da: "21:00", a: "23:00", nome: "Finestra persone", tipo: "persone" },
    { g: 5, da: "15:00", a: "23:30", nome: "Finestra persone", tipo: "persone" },
    { g: 6, da: "13:00", a: "17:30", nome: "Finestra persone", tipo: "persone" },
    { g: 6, da: "18:00", a: "18:45", nome: "Pianifica la settimana", tipo: "rito" },
  ],
  luoghi: [{ nome: "Casa", min: 0 }, { nome: "Tor Vergata", min: 20 }, { nome: "Corso", min: 40 }, { nome: "Valeria", min: 35 }],
  tragitti: [{ da: "Corso", a: "Valeria", min: 15 }],
  sveglie: ["07:30", "07:30", "07:30", "07:30", "07:30", "08:30", "08:30"],
  sonno: 7.5,
  stacco: 10,
  pienezza: [60, 70],
  regole: [],
};
const MSG = {
  proposta: "Ehi {nome}! Ho voglia di vederti: ti va {quando}?",
  rimando: "{nome}! Questa settimana sono pieno, ma ci tengo a vederti: ti va {data1} o {data2}?",
};
const PERSONE_SUGGERITE = ["Valerio", "Samuele", "Chiara", "Francesco", "Davide", "Beatrice", "Mamma e papà"];

function metodo() { return { ...METODO_BASE, ...(C.D.leggi("metodo") || {}) }; }
function salvaMetodo(patch) { C.D.scrivi("metodo", { ...(C.D.leggi("metodo") || {}), ...patch }); }
/** minuti porta a porta da a a b. q = { g, min } (giorno 0 = lunedì, ora in minuti) per il traffico di Roma.
    Ordine: tragitto scritto a mano › tempi calcolati con OpenStreetMap (viaggi.js) › minuti da casa scritti a mano. */
function tragitto(a, b, q = null) {
  if (a === "" || b === "") return 0;   // luogo sconosciuto (evento di Google senza luogo): niente spostamenti inventati
  a = a || "Casa"; b = b || "Casa";
  if (a === b) return 0;
  const m = metodo(), t = m.tragitti.find(x => (x.da === a && x.a === b) || (x.da === b && x.a === a));
  if (t) return Number(t.min) || 0;
  const L = n => m.luoghi.find(l => l.nome === n), base = m.durate?.[a + "|" + b] ?? m.durate?.[b + "|" + a];
  if (base != null) return V.stima(base, L(a), L(b), q, Number(m.correzioni?.[b]) || 1);
  const min = n => Number(L(n)?.min) || 0;
  return a === "Casa" ? min(b) : b === "Casa" ? min(a) : Math.max(min(a), min(b));
}
/** l'indirizzo di un luogo → punto sulla mappa → tempi verso tutti gli altri luoghi (OpenStreetMap) */
async function aggiornaLuogo(i) {
  const l = metodo().luoghi[i], ind = String(l?.indirizzo || "").trim();
  if (!ind) return;
  C.avvisa(`Cerco «${ind}» sulla mappa…`);
  try {
    const p = await V.cerca(/roma|,/i.test(ind) ? ind : ind + ", Roma");
    if (!p) return C.avvisa("Non trovo questo indirizzo: prova con via, numero e città");
    const L = metodo().luoghi.map((x, j) => j === i ? { ...x, lat: p.lat, lon: p.lon, trovato: p.nome.split(",").slice(0, 3).join(",") } : x);
    salvaMetodo({ luoghi: L, durate: await V.durate(L) });
    C.avvisa(`Trovato: tempi di «${l.nome}» calcolati`, false, "spunta");
  } catch { C.avvisa("La mappa non risponde: riprova tra poco"); }
  C.disegna();
}

// =========================================================
// STATO DELLO SCHERMO
// =========================================================
function settimanaDaPianificare() {
  const d = new Date(), dow = (d.getDay() + 6) % 7;
  const lun = C.lunediDi(d);
  return dow >= 4 ? C.piuGiorni(lun, 7) : lun;   // da venerdì in poi si pianifica la prossima
}
const P = { pill: new Set(), sett: null, perche: false, q: 0, scelta: null, sel: null, foglio: null, aperto: null, cattTab: "fare", dTipo: "bene" };
const kPiano = (s = P.sett) => "piano:" + s;
const piano = (s = P.sett) => C.D.leggi(kPiano(s));
function salvaPiano(p, s = P.sett) { C.D.scrivi(kPiano(s), p); }
function modPiano(f, s = P.sett) { const p = JSON.parse(JSON.stringify(piano(s))); f(p); salvaPiano(p, s); return p; }
const nid = () => C.nuovoId();

// ---------- Google Calendar ----------
const ora2 = d => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** dove si svolge un evento di Google: scelto per il calendario nelle impostazioni, oppure capito dal testo */
/** un testo (es. il campo Luogo di Google) → uno dei tuoi luoghi, cercando il nome o un sinonimo */
function luogoDaTesto(testo) {
  const t = String(testo || "").toLowerCase().trim();
  if (!t) return null;
  for (const l of metodo().luoghi) {
    const nomi = [l.nome, ...String(l.alias || "").split(",")].map(x => x.trim().toLowerCase()).filter(Boolean);
    if (nomi.some(n => t === n || t.includes(n))) return l.nome;
  }
  return null;
}
function luogoEvento(e) {
  const dalCampo = luogoDaTesto(e.luogo);   // 1. il campo «Luogo» di Google Calendar
  if (dalCampo) return dalCampo;
  const scelto = metodo().calendari?.[e.calId]?.luogo;   // 2. il luogo scelto per quel calendario
  if (scelto) return scelto;
  const t = `${e.cal} ${e.titolo}`.toLowerCase();   // 3. il titolo
  if (/lezion|fisica|strumenti digitali/.test(t)) return "Tor Vergata";
  if (/soft skill|genio|mclendon|richiam|demo|open day/.test(t)) return "Corso";
  return luogoDaTesto(t) || "";
}
/** i luoghi scritti in Google Calendar che Bussola non conosce ancora (per aggiungerli con un tocco) */
function luoghiSconosciuti() {
  const ev = G.eventiInCache(C.lunediDi(new Date())) || [];
  return [...new Set(ev.map(e => e.luogo.trim()).filter(l => l && !luogoDaTesto(l)))].slice(0, 8);
}
/** calendari da non usare: scelti in Impostazioni; in partenza quelli «impegni …» (gli orari dei ragazzi delle ripetizioni) */
const calendarioEscluso = c => { const s = metodo().calendari?.[c.id]; return s?.usa === false || (s?.usa !== true && /^impegni\b/i.test(c.nome || "")); };
const calendariEsclusi = () => (G.calendariNoti() || []).filter(calendarioEscluso).map(c => c.id).concat(Object.entries(metodo().calendari || {}).filter(([, v]) => v.usa === false).map(([k]) => k));
/** che cosa è, per il metodo, un evento di Calendar: un sasso grande (se il titolo contiene una delle parole che hai
    scritto nel sasso, campo `cal`), il blocco delle azioni rapide, il margine, oppure un paletto */
function riconosci(e, S) {
  const t = e.titolo.toLowerCase();
  // le finestre fisse messe in Calendar come eventi ripetuti «liberi» («Finestra · Persone», «Finestra · Allenamento»…)
  if (/^finestra\b/.test(t)) return { tipo: "finestra", sotto: /person/.test(t) ? "persone" : /allenament/.test(t) ? "allenamento" : /elastic/.test(t) ? "elastici" : /pianific/.test(t) ? "rito" : "altro" };
  const s = S.find(s => String(s.cal || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean).some(c => t.includes(c)));
  if (s) return { tipo: "sasso", voce: s.id, ruolo: s.ruolo };
  if (/blocco messaggi|azioni rapide/.test(t)) return { tipo: "messaggi" };
  if (/^margine/.test(t)) return { tipo: "margine" };
  return { tipo: e.bussola && e.tipo ? e.tipo : "paletto" };
}
/** il blocco appartiene al sasso grande id? (mandato da Bussola, oppure evento di Calendar riconosciuto) */
const diSasso = (b, id) => b.fonte === "voce:" + id || b.voce === id;
/** gli eventi di Google della settimana diventano blocchi di Bussola (quelli già legati a un blocco li salto) */
function blocchiDaGoogle(sett, eventi, giaLegati = new Set()) {
  const B = [], S = sassi(sett);
  eventi.forEach(e => {
    if (giaLegati.has(e.id)) return;
    if (e.tuttoIlGiorno) {
      const fineG = C.iso(e.fine);
      for (let g = 0; g < 7; g++) { const giorno = C.piuGiorni(sett, g); if (giorno >= e.giorno && giorno < fineG) B.push({ id: nid(), g, da: "00:00", a: "00:00", tuttoIlGiorno: true, titolo: e.titolo, tipo: "paletto", fonte: "gcal", gcalId: e.id, calId: e.calId, cal: e.cal, colore: coloriLocali()[e.id] || e.colorId || e.colore, provvisorio: /confermare/i.test(e.titolo) }); }
      return;
    }
    const g = C.giorniTra(sett, e.giorno);
    if (g < 0 || g > 6) return;
    B.push({ id: nid(), g, da: ora2(e.inizio), a: ora2(e.fine), titolo: e.titolo, ...riconosci(e, S), fonte: "gcal", gcalId: e.id, calId: e.calId, cal: e.cal, colore: coloriLocali()[e.id] || e.colorId || e.colore, luogo: luogoEvento(e), luogoG: e.luogo });
  });
  return B;
}
/** riallinea il piano con Google: i blocchi presi da Google si rinnovano; quelli mandati da Bussola seguono Google
    (se li hai spostati o cancellati in Calendar, qui si spostano o spariscono) */
async function aggiornaDaGoogle(sett = P.sett, { forza = true } = {}) {
  if (!G.collegato() || !piano(sett)) return;
  P.sinc = true;
  try {
    await G.calendari();
    const eventi = await G.eventiSettimana(sett, { forza, escludi: calendariEsclusi() }), perId = new Map(eventi.map(e => [e.id, e]));
    modPiano(p => {
      const tenuti = p.blocchi.filter(b => b.fonte !== "gcal").filter(b => !b.gcalId || perId.has(b.gcalId));
      tenuti.forEach(b => { const e = b.gcalId && perId.get(b.gcalId); if (e && !e.tuttoIlGiorno) Object.assign(b, { g: C.giorniTra(sett, e.giorno), da: ora2(e.inizio), a: ora2(e.fine), titolo: e.titolo }); });
      p.blocchi = [...tenuti, ...blocchiDaGoogle(sett, eventi, new Set(tenuti.map(b => b.gcalId).filter(Boolean)))];
      p.sincro = Date.now();
    }, sett);
  } catch (err) { if (err.message !== "scollegato") C.avvisa("Google Calendar non risponde: riprovo dopo"); }
  P.sinc = false;
  C.disegna();
}
// se l'elenco dei calendari non è ancora letto, provo: è Google a dire di no (prima diceva per errore «solo lettura»)
const scrivibile = b => { if (b.fonte !== "gcal") return true; const L = G.calendariNoti(); return L ? !!L.find(c => c.id === b.calId)?.scrivibile : true; };
const giornoDi = (b, sett = P.sett) => C.piuGiorni(sett, b.g);
/** manda a Google un blocco nuovo di Bussola (e ricorda il suo id) */
async function mandaBlocco(b, sett = P.sett) {
  const v = tragitto("Casa", b.luogo, { g: b.g, min: hm(b.da) });
  const id = await G.crea({ titolo: b.titolo, giorno: giornoDi(b, sett), da: b.da, a: b.a, tipo: b.tipo, fonte: b.fonte, luogo: b.luogo, colore: colG(coloreId(b)).gid, note: b.note, avviso: v ? v + 5 : undefined });
  modPiano(p => { const x = p.blocchi.find(x => x.id === b.id); if (x) { x.gcalId = id; x.calId = "primary"; } }, sett);
  return id;
}
/** il blocco «Azioni rapide» del giorno in Google Calendar: uno solo, con l'elenco nella descrizione (non un evento per
    ogni messaggio). Lo crea alle 13:30 o nel primo mezz'ora libera dopo; poi ne aggiorna titolo ed elenco. */
const RAP_ORA = 13 * 60 + 30;
let rapInCorso = new Set();
async function bloccoRapide(giorno) {
  if (!G.collegato() || giorno < C.oggi() || rapInCorso.has(giorno)) return;
  const L = R.azioniDi(giorno).filter(v => !v.ora);
  if (!L.length) return;
  rapInCorso.add(giorno);
  try {
    const sett = C.lunediDi(C.daIso(giorno)), g = C.giorniTra(sett, giorno);
    await G.eventiSettimana(sett, { escludi: calendariEsclusi() }).catch(() => null);
    const { blocchi } = blocchiSettimana(sett);
    const b = blocchi.find(x => x.g === g && x.tipo === "messaggi");
    const nDa = L.filter(v => !v.fatto).length;
    const titolo = nDa ? `Azioni rapide (${nDa})` : "Azioni rapide · fatte";
    const descr = L.map(v => (v.fatto ? "[fatta] " : "[ ] ") + v.testo).join("\n") + "\n\nDa Bussola: le spunti nell'app.";
    if (b?.gcalId) { if (scrivibile(b)) await G.aggiornaCampi(b.gcalId, { titolo, descrizione: descr }, b.calId || "primary"); }
    else if (!b) {
      const occ = blocchi.filter(x => x.g === g && occupa(x)).sort((x, y) => hm(x.da) - hm(y.da));
      let t = RAP_ORA;
      for (const x of occ) { if (hm(x.da) >= t + 30) break; if (fine(x) > t) t = Math.ceil(fine(x) / 15) * 15; }
      if (t + 30 <= 22 * 60) salvaBlocco(sett, { id: nid(), g, da: fmt(t), a: fmt(t + 30), titolo, tipo: "messaggi", luogo: "Casa", fonte: "rapide", note: descr }, () => {}, { nuovo: true });
    }
  } catch { /* riprovo alla prossima modifica */ }
  rapInCorso.delete(giorno);
}
const htmlCollega = testo => G.disponibile() ? `<div class="g-collega"><b>${C.ico("bussola")}Collega Google Calendar</b><p>${testo}</p>${btn("g-collega", "Collega", "btn pieno H")}</div>` : "";

/** i blocchi che la settimana ha già prima di tutto: paletti fissi (o i tuoi eventi di Google), finestre e impegni dei Mesi */
function blocchiDiPartenza(sett, eventi = null) {
  const m = metodo(), B = eventi ? blocchiDaGoogle(sett, eventi) : [];
  if (!eventi) m.ricorrenti.forEach(r => B.push({ id: nid(), g: r.g, da: r.da, a: r.a, titolo: r.nome, tipo: "paletto", luogo: r.luogo || "Casa", fonte: "ricorrente" }));
  // le finestre: quelle per le persone sempre (sono un posto libero); le altre solo se Google non ha già qualcosa a quell'ora
  // (se sono già in Calendar come eventi «Finestra · …» non le ripeto)
  blocchiFinestre(eventi ? B : []).forEach(f => B.push({ ...f, id: nid() }));
  const fineSett = C.piuGiorni(sett, 6);
  C.eventi().filter(e => e.fine >= sett && e.inizio <= fineSett).forEach(e => {
    for (let g = 0; g < 7; g++) {
      const giorno = C.piuGiorni(sett, g);
      if (giorno >= e.inizio && giorno <= e.fine)
        B.push({ id: nid(), g, da: "00:00", a: "00:00", tuttoIlGiorno: true, titolo: e.titolo, tipo: "paletto", fonte: "mesi", provvisorio: /confermare/i.test(e.titolo) });
    }
  });
  return B;
}
/** il ruolo della bacheca diventa «ruolo della settimana» (la card colorata in Settimana) */
function istanzaRuolo(nome, sett = P.sett) {
  const R = C.ruoli(sett), gia = R.find(r => r.nome.toLowerCase() === nome.toLowerCase());
  if (gia) return gia.id;
  const b = metodo().ruoli.find(r => r.nome.toLowerCase() === nome.toLowerCase());
  const id = nid();
  C.D.scrivi("ruolo:" + id, { settimana: sett, nome, colore: b?.colore || "blu", obiettivo: "", obiettivoFatto: false, ordine: R.length });
  return id;
}
async function iniziaPiano() {
  // si riparte dai ruoli della settimana prima (poi al passo 4 li cambi)
  if (!C.ruoli(P.sett).length) C.ruoli(C.piuGiorni(P.sett, -7)).forEach(r => istanzaRuolo(r.nome));
  let eventi = null;
  if (G.collegato()) try { await G.calendari(); eventi = await G.eventiSettimana(P.sett, { forza: true, escludi: calendariEsclusi() }); } catch { eventi = null; }
  salvaPiano({ passo: 0, iniziato: Date.now(), blocchi: blocchiDiPartenza(P.sett, eventi), persone: [], finito: false, sincro: eventi ? Date.now() : null });
}

// ---------- dati comodi ----------
const inbox = () => C.voci().filter(v => v.tipo === "inbox").sort((a, b) => (a.creato || 0) - (b.creato || 0));
const parcheggio = () => C.voci().filter(v => v.tipo === "parcheggio");
const azioni = (sett = P.sett) => C.voci().filter(v => v.tipo === "todo" && v.settimana === sett && !v.padre).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
const marginiSett = (sett = P.sett) => C.voci().filter(v => v.tipo === "margine" && v.settimana === sett && !v.padre);
/** «Bussola: idea…» → raccoglitore «Bussola». Solo se il nome è corto (non una frase con i due punti in mezzo) */
function leggiRacc(t) {
  const m = String(t).match(/^([^:\n]{2,24}):\s*(.+)$/s);
  if (!m || m[1].trim().split(/\s+/).length > 2) return { testo: t };
  const nome = m[1].trim();
  return { testo: m[2].trim(), racc: nome[0].toUpperCase() + nome.slice(1) };
}
/** parcheggiare non chiede niente: torna da solo la domenica dopo (si può dire «più avanti» quando torna) */
const prossimoLunedi = () => C.piuGiorni(C.lunediDi(new Date()), 7);
const datiParch = (dopo = prossimoLunedi()) => ({ tipo: "parcheggio", ritorna: dopo, parcheggiato: C.oggi(), sasso: false, padre: null });
const dataCorta = s => { const d = C.daIso(s); return `${d.getDate()} ${["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"][d.getMonth()]}`; };
function perRaccoglitore(L) {
  const g = new Map();
  L.forEach(v => { const k = v.racc || "Varie"; if (!g.has(k)) g.set(k, []); g.get(k).push(v); });
  return [...g.entries()].sort((a, b) => (a[0] === "Varie") - (b[0] === "Varie") || a[0].localeCompare(b[0]));
}
// le persone e il loro stato (verde / giallo / rosso / grigio = ogni tanto) stanno in persone.js
const persone = () => PS.ordinate();
const statoPersona = pe => PS.stato(pe);
function sassi(sett = P.sett) {
  const idR = new Map(C.ruoli(sett).map(r => [r.id, r]));
  return C.voci().filter(v => v.sasso && v.tipo === "ruolo" && idR.has(v.ruolo)).map(v => ({ ...v, r: idR.get(v.ruolo) }));
}
// i colori sono quelli di Google Calendar (colori.js): ogni tipo di blocco ne ha uno di partenza, e lo puoi cambiare
const TIPO_COLORE = { paletto: "mirtillo", persona: "vinaccia", messaggi: "banana", margine: "grafite", imprevisto: "pomodoro", altro: "grafite" };
const SOTTO_COLORE = { allenamento: "pomodoro", elastici: "mandarino", rito: "basilico", persone: "vinaccia" };
/** il colore (della tavolozza eventi) del blocco */
function coloreId(b) {
  if (b.colore && !String(b.colore).startsWith("#")) return colG(b.colore).k;
  if (b.tipo === "sasso" || b.ruolo) { const r = C.D.leggi("ruolo:" + b.ruolo); if (r) return VERSO_G[C.col(r.colore).k] || "cobalto"; }
  return TIPO_COLORE[b.tipo] || SOTTO_COLORE[b.sotto] || "grafite";
}
function coloreTipo(b) {
  if (String(b.colore || "").startsWith("#")) return b.colore;   // evento di Google senza colore: quello del suo calendario
  return colG(coloreId(b)).c;
}
/** i blocchi che occupano davvero tempo (le finestre persone vuote no: sono un posto libero) */
const occupa = b => !b.tuttoIlGiorno && !(b.tipo === "finestra" && b.sotto === "persone");
const delGiorno = (p, g) => p.blocchi.filter(b => b.g === g && occupa(b)).sort((a, b) => hm(a.da) - hm(b.da));
function nuovaAzione(testo, extra = {}, sett = P.sett) {
  const ordine = azioni(sett).reduce((m, v) => Math.max(m, v.ordine ?? 0), -1) + 1;
  C.D.scrivi("voce:" + nid(), { testo, tipo: "todo", settimana: sett, ruolo: null, fatto: false, ordine, ...extra });
}

// =========================================================
// DISEGNO
// =========================================================
export function disegna(vista) {
  if (!P.sett) P.sett = settimanaDaPianificare();
  if (vista === "oggi" && P.vistaPrima !== "oggi") P.og = 0;   // tornando su Oggi si riparte da oggi
  P.vistaPrima = vista;
  if (vista === "oggi") return vistaOggi();
  if (vista === "persone") return vistaPersone();
  if (vista === "metodo") return vistaMetodo();
  return vistaPianifica();
}
const btn = (p, txt, cls = "", extra = "") => `<button class="${cls}" data-p="${p}" ${extra}>${txt}</button>`;
const aiuto = v => `<button class="aiuto" data-p="aiuto" data-v="${v}" aria-label="Come funziona">?</button>`;

/** i blocchi di una settimana come li vedi in Oggi e nella griglia di Settimana: con Google collegato vengono dai tuoi
    calendari (+ i blocchi di Bussola non ancora mandati); senza, solo dal piano (niente blocchi inventati).
    attesa = sto ancora leggendo Google (la vista si ridisegna da sola quando arriva) */
/** le finestre fisse (Impostazioni → Finestre: persone, allenamento, elastici, rito) come blocchi di una settimana.
    Compaiono anche nelle settimane non ancora pianificate, così sai dove mettere le cose (es. un'uscita con Davide).
    Id fissi («fin-0»…), così modificandone una la ritrovo. Quelle non per le persone saltano se Google ha già qualcosa a quell'ora. */
function blocchiFinestre(eventiB = []) {
  return metodo().finestre.map((f, i) => ({ id: "fin-" + i, g: Number(f.g), da: f.da, a: f.a, titolo: f.nome, tipo: "finestra", sotto: f.tipo, luogo: f.luogo || "Casa", fonte: "finestra" }))
    .filter(f => !eventiB.some(b => b.tipo === "finestra" && b.g === f.g && b.sotto === f.sotto))   // già in Calendar come finestra
    .filter(f => f.sotto === "persone" || !eventiB.some(b => b.g === f.g && !b.tuttoIlGiorno && hm(b.da) < hm(f.a) && fine(b) > hm(f.da)));
}
/** un piano «leggero» per una settimana non ancora pianificata (serve quando aggiungi o cambi qualcosa da Oggi) */
function pianoMinimo(sett) {
  const ev = G.collegato() ? G.eventiInCache(sett) : null;
  return { passo: 0, iniziato: Date.now(), blocchi: blocchiFinestre(ev ? blocchiDaGoogle(sett, ev) : []), persone: [], finito: false };
}
function blocchiSettimana(sett) {
  const p = piano(sett);
  if (!G.collegato()) return { blocchi: p ? p.blocchi : blocchiFinestre(), attesa: false, p };
  const fresco = G.eventiInCache(sett), ev = fresco || G.eventiVecchi(sett);   // finché rileggo, uso l'ultima lettura
  if (!fresco && !P.leggo?.has(sett)) {
    (P.leggo ||= new Set()).add(sett);
    G.calendari().then(() => G.eventiSettimana(sett, { escludi: calendariEsclusi() })).then(() => C.disegna()).catch(() => C.disegna()).finally(() => P.leggo.delete(sett));
  }
  const daG = ev ? blocchiDaGoogle(sett, ev) : [];
  const legati = new Set(daG.map(b => b.gcalId));
  const soloBussola = p ? p.blocchi.filter(b => b.fonte !== "gcal" && b.fonte !== "ricorrente" && !(b.gcalId && legati.has(b.gcalId))).map(b => ({ ...b, nonInCal: !b.gcalId && b.tipo !== "finestra" }))
    : ev ? blocchiFinestre(daG) : [];
  return { blocchi: [...daG, ...soloBussola], attesa: !ev, p };
}
export { blocchiSettimana };

// ---------- OGGI ----------
/* Stile semplice: un solo protagonista (quello che fai adesso, in grande), il resto in card chiare con una striscia
   di colore; a lato il sasso grande e tre «pillole» chiuse (azioni rapide, margine, scadenze) che si aprono col tocco. */
const titoloB = b => b.tipo === "messaggi" ? "Azioni rapide" : b.tipo === "finestra" ? b.titolo.replace(/^finestra\s*·?\s*/i, "") || b.titolo : b.titolo;   // in Calendar «Finestra · Allenamento», qui basta «Allenamento» (già tratteggiato)
const dove = b => b.luogo && b.luogo !== "Casa" ? b.luogo : !b.luogo && b.luogoG ? b.luogoG : "";
function htmlPillola(k, titolo, conta, colore, dentro) {
  const aperta = P.pill.has(k);
  return `<div class="pillola ${aperta ? "aperta" : ""} pl-${k}"><button class="pill-t" data-p="pill" data-k="${k}" aria-expanded="${aperta}">
      <i class="pallino-p" style="background:${colore}"></i><b>${titolo}</b><span class="n">${conta}</span>${C.ico("dopo")}</button>
    ${aperta ? `<div class="pill-d">${dentro}</div>` : ""}</div>`;
}
const htmlSpunte = V => V.length ? `<ul class="og-az">${V.map(v => `<li class="${v.fatto ? "done" : ""}"><button class="ck" data-azione="spunta" data-id="${v.id}" aria-label="Fatto"></button><span>${C.esc(v.testo)}</span></li>`).join("")}</ul>` : "";
/* Oggi (dal 2026-10-29, anteprime anteprima/telefono.html e computer.html): in cima l'AZIONE CHE CONTA DI PIÙ (il sasso
   grande del giorno), sotto le AZIONI RAPIDE del giorno già aperte (rapide.js: gesti, «+», scheda), poi il calendario:
   sul telefono una lista corta da toccare, sul computer la giornata con gli orari (si trascina come in Settimana). */
function vistaOggi() {
  // P.og = quanti giorni prima (-) o dopo (+) di oggi stai guardando, con le frecce
  const ora = new Date(), og = P.og || 0, giorno = new Date(ora.getFullYear(), ora.getMonth(), ora.getDate() + og);
  const sett = C.lunediDi(giorno), g = (giorno.getDay() + 6) % 7, gIso = C.iso(giorno);
  const adesso = og < 0 ? 9999 : og > 0 ? -1 : ora.getHours() * 60 + ora.getMinutes();
  const col = G.collegato(), { blocchi: tutti, attesa, p } = blocchiSettimana(sett);
  const blocchi = tutti.filter(b => b.g === g);
  const lista = blocchi.filter(occupa).sort((a, b) => hm(a.da) - hm(b.da));
  P.ogBlocchi = new Map(lista.map(b => [b.id, b])); P.ogSett = sett; P.ogG = g;   // per il foglio «modifica»
  // il viaggio verso un impegno: da dov'eri prima (se era vicino) o da casa
  const viaggio = b => { const i = lista.indexOf(b), prima = lista[i - 1]; return tragitto(prima && hm(b.da) - fine(prima) < 120 ? prima.luogo : "Casa", b.luogo, { g, min: hm(b.da) }); };
  // l'azione che conta di più: il sasso grande che ha un blocco oggi, altrimenti il primo non fatto («Un'altra» passa al prossimo)
  const S = sassi(sett).filter(s => !s.fatto);
  const conBlocco = S.filter(s => blocchi.some(b => diSasso(b, s.id)));
  const ordine = [...conBlocco, ...S.filter(s => !conBlocco.includes(s))];
  const sasso = ordine.length ? ordine[(P.eroe || 0) % ordine.length] : null;
  // l'OBIETTIVO del giorno (v4): lo propone l'app (il sasso grande, quello con un blocco oggi per primo); toccandolo lo riscrivi
  // (salvato in «obiettivo:<giorno>»; vuoto = torna la proposta). Il cerchio lo segna fatto; se è il sasso conta anche +1.
  const kOb = "obiettivo:" + gIso, ob = C.D.leggi(kOb) || {}, proposta = sasso ? sasso.testo : "";
  const testoOb = ob.testo || proposta;
  const htmlOb = `<div class="og4-ob${ob.fatto ? " fatto" : ""}"><div class="og4-ob-t"><div class="og4-ob-e">Obiettivo ${og === 0 ? "di oggi" : og === 1 ? "di domani" : "del giorno"}</div>
      <h2 class="og4-ob-h" contenteditable="true" spellcheck="false" enterkeyhint="done" data-pob="${kOb}" data-placeholder="Qual è l'obiettivo ${og === 0 ? "di oggi" : "del giorno"}?">${C.esc(testoOb)}</h2></div>
  </div>`;   // niente spunta: l'obiettivo non si «fa», ricorda su cosa tenere il focus
  const chiesti = (() => { try { return JSON.parse(localStorage.getItem("bussola.viaggiChiesti") || "{}"); } catch { return {}; } })();
  const daChiedere = og ? null : lista.find(b => b.luogo && b.luogo !== "Casa" && viaggio(b) && hm(b.da) <= adesso && adesso - hm(b.da) < 240 && !chiesti[gIso + b.da + b.luogo]);
  P.viaggioChiesto = daChiedere ? { k: gIso + daChiedere.da + daChiedere.luogo, luogo: daChiedere.luogo } : null;
  const domanda = daChiedere ? `<div class="og2-viaggio"><p>Andare a <b>${C.esc(daChiedere.luogo)}</b>: avevo stimato <b>${viaggio(daChiedere)}'</b>. Com'è andata?</p>
      <div>${btn("viaggio", "Meno", "", 'data-v="0.9"')}${btn("viaggio", "Giusto", "", 'data-v="1"')}${btn("viaggio", "Di più", "", 'data-v="1.12"')}</div></div>` : "";
  const marg = C.voci().filter(v => v.tipo === "margine" && v.settimana === sett && !v.padre).sort((a, b) => (a.ordine ?? 0) - (b.ordine ?? 0));
  const quale = og === 0 ? "" : og === 1 ? "domani · " : og === -1 ? "ieri · " : og > 0 ? `tra ${og} giorni · ` : `${-og} giorni fa · `;
  const riga = b => { const t = viaggio(b); return `<button class="og2-r${fine(b) <= adesso ? " passato" : ""}${b.tipo === "finestra" ? " finestra" : ""}" data-p="og-blocco" data-id="${b.id}">
      <span class="t">${b.da}</span><i style="background:${coloreTipo(b)}"></i><span class="n">${C.esc(titoloB(b))}${dove(b) ? `<small>${C.esc(dove(b))}${b.nonInCal ? " · solo in Bussola" : ""}</small>` : ""}</span>
      ${t && hm(b.da) > adesso ? `<em>parti ${fmt(hm(b.da) - t)}</em>` : ""}</button>`; };
  const calendario = !col && !p ? `<div class="og-vuota"><b>Qui non vedi ancora la tua giornata vera</b>
        <p>Collega Google Calendar e qui compaiono tutti i tuoi calendari: lezioni, chiamate, ripetizioni.</p>
        ${G.disponibile() ? btn("g-collega", `${C.ico("bussola")}Collega Google Calendar`, "btn pieno H") : ""}</div>`
    : attesa ? `<p class="vuota">Leggo i tuoi calendari…</p>`
    : `<div class="og4-cal">${grigliaSettimana(sett, g)}</div>`;
  const azG = R.azioniDi(gIso), fatteG = azG.filter(v => v.fatto).length, nPers = og ? 0 : PS.quanteDaSentire();
  const data = giorno.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  return `<div class="testa og4-testa"><div><p class="og4-data">${maiusc(data)}${aiuto("oggi")}${col ? `<span class="og2-sync" title="Google Calendar collegato"><i></i>Calendar</span>` : ""}</p>
      ${quale ? `<p class="og4-sotto">${quale.replace(/ · $/, "")}</p>` : ""}</div>
      <div class="nav-t"><button class="tondo" data-p="og" data-d="-1" aria-label="Giorno prima">${C.ico("prima")}</button>${og ? `<button class="oggi og-torna H" data-p="og" data-d="0">Oggi</button>` : ""}<button class="tondo" data-p="og" data-d="1" aria-label="Giorno dopo">${C.ico("dopo")}</button></div></div>
    ${col && !G.perSempre() ? `<div class="og2-viaggio"><p><b>Una volta sola:</b> ricollega Google Calendar per restare collegato per sempre (niente più «Collega» ogni ora).</p><div>${btn("g-collega", "Ricollega ora", "")}</div></div>` : ""}
    ${htmlOb}${domanda}
    <div class="og2 og4">
      <div class="og2-sx"><div class="og4-gruppo">
        ${htmlPillola("rapide", "Azioni rapide", azG.length ? `${fatteG} di ${azG.length}` : "", "var(--blue)", R.htmlGiorno(gIso, { titolo: false }))}
        ${og ? "" : htmlPillola("persone", "Persone da sentire", nPers || "", "#E67C73", PS.htmlDaSentire({ titolo: false }) || `<p class="vuota">Aggiungi le persone a cui tieni in Impostazioni.</p>`)}
        ${htmlPillola("margine", "Margine", marg.length ? `${marg.filter(v => !v.fatto).length} idee` : "vuoto", "#A39E93",
          `<p class="sub">Ti è saltato un impegno o hai finito prima? Eccole.</p>${htmlSpunte(marg) || `<p class="vuota">Niente nel margine questa settimana.</p>`}`)}
      </div></div>
      <div class="og2-dx"><div class="rp-tit solo-pc"><h3 class="H">${og ? "In calendario" : "Oggi in calendario"}</h3><span>trascina per spostare · tocca per cambiare</span></div>${calendario}</div>
    </div>`;
}

/** la griglia della settimana per la schermata Settimana (solo da guardare: per spostare i blocchi c'è Pianifica, passo 5).
    Pieni = sassi grandi; chiari con la striscia = tutto il resto. */
const GS_H0 = 7, GS_PX = 30;   // la griglia parte dalle 7, 30 px per ora
export function grigliaSettimana(sett, soloG = null) {
  const { blocchi, attesa, p } = blocchiSettimana(sett);
  if (attesa) return `<p class="vuota">Leggo i tuoi calendari…</p>`;
  if (!blocchi.length) return `<p class="vuota">Questa settimana non è ancora pianificata.</p>`;
  const avviso = !p && !G.collegato() && G.disponibile() ? `<div class="g-collega"><b>${C.ico("bussola")}Collega Google Calendar</b><p>Vedi le tue finestre fisse; collegando Calendar vedi anche gli impegni già presi.</p>${btn("g-collega", "Collega", "btn pieno H")}</div>` : "";
  const H0 = GS_H0, H1 = 24, PX = GS_PX, oggiG = C.giorniTra(sett, C.oggi());
  // il passato si spegne: giorni prima di oggi, e oggi quello già finito; la linea rossa segna adesso
  const ora = new Date(), adesso = ora.getHours() * 60 + ora.getMinutes();
  const passato = (g, b) => g < oggiG || (g === oggiG && (!b || fine(b) <= adesso));
  const yAdesso = (adesso - H0 * 60) / 60 * PX, vediAdesso = oggiG >= 0 && oggiG <= 6 && adesso >= H0 * 60;
  if (vediAdesso && P.gsScroll !== sett + soloG && C.S.vista !== "pianifica") {   // la prima volta scorre da sola all'ora di adesso
    P.gsScroll = sett + soloG;
    setTimeout(() => {   // in Oggi (telefono) scorre solo il riquadro del calendario, non la pagina: l'obiettivo resta in vista
      const a = $(".gs-adesso"), box = a?.closest(".og4-cal");
      if (box && box.scrollHeight > box.clientHeight) box.scrollTop += a.getBoundingClientRect().top - box.getBoundingClientRect().top - box.clientHeight / 2;
      else a?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 60);
  }
  P.gsBlocchi = new Map(blocchi.map(b => [b.id, b])); P.gsSett = sett;   // per modificarli toccandoli o trascinandoli
  // gli impegni «tutto il giorno» stanno in una striscia di altezza fissa (uguale in ogni colonna, --nb righe):
  // così la griglia di ogni giorno parte alla stessa altezza della colonna delle ore e le linee combaciano
  const nb = Math.max(0, ...GIORNI.map((_, g) => soloG != null && g !== soloG ? 0 : blocchi.filter(b => b.g === g && b.tuttoIlGiorno).length));
  const colonne = GIORNI.map((nome, g) => {
    if (soloG != null && g !== soloG) return "";
    const tutti = blocchi.filter(b => b.g === g), banner = tutti.filter(b => b.tuttoIlGiorno);
    const veri = tutti.filter(occupa).sort((a, b) => hm(a.da) - hm(b.da));
    const posti = tutti.filter(b => b.tipo === "finestra" && b.sotto === "persone");
    const pos = b => `top:${Math.max(0, (hm(b.da) - H0 * 60) / 60 * PX)}px;height:${Math.max(15, durata(b) / 60 * PX - 2)}px`;
    return `<div class="gs-col-w ${g === oggiG ? "gs-oggi" : ""} ${passato(g) && g !== oggiG ? "gs-passato" : ""}"><h4 class="H">${nome} <span>${Number(C.piuGiorni(sett, g).slice(8))}</span></h4>
      <div class="gs-banners">${banner.map(b => `<div class="gs-banner">${C.esc(b.titolo)}</div>`).join("")}</div>
      <div class="gs-col" data-p="gs-nuovo" data-g="${g}" style="height:${(H1 - H0) * PX}px">${Array.from({ length: H1 - H0 }, (_, i) => `<i style="top:${i * PX}px"></i>`).join("")}
      ${posti.map(b => `<div class="gs-posto" style="${pos(b)}" data-p="gs-blocco" data-id="${b.id}" title="Posto libero per le persone ${b.da}-${b.a}"><span>Persone</span></div>`).join("")}
      ${veri.map(b => {
        const top = Math.max(0, (hm(b.da) - H0 * 60) / 60 * PX), h = Math.max(15, durata(b) / 60 * PX - 2), sasso = b.tipo === "sasso";
        return `<div class="gs-bl ${sasso ? "sasso" : ""} ${b.tipo === "finestra" ? "finestra" : ""} ${passato(g, b) ? "passato" : ""}" style="--c:${coloreTipo(b)};top:${top}px;height:${h}px" data-p="gs-blocco" data-id="${b.id}" title="${b.da}-${b.a} ${C.esc(titoloB(b))}">
          <b>${C.esc(titoloB(b))}</b>${h > 30 ? `<span>${b.da}</span>` : ""}<u class="gs-maniglia" aria-hidden="true"></u></div>`;
      }).join("")}${g === oggiG && vediAdesso ? `<div class="gs-adesso" style="top:${yAdesso}px"></div>` : ""}</div></div>`;
  }).join("");
  const ore = `<div class="gs-ore">${Array.from({ length: H1 - H0 }, (_, i) => `<span style="top:${i * PX}px">${H0 + i}</span>`).join("")}${vediAdesso ? `<b class="gs-adesso-t" style="top:${yAdesso}px">${fmt(adesso)}</b>` : ""}</div>`;
  if (soloG != null) return `<div class="gs-griglia gs-un-giorno" style="--nb:${nb}">${ore}${colonne}</div>`;
  return `${avviso}<div class="gs-griglia" style="--nb:${nb}">${ore}${colonne}</div>
    <p class="sub gs-nota">Tocca un impegno per cambiarlo, uno spazio vuoto per crearne uno. Trascinalo per spostarlo, tira il bordo in basso per allungarlo (sul telefono: tieni premuto, poi trascina). Pieni = sassi grandi, tratteggiati = finestre fisse.</p>`;
}

// ---------- PIANIFICA ----------
function testaPianifica(p) {
  const s = P.sett, n = C.numSettimana(s);
  return `<div class="testa"><div><h1 class="H">Pianifica la settimana${aiuto("pianifica")}</h1>
    <p>${C.intervallo(s)} · settimana ${n}${p?.finito ? " · pronta" : ""}</p></div>
    <div class="nav-t">
      ${p && !p.finito ? `<div class="pf-timer H" id="pf-timer">${testoTimer(p)}</div>` : ""}
      ${p && G.collegato() ? `<button class="tondo" data-p="g-aggiorna" title="Rileggi Google Calendar" aria-label="Rileggi Google Calendar">${C.ico(P.sinc ? "lampo" : "annulla")}</button>` : ""}
      <button class="tondo" data-p="sett" data-d="-7" aria-label="Settimana prima">${C.ico("prima")}</button>
      <button class="tondo" data-p="sett" data-d="7" aria-label="Settimana dopo">${C.ico("dopo")}</button>
    </div></div>`;
}
function testoTimer(p) {
  const passati = (Date.now() - (p.iniziato || Date.now())) / 60000, resto = 30 - passati;
  return resto >= 0 ? `<i></i>${Math.floor(resto)}' rimasti` : `<i class="oltre"></i>+${Math.ceil(-resto)}' oltre i 30`;
}
setInterval(() => { const t = $("#pf-timer"), p = P.sett && piano(); if (t && p) t.innerHTML = testoTimer(p); }, 20000);

/* Pianifica a tappe: in alto le 6 tappe + il traguardo (fatte con la spunta, quella attuale grande, le altre grigie);
   una domanda grande per passo; in fondo sempre «‹ Indietro» e «Fatto, avanti →». Finito → «Settimana pronta!» con la griglia. */
const NOMI_T = ["Guarda indietro", "Svuota e smista", "Già fissato", "Ruoli e sassi", "In agenda", "Messaggi", "Pronta!"];
function vistaPianifica() {
  return PF.vista();   // v5 (pianifica5.js). Quella di prima resta qui sotto, non più usata
  const p = piano();
  if (!p) return testaPianifica() + inizio();
  if (p.messaggi) migraMessaggi(p);
  if (G.collegato() && !P.sinc && (!p.sincro || Date.now() - p.sincro > 3 * 60000)) setTimeout(() => aggiornaDaGoogle(P.sett, { forza: false }), 0);
  const pronta = p.finito && !P.rivedi, n = pronta ? 6 : Math.min(p.passo, 5), ps = PASSI[n];
  const fatta = i => p.finito || i < Math.min(p.passo, 5);
  const tappe = `<div class="pf-tappe">${NOMI_T.map((t, i) => `<button class="pf-tappa ${i === n ? "ora" : fatta(i) ? "fatta" : ""} ${i === 6 ? "traguardo" : ""}" data-p="${i === 6 ? (p.finito ? "pronta" : "") : "passo"}" data-n="${i}" ${i === 6 && !p.finito ? "disabled" : ""}>
      <span class="n">${i === 6 ? "★" : fatta(i) && i !== n ? "✓" : i + 1}</span><small>${t}</small></button>`).join("")}</div>`;
  if (pronta) return testaPianifica(p) + tappe + vistaPronta(p);
  const corpo = [passoIndietro, passoSmista, passoPaletti, passoRuoli, passoAgenda, passoChiudi][n](p);
  const domanda = `<div class="pf-dom"><h2 class="H">${C.esc(ps.domanda)}</h2>
    <p>${C.esc(ps.breve)} <button class="pf-perche" data-p="perche">${P.perche ? "Chiudi" : "Perché?"}</button></p>
    ${P.perche ? `<div class="pf-perche-t"><p>${C.esc(ps.perche)}</p><ul>${ps.domande.map(d => `<li>${C.esc(d)}</li>`).join("")}</ul></div>` : ""}</div>`;
  const piede = `<div class="pf-barra">${n > 0 ? btn("passo", `${C.ico("prima")}Indietro`, "pf-ind", `data-n="${n - 1}"`) : "<span></span>"}
    <span class="pf-dove">Passo ${n + 1} di 6 · ${C.esc(ps.titolo)}</span>
    ${n < 5 ? btn("passo", `Fatto, avanti${C.ico("dopo")}`, "pf-avanti H", `data-n="${n + 1}"`) : btn("finito", "Finito: settimana pronta ★", "pf-avanti H")}</div>`;
  return testaPianifica(p) + tappe + domanda + `<div class="pf-corpo">${corpo}</div>` + piede;
}
/** il traguardo: la settimana pronta, con i sassi grandi e la griglia */
function vistaPronta(p) {
  const S = sassi(P.sett);
  return `<div class="pf-pronta"><h2 class="H">Settimana pronta!</h2>
      <p>Da domani: guarda Oggi ogni mattina, la sera i 5 minuti del rito. Per tutto il resto: Cattura.</p>
      ${S.length ? `<div class="pf-pronta-s">${S.map(s => `<span><i style="background:${C.col(s.r.colore).c}"></i>${C.esc(s.r.nome)} · ${C.esc(s.testo)}${s.misura ? " · " + C.esc(s.misura) : ""}</span>`).join("")}</div>` : ""}</div>
    <div class="paper gs-carta">${grigliaSettimana(P.sett)}</div>
    <div class="pf-barra">${btn("rivedi", `${C.ico("prima")}Rivedi i passi`, "pf-ind")}<span class="pf-dove"></span>${btn("vai-settimana", `Vai alla tua settimana${C.ico("dopo")}`, "pf-avanti H")}</div>`;
}
function inizio() {
  const n = inbox().length;
  return `<div class="pf-inizio paper">
    <div class="ribbon H" style="--c:var(--blue)">30 minuti, 6 passi</div>
    <h2 class="H">Pronto a mettere in ordine la settimana?</h2>
    <p>Ti guido un passo alla volta, con le stesse domande della nostra prima pianificazione. Tieni vicino il telefono (foglietti, note, chat aperte).</p>
    <ol class="pf-elenco">${PASSI.map(x => `<li><b>${C.esc(x.titolo)}</b> — ${C.esc(x.breve)}</li>`).join("")}</ol>
    ${n ? `<p class="pf-nota">${C.ico("smista")}Hai <b>${n}</b> ${n === 1 ? "cosa catturata" : "cose catturate"} in settimana: le smisti al passo 2.</p>` : ""}
    ${G.collegato() ? `<p class="pf-nota">${C.ico("spunta")}Google Calendar è collegato: i tuoi impegni della settimana entrano da soli come paletti.</p>` : htmlCollega("Così Pianifica parte dai tuoi impegni veri, e alla fine manda i blocchi nuovi in Calendar con un tocco.")}
    ${btn("inizia", `Inizia${C.ico("dopo")}`, "btn pieno H grande")}
  </div>`;
}

// ---------- 1. Guarda indietro ----------
function passoIndietro() {
  const prec = C.piuGiorni(P.sett, -7), NT = Object.fromEntries(C.NOTE.map(t => [t.k, t]));
  const diario = C.tutte("nota:").filter(n => n.settimana === prec || n.settimana === P.sett).sort((a, b) => (a.quando || 0) - (b.quando || 0));
  const regole = metodo().regole || [];
  return `<div class="pf-due">
    <div class="paper"><div class="ribbon H" style="--c:var(--blue)">Il diario della settimana</div>
      ${diario.length ? diario.map(n => `<div class="pf-dv"><span class="tag-d" style="background:${NT[n.tipo]?.c}">${NT[n.tipo]?.corto}</span>
        <span class="pf-dv-t">${C.esc(n.testo)}${n.quando ? `<small>${quando(n.quando)}</small>` : ""}</span>
        ${n.tipo !== "bene" ? `<span class="pf-azp">${n.fatta ? `<small>${n.fatta}</small>` : `${btn("da-nota", "→ Azione", "mini", `data-id="${n.id}"`)}${btn("a-regola", "→ Regola", "mini", `data-id="${n.id}"`)}`}</span>` : ""}</div>`).join("")
        : `<p class="vuota">Il diario è vuoto. Durante la settimana scrivi dal pulsante Cattura → Diario: domenica lo ritrovi qui.</p>`}
      <p class="sub" style="margin-top:10px"><b>→ Azione</b>: diventa una cosa da smistare al passo 2. <b>→ Regola</b>: entra nel tuo metodo e te la ricordo in agenda.</p>
    </div>
    <div class="paper"><div class="ribbon H" style="--c:#8A857A">Dal parcheggio</div>
      ${htmlParcheggio(parcheggio()) || `<p class="vuota">Il parcheggio è vuoto.</p>`}
      ${regole.length ? `<div class="pf-regole"><b class="H">Le tue regole</b>${regole.map((r, i) => `<span>${C.esc(r)}${btn("via-regola", C.ico("cestino"), "mn-p", `data-i="${i}" aria-label="Togli"`)}</span>`).join("")}</div>` : ""}
    </div></div>`;
}
const quando = t => { const d = new Date(t); return `${GIORNI_L[(d.getDay() + 6) % 7]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function htmlParcheggio(K) {
  if (!K.length) return "";
  const ora = K.filter(v => !v.ritorna || v.ritorna <= P.sett), dorme = K.filter(v => v.ritorna && v.ritorna > P.sett).sort((a, b) => a.ritorna.localeCompare(b.ritorna));
  const gruppi = (L, sveglie) => perRaccoglitore(L).map(([nome, V]) => `<div class="pf-racc"><b class="H">${C.esc(nome)} <span>${V.length}</span></b>
    <ul class="pf-lista">${V.map(v => `<li><span class="pf-idea">${C.esc(v.testo)}${v.parcheggiato ? `<small>dal ${dataCorta(v.parcheggiato)}</small>` : ""}</span>
      ${sveglie ? `<span class="pf-azp">${btn("riprendi-parch", "Riprendi", "mini on", `data-id="${v.id}"`)}${btn("piu-avanti", "Tra 2 sett.", "mini", `data-id="${v.id}" data-sett="2"`)}${btn("piu-avanti", "Tra 1 mese", "mini", `data-id="${v.id}" data-sett="4"`)}</span>`
        : `<span class="pf-azp"><small>torna il ${dataCorta(v.ritorna)}</small>${btn("riprendi-parch", "Riprendi ora", "mini", `data-id="${v.id}"`)}</span>`}</li>`).join("")}</ul></div>`).join("");
  return `<div class="pf-parch">
    ${ora.length ? `<b class="H">Dal parcheggio · ${ora.length}</b><p class="sub">Cose messe da parte che tornano questa settimana. Le riprendi o le rimandi: niente sensi di colpa.</p>${gruppi(ora, true)}` : ""}
    ${dorme.length ? `<details class="pf-dorme"><summary>${ora.length ? "" : `${C.ico("spunta")}`}Nel parcheggio dormono ${dorme.length} ${dorme.length === 1 ? "idea" : "idee"} (la prossima torna il ${dataCorta(dorme[0].ritorna)})</summary>${gruppi(dorme, false)}</details>` : ""}
  </div>`;
}


// ---------- 2. Svuota e smista ----------
function passoSmista(p) {
  const I = inbox();
  const conta = { paletti: p.blocchi.filter(b => b.fonte === "smista").length, azioni: azioni().length, ruoli: C.voci().filter(v => v.tipo === "ruolo" && v.settimana === P.sett && !v.padre).length, marg: marginiSett().length, parch: parcheggio().length };
  const scrivi = `<form class="pf-svuota" data-pf="svuota"><textarea name="t" class="pf-area" rows="3" placeholder="Hai ancora qualcosa in testa? Una cosa per riga.&#10;Es. regalo Gaia · rispondere a Lorenzo · Bussola: parcheggio con le date"></textarea>
    <button class="btn pieno H">${C.ico("piu")}Butta dentro</button></form>`;
  const mucchi = `<div class="pf-mucchi">
    <div class="pf-mucchio" style="--c:var(--blue)"><div class="H">Paletti <span>${conta.paletti}</span></div><p>Hanno già giorno e ora</p></div>
    <div class="pf-mucchio" style="--c:var(--yellow);--t:#2B2205"><div class="H">Azioni rapide <span>${conta.azioni}</span></div><p>Meno di 5 minuti: tutte insieme</p></div>
    <div class="pf-mucchio" style="--c:var(--purple)"><div class="H">Ai ruoli <span>${conta.ruoli}</span></div><p>Al passo 4 scegli il sasso grande</p></div>
    <div class="pf-mucchio" style="--c:#8A857A"><div class="H">Margine · Parcheggio <span>${conta.marg} · ${conta.parch}</span></div><p>Se avanza tempo · non ora</p></div>
    ${I.length ? `<p class="restano">Restano ${I.length} · circa ${Math.max(1, Math.round(I.length * .5))} minuti</p>` : ""}</div>`;
  if (!I.length) return scrivi + `<div class="pf-smista"><div class="pf-carta fatta"><h2 class="H">Tutto smistato</h2><p>Ogni cosa ha il suo destino. Avanti con i paletti.</p></div>${mucchi}</div>`;
  const v = I[0];
  let dentro;
  if (P.scelta === "paletto") {
    dentro = `<form class="pf-domanda" data-pf="paletto" data-id="${v.id}"><div class="n H">Quando?</div>
      <div class="pf-riga">${selGiorno("g")}<input type="time" name="da" value="09:00" required><span>→</span><input type="time" name="a" value="10:00" required></div>
      <div class="pf-riga">${selLuogo("luogo")}<label class="pf-check"><input type="checkbox" name="prov"> da confermare</label></div>
      <div class="sino"><button class="H">Segna il paletto</button>${btn("scelta", "Indietro", "H no", 'data-s=""')}</div></form>`;
  } else if (P.scelta === "ruolo") {
    dentro = `<div class="pf-domanda"><div class="n H">Di quale ruolo è?</div>
      <div class="pf-ruoli">${metodo().ruoli.map(r => `<button class="H" style="${C.stileCol(r.colore)}" data-p="a-ruolo" data-id="${v.id}" data-r="${C.esc(r.nome)}">${C.esc(r.nome)}</button>`).join("")}</div>
      <div class="sino" style="margin-top:10px">${btn("scelta", "Indietro", "H no", 'data-s=""')}</div></div>`;
  } else {
    // i 5 destini subito visibili: ti fermi al primo che è vero
    dentro = `<div class="pf-destini">
      ${btn("scelta", "Ha giorno e ora<small>paletto</small>", "", 'data-s="paletto"')}
      ${btn("a-azione", "Meno di 5 minuti<small>azione rapida</small>", "", `data-id="${v.id}"`)}
      ${btn("scelta", "Per un ruolo<small>sasso o promemoria</small>", "", 'data-s="ruolo"')}
      ${btn("a-margine", "Se avanza tempo<small>margine</small>", "", `data-id="${v.id}"`)}
      ${btn("a-parch", "Non ora<small>parcheggio</small>", "", `data-id="${v.id}"`)}</div>
      <div class="pf-via">${btn("via-voce", `${C.ico("cestino")}Non serve più: elimina`, "", `data-id="${v.id}"`)}</div>`;
  }
  return scrivi + `<div class="pf-smista">
    <div class="pf-carta"><small>${I.length === 1 ? "Ultima cosa" : `1 di ${I.length}`}${v.racc ? ` · raccoglitore «${C.esc(v.racc)}»` : ""}</small>
      <h2 class="H">${C.esc(v.testo)}</h2>${dentro}
    </div>${mucchi}</div>`;
}
const selGiorno = (name, val = 0) => `<select name="${name}">${GIORNI_L.map((g, i) => `<option value="${i}" ${i === Number(val) ? "selected" : ""}>${g} ${Number(C.piuGiorni(P.foglio?.sett || P.sett, i).slice(8))}</option>`).join("")}</select>`;
const selLuogo = (name, val = "Casa", vuoto = false) => `<select name="${name}">${vuoto ? `<option value="" ${!val ? "selected" : ""}>Luogo non indicato</option>` : ""}${metodo().luoghi.map(l => `<option ${l.nome === val ? "selected" : ""}>${C.esc(l.nome)}</option>`).join("")}</select>`;

// ---------- 3. Paletti ----------
function passoPaletti(p) {
  const noteG = G.collegato() ? `<p class="pf-nota" style="margin-bottom:12px">${C.ico("spunta")}Ci sono i tuoi impegni di Google Calendar (tutti i calendari) e le finestre libere. Se cambi qualcosa in Calendar, tocca ${C.ico("annulla")} in alto per rileggerlo.</p>` : htmlCollega("Ora vedi i paletti della settimana tipo: collegando Calendar vedresti i tuoi impegni veri.");
  const giorni = GIORNI.map((G, g) => {
    const B = p.blocchi.filter(b => b.g === g && (b.tipo === "paletto" || b.tipo === "finestra")).sort((a, b) => (b.tuttoIlGiorno ? 1 : 0) - (a.tuttoIlGiorno ? 1 : 0) || hm(a.da) - hm(b.da));
    return `<div class="pf-giorno"><h4 class="H">${G} <span>${Number(C.piuGiorni(P.sett, g).slice(8))}</span></h4>
      ${B.map(b => `<div class="pf-pal ${b.provvisorio ? "prov" : ""} ${b.tipo === "finestra" ? "fin" : ""}" style="--c:${coloreTipo(b)}">
        <span>${b.tuttoIlGiorno ? "tutto il giorno" : `${b.da}-${b.a}`}</span><b>${C.esc(b.titolo)}${b.provvisorio ? " ?" : ""}</b>
        <button data-p="via-blocco" data-id="${b.id}" aria-label="Togli da questa settimana">${C.ico("cestino")}</button></div>`).join("") || `<p class="vuota">Libero</p>`}</div>`;
  }).join("");
  return `<div class="paper"><div class="ribbon H" style="--c:var(--blue)">I paletti della settimana</div>
      ${noteG}<p class="sub" style="margin-bottom:12px">Togli quello che questa settimana non vale, aggiungi quello che manca. (Togliere qui non cancella niente da Google Calendar.)</p>
      <div class="pf-settimana">${giorni}</div></div>
    <form class="paper pf-agg" data-pf="nuovo-paletto"><b class="H">Aggiungi un impegno</b>
      <input name="t" placeholder="Es. dentista, cena di compleanno…" required>${selGiorno("g")}
      <input type="time" name="da" value="10:00" required><input type="time" name="a" value="11:00" required>${selLuogo("luogo")}
      <label class="pf-check"><input type="checkbox" name="prov"> da confermare</label>
      <button class="btn pieno H">${C.ico("piu")}Aggiungi</button></form>`;
}


// ---------- 4. Ruoli e sassi grandi (+ persone) ----------
function passoRuoli(p) {
  const m = metodo(), R = C.ruoli(P.sett), scelti = new Set(R.map(r => r.nome.toLowerCase())), n = R.length;
  const bacheca = `<div class="paper"><div class="pf-cont H">Ruoli della settimana <span class="${n > 5 ? "troppi" : n < 3 ? "pochi" : ""}">${n} di 3-5</span></div>
    ${n > 5 ? `<p class="avviso-s">Più di 5 ruoli diventa insostenibile: scegliere vuol dire anche dire «non ora».</p>` : ""}
    <div class="pf-scegli">${m.ruoli.map(r => {
      const on = scelti.has(r.nome.toLowerCase()), ist = R.find(x => x.nome.toLowerCase() === r.nome.toLowerCase());
      const sg = ist ? C.voci().filter(v => v.tipo === "ruolo" && v.ruolo === ist.id && v.sasso) : [];
      return `<button class="pf-rc ${on ? "on" : ""}" style="${C.stileCol(r.colore)}" data-p="scegli-ruolo" data-r="${C.esc(r.nome)}"><i class="pal"></i>
        <span><b class="H">${C.esc(r.nome)}</b><small>${on ? (sg.length ? "Sasso: " + C.esc(sg.map(s => s.testo).join(", ")) : "Manca il sasso grande") : "Questa settimana dorme"}</small></span></button>`;
    }).join("")}</div>
    <p class="sub" style="margin-top:8px">Un ruolo che non c'è? Aggiungilo in Impostazioni → I tuoi ruoli.</p></div>`;
  const card = R.map(r => {
    const base = m.ruoli.find(x => x.nome.toLowerCase() === r.nome.toLowerCase());
    const V = C.voci().filter(v => v.tipo === "ruolo" && v.ruolo === r.id && !v.padre).sort((a, b) => (b.sasso ? 1 : 0) - (a.sasso ? 1 : 0));
    return `<div class="pf-ruolo" style="${C.stileCol(r.colore)}">
      <small class="H">Ruolo</small><h3 class="H">${C.esc(r.nome)}</h3>
      <p class="dom">${C.esc(base?.domanda || "Cosa conta davvero questa settimana in questo ruolo?")}</p>
      ${V.map(v => `<div class="pf-cd ${v.sasso ? "sasso" : ""}">
        <b>${C.esc(v.testo)}</b>
        <div class="pf-dest">${btn("dest", "Sasso", v.sasso ? "on" : "", `data-id="${v.id}" data-d="sasso"`)}${btn("dest", "Punto", !v.sasso ? "on" : "", `data-id="${v.id}" data-d="punto"`)}${btn("dest", "Margine", "", `data-id="${v.id}" data-d="margine"`)}${btn("dest", "Parcheggio", "", `data-id="${v.id}" data-d="parcheggio"`)}</div>
        ${v.sasso ? `<div class="pf-riga"><input data-pv="cal" data-id="${v.id}" value="${C.esc(v.cal || "")}" placeholder="In Calendar si chiama… (es. recupero lezioni)" title="Le parole del titolo dei suoi blocchi in Google Calendar, separate da virgola"></div>
          <div class="pf-riga"><input data-pv="misura" data-id="${v.id}" value="${C.esc(v.misura || "")}" placeholder="Quanto? (es. 8 lezioni)">
          <input type="number" min="0.5" step="0.5" data-pv="ore" data-id="${v.id}" value="${v.ore || 2}" title="Ore che servono"><span>ore</span></div>
          ${v.misura ? "" : `<p class="avviso-s">Rendilo misurabile: «8 lezioni», non «recuperare tutto».</p>`}` : ""}</div>`).join("")}
      ${V.filter(v => v.sasso).length > 2 ? `<p class="avviso-s">Più di 2 sassi grandi? Scegliere vuol dire anche dire «non ora».</p>` : ""}
      <form data-pf="nuovo-sasso" data-r="${r.id}"><input name="t" placeholder="Aggiungi: sasso grande o promemoria…"></form>
    </div>`;
  }).join("");
  const marg = marginiSett();
  return bacheca + (R.length ? `<div class="pf-sassi">${card}</div>` : "")
    + `<div class="paper"><div class="ribbon H" style="--c:#8A857A">Lista del margine · ${marg.length}</div>
      <p class="sub">Quello che lasci fuori di proposito: se avanza tempo lo fai. Un premio, non un dovere.</p>
      ${marg.length ? `<ul class="pf-lista">${marg.map(v => `<li>${C.esc(v.testo)}${btn("dest", "Rendi sasso", "mini", `data-id="${v.id}" data-d="torna"`)}</li>`).join("")}</ul>` : ""}
      <form data-pf="nuovo-margine" class="pf-agg"><input name="t" placeholder="Aggiungi al margine…"></form></div>`
    + `<div class="pf-tit-pers H">${C.ico("persone")}Le persone di questa settimana</div>` + passoPersone(p);
}
function passoPersone(p) {
  const L = persone(), fin = p.blocchi.filter(b => b.tipo === "finestra" && b.sotto === "persone");
  const scelte = new Map(p.persone.map(x => [x.id, x]));
  if (!L.length) return `<div class="paper pf-vuoto"><h2 class="H">Ancora nessuna persona</h2><p>Aggiungi le persone a cui tieni: Bussola ti dirà chi non senti da troppo.</p>
    ${btn("suggerite", `${C.ico("piu")}Aggiungi ${PERSONE_SUGGERITE.join(", ")}`, "btn pieno H")}</div>`;
  return `<div class="pf-persone">${L.map(pe => {
    const st = statoPersona(pe), sc = scelte.get(pe.id);
    return `<div class="pf-pers ${sc ? "scelta" : ""}">
      <div class="pf-pers-t"><i class="pallino ${st.c}"></i><b>${C.esc(pe.nome)}</b><small>${st.testo} · ${PS.ogniTesto(pe)}</small>
        ${btn("scegli-persona", "Questa settimana", sc ? "mini on" : "mini", `data-id="${pe.id}"`)}</div>
      ${sc ? `<div class="pf-riga">
          <select data-pv="quando" data-id="${pe.id}"><option value="">Quando?</option>
            ${fin.map(f => `<option value="${f.g}|${f.da}" ${sc.g === f.g && sc.da === f.da ? "selected" : ""}>${GIORNI_L[f.g]} ${f.da}</option>`).join("")}
            <option value="altro" ${sc.altro ? "selected" : ""}>Un altro momento (lo metto in agenda)</option></select>
          <div class="pf-motivi">${["bisogno", "scadenza", "da tanto"].map(mo => btn("motivo", mo, sc.motivo === mo ? "on" : "", `data-id="${pe.id}" data-m="${mo}"`)).join("")}</div></div>`
        : st.c === "rosso" ? `<div class="pf-riga"><button class="mini" data-ps="nuova-uscita" data-id="${pe.id}">${C.ico("persone")}Organizza un'uscita</button></div>` : ""}
    </div>`;
  }).join("")}</div>`;
}

// ---------- 5. Metti in agenda (+ controllo di realtà dal vivo) ----------
const ORA0 = 7, ORA1 = 24, PXH = 34;
function passoAgenda(p) {
  const S = sassi(), da = [], A = azioni();
  S.forEach(s => {
    const messi = p.blocchi.filter(b => diSasso(b, s.id)).reduce((t, b) => t + durata(b), 0), resto = (Number(s.ore) || 2) * 60 - messi;
    if (resto > 0) da.push({ k: "sasso:" + s.id, titolo: s.testo, sotto: `${s.r.nome} · ancora ${oreTxt(resto)}`, c: colG(VERSO_G[C.col(s.r.colore).k]).c, min: Math.min(resto, 120) });
  });
  p.persone.filter(x => x.altro && !x.posto).forEach(x => { const pe = C.D.leggi("persona:" + x.id); if (pe) da.push({ k: "persona:" + x.id, titolo: pe.nome, sotto: "Persone", c: "#A75CF2", min: 120 }); });
  if (A.length && !p.blocchi.some(b => b.tipo === "messaggi")) da.push({ k: "messaggi", titolo: "Azioni rapide", sotto: `${A.length} da fare tutte insieme`, c: "#E0A21B", min: 30 });
  const marg = p.blocchi.filter(b => b.tipo === "margine").reduce((t, b) => t + durata(b), 0);
  if (marg < 120) da.push({ k: "margine", titolo: "Margine", sotto: `ne hai ${oreTxt(marg)}: almeno 2 h`, c: "#B9AF9A", min: 75 });
  const regole = metodo().regole || [];
  const colonne = GIORNI.map((G, g) => {
    const tutti = p.blocchi.filter(b => b.g === g), banner = tutti.filter(b => b.tuttoIlGiorno);
    const veri = tutti.filter(b => !b.tuttoIlGiorno).sort((a, b) => hm(a.da) - hm(b.da));
    let html = "", prima = "Casa", fineP = null;
    delGiorno(p, g).forEach(b => {
      const t = tragitto(prima, b.luogo);
      if (t) html += `<div class="pf-viaggio" style="top:${y(hm(b.da) - t)}px;height:${t / 60 * PXH}px" title="Spostamento ${t}'"></div>`;
      prima = b.luogo || "Casa"; fineP = fine(b);
    });
    if (fineP != null && prima !== "Casa") { const t = tragitto(prima, "Casa"); html += `<div class="pf-viaggio" style="top:${y(fineP)}px;height:${t / 60 * PXH}px"></div>`; }
    veri.forEach(b => {
      const h = Math.max(14, durata(b) / 60 * PXH - 2), vuota = !occupa(b);
      html += `<div class="pf-bl ${vuota ? "vuota" : ""} ${b.provvisorio ? "prov" : ""}" style="--c:${coloreTipo(b)};top:${y(hm(b.da))}px;height:${h}px" data-p="blocco" data-id="${b.id}">
        <b>${C.esc(b.titolo)}</b>${h > 26 ? `<span>${b.da}-${b.a}${b.luogo && b.luogo !== "Casa" ? " · " + C.esc(b.luogo) : ""}</span>` : ""}</div>`;
    });
    return `<div class="pf-col-w"><h4 class="H">${G} <span>${Number(C.piuGiorni(P.sett, g).slice(8))}</span></h4>
      ${banner.map(b => `<div class="pf-banner ${b.provvisorio ? "prov" : ""}">${C.esc(b.titolo)}</div>`).join("")}
      <div class="pf-col ${P.sel ? "piazza" : ""}" data-p="col" data-g="${g}" style="height:${(ORA1 - ORA0) * PXH}px">${righe()}${html}</div></div>`;
  }).join("");
  return `<div class="pf-agenda">
    <div class="pf-dasist paper"><div class="ribbon H" style="--c:var(--coral)">Da sistemare</div>
      ${da.length ? `<p class="sub">${P.sel ? "Ora tocca un orario nella colonna del giorno." : "Tocca un elemento, poi tocca l'orario nella settimana."}</p>
      ${da.map(x => `<button class="pf-dsel ${P.sel?.k === x.k ? "on" : ""}" style="--c:${x.c}" data-p="seleziona" data-k="${x.k}" data-min="${x.min}" data-t="${C.esc(x.titolo)}"><b>${C.esc(x.titolo)}</b><span>${C.esc(x.sotto)}</span></button>`).join("")}`
        : `<p class="vuota">${C.ico("spunta")}Tutto ha un posto.</p>`}
      ${regole.length ? `<div class="pf-regole"><b class="H">Le tue regole</b>${regole.map(r => `<span>${C.esc(r)}</span>`).join("")}</div>` : ""}
      <p class="sub" style="margin-top:10px">Tocca un blocco per spostarlo, allungarlo o toglierlo. Le righe grigie sono gli spostamenti.</p>
    </div>
    <div class="pf-griglia"><div class="pf-ore">${Array.from({ length: ORA1 - ORA0 }, (_, i) => `<span style="top:${i * PXH}px">${ORA0 + i}</span>`).join("")}</div>${colonne}</div>
  </div>` + `<div class="pf-tit-pers H">${C.ico("allerta")}Controllo di realtà</div>` + passoRealta(p);
}
const y = min => (min - ORA0 * 60) / 60 * PXH;
const righe = () => Array.from({ length: ORA1 - ORA0 }, (_, i) => `<i style="top:${i * PXH}px"></i>`).join("");


function analisi(p) {
  const m = metodo(), giorni = [];
  for (let g = 0; g < 7; g++) {
    const B = delGiorno(p, g), sveglia = hm(m.sveglie[g] || "07:30");
    let prima = "Casa", viaggi = 0, avvisi = [], ultimo = null;
    B.forEach((b, i) => {
      const t = tragitto(prima, b.luogo);
      viaggi += t;
      if (ultimo) {
        const buco = hm(b.da) - fine(ultimo), serve = t + Number(m.stacco || 10);
        if (buco < serve) avvisi.push({ g, b, testo: `${GIORNI_L[g]}: tra «${ultimo.titolo}» e «${b.titolo}» ${buco <= 0 ? "non c'è spazio" : `solo ${buco}'`} (servono ${serve}': ${t ? `${t}' di strada + ` : ""}stacco)` });
      }
      prima = b.luogo || "Casa"; ultimo = b;
    });
    const rientro = ultimo && prima !== "Casa" ? tragitto(prima, "Casa") : 0;
    viaggi += rientro;
    const fineGiorno = ultimo ? fine(ultimo) + rientro : 0;
    const letto = Math.max(23 * 60, fineGiorno + 30);
    const pieno = B.reduce((t, b) => t + durata(b), 0) + viaggi, sveglioMin = Math.max(60, letto - sveglia);
    const tutto = p.blocchi.some(b => b.g === g && b.tuttoIlGiorno);
    giorni.push({ g, B, sveglia, letto, viaggi, pieno, pct: tutto ? 100 : Math.min(100, Math.round(pieno / sveglioMin * 100)), avvisi, tutto });
  }
  giorni.forEach((d, g) => { d.sonno = (hm(m.sveglie[(g + 1) % 7] || "07:30") + 1440 - d.letto) / 60; });
  const pct = Math.round(giorni.reduce((t, d) => t + d.pct, 0) / 7);
  return { giorni, pct };
}

function passoRealta(p) {
  const m = metodo(), A = analisi(p), avv = [], ok = [];
  A.giorni.forEach(d => d.avvisi.forEach(a => avv.push({ c: "#E2502E", ic: "allerta", t: "Manca lo stacco", d: a.testo, g: d.g })));
  A.giorni.forEach(d => { if (d.sonno < m.sonno - .25) avv.push({ c: "#E2502E", ic: "luna", t: `Notte dopo ${GIORNI_L[d.g]}: ${d.sonno.toFixed(1).replace(".", ",")} h di sonno`, d: `Vai a letto verso le ${fmt(d.letto)}. Il tuo obiettivo è ${String(m.sonno).replace(".", ",")} h.`, g: d.g }); });
  A.giorni.forEach(d => { if (d.pct > 80 && !d.tutto) avv.push({ c: "#E2502E", ic: "allerta", t: `${GIORNI_L[d.g][0].toUpperCase() + GIORNI_L[d.g].slice(1)} è pieno all'${d.pct}%`, d: "Togli o sposta qualcosa: al primo imprevisto salta tutto.", g: d.g }); });
  const R = C.ruoli(P.sett), S = sassi();
  const senza = R.filter(r => !S.some(s => s.ruolo === r.id));
  if (senza.length) avv.push({ c: "#E0A21B", ic: "allerta", t: `Ruoli senza sasso grande: ${senza.map(r => r.nome).join(", ")}`, d: "Va bene se è una scelta. Altrimenti torna al passo 4." });
  else ok.push({ t: "Ogni ruolo ha il suo sasso grande", d: R.map(r => r.nome).join(", ") });
  const nonMessi = S.filter(s => !p.blocchi.some(b => diSasso(b, s.id)));
  if (nonMessi.length) avv.push({ c: "#E0A21B", ic: "allerta", t: `Sassi senza un posto in agenda: ${nonMessi.length}`, d: nonMessi.map(s => s.testo).join(" · ") });
  const marg = p.blocchi.filter(b => b.tipo === "margine").reduce((t, b) => t + durata(b), 0);
  (marg >= 120 ? ok : avv).push(marg >= 120 ? { t: `Margine: ${oreTxt(marg)}`, d: "La ruota di scorta c'è." } : { c: "#E0A21B", ic: "allerta", t: `Margine: solo ${oreTxt(marg)}`, d: "Lascia almeno 2 ore libere per gli imprevisti." });
  const rossi = persone().filter(pe => statoPersona(pe).c === "rosso" && !p.persone.some(x => x.id === pe.id));
  if (rossi.length) avv.push({ c: "#E0A21B", ic: "persone", t: `Persone in rosso: ${rossi.map(x => x.nome).join(", ")}`, d: "Almeno una data precisa per la settimana prossima." });
  if (!avv.some(a => a.c === "#E2502E")) ok.push({ t: "Stacchi, sonno e carico a posto", d: "La settimana regge." });
  const [lo, hi] = m.pienezza;
  const colonna = d => {
    const sv = d.sveglia, tot = Math.max(60, d.letto - sv);
    return `<div class="pf-carico"><span class="pct ${d.pct > 80 ? "rosso" : ""}">${d.pct}%</span>
      <div class="barra-g ${d.pct > 80 ? "troppo" : ""}">${d.tutto ? `<i style="top:0;height:100%;background:#1E9C98"></i>` :
        d.B.map(b => `<i style="top:${(hm(b.da) - sv) / tot * 100}%;height:${durata(b) / tot * 100}%;background:${coloreTipo(b)}"></i>`).join("")}</div>
      <b class="H">${GIORNI[d.g]}</b></div>`;
  };
  return `<div class="pf-realta">
    <div class="paper"><div class="ribbon H" style="--c:var(--blue)">Il carico di ogni giorno</div>
      <div class="pf-carichi">${A.giorni.map(colonna).join("")}</div>
      <div class="misure">
        <div class="misura"><small>Quanto è piena</small><b class="H">${A.pct}%</b><div class="barra"><i style="width:${A.pct}%;background:${A.pct > hi ? "var(--coral)" : "var(--green)"}"></i></div><p class="sub">Ideale tra ${lo} e ${hi}%</p></div>
        <div class="misura"><small>Sonno medio</small><b class="H">${(A.giorni.reduce((t, d) => t + d.sonno, 0) / 7).toFixed(1).replace(".", ",")} h</b>
          <div class="sonno">${A.giorni.map(d => `<div class="${d.sonno < m.sonno - .25 ? "poco" : ""}" style="height:${Math.min(100, d.sonno / 10 * 100)}%"><span>${d.sonno.toFixed(1).replace(".", ",").replace(",0", "")}</span></div>`).join("")}</div>
          <div class="giorni">${GIORNI.map(g => `<span>${g[0]}</span>`).join("")}</div></div>
      </div></div>
    <div class="avvisi">${avv.map(a => `<div class="avv" style="--c:${a.c}"><div class="ic">${C.ico(a.ic)}</div><div><b>${C.esc(a.t)}</b><p>${C.esc(a.d)}</p></div>${a.g != null ? btn("vai-agenda", "Sistema", "fix", `data-g="${a.g}"`) : ""}</div>`).join("")}
      ${ok.map(a => `<div class="avv" style="--c:var(--green)"><div class="ic">${C.ico("spunta")}</div><div><b>${C.esc(a.t)}</b><p>${C.esc(a.d)}</p></div></div>`).join("")}</div>
  </div>`;
}


// ---------- 6. Messaggi e calendario ----------
function linkWa(pe, testo) {
  let tel = String(pe?.tel || "").replace(/\D/g, "");
  if (tel.length === 10 && tel.startsWith("3")) tel = "39" + tel;
  return `https://wa.me/${tel}?text=${encodeURIComponent(testo)}`;
}

function passoChiudi(p) {
  const A = azioni(), N = nuoviBlocchi(p);
  return `<div class="pf-due">
    <div class="paper"><div class="ribbon H" style="--c:var(--yellow);color:var(--ink)">Messaggi e azioni rapide · ${A.filter(x => x.fatto).length}/${A.length}</div>
      <p class="sub" style="margin-bottom:12px">Prima quelle che aspettano una risposta: mandale adesso o nel loro blocco. Correggi i testi con parole tue.</p>
      ${A.length ? `<div class="pf-msgs">${A.map(x => {
        const pe = x.persona ? C.D.leggi("persona:" + x.persona) : null;
        const aperto = P.msgAperto === x.id;
        return `<div class="pf-msg ${x.fatto ? "fatto" : ""} ${aperto ? "aperto" : ""}">
          <button class="ck-p ${x.fatto ? "on" : ""}" data-azione="spunta" data-id="${x.id}" aria-label="Fatto"></button>
          <div class="pf-msg-c"><button class="pf-msg-t" data-p="msg-apri" data-id="${x.id}"><b>${C.esc(x.testo)}</b>${x.msg ? `<small>${aperto ? "chiudi il testo" : "tocca per vedere o correggere il testo"}</small>` : ""}</button>
            ${aperto && (x.persona || x.msg) ? `<textarea data-pv="msg" data-id="${x.id}" rows="3" placeholder="Testo del messaggio">${C.esc(x.msg || "")}</textarea>` : ""}</div>
          <div class="pf-msg-a">${x.msg ? `<a class="mini" href="${linkWa(pe, x.msg)}" target="_blank" rel="noopener">WhatsApp</a>${btn("copia", "Copia", "mini", `data-id="${x.id}"`)}` : ""}</div></div>`;
      }).join("")}</div>` : `<p class="vuota">Nessuna azione rapida questa settimana.</p>`}
    </div>
    <div class="paper"><div class="ribbon H" style="--c:var(--green)">Google Calendar · ${N.filter(b => b.gcalId).length}/${N.length}</div>
      ${G.collegato() ? `<p class="sub" style="margin-bottom:10px">I tuoi impegni ci sono già. Questi sono i blocchi nuovi di Bussola: con un tocco vanno tutti nel tuo calendario principale.</p>
        ${N.map(b => `<div class="pf-cal"><i style="background:${coloreTipo(b)}"></i><div><b>${C.esc(b.titolo)}</b><span>${GIORNI_L[b.g]} ${b.da}-${b.a}</span></div>
          ${b.gcalId ? `<span class="pf-ok">${C.ico("spunta")}in Calendar</span>` : `<span class="pf-ok no">da mandare</span>`}</div>`).join("") || `<p class="vuota">Nessun blocco nuovo.</p>`}
        ${N.some(b => !b.gcalId) ? btn("g-manda", `${C.ico("avanti")}Manda tutto in Calendar (${N.filter(b => !b.gcalId).length})`, "btn pieno H") : N.length ? `<p class="pf-nota">${C.ico("spunta")}Tutto è in Google Calendar.</p>` : ""}`
      : `${htmlCollega("Con Calendar collegato i blocchi nuovi ci vanno tutti con un tocco, e restano allineati.")}
        <p class="sub" style="margin:10px 0">Oppure, a mano: un tocco ciascuno o tutti insieme col file.</p>
        ${N.map(b => `<div class="pf-cal"><i style="background:${coloreTipo(b)}"></i><div><b>${C.esc(b.titolo)}</b><span>${GIORNI_L[b.g]} ${b.da}-${b.a}</span></div>
          <a class="mini" href="${linkGoogle(b)}" target="_blank" rel="noopener">Aggiungi</a></div>`).join("") || `<p class="vuota">Nessun blocco nuovo.</p>`}
        ${N.length ? btn("ics", `${C.ico("avanti")}Scarica tutti (file .ics)`, "btn", "") : ""}`}
      <p class="sub" style="margin-top:14px">Da domani: guarda <b>Oggi</b> ogni mattina, e la sera i 5 minuti del rito. Per tutto il resto: <b>Cattura</b> e <b>Imprevisto</b>.</p>
    </div></div>`;
}
const nuoviBlocchi = p => p.blocchi.filter(b => !["ricorrente", "finestra", "mesi", "gcal"].includes(b.fonte) && !b.tuttoIlGiorno).sort((a, b) => a.g - b.g || hm(a.da) - hm(b.da));
function dataOra(g, min) {
  const d = C.daIso(C.piuGiorni(P.sett, g)); d.setMinutes(min);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}00`;
}
function linkGoogle(b) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: b.titolo, dates: `${dataOra(b.g, hm(b.da))}/${dataOra(b.g, fine(b))}`, ctz: "Europe/Rome", details: "Da Bussola", location: b.luogo && b.luogo !== "Casa" ? b.luogo : "" });
  return "https://calendar.google.com/calendar/render?" + q;
}

// =========================================================
// PERSONE
// =========================================================
const vistaPersone = () => PS.vista();

// =========================================================
// IMPOSTAZIONI: i tuoi ruoli (bacheca a due colonne) + il resto, in riquadri richiudibili
// =========================================================
function vistaMetodo() {
  const m = metodo();
  const inp = (path, val, ph = "", type = "text", cls = "") => `<input type="${type}" class="${cls}" data-pm="${path}" value="${C.esc(val ?? "")}" placeholder="${C.esc(ph)}">`;
  const giorno = (path, val) => `<select data-pm="${path}" data-num>${GIORNI_L.map((g, i) => `<option value="${i}" ${i === Number(val) ? "selected" : ""}>${g}</option>`).join("")}</select>`;
  const luogo = (path, val) => `<select data-pm="${path}">${m.luoghi.map(l => `<option ${l.nome === val ? "selected" : ""}>${C.esc(l.nome)}</option>`).join("")}</select>`;
  const via = (lista, i) => btn("m-via", C.ico("cestino"), "mini", `data-lista="${lista}" data-i="${i}" aria-label="Togli"`);
  const agg = (lista, txt) => btn("m-agg", `${C.ico("piu")}${txt}`, "add", `data-lista="${lista}"`);
  const scelti = new Set(C.ruoli(C.lunediDi(new Date())).map(r => r.nome.toLowerCase()));
  const nP = persone().length;
  return `<div class="testa"><div><h1 class="H">Ruoli, persone e impostazioni${aiuto("metodo")}</h1><p>Tutti i tuoi ruoli: ogni domenica ne scegli 3-5. Sotto, le tue persone e il resto.</p></div></div>
  <div class="bacheca">${m.ruoli.map((r, i) => `<div class="br ${scelti.has(r.nome.toLowerCase()) ? "" : "dorme"}" style="${C.stileCol(r.colore)}">
      <div class="br-nome"><small class="H">${scelti.has(r.nome.toLowerCase()) ? "Ruolo · questa settimana" : "Ruolo"}</small>${inp(`ruoli.${i}.nome`, r.nome, "Nome", "text", "H")}</div>
      <label class="br-dom"><small>Domanda bussola</small><textarea data-pm="ruoli.${i}.domanda" rows="3" placeholder="Tocca per scriverla">${C.esc(r.domanda || "")}</textarea></label>
      <details class="br-menu"><summary aria-label="Altre azioni">•••</summary><div>
        <div class="colori">${C.COLORI.map(c => `<button style="--c:${c.c}" class="${r.colore === c.k ? "on" : ""}" data-p="m-colore" data-path="ruoli.${i}.colore" data-c="${c.k}" aria-label="${c.nome}" title="${c.nome}"></button>`).join("")}</div>
        ${btn("m-via", `${C.ico("cestino")}Elimina ruolo`, "mini", `data-lista="ruoli" data-i="${i}"`)}</div></details>
    </div>`).join("")}
    ${btn("m-agg", `${C.ico("piu")}Nuovo ruolo`, "br nuovo H", 'data-lista="ruoli"')}</div>

  <div class="pf-impost">
    ${SD.html()}
    <details class="paper" open><summary class="H">Le tue persone <small>${nP ? `${nP} · chi senti e ogni quanto` : "chi vuoi coltivare"}</small></summary>
      <p class="sub" style="margin:8px 0 12px">Scorri a destra = sentito oggi. Tocca un nome per cambiarlo. Si segnano anche da sole: dal calendario («Cena con Marco»), dal «+» («sentito Marco») o spuntando «Chiamare Marco».</p><div class="ps-vista">${PS.htmlLista()}</div></details>
    ${htmlImpostGoogle()}
    <details class="paper"><summary class="H">Paletti fissi <small>${G.collegato() ? "usati solo senza Google Calendar" : "ogni settimana, sempre uguali"}</small></summary>
      ${m.ricorrenti.map((r, i) => `<div class="pf-mriga">${giorno(`ricorrenti.${i}.g`, r.g)}${inp(`ricorrenti.${i}.da`, r.da, "", "time")}${inp(`ricorrenti.${i}.a`, r.a, "", "time")}
        ${inp(`ricorrenti.${i}.nome`, r.nome, "Cosa")}${luogo(`ricorrenti.${i}.luogo`, r.luogo)}${via("ricorrenti", i)}</div>`).join("")}${agg("ricorrenti", "Nuovo paletto fisso")}</details>
    <details class="paper"><summary class="H">Finestre <small>persone, allenamento, elastici, rito della domenica</small></summary>
      ${m.finestre.map((f, i) => `<div class="pf-mriga">${giorno(`finestre.${i}.g`, f.g)}${inp(`finestre.${i}.da`, f.da, "", "time")}${inp(`finestre.${i}.a`, f.a, "", "time")}
        ${inp(`finestre.${i}.nome`, f.nome, "Nome")}<select data-pm="finestre.${i}.tipo">${["persone", "allenamento", "elastici", "rito", "altro"].map(t => `<option ${t === f.tipo ? "selected" : ""}>${t}</option>`).join("")}</select>${via("finestre", i)}</div>`).join("")}${agg("finestre", "Nuova finestra")}</details>
    <details class="paper"><summary class="H">Luoghi e spostamenti <small>indirizzo → tempi in auto calcolati da soli</small></summary>
      <p class="sub" style="margin-bottom:6px">In Google Calendar scrivi nel campo <b>Luogo</b> uno di questi nomi (o un sinonimo): Bussola lo riconosce, e scrive lì il luogo dei blocchi che manda.</p>
      ${m.luoghi.map((l, i) => {
        const casa = m.luoghi.find(x => x.nome === "Casa"), base = m.durate?.["Casa|" + l.nome];
        const stato = l.nome === "Casa" ? (l.lat != null ? "Punto di partenza: trovato" : "Scrivi il tuo indirizzo: da qui calcolo tutti i tempi")
          : base != null ? V.forbice(base, casa, l, Number(m.correzioni?.[l.nome]) || 1) : l.lat != null ? "Trovato: manca l'indirizzo di Casa" : "";
        return `<div class="pf-luogo">${inp(`luoghi.${i}.nome`, l.nome, "Nome (es. Palestra)", "text", "pf-l-nome")}
          ${inp(`luoghi.${i}.indirizzo`, l.indirizzo || "", "Indirizzo (via, numero, città)", "text", "pf-l-ind")}
          ${inp(`luoghi.${i}.alias`, l.alias || "", "sinonimi: università, biblioteca", "text", "pf-l-alias")}
          ${l.lat == null && l.nome !== "Casa" ? `<label class="pf-l-min">${inp(`luoghi.${i}.min`, l.min, "min", "number")} min da casa (a mano)</label>` : ""}
          ${i ? via("luoghi", i) : ""}
          ${stato ? `<p class="pf-l-stato${l.lat != null ? " ok" : ""}">${C.esc(stato)}${l.trovato ? ` · <span>${C.esc(l.trovato)}</span>` : ""}</p>` : ""}</div>`;
      }).join("")}${agg("luoghi", "Nuovo luogo")}
      <p class="sub" style="margin-top:8px">I tempi sono in auto e tengono conto del traffico di Roma: ora, giorno, se vai verso il centro o verso fuori, e il parcheggio. Dopo ogni viaggio Bussola ti chiede «ci hai messo di più?» e si corregge.</p>
      ${luoghiSconosciuti().length ? `<p class="sub" style="margin-top:10px">Trovati in Google Calendar, ancora sconosciuti:</p><div class="pf-cand-l">${luoghiSconosciuti().map(l => btn("luogo-agg", `${C.ico("piu")}${C.esc(l)}`, "mini", `data-n="${C.esc(l)}"`)).join("")}</div>` : ""}
      <p class="sub" style="margin-top:10px">Tra due luoghi, se vuoi fissare tu i minuti (vale più del calcolo):</p>
      ${m.tragitti.map((t, i) => `<div class="pf-mriga">${luogo(`tragitti.${i}.da`, t.da)}<span>↔</span>${luogo(`tragitti.${i}.a`, t.a)}${inp(`tragitti.${i}.min`, t.min, "min", "number")}<span>min</span>${via("tragitti", i)}</div>`).join("")}${agg("tragitti", "Nuovo tragitto")}</details>
    <details class="paper"><summary class="H">Ritmo <small>sveglie, sonno, stacco</small></summary>
      <div class="pf-mriga sveglie">${GIORNI.map((g, i) => `<label>${g}${inp(`sveglie.${i}`, m.sveglie[i], "", "time")}</label>`).join("")}</div>
      <div class="pf-mriga"><label>Ore di sonno ${inp("sonno", m.sonno, "", "number")}</label><label>Stacco tra attività (min) ${inp("stacco", m.stacco, "", "number")}</label>
        <label>Settimana piena ideale ${inp("pienezza.0", m.pienezza[0], "", "number")}–${inp("pienezza.1", m.pienezza[1], "", "number")} %</label></div></details>
    <details class="paper"><summary class="H">Le tue regole <small>nate dal diario di bordo</small></summary>
      <textarea data-pm="regole" data-righe rows="4" placeholder="Una per riga. Es. niente chiamate dopo le 21">${C.esc((m.regole || []).join("\n"))}</textarea></details>
    <div class="pf-fondo">${btn("guida", "Rivedi la guida", "btn")}${btn("m-reset", "Ripristina le impostazioni di partenza", "btn rosso")}</div>
  </div>`;
}
function htmlImpostGoogle() {
  if (!G.disponibile()) return "";
  if (!G.collegato()) return `<div class="paper">${htmlCollega("Bussola legge tutti i tuoi calendari e scrive i blocchi nuovi nel principale. Google chiede di ricollegarsi ogni tanto (circa ogni ora di uso).")}</div>`;
  const cal = G.calendariNoti(), m = metodo();
  if (!cal) { G.calendari().then(() => C.disegna()).catch(() => C.disegna()); return `<div class="paper"><p class="vuota">Leggo i tuoi calendari…</p></div>`; }
  return `<details class="paper"><summary class="H">Google Calendar <small>collegato · ${cal.length} calendari</small></summary>
    <p class="sub">Scegli quali calendari usare e dove si svolgono (serve agli spostamenti).</p>
    ${cal.map(c => { const s = m.calendari?.[c.id] || {}; return `<div class="pf-mriga"><button class="ck-p ${calendarioEscluso(c) ? "" : "on"}" data-p="g-usa" data-id="${C.esc(c.id)}" aria-label="Usa questo calendario"></button>
      <i class="g-pall" style="background:${c.colore}"></i><b class="g-nome">${C.esc(c.nome)}${c.principale ? " · principale" : ""}</b>
      <select data-gcal="${C.esc(c.id)}"><option value="">luogo: dal testo</option>${m.luoghi.map(l => `<option ${s.luogo === l.nome ? "selected" : ""}>${C.esc(l.nome)}</option>`).join("")}</select></div>`; }).join("")}
    <div class="pf-fondo" style="margin-top:10px">${btn("g-scollega", "Scollega", "btn")}</div></details>`;
}
function setPath(obj, path, val) {
  const k = path.split("."), last = k.pop();
  let o = obj;
  k.forEach(x => { o = o[x]; });
  o[last] = val;
}
const NUOVI = {
  ruoli: { nome: "Nuovo ruolo", colore: "rosa", domanda: "" },
  ricorrenti: { g: 0, da: "09:00", a: "10:00", nome: "", luogo: "Casa" },
  finestre: { g: 0, da: "18:00", a: "19:00", nome: "", tipo: "persone" },
  luoghi: { nome: "", min: 20 },
  tragitti: { da: "Casa", a: "Casa", min: 15 },
};

// =========================================================
// GUIDA e «?»
// =========================================================
const GUIDE = {
  oggi: ["Oggi", "Il piano della domenica, giorno per giorno. Non devi compilare niente.",
    ["<b>La tua giornata</b>: in grande quello che fai adesso; sopra, piccole, le cose già fatte; sotto, quelle che verranno, con gli spostamenti.",
      "<b>Tocca un'attività</b> per cambiarla: orari, giorno, luogo, colore, oppure toglierla. Se viene da Google Calendar, cambia anche lì. «Aggiungi un impegno» ne crea uno nuovo.",
      "<b>Azioni rapide</b>: tocca il loro blocco per aprire la lista e spuntarle.",
      "<b>Sasso grande</b>: con «+1 fatto» segni un passo (es. una lezione recuperata).",
      "<b>Frecce</b> in alto: scorri i giorni. La sera, il rito dei 5 minuti: freccia avanti, guardi domani e aggiusti."]],
  settimana: ["Settimana", "A che punto sei con quello che hai scelto domenica.",
    ["<b>Card dei ruoli</b> (3-5): l'obiettivo nel riquadro bianco, il sasso grande (l'azione che ti porta lì) nel riquadro chiaro, sotto i promemoria.",
      "<b>Diario di bordo</b>: le note scritte sul momento con Cattura → Diario.",
      "<b>Lista del margine</b>: quello che hai lasciato fuori di proposito. Se avanza tempo, scegli da qui.",
      "<b>Azioni rapide</b>: tutte quelle sotto i 5 minuti, da fare nel loro blocco."]],
  pianifica: ["Pianifica la settimana", "La domenica, 30 minuti, 6 passi. Il mentore ti fa le domande; «Perché questo passo?» ti spiega il metodo.",
    ["<b>1 Guarda indietro</b>: il diario e il parcheggio.", "<b>2 Svuota e smista</b>: ogni cosa riceve il suo destino.", "<b>3 Paletti</b>: ciò su cui non hai scelta.",
      "<b>4 Ruoli e sassi grandi</b>: scegli 3-5 ruoli, per ognuno il sasso grande; il resto nel margine o nel parcheggio. Poi le persone.",
      "<b>5 Metti in agenda</b>: tocca un elemento, poi l'orario. Sotto vedi carico, sonno e stacchi.", "<b>6 Messaggi e calendario</b>: avvia, segna, fatto."]],
  persone: ["Persone", "Le persone che vuoi coltivare.",
    ["Scegli <b>ogni quanto</b> vuoi sentire ognuna: il pallino diventa giallo e poi rosso quando sei in ritardo.",
      "Dopo una chiamata o un incontro tocca <b>Sentito oggi</b>.", "Con il telefono salvato, il pulsante <b>WhatsApp</b> apre la chat.",
      "La domenica, al passo 4, scegli chi vedere questa settimana: Bussola prepara il messaggio."]],
  mesi: ["Mesi", "Il quadro dei prossimi mesi.",
    ["Tocca un giorno, o trascina su più giorni, per segnare un impegno.", "Se non è sicuro scrivi «da confermare» nel titolo.",
      "Quando pianifichi quella settimana, Bussola lo trova da sola e lo tratta come un paletto."]],
  metodo: ["Impostazioni", "Le regole della tua agenda: cambiano con te.",
    ["<b>I tuoi ruoli</b>: tutti, ognuno con la sua domanda bussola. Ogni domenica ne scegli 3-5.",
      "<b>Paletti fissi e finestre</b>: compaiono da soli in ogni pianificazione.", "<b>Luoghi, ritmo, regole</b>: servono al controllo di realtà."]],
};
const GUIDA = `<h2 class="H">Come funziona Bussola</h2>
  <p>Le cose entrano da <b>due porte</b> e le liste si riempiono <b>da sole</b>.</p>
  <ol class="pf-elenco">
    <li><b>Cattura</b>: durante la settimana butti dentro le cose come vengono (o scrivi nel diario). Senza decidere niente.</li>
    <li><b>Pianifica</b>: la domenica, 30 minuti, ogni cosa riceve il suo destino: <b>paletto</b> (ha giorno e ora), <b>azione rapida</b> (meno di 5 minuti), <b>sasso grande</b> di un ruolo, <b>margine</b> (se avanza tempo) o <b>parcheggio</b> (non ora).</li>
  </ol>
  <p><b>Oggi</b> e <b>Settimana</b> mostrano il risultato: non le devi compilare. Quando arriva qualcosa che non può aspettare domenica: <b>Imprevisto</b>.</p>
  <p class="pf-ritmo"><b>Il ritmo</b> · domenica 30' Pianifica · ogni mattina 1' Oggi · ogni sera 5' domani (freccia avanti in Oggi) · quando succede qualcosa 10" Cattura</p>`;

// =========================================================
// CATTURA (da fare / diario), IMPREVISTO, BLOCCO, AIUTO (fogli sopra tutto)
// =========================================================
function apriFoglio(tipo, dati = {}) { P.foglio = { tipo, ...dati }; disegnaFoglio(); }
function chiudiFoglio() { P.foglio = null; disegnaFoglio(); }
export function disegnaFoglio() {
  const f = $("#pf-foglio");
  if (!f) return;
  if (!P.foglio) { f.hidden = true; f.innerHTML = ""; return; }
  if (P.foglio.tipo === "blocco") return disegnaBlocco();
  f.hidden = false;
  if (P.foglio.tipo === "aiuto" || P.foglio.tipo === "guida") {
    const g = GUIDE[P.foglio.v];
    f.innerHTML = `<div class="velo" data-p="chiudi"></div><div class="foglio paper pf-guida">
      ${P.foglio.tipo === "guida" ? GUIDA : `<h2 class="H">${g[0]}</h2><p>${g[1]}</p><ul class="pf-elenco">${g[2].map(x => `<li>${x}</li>`).join("")}</ul>`}
      <div class="azioni">${P.foglio.tipo === "aiuto" ? btn("guida", "La guida completa", "btn", 'type="button"') : ""}<span class="spazio"></span>${btn("chiudi-guida", "Ho capito", "btn pieno H", 'type="button"')}</div></div>`;
    return;
  }
  if (P.foglio.tipo === "cattura") {
    const n = inbox().length, d = P.cattTab === "diario";
    f.innerHTML = `<div class="velo" data-p="chiudi"></div><form class="foglio paper pf-cattura" data-pf="cattura">
      <div class="schede H">${btn("catt-tab", "Da fare", d ? "" : "on", 'type="button" data-t="fare"')}${btn("catt-tab", "Diario", d ? "on" : "", 'type="button" data-t="diario"')}</div>
      ${d ? `<div class="tipi H">${C.NOTE.map(t => btn("d-tipo", t.nome, P.dTipo === t.k ? "on" : "", `type="button" data-t="${t.k}" style="--c:${t.c}"`)).join("")}</div>` : ""}
      <textarea name="t" rows="3" placeholder="${d ? "Cosa è successo? Una riga basta." : "Cosa hai in testa? Scrivi come viene: lo smisti domenica.&#10;Idea per un progetto? «Bussola: …» va nel suo raccoglitore."}"></textarea>
      <div class="azioni"><span class="sub">${d ? quando(Date.now()) : n ? `${n} ${n === 1 ? "cosa" : "cose"} da smistare domenica` : "Niente da smistare"}</span><span class="spazio"></span>
        ${btn("chiudi", "Chiudi", "btn", 'type="button"')}<button class="btn pieno H">${C.ico("piu")}${d ? "Scrivi nel diario" : "Butta dentro"}</button></div></form>`;
    setTimeout(() => f.querySelector("textarea")?.focus(), 30);
    return;
  }
  const s = P.foglio;
  const sc = (k, opz) => `<div class="scelte">${opz.map(([v, t]) => btn("imp", t, s[k] === v ? "on" : "", `data-k="${k}" data-v="${v}" type="button"`)).join("")}</div>`;
  const prop = s.testo && s.entro && s.conta && s.tempo ? propostaImprevisto(s) : null;
  f.innerHTML = `<div class="velo" data-p="chiudi"></div><div class="foglio paper pf-imp">
    <div><span class="ribbon H" style="--c:#D9442B">Imprevisto</span></div>
    <input class="campo" data-pv="imp-testo" value="${C.esc(s.testo || "")}" placeholder="Cosa è successo? Es. il prof anticipa il compito">
    <div><div class="pf-q">Entro quando va fatto?</div>${sc("entro", [["oggi", "Oggi"], ["3", "Entro 3 giorni"], ["sett", "Questa settimana"], ["aspetta", "Può aspettare"]])}</div>
    <div><div class="pf-q">Quanto conta? (ti avvicina a chi vuoi essere)</div>${sc("conta", [["tanto", "Tanto"], ["medio", "Così così"], ["poco", "Poco"]])}</div>
    <div><div class="pf-q">Quanto tempo serve?</div>${sc("tempo", [["15", "15'"], ["60", "1 ora"], ["180", "3 ore"], ["300", "Di più"]])}</div>
    ${prop ? `<div class="proposta ${prop.tipo}"><b class="H">${C.esc(prop.titolo)}</b><p>${prop.testo}</p></div>` : ""}
    <div class="azioni">${btn("chiudi", "Annulla", "btn", 'type="button"')}${prop ? btn("imp-applica", C.esc(prop.bottone), "btn pieno H", 'type="button"') : ""}</div></div>`;
}
/** cerca il posto per l'imprevisto: prima il margine, poi uno spazio libero, poi cosa si può spostare */
function propostaImprevisto(s) {
  if (s.entro === "aspetta") return { tipo: "parch", titolo: "Va nel parcheggio", testo: "Può aspettare: la riprendi domenica, quando pianifichi. Adesso non ci pensi più.", bottone: "Metti nel parcheggio", azione: { tipo: "parch" } };
  const min = Number(s.tempo);
  if (s.conta === "poco" && min <= 15) return { tipo: "msg", titolo: "Azione rapida", testo: "Conta poco e dura poco: va nel blocco messaggi e azioni rapide, la fai insieme alle altre.", bottone: "Aggiungi alle azioni rapide", azione: { tipo: "msg" } };
  if (s.conta === "poco") return { tipo: "parch", titolo: "Delega o parcheggio", testo: "È urgente ma conta poco: chi può farla al posto tuo? Se nessuno, mettila nel parcheggio o falla in 15 minuti.", bottone: "Metti nel parcheggio", azione: { tipo: "parch" } };
  const sett = C.lunediDi(new Date()), p = piano(sett);
  if (!p) return { tipo: "msg", titolo: "Nella To-do di questa settimana", testo: "Questa settimana non è stata pianificata con Bussola: la metto nella To-do, così non la perdi.", bottone: "Aggiungi alla To-do", azione: { tipo: "todo" } };
  const oggiG = C.giorniTra(sett, C.oggi()), ultimo = s.entro === "oggi" ? oggiG : s.entro === "3" ? Math.min(6, oggiG + 2) : 6, m = metodo(), st = Number(m.stacco || 10);
  const adesso = new Date().getHours() * 60 + new Date().getMinutes();
  // 1. il margine
  const mar = p.blocchi.filter(b => b.tipo === "margine" && b.g >= oggiG && b.g <= ultimo && !(b.g === oggiG && hm(b.da) < adesso)).sort((a, b) => a.g - b.g || hm(a.da) - hm(b.da));
  const usa = mar.find(b => durata(b) >= Math.min(min, 120)) || mar[0];
  if (usa) return { tipo: "ok", titolo: "Fai subito · prendo il margine", testo: `<b>${GIORNI_L[usa.g]} ${usa.da}-${fmt(hm(usa.da) + Math.min(min, durata(usa)))}</b> → al posto del margine (era lì apposta).${min > durata(usa) ? ` Il resto (${oreTxt(min - durata(usa))}) lo trovi nel prossimo spazio libero.` : ""} Le persone e l'allenamento non si toccano.`, bottone: "Aggiorna la settimana", azione: { tipo: "slot", g: usa.g, da: hm(usa.da), min: Math.min(min, durata(usa)), sostituisce: usa.id } };
  // 2. uno spazio libero tra le 8 e le 21
  for (let g = oggiG; g <= ultimo; g++) {
    const B = p.blocchi.filter(b => b.g === g && !b.tuttoIlGiorno && b.sotto !== "persone").sort((a, b) => hm(a.da) - hm(b.da));
    let t = Math.max(8 * 60, g === oggiG ? Math.ceil((adesso + 15) / 15) * 15 : 0);
    for (const b of [...B, { da: "21:00", a: "21:00" }]) {
      if (hm(b.da) - st - t >= min) return { tipo: "ok", titolo: "Fai subito · c'è spazio", testo: `<b>${GIORNI_L[g]} ${fmt(t)}-${fmt(t + min)}</b> è libero, con lo stacco prima e dopo. Non devi spostare niente.`, bottone: "Aggiorna la settimana", azione: { tipo: "slot", g, da: t, min } };
      t = Math.max(t, fine(b) + st);
    }
  }
  // 3. cosa si può spostare (mai persone, allenamento, paletti fissi)
  const spostabili = p.blocchi.filter(b => ["altro", "sasso", "messaggi"].includes(b.tipo) && b.g >= oggiG && b.g <= ultimo).sort((a, b) => (a.tipo === "sasso") - (b.tipo === "sasso") || a.g - b.g);
  if (spostabili.length) { const b = spostabili[0]; return { tipo: "scelta", titolo: "La settimana è piena: cosa lasci andare?", testo: `Propongo <b>${C.esc(b.titolo)}</b> (${GIORNI_L[b.g]} ${b.da}): lo sposto nel parcheggio e il suo posto va all'imprevisto. Le persone e l'allenamento non si toccano.`, bottone: `Sposta «${b.titolo}»`, azione: { tipo: "slot", g: b.g, da: hm(b.da), min: Math.min(min, durata(b)), sostituisce: b.id, parcheggia: b.titolo } }; }
  return { tipo: "parch", titolo: "Non c'è posto senza togliere persone o allenamento", testo: "Decidi tu cosa lasciare: è una scelta, non un fallimento. Intanto la metto nella To-do.", bottone: "Aggiungi alla To-do", azione: { tipo: "todo" } };
}

function applicaImprevisto() {
  const s = P.foglio, prop = propostaImprevisto(s), a = prop.azione, testo = s.testo.trim(), sett = C.lunediDi(new Date());
  if (a.tipo === "parch") C.D.scrivi("voce:" + nid(), { ...leggiRacc(testo), ...datiParch(), fatto: false, creato: Date.now() });
  else if (a.tipo === "todo" || a.tipo === "msg") nuovaAzione(testo, {}, sett);
  else {
    const nuovo = { id: nid(), g: a.g, da: fmt(a.da), a: fmt(a.da + a.min), titolo: testo, tipo: "imprevisto", luogo: "Casa", fonte: "imprevisto" };
    const vecchio = a.sostituisce && piano(sett).blocchi.find(b => b.id === a.sostituisce);
    modPiano(p => {
      if (a.sostituisce) p.blocchi = p.blocchi.filter(b => b.id !== a.sostituisce);
      p.blocchi.push(nuovo);
    }, sett);
    if (G.collegato()) {
      if (vecchio?.gcalId && scrivibile(vecchio)) G.elimina(vecchio.gcalId, vecchio.calId || "primary");
      mandaBlocco(nuovo, sett).then(() => C.avvisa("Fatto: aggiornato anche Google Calendar", true)).catch(() => C.avvisa("Non sono riuscito a scriverlo in Calendar"));
    }
    if (a.parcheggia) C.D.scrivi("voce:" + nid(), { testo: a.parcheggia, ...datiParch(), fatto: false, creato: Date.now() });
  }
  chiudiFoglio();
  if (!G.collegato()) C.avvisa(prop.tipo === "ok" || prop.tipo === "scelta" ? "Settimana aggiornata: ricordati di spostarlo anche in Google Calendar" : "Fatto", true);
  else if (!(prop.tipo === "ok" || prop.tipo === "scelta")) C.avvisa("Fatto", true);
  C.disegna();
}

// =========================================================
// TOCCHI
// =========================================================
/** settimana pianificata → la schermata Settimana si apre in griglia */
function settimanaInGriglia() { C.S.modoSett = "griglia"; C.ricorda("bussola.modoSett", "griglia"); }
function passaA(n) {
  modPiano(p => { p.passo = Math.max(0, Math.min(5, n)); });
  P.q = 0; P.scelta = null; P.sel = null; P.perche = false;
  C.disegna(); $("main")?.scrollTo(0, 0);
}
function cambiaVoce(id, nuovo) { const v = C.D.leggi("voce:" + id); if (!v) return; C.D.scrivi("voce:" + id, nuovo === null ? null : { ...v, ...nuovo }); P.q = 0; P.scelta = null; }
function destino(id, d) {
  const v = C.D.leggi("voce:" + id);
  if (!v) return;
  if (d === "sasso") cambiaVoce(id, { sasso: true, check: true, ore: v.ore || 2 });
  else if (d === "punto") cambiaVoce(id, { sasso: false });
  else if (d === "margine") { cambiaVoce(id, { tipo: "margine", settimana: P.sett, sasso: false }); C.avvisa("Nella lista del margine", true); }
  else if (d === "parcheggio") { const r = C.D.leggi("ruolo:" + v.ruolo); cambiaVoce(id, { ...datiParch(C.piuGiorni(P.sett, 7)), racc: v.racc || r?.nome }); C.avvisa("Nel parcheggio: torna tra una settimana", true); }
  else if (d === "torna") {   // dal margine torna a un ruolo come sasso grande
    const R = C.ruoli(P.sett), r = R.find(x => x.id === v.ruolo) || R[0];
    if (r) cambiaVoce(id, { tipo: "ruolo", ruolo: r.id, settimana: P.sett, sasso: true, check: true, ore: v.ore || 2 });
  }
}

// ---------- trascinare nella griglia di Settimana (come in Google Calendar) ----------
// col mouse: trascini subito; col dito: tieni premuto un attimo, poi trascini (così lo scorrimento resta normale).
// Il bordo in basso (.gs-maniglia) cambia la fine. Al rilascio salva con salvaBlocco (piano e/o Google Calendar).
let GS = null, GS_ultimo = 0;
const GS_Q = GS_PX / 4;   // un quarto d'ora in pixel
document.addEventListener("pointerdown", e => {
  const el = e.target.closest(".gs-bl[data-id], .gs-posto[data-id]");
  if (!el || e.button > 0) return;
  GS = { el, id: el.dataset.id, x0: e.clientX, y0: e.clientY, fine: !!e.target.closest(".gs-maniglia"), touch: e.pointerType !== "mouse", attivo: false, top0: el.offsetTop, h0: el.offsetHeight };
  if (GS.touch) GS.timer = setTimeout(() => { if (GS) { GS.attivo = true; el.classList.add("trascina"); navigator.vibrate?.(15); } }, 380);
});
document.addEventListener("pointermove", e => {
  if (!GS) return;
  const dx = e.clientX - GS.x0, dy = e.clientY - GS.y0;
  if (!GS.attivo) {
    if (GS.touch) { if (Math.hypot(dx, dy) > 8) { clearTimeout(GS.timer); GS = null; } return; }   // stava scorrendo
    if (Math.hypot(dx, dy) < 5) return;
    GS.attivo = true; GS.el.classList.add("trascina");
  }
  if (GS.fine) { GS.el.style.height = Math.max(GS_Q, Math.round((GS.h0 + 2 + dy) / GS_Q) * GS_Q - 2) + "px"; return; }
  const col = GS.el.parentElement, maxTop = col.offsetHeight - GS.el.offsetHeight;
  GS.el.style.top = Math.max(0, Math.min(maxTop, Math.round((GS.top0 + dy) / GS_Q) * GS_Q)) + "px";
  const sotto = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains("gs-col"));
  if (sotto && sotto !== col) sotto.appendChild(GS.el);
  const da = GS_H0 * 60 + Math.round(GS.el.offsetTop / GS_PX * 60);
  GS.el.querySelector("span")?.replaceChildren(fmt(da));
});
document.addEventListener("touchmove", e => { if (GS?.attivo) e.preventDefault(); }, { passive: false });   // mentre trascini la pagina non scorre
document.addEventListener("pointerup", () => {
  if (!GS) return;
  clearTimeout(GS.timer);
  const g = GS, b = P.gsBlocchi?.get(g.id);
  GS = null;
  if (!g.attivo || !b) return;
  GS_ultimo = Date.now();
  const da = GS_H0 * 60 + Math.round(g.el.offsetTop / GS_PX * 60 / 15) * 15;
  const dur = Math.max(15, Math.round((g.el.offsetHeight + 2) / GS_PX * 60 / 15) * 15);
  const nuovi = { g: Number(g.el.parentElement.dataset.g), da: fmt(da), a: fmt(Math.min(da + dur, 24 * 60 - 1)) };
  if (nuovi.g === b.g && nuovi.da === b.da && nuovi.a === b.a) return C.disegna();
  if (!salvaBlocco(P.gsSett, b, x => Object.assign(x, nuovi))) return C.disegna();   // non si può: torna al suo posto
  C.disegna();
});
document.addEventListener("pointercancel", () => { if (GS) { clearTimeout(GS.timer); GS = null; C.disegna(); } });

document.addEventListener("click", e => {
  const el = e.target.closest("[data-p]");
  if (!el) return;
  const a = el.dataset.p, d = el.dataset;
  if (el.tagName === "A") return;
  switch (a) {
    case "og-blocco": {   // tocco su un'attività di Oggi: la modifichi (orari, giorno, luogo, colore, togli)
      if (e.target.closest(".ck, .chip")) break;
      const b = P.ogBlocchi?.get(d.id);
      if (b) apriFoglio("blocco", { id: b.id, b: { ...b }, sett: P.ogSett });
      break;
    }
    case "gs-blocco": {   // griglia di Settimana: tocco su un impegno = lo modifichi
      if (GS_ultimo && Date.now() - GS_ultimo < 400) break;   // era la fine di un trascinamento
      const b = P.gsBlocchi?.get(d.id);
      if (b) apriFoglio("blocco", { id: b.id, b: { ...b }, sett: P.gsSett });
      break;
    }
    case "gs-nuovo": {   // tocco su uno spazio vuoto = nuovo impegno a quell'ora (al quarto d'ora)
      if (GS_ultimo && Date.now() - GS_ultimo < 400) break;
      const r = el.getBoundingClientRect(), min = GS_H0 * 60 + Math.floor((e.clientY - r.top) / GS_PX * 4) * 15;
      const da = fmt(Math.min(min, 22 * 60 + 45)), a = fmt(Math.min(min + 60, 23 * 60 + 59));
      apriFoglio("blocco", { id: nid(), nuovo: true, sett: P.gsSett, b: { id: "", g: Number(d.g), da, a, titolo: "", tipo: "altro", luogo: "Casa", fonte: "manuale" } });
      P.foglio.b.id = P.foglio.id; disegnaFoglio(); break;
    }
    case "og-nuovo": {
      const ora = new Date(), h = (P.og || 0) ? 9 : Math.min(22, ora.getHours() + 1), da = `${String(h).padStart(2, "0")}:00`;
      apriFoglio("blocco", { id: nid(), nuovo: true, sett: P.ogSett, b: { id: "", g: P.ogG, da, a: `${String(h + 1).padStart(2, "0")}:00`, titolo: "", tipo: "altro", luogo: "Casa", fonte: "manuale" } });
      P.foglio.b.id = P.foglio.id; disegnaFoglio(); break;
    }
    case "msg-apri": P.msgAperto = P.msgAperto === d.id ? null : d.id; C.disegna(); break;
    case "pill": P.pill.has(d.k) ? P.pill.delete(d.k) : P.pill.add(d.k); C.disegna(); break;
    case "og-altro": P.eroe = (P.eroe || 0) + 1; C.disegna(); break;
    case "viaggio": {   // «ci hai messo di più?» → Bussola corregge le stime verso quel luogo
      const q = P.viaggioChiesto; if (!q) break;
      try { const c = JSON.parse(localStorage.getItem("bussola.viaggiChiesti") || "{}"); c[q.k] = 1; localStorage.setItem("bussola.viaggiChiesti", JSON.stringify(c)); } catch { /* niente */ }
      const f = Number(d.v);
      if (f !== 1) { const corr = { ...(metodo().correzioni || {}) }; corr[q.luogo] = Math.min(1.6, Math.max(0.7, (Number(corr[q.luogo]) || 1) * f)); salvaMetodo({ correzioni: corr }); }
      C.avvisa(f === 1 ? "Bene, tengo così" : f < 1 ? `Ok: per ${q.luogo} calcolo un po' meno` : `Ok: per ${q.luogo} calcolo un po' di più`, f !== 1, "spunta");
      C.disegna(); break;
    }
    case "og": P.og = d.d === "0" ? 0 : (P.og || 0) + Number(d.d); P.aperto = null; C.disegna(); break;
    case "sett": P.sett = C.piuGiorni(P.sett, Number(d.d)); P.sel = null; P.rivedi = false; C.disegna(); break;
    case "inizia": el.disabled = true; el.textContent = "Leggo i tuoi calendari…"; iniziaPiano().then(() => C.disegna()); break;
    case "g-collega": G.collega(C.D.chiSei()?.email || ""); break;
    case "g-scollega": G.scollega({ ovunque: true }); C.avvisa("Google Calendar scollegato"); C.disegna(); break;
    case "g-aggiorna": aggiornaDaGoogle(); C.disegna(); break;
    case "g-manda": {
      el.disabled = true; el.textContent = "Mando…";
      (async () => {
        let ok = 0;
        for (const b of nuoviBlocchi(piano()).filter(b => !b.gcalId)) { try { await mandaBlocco(b); ok++; } catch (err) { if (err.message === "scollegato") break; } }
        C.avvisa(ok ? `${ok} ${ok === 1 ? "blocco mandato" : "blocchi mandati"} in Google Calendar` : "Non sono riuscito a scrivere in Calendar: ricollegalo", false, ok ? "spunta" : "");
        C.disegna();
      })();
      break;
    }
    case "luogo-agg": { const m = metodo(); salvaMetodo({ luoghi: [...m.luoghi, { nome: d.n, min: 20, alias: "" }] }); G.dimentica(C.lunediDi(new Date())); C.avvisa(`«${d.n}» aggiunto: controlla i minuti da casa`, true); C.disegna(); break; }
    case "g-usa": { const c = { ...(metodo().calendari || {}) }, cal = (G.calendariNoti() || []).find(x => x.id === d.id); c[d.id] = { ...(c[d.id] || {}), usa: cal ? calendarioEscluso(cal) : c[d.id]?.usa === false }; salvaMetodo({ calendari: c }); G.dimentica(C.lunediDi(new Date())); C.disegna(); break; }
    case "passo": P.rivedi = true; passaA(Number(d.n)); break;
    case "finito": modPiano(p => { p.finito = true; }); P.rivedi = false; settimanaInGriglia(); C.avvisa("Settimana pronta. Buona settimana!", false, "bersaglio"); C.disegna(); $("main")?.scrollTo(0, 0); break;
    case "pronta": P.rivedi = false; C.disegna(); $("main")?.scrollTo(0, 0); break;
    case "rivedi": P.rivedi = true; passaA(5); break;
    case "vai-settimana": settimanaInGriglia(); C.S.sett = P.sett; document.querySelector('[data-azione="vista"][data-v="settimana"]')?.click(); break;
    case "perche": P.perche = !P.perche; C.disegna(); break;
    case "via-voce": cambiaVoce(d.id, null); C.avvisa("Eliminato", true); C.disegna(); break;
    case "riprendi-parch": cambiaVoce(d.id, { tipo: "inbox", creato: Date.now(), ritorna: null }); C.disegna(); break;
    case "piu-avanti": { const v = C.D.leggi("voce:" + d.id), dopo = C.piuGiorni(P.sett, 7 * Number(d.sett)); C.D.scrivi("voce:" + d.id, { ...v, ritorna: dopo }); C.avvisa(`Torna il ${dataCorta(dopo)}`, true); C.disegna(); break; }
    // diario → azione / regola
    case "da-nota": { const n = C.D.leggi("nota:" + d.id); C.D.scrivi("voce:" + nid(), { testo: n.testo, tipo: "inbox", fatto: false, creato: Date.now() }); C.D.scrivi("nota:" + d.id, { ...n, fatta: "→ da smistare" }); C.avvisa("Diventa un'azione: la smisti al passo 2", true); C.disegna(); break; }
    case "a-regola": { const n = C.D.leggi("nota:" + d.id); salvaMetodo({ regole: [...(metodo().regole || []), n.testo] }); C.D.scrivi("nota:" + d.id, { ...n, fatta: "→ regola" }); C.avvisa("Aggiunta alle tue regole", true); C.disegna(); break; }
    case "via-regola": { const L = [...(metodo().regole || [])]; L.splice(Number(d.i), 1); salvaMetodo({ regole: L }); C.disegna(); break; }
    // smistare
    case "si": {
      const v = inbox()[0];
      if (P.q === 0) P.scelta = "paletto";
      else if (P.q === 1) { nuovaAzione(v.testo); cambiaVoce(v.id, null); }
      else P.scelta = "ruolo";
      C.disegna(); break;
    }
    case "no": {
      if (P.q < 2) P.q++;
      else { cambiaVoce(inbox()[0].id, datiParch(C.piuGiorni(P.sett, 7))); C.avvisa("Nel parcheggio: torna tra una settimana", true); }
      C.disegna(); break;
    }
    case "scelta": P.scelta = d.s || null; if (!d.s) P.q = 0; C.disegna(); break;
    case "a-azione": { const v = C.D.leggi("voce:" + d.id); nuovaAzione(v.testo); cambiaVoce(d.id, null); C.disegna(); break; }
    case "a-margine": cambiaVoce(d.id, { tipo: "margine", settimana: P.sett }); C.disegna(); break;
    case "a-parch": cambiaVoce(d.id, datiParch(C.piuGiorni(P.sett, 7))); C.avvisa("Nel parcheggio: torna tra una settimana", true); C.disegna(); break;
    case "a-ruolo": {
      const rid = istanzaRuolo(d.r);
      cambiaVoce(d.id, { tipo: "ruolo", ruolo: rid, settimana: P.sett, ordine: 999, padre: null });
      C.disegna(); break;
    }
    // ruoli e sassi grandi
    case "scegli-ruolo": {
      const R = C.ruoli(P.sett), ist = R.find(x => x.nome.toLowerCase() === d.r.toLowerCase());
      if (!ist) istanzaRuolo(d.r);
      else {   // il ruolo torna a dormire: le sue cose vanno nel parcheggio, nel suo raccoglitore
        C.voci().filter(v => v.tipo === "ruolo" && v.ruolo === ist.id).forEach(v => C.D.scrivi("voce:" + v.id, { ...C.D.leggi("voce:" + v.id), ...datiParch(C.piuGiorni(P.sett, 7)), racc: ist.nome }));
        C.D.scrivi("ruolo:" + ist.id, null);
        C.avvisa(`${ist.nome} dorme questa settimana`, true);
      }
      C.disegna(); break;
    }
    case "dest": destino(d.id, d.d); C.disegna(); break;
    // paletti e blocchi
    case "via-blocco": modPiano(p => { p.blocchi = p.blocchi.filter(b => b.id !== d.id); }); C.disegna(); break;
    // persone
    case "suggerite": PERSONE_SUGGERITE.forEach(n => C.D.scrivi("persona:" + nid(), { nome: n, ogni: n.startsWith("Mamma") ? 7 : 14, ultimo: null, tel: "", note: "" })); C.disegna(); break;
    case "sentito": { const pe = C.D.leggi("persona:" + d.id); C.D.scrivi("persona:" + d.id, { ...pe, ultimo: C.oggi() }); C.avvisa(`${pe.nome}: sentito oggi`, true, "spunta"); C.disegna(); break; }
    case "via-persona": C.D.scrivi("persona:" + d.id, null); C.avvisa("Persona eliminata", true); C.disegna(); break;
    case "scegli-persona": {
      modPiano(p => {
        const i = p.persone.findIndex(x => x.id === d.id);
        if (i >= 0) { p.persone.splice(i, 1); p.blocchi = p.blocchi.filter(b => b.fonte !== "persona:" + d.id); }
        else p.persone.push({ id: d.id, motivo: "" });
      });
      if (!piano().persone.some(x => x.id === d.id)) C.voci().filter(v => v.persona === d.id && v.auto && v.settimana === P.sett).forEach(v => C.D.scrivi("voce:" + v.id, null));
      C.disegna(); break;
    }
    case "motivo": modPiano(p => { const x = p.persone.find(x => x.id === d.id); if (x) x.motivo = x.motivo === d.m ? "" : d.m; }); C.disegna(); break;
    case "rimando": {
      const pe = C.D.leggi("persona:" + d.id), m = metodo(), nx = C.piuGiorni(P.sett, 7);
      const fin = m.finestre.filter(f => f.tipo === "persone"), d1 = fin[0], d2 = fin[1] || fin[0];
      const data = f => f ? `${GIORNI_L[f.g]} ${Number(C.piuGiorni(nx, f.g).slice(8))} (${f.da})` : "";
      nuovaAzione(`Scrivere a ${pe.nome}`, { persona: d.id, msg: MSG.rimando.replace("{nome}", pe.nome).replace("{data1}", data(d1)).replace("{data2}", data(d2)) });
      C.avvisa(`Messaggio per ${pe.nome} pronto al passo 6`, true); C.disegna(); break;
    }
    // agenda
    case "seleziona": P.sel = P.sel?.k === d.k ? null : { k: d.k, min: Number(d.min), t: d.t }; C.disegna(); break;
    case "col": {
      if (!P.sel) break;
      const r = el.getBoundingClientRect(), min = Math.round(((e.clientY - r.top) / PXH * 60 + ORA0 * 60) / 15) * 15;
      const g = Number(d.g), sel = P.sel;
      modPiano(p => {
        const b = { id: nid(), g, da: fmt(min), a: fmt(min + sel.min), titolo: sel.t, luogo: "Casa" };
        if (sel.k.startsWith("sasso:")) { const v = C.D.leggi("voce:" + sel.k.slice(6)); Object.assign(b, { tipo: "sasso", fonte: "voce:" + sel.k.slice(6), ruolo: v?.ruolo }); }
        else if (sel.k.startsWith("persona:")) { Object.assign(b, { tipo: "persona", fonte: sel.k }); const x = p.persone.find(x => "persona:" + x.id === sel.k); if (x) x.posto = true; }
        else Object.assign(b, { tipo: sel.k, fonte: sel.k });
        p.blocchi.push(b);
      });
      P.sel = null; C.disegna(); break;
    }
    case "blocco": {
      if (P.sel) { el.parentElement.dispatchEvent(new MouseEvent("click", { bubbles: true, clientY: e.clientY })); break; }
      apriFoglio("blocco", { id: d.id }); break;
    }
    case "vai-agenda": $("main")?.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "apri-blocco": if (e.target.closest(".ck")) break; P.aperto = P.aperto === d.id ? null : d.id; C.disegna(); break;
    // messaggi
    case "copia": { const x = C.D.leggi("voce:" + d.id); navigator.clipboard?.writeText(x.msg || x.testo).then(() => C.avvisa("Copiato")); break; }
    case "ics": scaricaIcs(); break;
    // impostazioni
    case "m-colore": { const m = JSON.parse(JSON.stringify(metodo())); setPath(m, d.path, d.c); salvaMetodo({ ruoli: m.ruoli }); C.disegna(); break; }
    case "m-via": { const m = metodo(), L = [...m[d.lista]]; L.splice(Number(d.i), 1); salvaMetodo({ [d.lista]: L }); C.avvisa("Tolto", true); C.disegna(); break; }
    case "m-agg": { const m = metodo(), usati = new Set(m.ruoli.map(r => r.colore)); const nuovo = { ...NUOVI[d.lista] }; if (d.lista === "ruoli") nuovo.colore = (C.COLORI.find(c => !usati.has(c.k)) || C.COLORI[0]).k; salvaMetodo({ [d.lista]: [...m[d.lista], nuovo] }); C.disegna(); break; }
    case "m-reset": if (el.dataset.sicuro) { const r = metodo().ruoli; C.D.scrivi("metodo", { ruoli: r }); C.avvisa("Impostazioni di partenza ripristinate (i ruoli restano)", true); C.disegna(); } else { el.dataset.sicuro = "1"; el.textContent = "Tocca di nuovo per confermare"; } break;
    // fogli
    case "cattura": P.cattTab = "fare"; apriFoglio("cattura"); break;
    case "diario": P.cattTab = "diario"; apriFoglio("cattura"); break;
    case "catt-tab": P.cattTab = d.t; disegnaFoglio(); break;
    case "d-tipo": { const t = $("#pf-foglio textarea")?.value; P.dTipo = d.t; disegnaFoglio(); const ta = $("#pf-foglio textarea"); if (ta && t) ta.value = t; break; }
    case "imprevisto": apriFoglio("imprevisto"); break;
    case "aiuto": apriFoglio("aiuto", { v: d.v }); break;
    case "guida": apriFoglio("guida"); break;
    case "chiudi-guida": try { localStorage.setItem("bussola.guida", "1"); } catch { /* niente */ } chiudiFoglio(); break;
    case "chiudi": chiudiFoglio(); break;
    case "imp": P.foglio[d.k] = d.v; disegnaFoglio(); break;
    case "imp-applica": applicaImprevisto(); break;
    case "blocco-via": {
      const sett = P.foglio.sett || P.sett, bb = bloccoFoglio();
      if (bb?.fonte === "gcal" && bb.gcalId) {   // evento nato in Calendar: lo tolgo da Calendar solo se lo confermi
        if (!G.collegato() || !scrivibile(bb)) { C.avvisa("Questo è in un calendario che Bussola non può cambiare: toglilo da Google Calendar"); break; }
        if (!confirm(`Eliminare «${bb.titolo}» anche da Google Calendar?`)) break;
        G.elimina(bb.gcalId, bb.calId || "primary").then(() => C.disegna());
        if (piano(sett)) modPiano(p => { p.blocchi = p.blocchi.filter(x => x.gcalId !== bb.gcalId); }, sett);
        chiudiFoglio(); C.disegna(); break;
      }
      if (bb?.gcalId && G.collegato()) G.elimina(bb.gcalId, bb.calId || "primary");
      if (!piano(sett)) { chiudiFoglio(); C.disegna(); break; }
    }
      modPiano(p => { const b = p.blocchi.find(b => b.id === P.foglio.id); p.blocchi = p.blocchi.filter(x => x.id !== P.foglio.id); if (b?.fonte?.startsWith("persona:")) { const x = p.persone.find(x => "persona:" + x.id === b.fonte); if (x) x.posto = false; } }, P.foglio.sett || P.sett); chiudiFoglio(); C.disegna(); break;
  }
});

/** salva le modifiche a un blocco (dal foglio o trascinandolo nella griglia), ovunque viva:
    nel piano della settimana (stesso id o stesso evento di Google) e/o in Google Calendar.
    cambia(b) applica le modifiche. Ritorna false se non si può (calendario che Bussola può solo leggere). */
/** toglie dal piano (e da Google Calendar) i blocchi nati da una cosa di Bussola, es. un'uscita ("uscita:<id>") */
function togliDaFonte(sett, fonte) {
  const p = piano(sett);
  if (!p) return;
  p.blocchi.filter(b => b.fonte === fonte && b.gcalId).forEach(b => G.elimina(b.gcalId, b.calId || "primary").catch(() => C.avvisa("Non sono riuscito a toglierla da Calendar")));
  modPiano(p => { p.blocchi = p.blocchi.filter(b => b.fonte !== fonte); }, sett);
}
function salvaBlocco(sett, orig, cambia, { nuovo = false, id = orig?.id, colore = null } = {}) {
  if (nuovo) {   // impegno nuovo: nel piano e, se collegato, in Google Calendar
    if (!piano(sett)) salvaPiano(pianoMinimo(sett), sett);
    const b = { ...orig }; cambia(b);
    modPiano(p => p.blocchi.push(b), sett);
    if (G.collegato()) mandaBlocco(b, sett).then(() => { C.avvisa("Messo anche in Google Calendar"); C.disegna(); }).catch(() => C.avvisa("Non sono riuscito a metterlo in Calendar"));
    return true;
  }
  const daGoogle = orig?.gcalId && orig.fonte === "gcal";
  if (daGoogle && !colore && !(G.collegato() && scrivibile(orig))) {
    C.avvisa(`«${orig.cal || "Questo calendario"}»: Bussola può solo leggerlo. Spostalo in Google Calendar.`);
    return false;
  }
  if (!orig?.gcalId && !piano(sett)) salvaPiano(pianoMinimo(sett), sett);   // una finestra di una settimana non pianificata
  // nel piano c'è lo stesso blocco (stesso id, o lo stesso evento di Google)? Allora aggiorno quello
  const nelPiano = piano(sett)?.blocchi.find(b => b.id === id || (orig?.gcalId && b.gcalId === orig.gcalId));
  const n = nelPiano ? modPiano(p => cambia(p.blocchi.find(b => b.id === nelPiano.id)), sett).blocchi.find(b => b.id === nelPiano.id) : (() => { const b = { ...orig }; cambia(b); return b; })();
  // colore di un evento nato in Calendar: lo ricordo solo in Bussola (sopravvive quando rileggo Calendar)
  if (colore && n?.fonte === "gcal" && n.gcalId) C.D.scrivi("coloriEventi", { ...coloriLocali(), [n.gcalId]: colore });
  if (n?.gcalId && G.collegato() && scrivibile(n))
    // il luogo va a Google solo se l'hai cambiato tu: quello che Bussola deduce (es. «Corso» per Genio) non deve finire in Calendar
    G.aggiornaCampi(n.gcalId, { titolo: n.titolo, giorno: giornoDi(n, sett), da: n.da, a: n.a, luogo: (n.luogo || "") !== (orig?.luogo || "") ? n.luogo : undefined,
      avviso: n.fonte !== "gcal" && tragitto("Casa", n.luogo, { g: n.g, min: hm(n.da) }) ? tragitto("Casa", n.luogo, { g: n.g, min: hm(n.da) }) + 5 : undefined }, n.calId || "primary")
      .then(() => { C.avvisa("Aggiornato anche in Google Calendar"); C.disegna(); }).catch(() => { C.avvisa("Non sono riuscito ad aggiornare Calendar"); C.disegna(); });
  return true;
}
/** il blocco del foglio: quello salvato nel piano, oppure (da Oggi) la copia presa da Google o un blocco nuovo */
const bloccoFoglio = () => { const sett = P.foglio.sett || P.sett; return piano(sett)?.blocchi.find(x => x.id === P.foglio.id) || P.foglio.b; };
function disegnaBlocco() {
  const f = $("#pf-foglio"), b = bloccoFoglio();
  if (!b) return chiudiFoglio();
  f.hidden = false;
  f.innerHTML = `<div class="velo" data-p="chiudi"></div><form class="foglio paper" data-pf="blocco">
    <div><span class="ribbon H" style="--c:${coloreTipo(b)}">${P.foglio.nuovo ? "Nuovo impegno" : b.tipo === "finestra" ? "Finestra" : "Blocco"}</span></div>
    <label class="pf-lab">Cosa<input name="titolo" value="${C.esc(b.titolo)}" ${P.foglio.nuovo ? 'placeholder="Es. chiamare Marco" autofocus' : ""}></label>
    ${b.cal && b.fonte === "gcal" ? `<p class="sub">Dal calendario «${C.esc(b.cal)}»${scrivibile(b) ? ": le modifiche vanno anche in Google Calendar." : ": Bussola può solo leggerlo. Orari, giorno e luogo cambiali in Google Calendar; qui puoi cambiare il colore."}</p>` : ""}
    <div class="pf-riga">${selGiorno("g", b.g)}<input type="time" name="da" value="${b.da}"><span>→</span><input type="time" name="a" value="${b.a}"></div>
    <div class="pf-riga">${selLuogo("luogo", b.luogo ?? "Casa", true)}<label class="pf-check"><input type="checkbox" name="prov" ${b.provvisorio ? "checked" : ""}> da confermare</label></div>
    ${b.luogoG && !luogoDaTesto(b.luogoG) ? `<p class="sub">In Google Calendar il luogo è «${C.esc(b.luogoG)}»: aggiungilo ai tuoi luoghi (Impostazioni) per riconoscerlo.</p>` : ""}
    <p class="sub">Colore in Bussola (stessa tavolozza di Calendar). ${b.gcalId ? "Cambiarlo qui non cambia Google Calendar." : "Quando lo mandi, Calendar prende lo stesso colore se Google lo permette."}</p>
    <div class="colori pf-colori">${COLORI_G.map(c => `<label style="--c:${c.c}" title="${c.nome}"><input type="radio" name="colore" value="${c.k}" ${coloreId(b) === c.k && !String(b.colore || "").startsWith("#") ? "checked" : ""}><i></i></label>`).join("")}</div>
    <div class="azioni">${P.foglio.nuovo ? "" : btn("blocco-via", "Togli", "btn rosso", 'type="button"')}<span class="spazio"></span>${btn("chiudi", "Annulla", "btn", 'type="button"')}<button class="btn pieno H">Salva</button></div></form>`;
}


document.addEventListener("submit", e => {
  const f = e.target, t = f.dataset.pf;
  if (!t) return;
  e.preventDefault();
  const v = Object.fromEntries(new FormData(f));
  if (t === "svuota" || (t === "cattura" && P.cattTab === "fare")) {
    const righe = String(v.t || "").split("\n").map(s => s.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
    righe.forEach((r, i) => C.D.scrivi("voce:" + nid(), { ...leggiRacc(r), tipo: "inbox", fatto: false, creato: Date.now() + i }));
    if (t === "cattura") { C.avvisa(righe.length ? "Catturato: lo smisti domenica" : "Scrivi qualcosa", false, "spunta"); disegnaFoglio(); C.disegna(); return; }
  } else if (t === "cattura") {   // diario di bordo
    const testo = String(v.t || "").trim();
    if (!testo) return;
    C.D.scrivi("nota:" + nid(), { settimana: C.lunediDi(new Date()), tipo: P.dTipo, testo, quando: Date.now() });
    C.avvisa("Scritto nel diario", false, "spunta"); disegnaFoglio(); C.disegna(); return;
  } else if (t === "paletto") {
    modPiano(p => p.blocchi.push({ id: nid(), g: Number(v.g), da: v.da, a: v.a, titolo: C.D.leggi("voce:" + f.dataset.id)?.testo || "", tipo: "paletto", luogo: v.luogo, fonte: "smista", provvisorio: !!v.prov }));
    cambiaVoce(f.dataset.id, null);
  } else if (t === "nuovo-paletto") {
    modPiano(p => p.blocchi.push({ id: nid(), g: Number(v.g), da: v.da, a: v.a, titolo: v.t.trim(), tipo: "paletto", luogo: v.luogo, fonte: "manuale", provvisorio: !!v.prov }));
  } else if (t === "nuovo-sasso") {
    if (!v.t.trim()) return;
    const r = C.D.leggi("ruolo:" + f.dataset.r);
    C.D.scrivi("voce:" + nid(), { testo: v.t.trim(), tipo: "ruolo", ruolo: f.dataset.r, settimana: r.settimana, fatto: false, ordine: 999 });
  } else if (t === "nuovo-margine") {
    if (!v.t.trim()) return;
    C.D.scrivi("voce:" + nid(), { testo: v.t.trim(), tipo: "margine", settimana: P.sett, fatto: false, ordine: 999 });
  } else if (t === "nuova-persona") {
    C.D.scrivi("persona:" + nid(), { nome: v.t.trim(), ogni: Number(v.ogni) || 14, ultimo: null, tel: "", note: "" });
  } else if (t === "blocco") {
    const sett = P.foglio.sett || P.sett;
    if (P.foglio.nuovo && !v.titolo.trim()) return;
    salvaBlocco(sett, bloccoFoglio(), b => { Object.assign(b, { titolo: v.titolo.trim() || b.titolo, g: Number(v.g), da: v.da, a: v.a, luogo: v.luogo, provvisorio: !!v.prov }, v.colore ? { colore: v.colore } : {}); if (v.luogo) b.luogoG = v.luogo; },
      { nuovo: P.foglio.nuovo, id: P.foglio.id, colore: v.colore });
    chiudiFoglio();
  }
  C.disegna();
});

document.addEventListener("change", e => {
  const t = e.target;
  if (t.dataset.gcal) {   // luogo di un calendario Google
    const c = { ...(metodo().calendari || {}) };
    c[t.dataset.gcal] = { ...(c[t.dataset.gcal] || {}), luogo: t.value || undefined };
    salvaMetodo({ calendari: c }); G.dimentica(C.lunediDi(new Date())); C.disegna();
    return;
  }
  if (t.dataset.pm) {   // impostazioni
    const m = JSON.parse(JSON.stringify(metodo()));
    let val = t.value;
    if (t.dataset.righe != null) val = val.split("\n").map(s => s.trim()).filter(Boolean);
    else if (t.type === "number" || t.dataset.num != null) val = Number(val);
    setPath(m, t.dataset.pm, val);
    const radice = t.dataset.pm.split(".")[0];
    salvaMetodo({ [radice]: m[radice] });
    if (/^luoghi\.\d+\.indirizzo$/.test(t.dataset.pm)) { aggiornaLuogo(Number(t.dataset.pm.split(".")[1])); return; }
    if (/^luoghi\.\d+\.nome$/.test(t.dataset.pm) && m.luoghi.some(l => l.lat != null)) V.durate(m.luoghi).then(D => { salvaMetodo({ durate: D }); C.disegna(); }).catch(() => {});
    if (t.tagName === "SELECT" || radice === "luoghi") C.disegna();
    return;
  }
  const k = t.dataset.pv;
  if (!k) return;
  const id = t.dataset.id;
  if (k === "misura" || k === "ore" || k === "cal") { const v = C.D.leggi("voce:" + id); C.D.scrivi("voce:" + id, { ...v, [k]: k === "ore" ? Number(t.value) || 1 : t.value.trim() }); C.disegna(); }
  else if (k === "msg") { const v = C.D.leggi("voce:" + id); C.D.scrivi("voce:" + id, { ...v, msg: t.value }); C.disegna(); }
  else if (k === "ogni" || k === "tel" || k === "note") { const pe = C.D.leggi("persona:" + id); C.D.scrivi("persona:" + id, { ...pe, [k]: k === "ogni" ? Number(t.value) : t.value.trim() }); if (k !== "note") C.disegna(); }
  else if (k === "quando") {
    const pe = C.D.leggi("persona:" + id);
    C.voci().filter(v => v.persona === id && v.auto && v.settimana === P.sett).forEach(v => C.D.scrivi("voce:" + v.id, null));
    modPiano(p => {
      const x = p.persone.find(x => x.id === id);
      p.blocchi = p.blocchi.filter(b => b.fonte !== "persona:" + id);
      x.altro = t.value === "altro"; x.posto = false; delete x.g; delete x.da;
      if (t.value && t.value !== "altro") {
        const [g, da] = t.value.split("|"); x.g = Number(g); x.da = da; x.posto = true;
        p.blocchi.push({ id: nid(), g: x.g, da, a: fmt(hm(da) + 120), titolo: pe.nome, tipo: "persona", fonte: "persona:" + id, luogo: "Casa" });
      }
    });
    if (t.value && t.value !== "altro") {
      const [g, da] = t.value.split("|"), q = `${GIORNI_L[g]} ${Number(C.piuGiorni(P.sett, Number(g)).slice(8))} verso le ${da}`;
      nuovaAzione(`Scrivere a ${pe.nome}`, { persona: id, auto: true, msg: MSG.proposta.replace("{nome}", pe.nome).replace("{quando}", q) });
    }
    C.disegna();
  }
});
document.addEventListener("input", e => {
  if (e.target.dataset.pv === "imp-testo") { P.foglio.testo = e.target.value; const pr = $(".pf-imp .proposta"); if (!pr && P.foglio.entro && P.foglio.conta && P.foglio.tempo) disegnaFoglio(); }
});
// l'obiettivo di Oggi si riscrive toccandolo: Invio o tocco fuori = salva (vuoto o uguale alla proposta = torna la proposta)
document.addEventListener("focusout", e => {
  const k = e.target.dataset?.pob; if (!k) return;
  const ob = C.D.leggi(k) || {}, t = e.target.textContent.trim();
  const proposta = sassi(C.lunediDi(C.daIso(k.slice(10)))).find(s => s.testo === t);
  const nuovo = t && !proposta ? t : null;
  if ((ob.testo || null) !== nuovo) C.D.scrivi(k, { ...ob, testo: nuovo });
  C.disegna();
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset?.pob) { e.preventDefault(); e.target.blur(); return; }
  if (e.key === "Escape" && P.foglio) { chiudiFoglio(); return; }
  if (e.key === "Enter" && !e.shiftKey && e.target.closest?.('[data-pf="cattura"]') && e.target.tagName === "TEXTAREA") { e.preventDefault(); e.target.form.requestSubmit(); }
});

function scaricaIcs() {
  const p = piano(), N = nuoviBlocchi(p);
  const righe = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bussola//IT", "CALSCALE:GREGORIAN"];
  N.forEach(b => righe.push("BEGIN:VEVENT", `UID:${b.id}-${P.sett}@bussola`, `DTSTAMP:${dataOra(0, 0)}`, `DTSTART;TZID=Europe/Rome:${dataOra(b.g, hm(b.da))}`, `DTEND;TZID=Europe/Rome:${dataOra(b.g, fine(b))}`,
    `SUMMARY:${b.titolo.replace(/[,;]/g, " ")}`, ...(b.luogo && b.luogo !== "Casa" ? [`LOCATION:${b.luogo}`] : []), "END:VEVENT"));
  righe.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([righe.join("\r\n")], { type: "text/calendar" }));
  a.download = `bussola-settimana-${C.numSettimana(P.sett)}.ics`;
  a.click();
}


// =========================================================
// SISTEMARE I DATI DELLA VERSIONE PRIMA (una volta sola)
// =========================================================
function migraMessaggi(p) {
  const M = p.messaggi || [];
  M.filter(x => !x.fatto).forEach(x => nuovaAzione(x.chi, { persona: x.persona, msg: x.testo || "" }));
  modPiano(q => { delete q.messaggi; if (q.passo > 5) q.passo = 5; });
}
export function migra() {
  // la bacheca dei ruoli: se non c'è, la creo dai ruoli che hai già usato (con i loro colori)
  const met = C.D.leggi("metodo") || {};
  if (!met.ruoli || met.v !== 2) {
    const usati = new Map();
    C.tutte("ruolo:").sort((a, b) => (b.settimana || "").localeCompare(a.settimana || "")).forEach(r => { const k = r.nome.trim().toLowerCase(); if (k && !usati.has(k)) usati.set(k, { nome: r.nome.trim(), colore: r.colore, domanda: "" }); });
    const vecchi = met.ruoli || [];
    const ruoli = usati.size ? [...usati.values()].map(r => ({ ...r, domanda: vecchi.find(x => x.nome.toLowerCase() === r.nome.toLowerCase())?.domanda || METODO_BASE.ruoli.find(x => x.nome.toLowerCase() === r.nome.toLowerCase())?.domanda || "" })) : METODO_BASE.ruoli;
    const { margine, modelli, passi, ...resto } = met;
    C.D.scrivi("metodo", { ...resto, ruoli, regole: met.regole || [], v: 2 });
  }
  if (C.D.leggi("migrazione:v2")) return;
  // cicli aperti → cose da smistare domenica (Cattura)
  C.voci().filter(v => v.tipo === "ciclo" && !v.fatto).forEach(v => C.D.scrivi("voce:" + v.id, { ...C.D.leggi("voce:" + v.id), tipo: "inbox", padre: null, creato: Date.now() }));
  // le voci in matrice tornano normali
  C.voci().filter(v => v.quadrante || v.inMatrice).forEach(v => C.D.scrivi("voce:" + v.id, { ...C.D.leggi("voce:" + v.id), quadrante: null, inMatrice: false }));
  C.D.scrivi("migrazione:v2", { quando: Date.now() });
}

/** ?cattura nell'indirizzo (icona sulla Home del telefono) = apre subito la Cattura. La prima volta: la guida. */
export function avvio() {
  G.completaRitorno().then(ok => { if (ok) { C.avvisa("Google Calendar collegato per sempre", false, "spunta"); C.disegna(); } });
  if (new URLSearchParams(location.search).has("cattura")) return apriFoglio("cattura");
  let vista = null;
  try { vista = localStorage.getItem("bussola.guida"); } catch { /* niente */ }
  if (!vista) apriFoglio("guida");
}
export const apri = apriFoglio;
