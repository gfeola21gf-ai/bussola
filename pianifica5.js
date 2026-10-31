/* pianifica5.js — Pianifica v5 (dal 2026-10-31; anteprima approvata anteprima/pianifica-v5.html, Smista con ENTRAMBE le modalità).
   Stesso metodo di prima (diario → smistare per ruoli → un sasso grande per ruolo → prima i sassi in agenda), con la logica del «+»:
     1 Guarda indietro · 2 Smista (Tutte insieme | Una alla volta) · 3 Ruoli e sassi · 4 In agenda · 5 Pronta.
   Dati: gli stessi di sempre. Ruoli della settimana = `ruolo:<id>` (istanzaRuolo); le cose da sistemare sono le voci di Da sistemare
   (inbox, todo senza giorno) + il parcheggio che torna (ritorna <= settimana); smistarle cambia la voce SUBITO:
     az = todo senza giorno (con `ruolo`) · imp = inbox con `impegno: true, dur` · dopo = parcheggio senza data · via = eliminata.
   Sasso grande = la stessa voce diventa `tipo: "ruolo", sasso: true` (`prima` = il tipo di prima, per togliere la stella).
   In agenda: «Dove lo metto?» di aggiungi.js (sassi con `tieni` e fonte "voce:<id>", impegni normali); azioni = giorno + blocco «Azioni».
   Passo salvato in `piano:<lunedì>.p5`. Usa SOLO data-p5 (+ i data-p già esistenti «inizia», «sett», «scegli-ruolo», «da-nota», «a-regola»). */
import * as G from "./gcal.js?v=20261031181718";
import * as SD from "./sudime.js?v=20261031181718";
import * as AG from "./aggiungi.js?v=20261031181718";
let C, X;
export function init(ctx, extra) { C = ctx; X = extra; }
const $ = s => document.querySelector(s);
const leggiLS = k => { try { return localStorage.getItem(k); } catch { return null; } };
const S5 = { modo: leggiLS("bussola.smista") === "carta" ? "carta" : "lista", visti: new Set(), iaFatta: new Set(), iaInCorso: false };
const PASSI = [
  { nome: "Guarda indietro", dom: "Com'è andata la settimana?", sotto: "Rileggi il diario: quello che vuoi cambiare diventa un'azione o una regola." },
  { nome: "Smista", dom: "Cosa hai da sistemare?", sotto: "Tutto in un posto. Per ognuna: di che ruolo è e cos'è." },
  { nome: "Ruoli e sassi", dom: "Chi vuoi essere questa settimana?", sotto: "Per ogni ruolo l'obiettivo e un sasso grande: tocca la stella." },
  { nome: "In agenda", dom: "Dove li metti?", sotto: "Prima i sassi grandi, poi gli altri impegni, poi le azioni nei giorni." },
  { nome: "Pronta", dom: "La tua settimana", sotto: "" },
];
const STELLA = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`;
const durTxt = m => m < 60 ? `${m}'` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}'` : ""}`;
const GIORNI_C = ["L", "M", "M", "G", "V", "S", "D"];
const leggi = id => ({ ...C.D.leggi("voce:" + id), id });
const scrivi = (v, cambia) => { const { id, ...r } = v; C.D.scrivi("voce:" + id, { ...r, ...cambia }); };

// ---------- dati ----------
const sett = () => X.sett();
const ruoliSett = () => C.ruoli(sett());
const nomeRuolo = v => ruoliSett().find(r => r.id === v.ruolo)?.nome || "";
const coloreRuolo = nome => { const b = X.metodo().ruoli.find(r => r.nome.toLowerCase() === (nome || "").toLowerCase()); return b ? C.col(b.colore).c : "#A39E93"; };
/** le cose da smistare: Da sistemare (inbox + azioni senza giorno) + il parcheggio che torna per questa settimana */
function daSmistare() {
  const V = C.voci().filter(v => !v.padre), s = sett();
  return [...V.filter(v => v.tipo === "inbox"), ...V.filter(v => v.tipo === "todo" && !v.giorno && !v.fatto), ...V.filter(v => v.tipo === "parcheggio" && v.ritorna && v.ritorna <= s)];   // ordine fisso: smistando una cosa non salta altrove
}
const tipoDi = v => v.tipo === "parcheggio" ? "dopo" : v.impegno ? "imp" : "az";
const daDove = v => v.tipo === "parcheggio" ? "dal parcheggio" : v.tipo === "inbox" && !v.impegno ? "catturata" : "da sistemare";
/** cambia il destino di una voce (subito, si annulla con ⌘Z / Annulla) */
function destino(v, tipo, dur) {
  const s = sett();
  if (tipo === "via") { C.D.scrivi("voce:" + v.id, null); C.avvisa("Eliminata", true); return; }
  if (tipo === "dopo") return scrivi(v, { tipo: "parcheggio", ritorna: null, parcheggiato: C.oggi(), giorno: null, sasso: false });
  if (tipo === "az") return scrivi(v, { tipo: "todo", giorno: null, settimana: s, ora: "", fatto: false, impegno: false, ritorna: null, ordine: v.ordine ?? Date.now() });
  scrivi(v, { tipo: "inbox", impegno: true, dur: dur || v.dur || 60, ritorna: null, creato: v.creato || Date.now() });
}
function ruoloA(v, nome) { scrivi(v, { ruolo: nome ? X.istanzaRuolo(nome, sett()) : null }); }

/** l'assistente propone ruolo, tipo e durata per le cose nuove (una volta per voce); quello che hai già toccato non lo cambia */
function proponiIA() {
  if (C.D.PROVA || !navigator.onLine || S5.iaInCorso) return;
  const L = daSmistare().filter(v => !v.ruolo && !S5.iaFatta.has(v.id) && !v.toccata);
  if (!L.length) return;
  S5.iaInCorso = true; L.forEach(v => S5.iaFatta.add(v.id));
  const ruoli = X.metodo().ruoli.map(r => ({ nome: r.nome, domanda: r.domanda || "" }));
  Promise.race([C.D.funzione("bussola-ia", { azione: "smista", cose: L.map(v => ({ t: v.testo, nota: v.impegno ? `impegno ${v.dur || ""}'` : "" })), ruoli, fatti: SD.fatti() }).catch(() => null),
    new Promise(ok => setTimeout(() => ok(null), 22000))]).then(r => {
    S5.iaInCorso = false;
    (r?.scelte || []).forEach(s => {
      const v0 = L[s.i]; if (!v0) return; const v = leggi(v0.id); if (!v.testo || v.toccata || v.ruolo) return;
      const nome = X.metodo().ruoli.find(x => x.nome.toLowerCase() === String(s.ruolo || "").toLowerCase())?.nome;
      if (nome) ruoloA(v, nome);
      if (["az", "imp", "dopo"].includes(s.tipo) && s.tipo !== tipoDi(v)) destino(leggi(v.id), s.tipo, s.dur > 0 ? Math.round(s.dur / 15) * 15 : 60);
      else if (s.tipo === "imp" && s.dur > 0 && !v.dur) scrivi(leggi(v.id), { dur: Math.round(s.dur / 15) * 15 });
      scrivi(leggi(v.id), { ia: true });
    });
    C.disegna();
  });
}

// ---------- i passi ----------
function p1() {
  const s = sett(), prec = C.piuGiorni(s, -7), NT = Object.fromEntries(C.NOTE.map(t => [t.k, t]));
  const diario = C.tutte("nota:").filter(n => n.settimana === prec || n.settimana === s).sort((a, b) => (a.quando || 0) - (b.quando || 0));
  const torna = C.voci().filter(v => v.tipo === "parcheggio" && v.ritorna && v.ritorna <= s && !v.padre);
  return `<div class="p5-et"><b>Il diario</b>${diario.length || ""}</div><div class="p5-card">${diario.length ? diario.map(n => `<div class="p5-nota"><span class="p5-tag" style="background:${NT[n.tipo]?.c || "#999"}">${NT[n.tipo]?.corto || ""}</span>
      <div class="t">${C.esc(n.testo)}${n.tipo !== "bene" ? (n.fatta ? `<small>${C.esc(n.fatta)}</small>` : `<div class="p5-az"><button class="p5-chip blu" data-p="da-nota" data-id="${n.id}">→ Azione</button><button class="p5-chip" data-p="a-regola" data-id="${n.id}">→ Regola</button></div>`) : ""}</div></div>`).join("")
    : `<p class="p5-vuoto">Il diario è vuoto. In settimana scrivi dal «+» → Scrivi sul diario.</p>`}</div>
    ${torna.length ? `<div class="p5-et"><b>Tornano dal parcheggio</b>${torna.length} · le trovi al passo 2</div><div class="p5-card">${torna.map(v => `<div class="p5-riga"><div class="t">${C.esc(v.testo)}</div><button class="p5-chip" data-p5="rimanda" data-id="${v.id}">Rimanda</button></div>`).join("")}</div>` : ""}`;
}
const TIPI = [["az", "Azione"], ["imp", "Impegno"], ["dopo", "Più avanti"], ["via", "Elimina"]];
const DURATE = [15, 30, 45, 60, 90, 120, 180, 240];
function selRuolo(v) {
  const nome = nomeRuolo(v), R = X.metodo().ruoli;
  return `<select class="p5-sel ruolo" style="--c:${coloreRuolo(nome)}" data-p5s="ruolo" data-id="${v.id}"><option value="">Nessun ruolo</option>${R.map(r => `<option ${r.nome === nome ? "selected" : ""}>${C.esc(r.nome)}</option>`).join("")}</select>`;
}
function p2() {
  const L = daSmistare(), avanti = C.voci().filter(v => v.tipo === "parcheggio" && !v.ritorna && !v.padre);
  proponiIA();
  const modo = `<div class="p5-modo"><button data-p5="modo" data-m="lista" class="${S5.modo === "lista" ? "on" : ""}">Tutte insieme</button><button data-p5="modo" data-m="carta" class="${S5.modo === "carta" ? "on" : ""}">Una alla volta</button></div>`;
  const nota = S5.iaInCorso ? `<p class="p5-ia"><i></i>L'assistente sta proponendo ruolo e tipo…</p>` : L.some(v => v.ia) ? `<p class="p5-ia">Proposte dall'assistente: cambia solo quello che non va.</p>` : "";
  const piu = avanti.length ? `<button class="p5-piu" data-p5="avanti">${avanti.length} ${avanti.length === 1 ? "cosa" : "cose"} in «Più avanti» ${S5.avanti ? "‹" : "›"}</button>${S5.avanti ? `<div class="p5-card">${avanti.map(v => `<div class="p5-riga"><div class="t">${C.esc(v.testo)}</div><button class="p5-chip blu" data-p5="riprendi" data-id="${v.id}">Questa settimana</button></div>`).join("")}</div>` : ""}` : "";
  if (!L.length) return modo + `<div class="p5-card"><p class="p5-vuoto">Niente da smistare: la testa è libera.</p></div>` + piu;
  if (S5.modo === "lista") return modo + nota + `<div class="p5-card">${L.map(v => { const t = tipoDi(v); return `<div class="p5-sm"><b>${C.esc(v.testo)}</b><small>${daDove(v)}</small>
      <div class="p5-sels">${selRuolo(v)}<select class="p5-sel" data-p5s="tipo" data-id="${v.id}">${TIPI.map(([k, n]) => `<option value="${k}" ${t === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${t === "imp" ? `<select class="p5-sel dur" data-p5s="dur" data-id="${v.id}">${DURATE.map(d => `<option value="${d}" ${(v.dur || 60) === d ? "selected" : ""}>${durTxt(d)}</option>`).join("")}</select>` : ""}</div></div>`; }).join("")}</div>` + piu;
  // una alla volta: le carte non ancora viste in questa sessione
  const resta = L.filter(v => !S5.visti.has(v.id));
  if (!resta.length) return modo + `<div class="p5-card"><p class="p5-vuoto">Le hai viste tutte (${L.length}). Puoi ricontrollarle in «Tutte insieme», o andare avanti.</p></div>` + piu;
  const v = resta[0], t = tipoDi(v), nome = nomeRuolo(v);
  return modo + nota + `<div class="p5-carta" id="p5-carta" data-id="${v.id}"><small>${L.length - resta.length + 1} di ${L.length} · ${daDove(v)}</small><h3>${C.esc(v.testo)}</h3>
    <div class="p5-lab">Di che ruolo è?</div><div class="p5-chips">${X.metodo().ruoli.map(r => `<button class="p5-chip ruolo ${r.nome === nome ? "on" : ""}" style="--c:${C.col(r.colore).c}" data-p5="c-ruolo" data-r="${C.esc(r.nome)}">${C.esc(r.nome)}</button>`).join("")}</div>
    <div class="p5-lab">Cos'è?</div><div class="p5-chips">${TIPI.slice(0, 3).map(([k, n]) => `<button class="p5-chip ${t === k ? "on" : ""}" data-p5="c-tipo" data-t="${k}">${n}</button>`).join("")}</div>
    ${t === "imp" ? `<div class="p5-lab">Quanto dura?</div><div class="p5-chips">${DURATE.slice(0, 7).map(d => `<button class="p5-chip ${(v.dur || 60) === d ? "on" : ""}" data-p5="c-dur" data-d="${d}">${durTxt(d)}</button>`).join("")}</div>` : ""}
    <p class="p5-gesti">Scorri a destra = va bene, la prossima · a sinistra = più avanti</p>
    <div class="p5-chips" style="margin-top:6px"><button class="p5-chip" data-p5="c-via">Elimina</button><button class="p5-chip blu" data-p5="c-ok">Va bene ›</button></div></div>` + piu;
}
function p3() {
  const s = sett(), R = ruoliSett(), scelti = new Set(R.map(r => r.nome.toLowerCase())), M = X.metodo().ruoli;
  const chips = `<div class="p5-chips" style="justify-content:flex-start;margin-bottom:10px">${M.map(r => `<button class="p5-chip ruolo ${scelti.has(r.nome.toLowerCase()) ? "on" : ""}" style="--c:${C.col(r.colore).c}" data-p="scegli-ruolo" data-r="${C.esc(r.nome)}">${C.esc(r.nome)}</button>`).join("")}</div>
    ${R.length > 5 ? `<p class="p5-avviso">Più di 5 ruoli diventa insostenibile: scegliere vuol dire anche «non ora».</p>` : ""}`;
  const voci = C.voci().filter(v => !v.padre && v.ruolo && (v.tipo === "ruolo" || v.tipo === "inbox" || (v.tipo === "todo" && !v.fatto && (!v.giorno || v.settimana === s))));
  return chips + R.map(r => {
    const c = C.col(r.colore).c, base = M.find(x => x.nome.toLowerCase() === r.nome.toLowerCase());
    const L = voci.filter(v => v.ruolo === r.id).sort((a, b) => (b.sasso ? 1 : 0) - (a.sasso ? 1 : 0));
    return `<div class="p5-card p5-ruolo" style="--c:${c}"><div class="rt"><b>${C.esc(r.nome)}</b><small>${C.esc(base?.domanda || "obiettivo della settimana")}</small></div>
      <input class="p5-ob" data-p5i="ob" data-id="${r.id}" value="${C.esc(r.obiettivo || "")}" placeholder="L'obiettivo della settimana">
      <div class="p5-lab" style="padding:0 14px">Il sasso grande</div>
      ${L.map(v => `<div class="p5-cosa ${v.sasso ? "sasso" : ""}"><div class="t">${C.esc(v.testo)}<small>${v.impegno || v.sasso ? `Impegno · ${durTxt(v.dur || (v.ore ? v.ore * 60 : 60))}` : v.tipo === "ruolo" ? "Promemoria" : "Azione"}</small></div>
        <button class="p5-stella ${v.sasso ? "on" : ""}" data-p5="stella" data-id="${v.id}" aria-label="Sasso grande">${STELLA}</button></div>`).join("")}
      <form class="p5-nuovo" data-p5f="sasso" data-r="${r.id}"><input name="t" placeholder="+ Scrivi un sasso grande" enterkeyhint="done"></form></div>`;
  }).join("") + (R.length ? "" : `<div class="p5-card"><p class="p5-vuoto">Scegli i ruoli di questa settimana qui sopra (3-5).</p></div>`);
}
function p4() {
  const s = sett(), p = X.piano(s), B = p?.blocchi || [];
  const sassi = X.sassi(s), messo = id => B.find(b => b.fonte === "voce:" + id);
  const imp = C.voci().filter(v => v.tipo === "inbox" && v.impegno && !v.padre);
  const az = C.voci().filter(v => v.tipo === "todo" && !v.fatto && !v.padre && (!v.giorno || v.settimana === s));
  const gg = b => `${["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"][b.g]} ${b.da}`;
  const riga = (v, nome, sasso) => { const b = sasso && messo(v.id); return `<div class="p5-ag" style="--c:${coloreRuolo(nome)}"><span class="p"></span><div class="t">${C.esc(v.testo)}<small>${C.esc(nome || "Nessun ruolo")}${sasso ? " · sasso grande" : ""} · ${durTxt(v.dur || (v.ore ? v.ore * 60 : 60))}</small></div>
    ${b ? `<button class="p5-ok" data-p5="dove" data-id="${v.id}" data-s="1">${gg(b)}</button>` : `<button class="p5-chip blu" data-p5="dove" data-id="${v.id}"${sasso ? ' data-s="1"' : ""}>Dove?</button>`}</div>`; };
  return `<div class="p5-et"><b>1. I sassi grandi</b></div><div class="p5-card">${sassi.length ? sassi.map(v => riga(v, v.r.nome, true)).join("") : `<p class="p5-vuoto">Nessun sasso grande: sceglilo al passo 3.</p>`}</div>
    <div class="p5-et"><b>2. Gli altri impegni</b>${imp.length || ""}</div><div class="p5-card">${imp.length ? imp.map(v => riga(v, nomeRuolo(v), false)).join("") : `<p class="p5-vuoto">Nessun impegno da mettere.</p>`}</div>
    <div class="p5-et"><b>3. Le azioni rapide</b>tocca il giorno</div><div class="p5-card">${az.length ? az.map(v => `<div class="p5-ag" style="--c:${coloreRuolo(nomeRuolo(v))}"><span class="p"></span><div class="t">${C.esc(v.testo)}</div>
      <div class="p5-giorni">${GIORNI_C.map((g, i) => { const iso = C.piuGiorni(s, i); return `<button class="${v.giorno === iso ? "on" : ""}" data-p5="giorno" data-id="${v.id}" data-g="${iso}">${g}</button>`; }).join("")}</div></div>`).join("") : `<p class="p5-vuoto">Nessuna azione senza giorno.</p>`}</div>
    <div class="p5-et"><b>La settimana</b></div><div class="paper gs-carta">${X.grigliaSettimana(s)}</div>`;
}
function p5() {
  const s = sett(), R = ruoliSett(), sassi = X.sassi(s);
  return `${G.collegato() ? `<div class="p5-inviato">✓ I blocchi nuovi sono già in Google Calendar</div>` : ""}
    <div class="p5-et"><b>Il focus</b></div><div class="p5-card">${R.map(r => { const sg = sassi.filter(x => x.ruolo === r.id); return `<div class="p5-focus" style="--c:${C.col(r.colore).c}"><b>${C.esc(r.nome)}</b><p>${C.esc(r.obiettivo || "—")}</p>${sg.map(x => `<div class="s">${STELLA}${C.esc(x.testo)}</div>`).join("")}</div>`; }).join("") || `<p class="p5-vuoto">Nessun ruolo scelto.</p>`}</div>
    <div class="p5-et"><b>La settimana</b></div><div class="paper gs-carta">${X.grigliaSettimana(s)}</div>`;
}

// ---------- la vista ----------
export function vista() {
  const s = sett(), p = X.piano(s);
  const testa = `<div class="testa"><div><h1 class="H">Pianifica${X.aiuto("pianifica")}</h1><p>${C.intervallo(s)} · settimana ${C.numSettimana(s)}</p></div>
    <div class="nav-t">${p && G.collegato() ? `<button class="tondo" data-p="g-aggiorna" title="Rileggi Google Calendar" aria-label="Rileggi Google Calendar">${C.ico("annulla")}</button>` : ""}
      <button class="tondo" data-p="sett" data-d="-7" aria-label="Settimana prima">${C.ico("prima")}</button><button class="tondo" data-p="sett" data-d="7" aria-label="Settimana dopo">${C.ico("dopo")}</button></div></div>`;
  if (!p) return testa + `<div class="p5-card p5-inizio"><h2>Pianifichiamo la settimana?</h2><p>5 passi: guarda indietro, smista, ruoli e sassi, in agenda, pronta.</p>
    ${daSmistare().length ? `<p>Hai <b>${daSmistare().length}</b> ${daSmistare().length === 1 ? "cosa" : "cose"} da sistemare: le trovi al passo 2.</p>` : ""}
    <button class="p5-b blu" data-p="inizia">Inizia</button></div>`;
  const n = Math.min(p.p5 ?? 0, 4), fin = p.finito;
  const tappe = `<div class="p5-tappe">${PASSI.map((x, i) => `<button class="${i < n || fin ? "fatta" : ""} ${i === n ? "ora" : ""}" data-p5="passo" data-n="${i}" title="${x.nome}"><i></i><span>${x.nome}</span></button>`).join("")}</div>`;
  const ps = PASSI[n];
  const corpo = [p1, p2, p3, p4, p5][n]();
  return testa + tappe + `<div class="p5-dom"><h2>${ps.dom}</h2>${ps.sotto ? `<p>${ps.sotto}</p>` : ""}</div>${corpo}
    <div class="pf-barra">${n ? `<button class="pf-ind" data-p5="passo" data-n="${n - 1}">${C.ico("prima")}Indietro</button>` : "<span></span>"}<span class="pf-dove"></span>
      ${n < 4 ? `<button class="pf-avanti" data-p5="passo" data-n="${n + 1}">Avanti${C.ico("dopo")}</button>` : `<button class="pf-avanti" data-p5="fine">${fin ? "Vai alla settimana" : "Fatto: settimana pronta"}</button>`}</div>`;
}

// ---------- eventi ----------
function vaiPasso(n) { X.modPiano(p => { p.p5 = n; }); C.disegna(); $("main")?.scrollTo(0, 0); }
document.addEventListener("click", e => {
  const b = e.target.closest("[data-p5]"); if (!b) return;
  const k = b.dataset.p5, id = b.dataset.id;
  if (k === "passo") return vaiPasso(Number(b.dataset.n));
  if (k === "fine") {
    const s = sett(); X.modPiano(p => { p.finito = true; p.p5 = 4; });
    X.vaiASettimana(s); C.avvisa("Settimana pronta. Buona settimana!", false, "bersaglio"); return;
  }
  if (k === "modo") { S5.modo = b.dataset.m; try { localStorage.setItem("bussola.smista", S5.modo); } catch {} return C.disegna(); }
  if (k === "avanti") { S5.avanti = !S5.avanti; return C.disegna(); }
  if (k === "riprendi") { destino(leggi(id), "az"); return C.disegna(); }
  if (k === "rimanda") { scrivi(leggi(id), { ritorna: C.piuGiorni(sett(), 14) }); C.avvisa("Rimandata di 2 settimane", true); return C.disegna(); }
  // una alla volta
  const carta = $("#p5-carta"), cv = carta && leggi(carta.dataset.id);
  if (k === "c-ruolo" && cv) { ruoloA(cv, nomeRuolo(cv) === b.dataset.r ? "" : b.dataset.r); scrivi(leggi(cv.id), { toccata: true }); return C.disegna(); }
  if (k === "c-tipo" && cv) { destino(cv, b.dataset.t); scrivi(leggi(cv.id), { toccata: true }); if (b.dataset.t !== "imp") S5.visti.add(cv.id); return C.disegna(); }
  if (k === "c-dur" && cv) { scrivi(cv, { dur: Number(b.dataset.d), toccata: true }); S5.visti.add(cv.id); return C.disegna(); }
  if (k === "c-ok" && cv) { S5.visti.add(cv.id); return C.disegna(); }
  if (k === "c-via" && cv) { S5.visti.add(cv.id); destino(cv, "via"); return C.disegna(); }
  // sasso grande: una stella per ruolo
  if (k === "stella") {
    const v = leggi(id);
    if (v.sasso) scrivi(v, { sasso: false, tipo: v.prima || "ruolo" });
    else {
      C.voci().filter(x => x.sasso && x.ruolo === v.ruolo && x.id !== v.id).forEach(x => scrivi(leggi(x.id), { sasso: false, tipo: x.prima || "ruolo" }));
      scrivi(v, { sasso: true, prima: v.tipo, tipo: "ruolo", settimana: sett(), ore: (v.dur || 60) / 60, dur: v.dur || 60, giorno: null });
    }
    return C.disegna();
  }
  if (k === "dove") {
    const v = leggi(id), sasso = !!b.dataset.s;
    return AG.apri("impegno", v.testo, id, sasso ? { dal: sett(), dur: v.dur || (v.ore ? v.ore * 60 : 60), tieni: true, fonte: "voce:" + id, tipoBlocco: "sasso" } : { dal: sett() });
  }
  if (k === "giorno") {
    const v = leggi(id), g = b.dataset.g, nuovo = v.giorno === g ? null : g;
    scrivi(v, { giorno: nuovo, settimana: nuovo ? sett() : v.settimana, rinvii: 0 });
    [v.giorno, nuovo].filter(Boolean).forEach(x => X.bloccoRapide(x));
    return C.disegna();
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.p5s) {
    const v = leggi(el.dataset.id), k = el.dataset.p5s;
    if (k === "ruolo") ruoloA(v, el.value);
    else if (k === "tipo") destino(v, el.value);
    else if (k === "dur") scrivi(v, { dur: Number(el.value) });
    if (C.D.leggi("voce:" + v.id)) scrivi(leggi(v.id), { toccata: true });
    return C.disegna();
  }
  if (el.dataset.p5i === "ob") { const r = C.D.leggi("ruolo:" + el.dataset.id); if (r) C.D.scrivi("ruolo:" + el.dataset.id, { ...r, obiettivo: el.value.trim() }); }
});
document.addEventListener("submit", e => {
  const f = e.target.closest?.("[data-p5f]"); if (!f) return;
  e.preventDefault();
  const t = f.t.value.trim(); if (!t) return;
  const r = f.dataset.r;
  C.voci().filter(x => x.sasso && x.ruolo === r).forEach(x => scrivi(leggi(x.id), { sasso: false, tipo: x.prima || "ruolo" }));
  C.D.scrivi("voce:" + C.nuovoId(), { testo: t, tipo: "ruolo", ruolo: r, sasso: true, settimana: sett(), dur: 60, ore: 1, fatto: false, ordine: Date.now() });
  C.disegna();
});
// una alla volta: scorri la carta (destra = va bene, sinistra = più avanti)
let T = null;
document.addEventListener("pointerdown", e => { const c = e.target.closest("#p5-carta"); if (c && !e.target.closest("button")) T = { c, x: e.clientX, y: e.clientY }; });
document.addEventListener("pointermove", e => { if (!T) return; const dx = e.clientX - T.x; if (Math.abs(e.clientY - T.y) > 40 && Math.abs(dx) < 20) { T = null; return; } T.c.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`; });
document.addEventListener("pointerup", e => {
  if (!T) return; const { c, x } = T, dx = e.clientX - x; T = null;
  if (Math.abs(dx) < 90) { c.style.transform = ""; return; }
  const v = leggi(c.dataset.id); c.style.transform = `translateX(${dx > 0 ? 600 : -600}px)`; c.style.opacity = 0;
  setTimeout(() => { if (dx < 0) destino(v, "dopo"); S5.visti.add(v.id); C.disegna(); }, 180);
});
