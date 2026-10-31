/* rapide.js — le AZIONI RAPIDE, i loro gesti e il pulsante «+» (dal 2026-10-29; anteprime approvate:
   anteprima/telefono.html e anteprima/computer.html).
   Azione rapida = voce tipo "todo": settimana (lunedì), giorno (AAAA-MM-GG; null = «quando capita»), ora ("HH:MM", vuota =
   nel blocco delle azioni rapide), rinvii (quante volte è passata da sola al giorno dopo), fatto, fattoIl, persona (id).
   Gesti sulle righe [data-rid]:
     tocco / clic = scheda di modifica · scorri a destra = fatta, a sinistra = domani · tieni premuto (tasto destro) = menu ·
     tieni premuto e trascina (mouse: premi e muovi) = in basso la barra coi prossimi 7 giorni + Fatta / Parcheggia / Elimina,
     oppure dentro un'altra lista [data-rlista] (cambia posto o giorno). Vicino ai bordi la pagina scorre da sola.
   «+» = un foglio solo al posto di Cattura e Imprevisto: azione rapida, impegno (cerca gli spazi liberi), per dopo, diario.
   Usa SOLO data-r / data-rid / data-rlista / data-rnuova (data-p, data-azione, data-drag sono di pianifica.js e app.js). */
import * as G from "./gcal.js?v=20261031181718";
import * as PS from "./persone.js?v=20261031181718";
import * as AG from "./aggiungi.js?v=20261031181718";
let C, X;
/** C = strumenti di app.js; X = quelli di pianifica.js (blocchiSettimana, salvaBlocco, metodo, tragitto, …) */
export function init(ctx, extra) { C = ctx; X = extra; }
const $ = s => document.querySelector(s);
const R = { foglio: null, aperti: new Set(), copiato: null, giornoTel: null, edit: null };   // edit = id della riga aperta
const nid = () => C.nuovoId();
const NOMI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const NOMI_L = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>`;
const CESTINO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;

// ---------- dati ----------
const nomeGiorno = iso => { const o = C.oggi(), n = C.giorniTra(o, iso); return n === 0 ? "oggi" : n === 1 ? "domani" : n === -1 ? "ieri" : NOMI_L[C.daIso(iso).getDay()] + " " + Number(iso.slice(8)); };
const corto = iso => { const n = C.giorniTra(C.oggi(), iso); return n === 0 ? "Oggi" : n === 1 ? "Domani" : NOMI[C.daIso(iso).getDay()]; };
const prossimi7 = () => Array.from({ length: 7 }, (_, i) => C.piuGiorni(C.oggi(), i));
const rapide = () => C.voci().filter(v => v.tipo === "todo" && !v.padre);
/** le azioni di un giorno (o «capita» = senza giorno), in ordine: prima quelle con l'ora, poi le altre, in fondo le fatte */
export function azioniDi(giorno) {
  const L = rapide().filter(v => giorno === "capita" ? !v.giorno && !v.fatto : v.giorno === giorno);
  const o = (a, b) => (a.ordine ?? 0) - (b.ordine ?? 0);
  return [...L.filter(v => !v.fatto && v.ora).sort((a, b) => a.ora.localeCompare(b.ora)), ...L.filter(v => !v.fatto && !v.ora).sort(o), ...L.filter(v => v.fatto).sort(o)];
}
/** i giorni toccati: dopo 3" aggiorno il loro blocco «Azioni rapide» in Google Calendar (pianifica.js) */
const daSinc = new Set(); let tSinc;
function sinc(...giorni) { giorni.filter(Boolean).forEach(g => daSinc.add(g)); clearTimeout(tSinc); tSinc = setTimeout(() => { daSinc.forEach(g => X.bloccoRapide(g)); daSinc.clear(); }, 3000); }
const scriviV = (v, cambia) => { const { id, ...resto } = v; C.D.scrivi("voce:" + id, { ...resto, ...cambia }); sinc(v.giorno, cambia.giorno); };
const settDi = giorno => C.lunediDi(giorno ? C.daIso(giorno) : new Date());
function nuova(testo, giorno, extra = {}) {
  const ordine = rapide().reduce((m, v) => Math.max(m, v.ordine ?? 0), 0) + 1;
  const id = nid();
  C.D.scrivi("voce:" + id, { testo, tipo: "todo", settimana: settDi(giorno), giorno: giorno || null, ora: "", ruolo: null, fatto: false, ordine, ...extra });
  sinc(giorno);
  return id;
}
/** le azioni non fatte dei giorni passati passano da sole a oggi (contando i rinvii); non si annulla, è automatico */
export function rollover() {
  const o = C.oggi(), sett = settDi(o);
  const vecchie = rapide().filter(v => !v.fatto && v.giorno && v.giorno < o);
  // le azioni di prima della versione 3 non hanno il campo «giorno» (le nuove «quando capita» hanno giorno: null):
  // quelle non fatte vengono a oggi, una volta sola
  const senza = rapide().filter(v => !v.fatto && v.giorno === undefined);
  if (!vecchie.length && !senza.length) return;
  C.D.senzaRegistro(() => {
    vecchie.forEach(v => scriviV(v, { giorno: o, settimana: sett, ora: "", rinvii: (v.rinvii || 0) + 1 }));
    senza.forEach(v => scriviV(v, { giorno: o, settimana: sett, ora: "" }));
  });
}
/** un'azione con l'ora va anche in Google Calendar (15 minuti), come un impegno */
function inCalendar(testo, giorno, ora, id = null) {
  if (!ora || !giorno || !G.collegato()) return;
  const sett = settDi(giorno), da = X.hm(ora);
  // fonte «azione:<id>» = l'evento è legato all'azione: se cambi o togli l'ora (o la sposti, o la elimini) si toglie anche da Calendar
  X.salvaBlocco(sett, { id: nid(), g: C.giorniTra(sett, giorno), da: X.fmt(da), a: X.fmt(da + 15), titolo: testo, tipo: "altro", luogo: "Casa", fonte: id ? "azione:" + id : "azione" }, () => {}, { nuovo: true });
}
/** toglie l'evento di Calendar legato a un'azione (se c'era) */
function togliEvento(v) { if (v.ora && v.giorno) X.togliDaFonte(settDi(v.giorno), "azione:" + v.id); }
/** cambia (o toglie, ora = "") l'orario di un'azione: l'evento vecchio va via, quello nuovo nasce */
function cambiaOra(v, ora) {
  if (ora === (v.ora || "")) return;
  togliEvento(v);
  scriviV(v, { ora });
  if (ora) inCalendar(v.testo, v.giorno, ora, v.id);
  C.avvisa(ora ? `Alle ${ora}${G.collegato() ? ", anche in Calendar" : ""}` : "Senza ora", true);
}
/** «domani alle 10», «oggi», «alle 9:30» scritti nel testo → giorno e ora (e il testo pulito) */
function capisciTesto(t, giorno) {
  let ora = "";
  const m = t.match(/\balle\s*(\d{1,2})(?:[:.](\d{2}))?\b/i);
  if (m && Number(m[1]) < 24) { ora = `${m[1].padStart(2, "0")}:${m[2] || "00"}`; t = t.replace(m[0], ""); }
  if (/\bdomani\b/i.test(t)) { giorno = C.piuGiorni(C.oggi(), 1); t = t.replace(/\bdomani\b/i, ""); }
  else if (/\boggi\b/i.test(t)) { giorno = C.oggi(); t = t.replace(/\boggi\b/i, ""); }
  return { testo: t.replace(/\s{2,}/g, " ").trim(), giorno, ora };
}

// ---------- disegno ----------
const persona = id => id ? C.D.leggi("persona:" + id) : null;
/** v4: la riga aperta per modificarla (tocco sull'azione): testo + UNA riga di etichette (quando · ora · persona · elimina) */
function htmlModifica(v) {
  const o = C.oggi(), giorni = Array.from({ length: 7 }, (_, i) => C.piuGiorni(o, i));
  const quando = [...giorni.map(g => [g, corto(g) === "Oggi" || corto(g) === "Domani" ? corto(g) : NOMI[C.daIso(g).getDay()].toLowerCase() + " " + Number(g.slice(8))]), ["capita", "Senza giorno"]];
  if (v.giorno && !giorni.includes(v.giorno)) quando.unshift([v.giorno, nomeGiorno(v.giorno)]);
  const pers = PS.tutte().sort((a, b) => a.nome.localeCompare(b.nome));
  return `<li class="rp-li rp-edit" data-rid="${v.id}"><input class="rp-ed-t" data-red="testo" value="${C.esc(v.testo)}" enterkeyhint="done" autocomplete="off">
    <div class="rp-ed-r"><select class="rp-ed-s" data-red="giorno">${quando.map(([k, n]) => `<option value="${k}" ${(v.giorno || "capita") === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${v.giorno ? `<button class="rp-ed-s rp-ed-ora${v.ora ? " pieno" : ""}" data-r="ed-ora">${v.ora || "Ora"}</button>` : ""}
      <select class="rp-ed-s${v.persona ? " pieno" : ""}" data-red="persona"><option value="">Chi?</option>${pers.map(p => `<option value="${p.id}" ${v.persona === p.id ? "selected" : ""}>${C.esc(p.nome)}</option>`).join("")}</select>
      <button class="rp-ed-x" data-r="ed-elimina" aria-label="Elimina">${CESTINO}</button></div>
    ${R.editOra && v.giorno ? htmlOre(v) : ""}</li>`;
}
/** gli orari pronti (ogni mezz'ora, da adesso se è oggi) in una riga che scorre di lato; «Senza ora» per toglierla */
function htmlOre(v) {
  const ora = new Date(), oggi = v.giorno === C.oggi(), da = oggi ? Math.ceil((ora.getHours() * 60 + ora.getMinutes() + 1) / 30) * 30 : 7 * 60;
  const ore = []; for (let m = Math.max(da, 6 * 60); m <= 23 * 60 + 30; m += 30) ore.push(X.fmt(m));
  if (v.ora && !ore.includes(v.ora)) ore.unshift(v.ora);
  return `<div class="rp-ed-ore">${v.ora ? `<button class="rp-ed-c senza" data-r="ed-ora-v" data-v="">Senza ora</button>` : ""}${ore.map(o => `<button class="rp-ed-c${o === v.ora ? " on" : ""}" data-r="ed-ora-v" data-v="${o}">${o}</button>`).join("")}
    <label class="rp-ed-c altra">Altra…<input type="time" data-red="ora" value="${v.ora || ""}"></label></div>`;
}
function chiudiModifica() {
  if (!R.edit) return;
  const inp = $(`.rp-edit[data-rid="${R.edit}"] [data-red=testo]`), v = C.D.leggi("voce:" + R.edit);
  if (inp && v && inp.value.trim() && inp.value.trim() !== v.testo) scriviV({ ...v, id: R.edit }, { testo: inp.value.trim() });
  R.edit = null; R.editOra = false;
}
function htmlRiga(v) {
  if (R.edit === v.id) return htmlModifica(v);
  const pe = persona(v.persona);
  const sotto = !v.fatto && v.rinvii >= 3
    ? `<small class="rp-rinvii">rimandata ${v.rinvii} volte</small><span class="rp-scelte"><button data-r="taglia">La taglio</button><button data-r="parcheggia">Parcheggio</button><button data-r="tieni">La faccio</button></span>`
    : !v.fatto && v.rinvii ? `<small class="rp-rinvii">${v.rinvii === 1 ? "da ieri" : `rimandata ${v.rinvii} volte`}</small>`
    : pe ? `<small>${C.esc(pe.nome)}</small>` : "";
  return `<li class="rp-li" data-rid="${v.id}"><div class="rp-sw"><span>Fatta</span><span>Domani</span></div>
    <div class="rp-it${v.fatto ? " fatta" : ""}"><button class="rp-ck" data-r="spunta" aria-label="${v.fatto ? "Da fare" : "Fatta"}">${OK}</button>
      <div class="rp-tx">${C.esc(v.testo)}${sotto}</div>${v.ora && !v.fatto ? `<span class="rp-ora">${v.ora}</span>` : ""}</div></li>`;
}
const htmlIncolla = giorno => R.copiato ? `<div class="rp-incolla"><span>Incolla «${C.esc(R.copiato)}»</span><button data-r="incolla" data-g="${giorno}">Qui</button><button data-r="no-incolla" aria-label="Lascia stare">×</button></div>` : "";
const htmlCampo = (giorno, ph) => `<label class="rp-agg"><span aria-hidden="true">+</span><input data-rnuova="${giorno}" placeholder="${ph}" enterkeyhint="done" autocomplete="off"></label>`;
/** le azioni rapide di un giorno, con il campo per aggiungerne (Oggi) */
export function htmlGiorno(giorno, { titolo = true } = {}) {
  const L = azioniDi(giorno), fatte = L.filter(v => v.fatto).length, o = C.oggi();
  const ieri = giorno === o ? rapide().filter(v => v.fatto && v.giorno === C.piuGiorni(o, -1)) : [];
  const capita = giorno === o ? azioniDi("capita") : [];
  const daIeri = L.filter(v => !v.fatto && v.rinvii).length;
  const pill = (k, t, n, dentro) => `<div class="rp-pill${R.aperti.has(k) ? " aperta" : ""}"><button data-r="pill" data-k="${k}">${t} · ${n}<i aria-hidden="true">›</i></button>${R.aperti.has(k) ? dentro : ""}</div>`;
  return `<section class="rp-giorno">
    ${titolo ? `<div class="rp-tit"><h3 class="H">Azioni rapide</h3><span>${L.length ? `${fatte} di ${L.length}` : ""}</span></div>` : ""}
    ${daIeri && giorno === o ? `<div class="rp-avviso">${daIeri} non ${daIeri === 1 ? "fatta" : "fatte"} nei giorni scorsi: ${daIeri === 1 ? "è" : "sono"} qui.</div>` : ""}
    ${htmlCampo(giorno, giorno === o ? "Es. «scrivi a Luca domani alle 10»" : "Aggiungi un'azione")}
    ${htmlIncolla(giorno)}
    <ul class="rp-lista" data-rlista="${giorno}">${L.map(htmlRiga).join("")}</ul>
    ${capita.length ? pill("capita", "Quando capita", capita.length, `<ul class="rp-lista" data-rlista="capita">${capita.map(htmlRiga).join("")}</ul>`) : ""}
    ${ieri.length ? pill("ieri", "Fatte ieri", ieri.length, `<ul class="rp-lista">${ieri.map(htmlRiga).join("")}</ul>`) : ""}
  </section>`;
}
/** Settimana: telefono = giorni a pillola + la lista del giorno scelto; computer = una colonna per giorno + «quando capita» */
export function htmlSettimana(lun, { titolo = true } = {}) {
  const giorni = Array.from({ length: 7 }, (_, i) => C.piuGiorni(lun, i)), o = C.oggi();
  if (!R.giornoTel || !giorni.concat("capita").includes(R.giornoTel)) R.giornoTel = giorni.includes(o) ? o : giorni[0];
  const conta = g => azioniDi(g).filter(v => !v.fatto).length;
  const nome = g => g === "capita" ? "Quando capita" : `${corto(g)} ${Number(g.slice(8))}`;
  const tel = `<div class="rp-chips solo-tel">${[...giorni, "capita"].map(g => `<button data-r="giorno-tel" data-g="${g}" class="${R.giornoTel === g ? "on" : ""}${g !== "capita" && g < o ? " passato" : ""}">${g === "capita" ? "Quando capita" : corto(g) === "Oggi" ? "Oggi" : NOMI[C.daIso(g).getDay()] + " " + Number(g.slice(8))}<em>${conta(g)}</em></button>`).join("")}</div>
    <div class="solo-tel">${R.giornoTel === "capita" || R.giornoTel >= o ? htmlCampo(R.giornoTel, "Aggiungi a questo giorno") : ""}${htmlIncolla(R.giornoTel)}
      <ul class="rp-lista" data-rlista="${R.giornoTel}">${azioniDi(R.giornoTel).map(htmlRiga).join("") || `<li class="rp-vuota">Niente qui.</li>`}</ul></div>`;
  const pc = `<div class="rp-colonne solo-pc">${[...giorni, "capita"].map(g => `<div class="rp-col${g === o ? " rp-oggi" : ""}${g !== "capita" && g < o ? " passato" : ""}">
      <h4 class="H">${nome(g)}<span>${conta(g) || ""}</span></h4>
      ${g === "capita" || g >= o ? htmlCampo(g, "+ aggiungi") : `<div class="rp-agg-vuoto"></div>`}
      <ul class="rp-lista" data-rlista="${g}">${azioniDi(g).map(htmlRiga).join("")}</ul></div>`).join("")}</div>`;
  return `<section class="rp-sett">${titolo ? `<div class="rp-tit"><h3 class="H">Azioni rapide</h3></div>` : ""}<p class="rp-aiuto solo-pc">Trascina tra i giorni · clic per modificare · tasto destro per il menu</p>${tel}${pc}</section>`;
}

// ---------- azioni (menu, barra, scheda) ----------
function fai(k, v, valore) {
  const o = C.oggi();
  const sposta = g => { if (g !== v.giorno) togliEvento(v); scriviV(v, { giorno: g, settimana: settDi(g || o), ora: g === v.giorno ? v.ora : "", rinvii: 0 }); };
  switch (k) {
    case "spunta": {   // spuntare «Chiamare Marco» segna anche Marco come sentito (persone.js)
      scriviV(v, { fatto: !v.fatto, fattoIl: !v.fatto ? o : null });
      if (!v.fatto) { const chi = PS.daAzione(v); C.avvisa(chi.length ? `Fatta · ${chi.join(", ")}: sentito` : "Fatta", true, "spunta"); }
      break;
    }
    case "domani": { const g = C.piuGiorni(v.giorno && v.giorno > o ? v.giorno : o, 1); sposta(g); C.avvisa("Spostata a " + nomeGiorno(g), true); break; }
    case "giorno": if (valore === v.giorno) return; sposta(valore === "capita" ? null : valore); C.avvisa(valore === "capita" ? "In «Quando capita»" : "Spostata a " + nomeGiorno(valore), true); break;
    case "elimina": case "taglia": togliEvento(v); C.D.scrivi("voce:" + v.id, null); sinc(v.giorno); C.avvisa(k === "taglia" ? "Tagliata: una cosa in meno" : "Eliminata", true); break;
    case "parcheggia": scriviV(v, X.datiParch()); C.avvisa("Parcheggiata: torna quando pianifichi", true); break;
    case "tieni": { const t = primoBuco(15); scriviV(v, { rinvii: 0, ora: t ? X.fmt(t) : "" }); if (t) inCalendar(v.testo, o, X.fmt(t), v.id); C.avvisa(t ? `Messa alle ${X.fmt(t)}` : "Tienila d'occhio oggi", true); break; }
    case "duplica": nuova(v.testo, v.giorno, { persona: v.persona || null, ordine: (v.ordine ?? 0) + 0.5 }); C.avvisa("Duplicata", true); break;
    case "copia": R.copiato = v.testo; C.avvisa("Copiata: tocca «Qui» dove vuoi incollarla"); break;
    case "fatta": if (!v.fatto) fai("spunta", v); return;
    case "modifica": R.edit = v.id; break;
  }
  C.disegna();
}
function apriMenu(v, r) {
  const m = $("#rp-menu");
  const voci = [["modifica", "Modifica"], ["duplica", "Duplica"], ["copia", "Copia"], ["domani", "Sposta a domani"], ["fatta", v.fatto ? "" : "Segna fatta"], ["parcheggia", "Parcheggia"], ["elimina", "Elimina"]].filter(x => x[1]);
  m.innerHTML = `<div class="rp-menu-box"><div class="rp-menu-copia">${htmlRiga(v)}</div><div class="rp-menu-l">${voci.map(([k, t]) => `<button data-rm="${k}" class="${k === "elimina" ? "rosso" : ""}">${t}</button>`).join("")}</div></div>`;
  m.hidden = false;
  const box = m.firstChild, h = box.offsetHeight;
  box.style.left = Math.max(12, Math.min(r.left, innerWidth - box.offsetWidth - 12)) + "px";
  box.style.top = Math.max(12, Math.min(r.top, innerHeight - h - 12)) + "px";
  m.onclick = e => { const b = e.target.closest("[data-rm]"); m.hidden = true; if (b) fai(b.dataset.rm, C.D.leggi("voce:" + v.id) ? { ...C.D.leggi("voce:" + v.id), id: v.id } : v); };
}
function mostraBarra() {
  const b = $("#rp-barra");
  b.innerHTML = `<div class="rp-b-aiuto">Lascia su un giorno, su un'azione, o nella lista per cambiare posto</div>
    <div class="rp-b-giorni">${prossimi7().map((g, i) => `<span data-rdrop="g:${g}" class="${i ? "" : "rp-oggi"}">${i ? NOMI[C.daIso(g).getDay()] : "Oggi"}<b>${Number(g.slice(8))}</b></span>`).join("")}</div>
    <div class="rp-b-az"><span data-rdrop="fatta" class="verde">Fatta</span><span data-rdrop="parcheggia">Parcheggia</span><span data-rdrop="elimina" class="rosso">${CESTINO}Elimina</span></div>`;
  b.hidden = false; requestAnimationFrame(() => b.classList.add("on"));
}
function nascondiBarra() { const b = $("#rp-barra"); b.classList.remove("on"); setTimeout(() => { if (!b.classList.contains("on")) b.hidden = true; }, 220); }
/** il primo quarto d'ora libero da adesso (oggi) nel calendario, tra le 8 e le 22 */
function primoBuco(min) {
  const o = C.oggi(), sett = settDi(o), g = C.giorniTra(sett, o), adesso = new Date().getHours() * 60 + new Date().getMinutes();
  const B = X.blocchiSettimana(sett).blocchi.filter(b => b.g === g && X.occupa(b)).sort((a, b) => X.hm(a.da) - X.hm(b.da));
  let t = Math.max(8 * 60, Math.ceil((adesso + 10) / 15) * 15);
  for (const b of [...B, { da: "22:00", a: "22:00" }]) { if (X.hm(b.da) - t >= min) return t < 22 * 60 ? t : null; t = Math.max(t, X.fine(b)); }
  return null;
}

// ---------- gesti ----------
let g = null, finito = 0;
const scroller = () => $("main");
document.addEventListener("pointerdown", e => {
  const it = e.target.closest(".rp-it");
  if (!it || e.button > 0 || e.target.closest("button, a, input") || it.closest("#rp-menu")) return;
  const li = it.parentElement;
  g = { li, it, id: li.dataset.rid, x: e.clientX, y: e.clientY, px: e.clientX, py: e.clientY, touch: e.pointerType !== "mouse", modo: null };
  if (g.touch) g.t = setTimeout(() => { if (g && !g.modo) { g.modo = "premuto"; it.classList.add("su"); navigator.vibrate?.(12); } }, 420);
});
document.addEventListener("touchmove", e => { if (g?.modo) e.preventDefault(); }, { passive: false });   // mentre trascini la pagina sta ferma
document.addEventListener("contextmenu", e => {
  const it = e.target.closest(".rp-it"); if (!it || it.closest("#rp-menu")) return;
  e.preventDefault(); if (g) { clearTimeout(g.t); g = null; }
  const v = C.D.leggi("voce:" + it.parentElement.dataset.rid);
  if (v) apriMenu({ ...v, id: it.parentElement.dataset.rid }, { left: e.clientX, top: e.clientY });
});
document.addEventListener("pointermove", e => {
  if (!g) return;
  g.px = e.clientX; g.py = e.clientY;
  const dx = e.clientX - g.x, dy = e.clientY - g.y, lontano = Math.hypot(dx, dy) > 8;
  if (!g.modo) {
    if (!lontano) return;
    clearTimeout(g.t);
    if (g.touch && Math.abs(dx) > Math.abs(dy) * 1.3) g.modo = "swipe";
    else if (!g.touch) iniziaTrascina();
    else { g = null; return; }   // il dito scorreva la pagina
  } else if (g.modo === "premuto" && lontano) iniziaTrascina();
  if (g.modo === "swipe") {
    g.li.classList.add("scorre"); g.li.classList.toggle("destra", dx > 0);
    g.it.style.transition = "none"; g.it.style.transform = `translateX(${dx}px)`;
  }
  if (g.modo === "trascina") segui();
});
function iniziaTrascina() {
  g.modo = "trascina"; g.it.classList.add("su"); g.li.classList.add("alzata"); g.s0 = scroller().scrollTop;
  document.body.classList.add("rp-trascino"); mostraBarra(); requestAnimationFrame(autoScorri);
}
function bersaglio() {
  const sotto = document.elementsFromPoint(g.px, g.py);
  return { drop: sotto.find(x => x.dataset?.rdrop), lista: sotto.find(x => x.dataset?.rlista && !x.closest("#rp-menu")),
    col: sotto.find(x => x.classList?.contains("gs-col") && x.closest(".gs-un-giorno")) };
}
function segui() {
  const dx = g.px - g.x, dy = g.py - g.y + (scroller().scrollTop - g.s0);
  g.it.style.transition = "none"; g.it.style.transform = `translate(${dx * .3}px, ${dy}px) scale(1.03)`;
  const { drop, lista, col } = bersaglio();
  document.querySelectorAll("[data-rdrop]").forEach(b => b.classList.toggle("sopra", b === drop));
  document.querySelectorAll(".rp-ombra").forEach(o => { if (!col || o.parentElement !== col) o.remove(); });
  if (col && !drop) {
    const m = minutiCol(col); let o = col.querySelector(".rp-ombra");
    if (!o) { o = document.createElement("div"); o.className = "rp-ombra"; col.appendChild(o); }
    o.style.top = (m - X.GS_H0 * 60) / 60 * X.GS_PX + "px"; o.textContent = X.fmt(m);
  }
  document.querySelectorAll(".rp-li.qui, .rp-li.qui-fine, .rp-lista.qui").forEach(x => x.classList.remove("qui", "qui-fine"));
  if (!drop && lista) { const d = arrivo(lista); d.li ? d.li.classList.add(d.fine ? "qui-fine" : "qui") : lista.classList.add("qui"); }
}
const minutiCol = col => Math.max(X.GS_H0 * 60, Math.min(23 * 60 + 45, X.GS_H0 * 60 + Math.round((g.py - col.getBoundingClientRect().top) / X.GS_PX * 4) * 15));
/** dove finisce nella lista: prima della riga sotto il dito, o in fondo */
function arrivo(lista) {
  const righe = [...lista.querySelectorAll(":scope > .rp-li")].filter(li => li !== g.li);
  const li = righe.find(li => { const r = li.getBoundingClientRect(); return r.top + r.height / 2 > g.py; });
  return li ? { li, fine: false } : { li: righe[righe.length - 1], fine: true };
}
/** vicino al bordo alto, o appena sopra la barra in basso, la pagina scorre da sola (più vicino = più veloce) */
function autoScorri() {
  if (!g || g.modo !== "trascina") return;
  const s = scroller(), r = s.getBoundingClientRect(), barra = $("#rp-barra").getBoundingClientRect().top || innerHeight;
  let v = 0;
  if (g.py < r.top + 70) v = -Math.min(16, (r.top + 70 - g.py) / 4);
  else if (g.py > barra - 60 && g.py < barra) v = Math.min(16, (g.py - barra + 60) / 4);
  if (v) { s.scrollTop += v; segui(); }
  requestAnimationFrame(autoScorri);
}
function fineGesto(e) {
  if (!g) return;
  clearTimeout(g.t);
  const x = g; g = null;
  const v0 = C.D.leggi("voce:" + x.id), v = v0 && { ...v0, id: x.id };
  x.it.style.transition = ""; x.it.style.transform = ""; x.it.classList.remove("su");
  x.li.classList.remove("alzata", "scorre", "destra");
  document.body.classList.remove("rp-trascino");
  if (!x.modo || !v) return;
  finito = Date.now();
  if (x.modo === "swipe") { const dx = e.clientX - x.x; if (dx > 90) fai(v.fatto ? "spunta" : "fatta", v); else if (dx < -90) fai("domani", v); return; }
  if (x.modo === "premuto") return apriMenu(v, x.it.getBoundingClientRect());
  // trascina
  g = x; const { drop, lista, col } = bersaglio(); const d = lista && !drop ? arrivo(lista) : null, mCol = col && !drop ? minutiCol(col) : null; g = null;
  document.querySelectorAll(".sopra, .qui, .qui-fine").forEach(y => y.classList.remove("sopra", "qui", "qui-fine"));
  document.querySelectorAll(".rp-ombra").forEach(o => o.remove());
  nascondiBarra();
  if (drop) { const k = drop.dataset.rdrop; return k.startsWith("g:") ? fai("giorno", v, k.slice(2)) : fai(k, v); }
  if (mCol != null) {   // lasciata nella giornata: un'ora precisa, anche in Calendar (15')
    const giorno = document.querySelector(".og2-sx [data-rlista]")?.dataset.rlista || C.oggi(), ora = X.fmt(mCol);
    scriviV(v, { giorno, settimana: settDi(giorno), ora, rinvii: 0 });
    inCalendar(v.testo, giorno, ora);
    C.avvisa(`Alle ${ora}${G.collegato() ? ", anche in Calendar" : ""}`, true);
    return C.disegna();
  }
  if (lista) return riordina(v, lista.dataset.rlista, d);
  C.disegna();
}
document.addEventListener("pointerup", fineGesto);
document.addEventListener("pointercancel", e => { if (g && g.modo === "trascina") return; fineGesto(e); });
/** lasciata in una lista: prende quel giorno e quel posto (le altre si rinumerano, tutto in un passo da annullare) */
function riordina(v, dest, d) {
  const giorno = dest === "capita" ? null : dest;
  const L = azioniDi(dest).filter(x => x.id !== v.id && !x.fatto);
  let i = d?.li ? L.findIndex(x => x.id === d.li.dataset.rid) + (d.fine ? 1 : 0) : L.length;
  if (i < 0) i = L.length;
  L.splice(i, 0, v);
  L.forEach((x, n) => { const c = { ordine: n }; if (x.id === v.id) Object.assign(c, { giorno, settimana: settDi(giorno), ora: "" }); scriviV(x, c); });
  C.avvisa(giorno === v.giorno ? "Spostata" : giorno ? "Spostata a " + nomeGiorno(giorno) : "In «Quando capita»", true);
  C.disegna();
}

// ---------- tocchi ----------
document.addEventListener("click", e => {
  const r = e.target.closest("[data-r]");
  if (r) {
    const k = r.dataset.r, li = r.closest("[data-rid]"), v0 = li && C.D.leggi("voce:" + li.dataset.rid), v = v0 && { ...v0, id: li.dataset.rid };
    if (li && r.closest("#rp-menu")) return;
    if (["spunta", "taglia", "parcheggia", "tieni"].includes(k) && v) return fai(k, v);
    if (k === "pill") { R.aperti.has(r.dataset.k) ? R.aperti.delete(r.dataset.k) : R.aperti.add(r.dataset.k); return C.disegna(); }
    if (k === "giorno-tel") { R.giornoTel = r.dataset.g; return C.disegna(); }
    if (k === "incolla") { nuova(R.copiato, r.dataset.g === "capita" ? null : r.dataset.g); R.copiato = null; C.avvisa("Incollata", true); return C.disegna(); }
    if (k === "no-incolla") { R.copiato = null; return C.disegna(); }
    if (k === "piu") return apriPiu(r.dataset.tipo);
    if (k === "ed-elimina" && v) { R.edit = null; return fai("elimina", v); }
    if (k === "ed-ora") { R.editOra = !R.editOra; C.disegna(); if (R.editOra) setTimeout(() => $(".rp-ed-c.on")?.scrollIntoView({ inline: "center", block: "nearest" }), 30); return; }
    if (k === "ed-ora-v" && v) { R.editOra = false; cambiaOra(v, r.dataset.v); return C.disegna(); }
    return foglioClic(e, r);
  }
  const it = e.target.closest(".rp-it");
  if (it && !e.target.closest("a") && !it.closest("#rp-menu") && Date.now() - finito > 300) {
    const id = it.parentElement.dataset.rid;
    if (C.D.leggi("voce:" + id)) { chiudiModifica(); R.edit = id; C.disegna(); setTimeout(() => { const i = $(`.rp-edit [data-red=testo]`); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 30); }
    return;
  }
  // un tocco fuori dalla riga aperta la chiude (salvando il testo)
  if (R.edit && !e.target.closest(".rp-edit")) { chiudiModifica(); C.disegna(); }
});
document.addEventListener("change", e => {
  const el = e.target.closest?.("[data-red]"), li = el?.closest(".rp-edit"); if (!el || !li) return;
  const v = { ...C.D.leggi("voce:" + li.dataset.rid), id: li.dataset.rid }, k = el.dataset.red;
  if (k === "testo") { if (el.value.trim() && el.value.trim() !== v.testo) scriviV(v, { testo: el.value.trim() }); return; }
  if (k === "giorno") { fai("giorno", v, el.value); return; }
  if (k === "persona") { scriviV(v, { persona: el.value || null }); C.disegna(); return; }
  if (k === "ora") { R.editOra = false; cambiaOra(v, el.value); C.disegna(); }
});
document.addEventListener("keydown", e => {
  if (e.target.dataset?.red === "testo" && (e.key === "Enter" || e.key === "Escape")) { e.preventDefault(); chiudiModifica(); C.disegna(); return; }
  const inp = e.target.closest?.("input[data-rnuova]");
  if (inp && e.key === "Enter" && inp.value.trim()) {
    e.preventDefault();
    const dove = inp.dataset.rnuova, c = capisciTesto(inp.value.trim(), dove === "capita" ? null : dove);
    if (!c.testo) return;
    const nid_ = nuova(c.testo, c.giorno, { ora: c.ora });
    inCalendar(c.testo, c.giorno, c.ora, nid_);
    const altrove = c.giorno !== (dove === "capita" ? null : dove);
    C.avvisa(altrove ? `Aggiunta a ${nomeGiorno(c.giorno)}${c.ora ? " alle " + c.ora : ""}` : c.ora ? `Alle ${c.ora}${G.collegato() ? ", anche in Calendar" : ""}` : "Aggiunta", true);
    inp.value = ""; R.fuoco = dove;
    C.disegna();
    const di = document.querySelector(`input[data-rnuova="${dove}"]`); di?.focus({ preventScroll: true });
    return;
  }
  if (e.target.matches?.("input, textarea, [contenteditable]")) return;
  if (e.key === "Escape" && R.foglio) chiudi();
  if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey && !R.foglio && !AG.aperto() && $("aside")) { e.preventDefault(); apriPiu(); }
});

// =========================================================
// FOGLI: scheda di un'azione · «+» (cosa ti è spuntato?)
// =========================================================
function chiudi() { R.foglio = null; disegnaFoglio(); }
function apriScheda(v) { R.foglio = { tipo: "scheda", id: v.id, giorno: v.giorno || "capita", persona: v.persona || "" }; disegnaFoglio(); }
/** testo = già scritto; daVoce = id di una voce di «Da sistemare» che sparisce quando l'impegno è in calendario */
export function apriPiu(tipo, testo = "", daVoce = null) {
  return AG.apri(tipo, testo, daVoce);   // v4: il «+» nuovo sta in aggiungi.js (quello sotto non si usa più)
  R.foglio = { tipo: "piu", t: tipo || "rapida", scelto: !!tipo, testo, daVoce, quando: "blocco", giorno: C.oggi(), dur: 60, entro: "oggi", dove: "Casa", nota: "bene" };
  disegnaFoglio();
  setTimeout(() => $("#rp-foglio .campo")?.focus(), 60);
}
const chip = (r, v, t, on, extra = "") => `<button type="button" class="chip${on ? " on" : ""}" data-r="${r}" data-v="${v}" ${extra}>${t}</button>`;
function disegnaFoglio() {
  const f = $("#rp-foglio"), s = R.foglio;
  if (!s) { f.hidden = true; f.innerHTML = ""; return; }
  f.hidden = false;
  let dentro = "";
  if (s.tipo === "scheda") {
    const v = C.D.leggi("voce:" + s.id);
    if (!v) return chiudi();
    const giorni = [...prossimi7(), "capita"];
    const persone = C.tutte("persona:").sort((a, b) => a.nome.localeCompare(b.nome));
    dentro = `<h3 class="H">Modifica</h3>
      <input class="campo" data-rc="testo" value="${C.esc(v.testo)}">
      <div class="rp-et">Quando</div><div class="chips">${giorni.map(gg => chip("s-giorno", gg, gg === "capita" ? "Quando capita" : corto(gg), s.giorno === gg)).join("")}</div>
      <div class="rp-orari"><span>Alle</span><input type="time" data-rc="ora" value="${v.ora || ""}"><small>vuoto = nel blocco delle azioni rapide</small></div>
      ${persone.length ? `<div class="rp-et">Con chi (spuntandola, la segno come sentita)</div><div class="chips">${chip("s-chi", "", "Nessuno", !s.persona)}${persone.map(p => chip("s-chi", p.id, C.esc(p.nome), s.persona === p.id)).join("")}</div>` : ""}
      <div class="rp-tre"><button type="button" class="btn" data-r="s-fai" data-k="duplica">Duplica</button><button type="button" class="btn" data-r="s-fai" data-k="parcheggia">Parcheggia</button><button type="button" class="btn rosso" data-r="s-fai" data-k="elimina">Elimina</button></div>
      <button type="button" class="btn pieno H rp-fisso" data-r="s-salva">Salva</button>`;
  } else if (s.esito) {
    dentro = `<div class="rp-esito"><div class="ok">${OK}</div><h3 class="H">${C.esc(s.esito[0])}</h3><p>${s.esito[1]}</p>
      <button type="button" class="btn pieno H rp-fisso" data-r="chiudi">Ok</button></div>`;
  } else if (s.spazi) {
    dentro = `<h3 class="H">Ecco dove sta</h3><p class="rp-capito">${C.esc(s.testo)} · ${X.oreTxt(s.dur)} · letto ora dal calendario</p>
      ${s.spazi.length ? `<div class="rp-posti">${s.spazi.map((p, i) => `<button type="button" class="rp-posto${i ? "" : " meglio"}" data-r="posto" data-v="${i}"><div><b>${C.esc(maiuscolo(nomeGiorno(p.giorno)))} ${X.fmt(p.da)} – ${X.fmt(p.a)}</b><small>${p.nota}</small></div>${i ? "" : `<span>MEGLIO</span>`}</button>`).join("")}</div>`
        : `<p class="rp-capito">Nessuno spazio libero ${s.entro === "oggi" ? "oggi" : "nei prossimi giorni"} tra le 8 e le 22. Prova un altro giorno, o apri Pianifica per decidere cosa spostare.</p>`}
      <div class="rp-tre"><button type="button" class="btn" data-r="indietro">Indietro</button>${G.collegato() ? "" : `<span class="rp-capito">Collega Google Calendar per vedere gli spazi veri.</span>`}</div>`;
  } else {
    const t = s.t, luoghi = ["Casa", ...X.metodo().luoghi.map(l => l.nome).filter(n => n !== "Casa")];
    const capito = s.scelto || t === "sentito" || t === "uscita" ? "" : `<p class="rp-capito">Ho capito: ${{ rapida: "azione rapida", impegno: "impegno", dopo: "per dopo", diario: "diario" }[t]}. Sbagliato? Tocca sotto.</p>`;
    dentro = `<h3 class="H">Cosa ti è spuntato?</h3>
      <input class="campo" data-rc="piu-testo" value="${C.esc(s.testo)}" placeholder="Es. call con Marco 2h · scrivi a Gaia · visita medica" autocomplete="off">
      ${capito}
      <div class="rp-tipo">${[["rapida", "Azione rapida"], ["impegno", "Impegno"], ["dopo", "Per dopo"], ["diario", "Diario"]].map(([k, n]) => chip("p-tipo", k, n, t === k)).join("")}</div>
      ${t === "sentito" || t === "uscita" ? htmlPersona(s)
      : t === "rapida" ? `<div class="rp-et">Quando</div><div class="chips">${chip("p-giorno", C.oggi(), "Oggi", s.giorno === C.oggi())}${chip("p-giorno", C.piuGiorni(C.oggi(), 1), "Domani", s.giorno === C.piuGiorni(C.oggi(), 1))}${chip("p-giorno", "capita", "Quando capita", s.giorno === "capita")}</div>
        ${s.giorno !== "capita" ? `<div class="rp-et">A che ora</div><div class="chips">${chip("p-quando", "blocco", "Nel blocco azioni rapide", s.quando === "blocco")}${s.giorno === C.oggi() ? chip("p-quando", "subito", "Prima possibile", s.quando === "subito") : ""}${chip("p-quando", "ora", "Alle…", s.quando === "ora")}</div>
        ${s.quando === "ora" ? `<div class="rp-orari"><input type="time" data-rc="p-ora" value="${s.ora || "10:00"}"></div>` : ""}` : ""}
        <p class="rp-capito">${s.giorno === "capita" ? "Resta nell'elenco «quando capita» finché non le dai un giorno." : s.quando === "blocco" ? "Va nelle azioni rapide del giorno, le fai tutte insieme." : s.quando === "subito" ? (primoBuco(15) != null ? `Primo buco libero: oggi alle ${X.fmt(primoBuco(15))}. ${G.collegato() ? "La metto anche in Calendar, con l'avviso." : ""}` : "Oggi non c'è un buco libero: va nelle azioni rapide di oggi.") : G.collegato() ? "La metto anche in Calendar (15'), con l'avviso del telefono." : ""}</p>
        <button type="button" class="btn pieno H rp-fisso" data-r="p-crea">Aggiungi</button>`
      : t === "impegno" ? `<div class="rp-et">Quanto dura</div><div class="chips">${[15, 30, 60, 120].map(m => chip("p-dur", m, X.oreTxt(m), s.dur === m && !s.altro)).join("")}${chip("p-dur", "altro", "altro", !!s.altro)}</div>
        ${s.altro ? `<div class="rp-passi"><button type="button" class="tondo" data-r="p-meno">−</button><b>${X.oreTxt(s.dur)}</b><button type="button" class="tondo" data-r="p-piu">+</button></div>` : ""}
        <div class="rp-et">Entro quando</div><div class="chips">${[["oggi", "Oggi"], ["domani", "Domani"], ["sett", "Questa settimana"], ["ore", "Ore precise…"]].map(([k, n]) => chip("p-entro", k, n, s.entro === k)).join("")}</div>
        ${s.entro === "ore" ? `<div class="rp-orari"><input type="date" data-rc="p-data" value="${s.data || C.oggi()}"><input type="time" data-rc="p-ora" value="${s.ora || "16:00"}"></div>${sovrapposto(s)}` : ""}
        <div class="rp-et">Dove</div><div class="chips">${luoghi.map(l => chip("p-dove", l, C.esc(l), s.dove === l)).join("")}</div>
        ${s.dove !== "Casa" ? `<p class="rp-capito">Il viaggio (circa ${X.tragitto("Casa", s.dove)}' da casa) lo conto io prima e dopo.</p>` : ""}
        <button type="button" class="btn pieno H rp-fisso" data-r="p-cerca">${s.entro === "ore" ? `Mettilo alle ${s.ora || "16:00"}` : "Trova uno spazio"}</button>`
      : t === "dopo" ? `<p class="rp-capito">Finisce nella casella di Pianifica: la smisti domenica, senza pensarci adesso. Per un progetto scrivi «Nome: idea».</p>
        <button type="button" class="btn pieno H rp-fisso" data-r="p-dopo">Metti da parte</button>`
      : `<div class="rp-et">Com'è andata</div><div class="chips">${C.NOTE.map(n => chip("p-nota", n.k, n.nome, s.nota === n.k, `style="--c:${n.c}"`)).join("")}</div>
        <button type="button" class="btn pieno H rp-fisso" data-r="p-diario">Scrivi nel diario</button>`}`;
  }
  f.innerHTML = `<div class="velo" data-r="chiudi"></div><div class="foglio paper rp-foglio">${dentro}</div>`;
}
const maiuscolo = t => t[0].toUpperCase() + t.slice(1);
/** «sentito Marco» / «uscita con Luca la prossima settimana»: chi è (o il nome nuovo da aggiungere) */
const RE_SENTITO = /^\s*(?:ho\s+)?(sentit[oa]|chiamat[oa]|vist[oa]|scritto\s+a|parlato\s+con|telefonato\s+a|videochiamata\s+con)\s+(.+)/i;
const RE_USCITA = /^\s*(?:un'?\s*)?(?:uscita|uscire|esco|vedermi|vedere)\s+con\s+(.+)/i;
function chiDaTesto(t) {
  const m = t.match(RE_SENTITO) || t.match(RE_USCITA), resto = m ? m[m.length - 1] : "";
  const noti = PS.personeDaTesto(resto);
  const nome = resto.replace(/\b(la|questa|prossima|settimana|weekend|oggi|ieri|domani|stasera)\b.*$/i, "").trim().split(/\s+/).slice(0, 2).join(" ");
  return { noti, nome: noti.length ? "" : nome ? maiuscolo(nome) : "" };
}
function settDaTesto(t) {
  const lun = C.lunediDi(new Date());
  if (/tra\s+(due|2)\s+settiman/i.test(t)) return C.piuGiorni(lun, 14);
  if (/prossima|settimana\s+prossima/i.test(t)) return C.piuGiorni(lun, 7);
  if (/questa|weekend|stasera|domani/i.test(t)) return lun;
  return null;
}
function htmlPersona(s) {
  const { noti, nome } = chiDaTesto(s.testo), chi = noti.map(p => `<b>${C.esc(p.nome)}</b>`).join(" e ");
  if (s.t === "sentito") return !noti.length && !nome ? `<p class="rp-capito">Scrivi il nome: «sentito Marco».</p>`
    : `<p class="rp-capito">${noti.length ? `Segno ${chi} come sentito oggi.` : `<b>${C.esc(nome)}</b> non è ancora tra le tue persone: la aggiungo (ogni 2 settimane) e la segno come sentita.`}</p>
      <button type="button" class="btn pieno H rp-fisso" data-r="p-sentito">${noti.length ? "Segna sentito" : "Aggiungi e segna"}</button>`;
  const sett = settDaTesto(s.testo);
  return !noti.length && !nome ? `<p class="rp-capito">Scrivi con chi: «uscita con Luca la prossima settimana».</p>`
    : `<p class="rp-capito">Uscita con ${noti.length ? chi : `<b>${C.esc(nome)}</b> (la aggiungo alle tue persone)`} da fissare${sett ? (sett === C.lunediDi(new Date()) ? ", questa settimana" : C.giorniTra(C.lunediDi(new Date()), sett) === 7 ? ", la prossima settimana" : ", tra 2 settimane") : ""}. Poi incolli le sue date e ti propongo quando.</p>
      <button type="button" class="btn pieno H rp-fisso" data-r="p-uscita">Crea l'uscita</button>`;
}
/** con l'ora precisa: avviso se si accavalla con qualcosa del calendario */
function sovrapposto(s) {
  if (!s.data || !s.ora) return "";
  const sett = settDi(s.data), gg = C.giorniTra(sett, s.data), da = X.hm(s.ora), a = da + s.dur;
  const b = X.blocchiSettimana(sett).blocchi.find(b => b.g === gg && X.occupa(b) && X.hm(b.da) < a && X.fine(b) > da);
  return b ? `<div class="rp-conflitto"><b>Si sovrappone</b> a «${C.esc(b.titolo)}» ${b.da} – ${b.a}. Lo metto lo stesso: poi decidi tu cosa spostare.</div>` : "";
}
/** gli spazi liberi per un impegno: tra le 8 e le 22, con lo stacco e il viaggio prima e dopo; al massimo 3 */
function trovaSpazi(s) {
  const o = C.oggi(), adesso = new Date().getHours() * 60 + new Date().getMinutes(), st = Number(X.metodo().stacco || 10);
  const giorni = s.entro === "oggi" ? [o] : s.entro === "domani" ? [C.piuGiorni(o, 1)] : Array.from({ length: 7 - ((new Date().getDay() + 6) % 7) }, (_, i) => C.piuGiorni(o, i));
  const P = [];
  for (const giorno of giorni) {
    const sett = settDi(giorno), gg = C.giorniTra(sett, giorno);
    const B = X.blocchiSettimana(sett).blocchi.filter(b => b.g === gg && X.occupa(b)).sort((a, b) => X.hm(a.da) - X.hm(b.da));
    let t = 8 * 60, luogoPrima = "Casa", trovati = 0;
    if (giorno === o) t = Math.max(t, Math.ceil((adesso + 15) / 15) * 15);
    for (const b of [...B, { da: "22:00", a: "22:00", luogo: "Casa", fine: true }]) {
      const q = { g: (C.daIso(giorno).getDay() + 6) % 7, min: t };
      const vaiA = X.tragitto(luogoPrima, s.dove, q), torna = X.tragitto(s.dove, b.luogo ?? "Casa", { ...q, min: X.hm(b.da) });
      const inizio = Math.ceil((t + vaiA) / 15) * 15;
      if (X.hm(b.da) - st - torna - inizio >= s.dur && inizio + s.dur <= 22 * 60) {
        const libero = X.hm(b.da) - (inizio + s.dur);
        P.push({ giorno, da: inizio, a: inizio + s.dur, nota: b.fine ? "Libero fino a sera" : `Libero, poi ${oreTxtR(libero)} prima di «${b.titolo}»`, sera: inizio >= 20 * 60 });
        if (++trovati >= 2) break;
      }
      if (X.hm(b.da) < 22 * 60) { t = Math.max(t, X.fine(b) + st); luogoPrima = b.luogo || "Casa"; }
    }
    if (P.length >= 4) break;
  }
  // prima quelli non di sera, poi in ordine di tempo
  return P.sort((a, b) => a.sera - b.sera || a.giorno.localeCompare(b.giorno) || a.da - b.da).slice(0, 3).map(p => ({ ...p, nota: p.sera ? p.nota + " · è sera" : p.nota }));
}
const oreTxtR = m => m >= 60 ? X.oreTxt(m) : m + "'";
function creaImpegno(giorno, da, s) {
  const sett = settDi(giorno);
  X.salvaBlocco(sett, { id: nid(), g: C.giorniTra(sett, giorno), da: X.fmt(da), a: X.fmt(Math.min(da + s.dur, 24 * 60 - 1)), titolo: s.testo, tipo: "imprevisto", luogo: s.dove, fonte: "imprevisto" }, () => {}, { nuovo: true });
  if (s.daVoce) { C.D.scrivi("voce:" + s.daVoce, null); s.daVoce = null; }
  const viaggio = X.tragitto("Casa", s.dove);
  s.spazi = null; s.esito = [G.collegato() ? "Messo in Calendar" : "Messo nella settimana", `${maiuscolo(nomeGiorno(giorno))} ${X.fmt(da)} – ${X.fmt(da + s.dur)}${viaggio ? ` · parti verso le ${X.fmt(da - viaggio)}` : ""}.${G.collegato() ? " Se lo sposti in Calendar, si sposta anche qui." : ""}`];
  disegnaFoglio(); C.disegna();
}
/** che cos'è quello che scrivi: «2h», «30 min» = impegno; manda/scrivi/chiama… = azione rapida; «idea» = per dopo */
function indovina(t) {
  if (RE_SENTITO.test(t)) return "sentito";
  if (RE_USCITA.test(t)) return "uscita";
  t = t.toLowerCase();
  if (/\d\s*(h|ore|ora|min|')\b|\bvisita\b|\bcall\b|\briunione\b|\bappuntamento\b|\bcena\b|\bpranzo\b/.test(t)) return "impegno";
  if (/\bidea\b|\bun giorno\b|\bprima o poi\b|\bprogetto\b|^[^:]{2,20}:/.test(t)) return "dopo";
  if (/\boggi (è|ho|mi)\b|\bha funzionato\b|\bmi sono\b/.test(t)) return "diario";
  return "rapida";
}
const durataDa = t => { const h = t.match(/(\d+(?:[.,]\d)?)\s*(h|ore|ora)\b/i), m = t.match(/(\d+)\s*(min|')/i); return h ? Math.round(parseFloat(h[1].replace(",", ".")) * 60 / 15) * 15 : m ? Math.max(15, Math.round(m[1] / 15) * 15) : null; };
function foglioClic(e, r) {
  const s = R.foglio, k = r.dataset.r, v = r.dataset.v;
  if (!s) return;
  if (k === "chiudi") return chiudi();
  if (s.tipo === "scheda") {
    const voce = C.D.leggi("voce:" + s.id);
    if (!voce) return chiudi();
    const leggi = () => { s.testoVivo = $("#rp-foglio [data-rc=testo]").value; s.oraViva = $("#rp-foglio [data-rc=ora]").value; };
    if (k === "s-giorno") { leggi(); s.giorno = v; }
    else if (k === "s-chi") { leggi(); s.persona = v; }
    else if (k === "s-fai") { chiudi(); return fai(r.dataset.k, { ...voce, id: s.id }); }
    else if (k === "s-salva") {
      const testo = $("#rp-foglio [data-rc=testo]").value.trim() || voce.testo, ora = $("#rp-foglio [data-rc=ora]").value, giorno = s.giorno === "capita" ? null : s.giorno;
      scriviV({ ...voce, id: s.id }, { testo, ora: giorno ? ora : "", giorno, settimana: settDi(giorno), persona: s.persona || null, ...(giorno !== voce.giorno ? { rinvii: 0 } : {}) });
      if (ora && ora !== voce.ora && giorno) inCalendar(testo, giorno, ora);
      chiudi(); C.avvisa("Salvata", true); return C.disegna();
    }
    disegnaFoglio();
    if (s.testoVivo != null) { $("#rp-foglio [data-rc=testo]").value = s.testoVivo; $("#rp-foglio [data-rc=ora]").value = s.oraViva; }
    return;
  }
  // foglio «+»
  const campo = $("#rp-foglio [data-rc=piu-testo]");
  if (campo) s.testo = campo.value;
  const tOra = $("#rp-foglio [data-rc=p-ora]"), tData = $("#rp-foglio [data-rc=p-data]");
  if (tOra) s.ora = tOra.value; if (tData) s.data = tData.value;
  const testo = s.testo.trim();
  if (k === "indietro") s.spazi = null;
  else if (k === "p-tipo") { s.t = v; s.scelto = true; }
  else if (k === "p-giorno") { s.giorno = v; if (v !== C.oggi() && s.quando === "subito") s.quando = "blocco"; }
  else if (k === "p-quando") s.quando = v;
  else if (k === "p-dur") { if (v === "altro") s.altro = true; else { s.altro = false; s.dur = Number(v); } }
  else if (k === "p-meno") s.dur = Math.max(15, s.dur - 15);
  else if (k === "p-piu") s.dur += 15;
  else if (k === "p-entro") s.entro = v;
  else if (k === "p-dove") s.dove = v;
  else if (k === "p-nota") s.nota = v;
  else if (k === "posto") { const p = s.spazi[Number(v)]; return creaImpegno(p.giorno, p.da, s); }
  else if (k === "p-sentito" || k === "p-uscita") {
    const { noti, nome } = chiDaTesto(testo);
    const ids = noti.length ? noti.map(p => p.id) : nome ? [PS.nuova(nome, 14)] : [];
    if (!ids.length) { campo?.focus(); return; }
    chiudi();
    if (k === "p-sentito") { ids.forEach(id => PS.sentito(id, { avviso: false })); C.avvisa(`${[...noti.map(p => p.nome), nome].filter(Boolean).join(", ")}: sentito oggi`, true, "spunta"); return C.disegna(); }
    const id = PS.nuovaUscita(ids[0], settDaTesto(testo));
    C.disegna(); return PS.apriUscita(id);
  }
  else if (!testo && ["p-crea", "p-cerca", "p-dopo", "p-diario"].includes(k)) { C.avvisa("Scrivi prima cosa ti è spuntato"); campo?.focus(); return; }
  else if (k === "p-crea") {
    const giorno = s.giorno === "capita" ? null : s.giorno;
    let ora = s.quando === "ora" ? s.ora || "10:00" : s.quando === "subito" ? (primoBuco(15) != null ? X.fmt(primoBuco(15)) : "") : "";
    if (!giorno) ora = "";
    nuova(testo, giorno, { ora });
    inCalendar(testo, giorno, ora);
    s.esito = ["Fatto", giorno ? `Nelle azioni rapide di ${nomeGiorno(giorno)}${ora ? ` alle ${ora}${G.collegato() ? ", anche in Calendar con l'avviso" : ""}` : ""}.` : "In «quando capita»."];
    C.disegna();
  } else if (k === "p-cerca") {
    if (s.entro === "ore") return creaImpegno(s.data || C.oggi(), X.hm(s.ora || "16:00"), { ...s, testo });
    s.testo = testo; s.spazi = trovaSpazi(s);
  } else if (k === "p-dopo") {
    C.D.scrivi("voce:" + nid(), { ...X.leggiRacc(testo), tipo: "inbox", fatto: false, creato: Date.now() });
    s.esito = ["Messa da parte", "La ritrovi domenica in Pianifica, al passo «Svuota e smista»."]; C.disegna();
  } else if (k === "p-diario") {
    C.D.scrivi("nota:" + nid(), { settimana: C.lunediDi(new Date()), tipo: s.nota, testo, quando: Date.now() });
    s.esito = ["Scritto nel diario", "Lo rileggi domenica, al primo passo di Pianifica."]; C.disegna();
  }
  disegnaFoglio();
}
// mentre scrivi nel «+» indovino il tipo (finché non lo scegli tu) e la durata
document.addEventListener("input", e => {
  if (!e.target.matches?.("#rp-foglio [data-rc=piu-testo]")) return;
  const s = R.foglio; s.testo = e.target.value;
  if (s.scelto) return;
  const t = indovina(s.testo), d = durataDa(s.testo);
  if (t !== s.t || (d && d !== s.dur) || t === "sentito" || t === "uscita") {   // per le persone ridisegno a ogni lettera (chi è?)
    s.t = t; if (d) { s.dur = d; s.altro = ![15, 30, 60, 120].includes(d); }
    const pos = e.target.selectionStart; disegnaFoglio();
    const c = $("#rp-foglio [data-rc=piu-testo]"); c.focus(); c.setSelectionRange(pos, pos);
  }
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches?.("#rp-foglio input")) { e.preventDefault(); $("#rp-foglio .rp-fisso")?.click(); } });
