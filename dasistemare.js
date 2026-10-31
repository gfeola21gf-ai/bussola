/* dasistemare.js — «Da sistemare», dentro Settimana (dal 2026-10-31; anteprima approvata anteprima/finale-v4.html).
   Tutto quello che hai segnato e non ha ancora un giorno:
     Questa settimana = azioni rapide «quando capita» (todo senza giorno) + cose catturate (inbox)
     Più avanti       = parcheggio (ex «Per dopo»); quelle con `ritorna` nel futuro dormono fino a quel lunedì
   Gesti sulle righe [data-dsid]: scorri a destra = oggi, a sinistra = più avanti, tieni premuto (tasto destro) = menu,
   tocco = scheda per modificarla. Usa SOLO data-ds / data-dsid (data-p, data-r, data-azione, data-drag sono degli altri). */
import * as RP from "./rapide.js?v=20261031181718";
let C;
export function init(ctx) { C = ctx; }
const $ = s => document.querySelector(s);

// ---------- dati ----------
export function elenco() {
  const o = C.oggi(), V = C.voci().filter(v => !v.padre);
  const per = (a, b) => (a.creato || a.ordine || 0) - (b.creato || b.ordine || 0);
  const sett = [...V.filter(v => v.tipo === "todo" && !v.giorno && !v.fatto), ...V.filter(v => v.tipo === "inbox")].sort(per);
  const parch = V.filter(v => v.tipo === "parcheggio");
  return { sett, avanti: parch.filter(v => !v.ritorna || v.ritorna <= o).sort(per), dorme: parch.filter(v => v.ritorna && v.ritorna > o).sort((a, b) => a.ritorna.localeCompare(b.ritorna)) };
}
export const quante = () => { const e = elenco(); return e.sett.length + e.avanti.length; };
const leggi = id => ({ ...C.D.leggi("voce:" + id), id });
const scrivi = (v, cambia) => { const { id, ...resto } = v; C.D.scrivi("voce:" + id, { ...resto, ...cambia }); };
const giornoTesto = iso => { const n = C.giorniTra(C.oggi(), iso); return n === 0 ? "oggi" : n === 1 ? "domani" : C.daIso(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }); };

/** sposta una voce: oggi / domani (= azione rapida di quel giorno) · avanti (parcheggio) · tra N settimane (parcheggio che dorme) */
function sposta(id, dove, settimane = 0) {
  const v = leggi(id); if (!v.testo && v.testo !== "") return;
  const o = C.oggi();
  if (dove === "oggi" || dove === "domani") {
    const g = dove === "oggi" ? o : C.piuGiorni(o, 1);
    scrivi(v, { tipo: "todo", giorno: g, settimana: C.lunediDi(C.daIso(g)), ora: "", fatto: false, ritorna: null, ruolo: v.ruolo ?? null, ordine: Date.now() });
    C.avvisa(`«${v.testo}» → ${dove}`, true);
  } else if (dove === "avanti") {
    scrivi(v, { tipo: "parcheggio", giorno: null, ritorna: null, parcheggiato: o, sasso: false });
    C.avvisa(`«${v.testo}» → più avanti`, true);
  } else if (dove === "ricorda") {
    const quando = C.piuGiorni(C.lunediDi(new Date()), 7 * settimane);
    scrivi(v, { tipo: "parcheggio", giorno: null, ritorna: quando, parcheggiato: o, sasso: false });
    C.avvisa(`La rivedi in Pianifica ${giornoTesto(C.piuGiorni(quando, -1))}`, true);
  } else if (dove === "elimina") {
    C.D.scrivi("voce:" + id, null);
    C.avvisa("Eliminata", true);
  }
  C.disegna();
}

// ---------- disegno ----------
const riga = v => `<div class="ds-riga" data-dsid="${v.id}"><div class="ds-sotto ds-a-dx">Oggi</div><div class="ds-sotto ds-a-sx">Più avanti</div>
  <div class="ds-davanti"><span class="ds-tx">${v.impegno ? `<i class="ds-imp"></i>` : ""}${C.esc(v.testo || "(senza testo)")}${dettagli(v)}</span></div></div>`;
function dettagli(v) {
  const pe = v.persona ? C.D.leggi("persona:" + v.persona) : null;
  const d = [v.impegno && `Impegno · ${v.dur < 60 ? v.dur + "'" : Math.floor(v.dur / 60) + " h" + (v.dur % 60 ? " " + v.dur % 60 + "'" : "")}`, v.luogo && v.luogo !== "tel" && v.luogo, v.luogo === "tel" && "al telefono", pe && !(v.testo || "").toLowerCase().includes(pe.nome.toLowerCase().split(" ")[0]) && pe.nome,
    v.entro && `entro ${giornoTesto(v.entro)}`, v.ritorna && v.ritorna <= C.oggi() && `tornata ${giornoTesto(v.ritorna)}`, v.racc && !v.impegno && v.racc].filter(Boolean);
  return d.length ? `<small>${C.esc(d.join(" · "))}</small>` : "";
}
const V = { aiuto: false, dorme: false };   // il «?» dei gesti aperto · le parcheggiate in attesa mostrate
export function html() {
  const { sett, avanti, dorme } = elenco();
  const lista = L => `<div class="ds-lista">${L.map(riga).join("")}</div>`;
  // `ritorna` = il lunedì della settimana in cui riprenderle: ricompaiono in Pianifica la DOMENICA prima (passo 1, «Dal parcheggio»)
  const quando = d => { const dom = C.piuGiorni(d.ritorna, -1); return `in Pianifica ${C.giorniTra(C.oggi(), dom) === 0 ? "oggi" : giornoTesto(dom)}`; };
  return `<div class="ds-et"><b>Questa settimana</b>${sett.length || ""}<button class="ds-q" data-ds="aiuto" aria-label="Come si usa">?</button></div>
    ${V.aiuto ? `<p class="ds-aiuto"><span><b>Scorri a destra</b> = oggi</span><span><b>a sinistra</b> = più avanti</span><span><b>tieni premuto</b> = altre scelte</span><span><b>tocca</b> = modifica</span></p>` : ""}
    ${sett.length ? lista(sett) : `<div class="ds-lista"><p class="ds-vuoto">Niente da sistemare. La testa è libera.</p></div>`}
    ${avanti.length ? `<div class="ds-et"><b>Più avanti</b>${avanti.length}</div>${lista(avanti)}` : ""}
    ${dorme.length ? `<button class="ds-dorme" data-ds="dorme">${dorme.length} ${dorme.length === 1 ? "cosa parcheggiata" : "cose parcheggiate"} · ${dorme.length === 1 ? "la rivedi" : "le prime le rivedi"} ${quando(dorme[0])} <i>${V.dorme ? "‹" : "›"}</i></button>
      ${V.dorme ? `<div class="ds-lista">${dorme.map(v => riga(v).replace("</span></div></div>", `<small>${quando(v)}</small></span></div></div>`)).join("")}</div>` : ""}` : ""}`;
}

// ---------- gesti: scorri, tieni premuto, tocca ----------
let G = null;
document.addEventListener("pointerdown", e => {
  const r = e.target.closest(".ds-riga"); if (!r || e.button > 0) return;
  G = { r, id: r.dataset.dsid, x: e.clientX, y: e.clientY, dx: 0, mosso: false, t: setTimeout(() => { if (G && !G.mosso) { apriMenu(G.id, G.x, G.y); G = null; } }, 480) };
});
document.addEventListener("pointermove", e => {
  if (!G) return;
  const dx = e.clientX - G.x, dy = e.clientY - G.y;
  if (!G.mosso && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(G.t); G = null; return; }   // sta scorrendo la pagina
  if (!G.mosso && Math.abs(dx) > 8) { G.mosso = true; clearTimeout(G.t); G.r.classList.add("trascino"); }
  if (G.mosso) {
    G.dx = dx; G.r.querySelector(".ds-davanti").style.transform = `translateX(${dx}px)`;
    G.r.querySelector(".ds-a-dx").style.opacity = dx > 0 ? 1 : 0; G.r.querySelector(".ds-a-sx").style.opacity = dx < 0 ? 1 : 0;
  }
});
document.addEventListener("pointerup", () => {
  if (!G) return;
  clearTimeout(G.t);
  const { r, id, dx, mosso } = G; G = null;
  r.classList.remove("trascino");
  const d = r.querySelector(".ds-davanti");
  if (!mosso) { const v = leggi(id); return v.impegno ? RP.apriPiu("impegno", v.testo, id) : apriScheda(id); }   // un impegno senza giorno torna a «Dove lo metto?»
  if (Math.abs(dx) > 90) { d.style.transform = `translateX(${dx > 0 ? 500 : -500}px)`; setTimeout(() => sposta(id, dx > 0 ? "oggi" : "avanti"), 180); }
  else d.style.transform = "";
});
document.addEventListener("pointercancel", () => { if (G) { clearTimeout(G.t); G.r.classList.remove("trascino"); G.r.querySelector(".ds-davanti").style.transform = ""; G = null; } });
document.addEventListener("contextmenu", e => { const r = e.target.closest(".ds-riga"); if (!r) return; e.preventDefault(); if (G) clearTimeout(G.t); G = null; apriMenu(r.dataset.dsid, e.clientX, e.clientY); });

// ---------- menu (tieni premuto) ----------
const VOCI_MENU = [["oggi", "Oggi"], ["domani", "Domani"], ["agenda", "Mettila in agenda"], ["avanti", "Più avanti"], ["r2", "Pianificala tra 2 settimane"], ["r4", "Pianificala tra 1 mese"], ["mod", "Modifica"], ["elimina", "Elimina"]];
function apriMenu(id, x, y) {
  let m = $("#ds-menu");
  if (!m) { m = document.createElement("div"); m.id = "ds-menu"; document.body.appendChild(m); }
  m.innerHTML = VOCI_MENU.map(([k, n]) => `<button data-ds="${k}" data-dsid="${id}" class="${k === "elimina" ? "rosso" : ""}">${n}</button>`).join("");
  m.hidden = false;
  m.style.left = Math.max(8, Math.min(x, innerWidth - 250)) + "px";
  m.style.top = Math.max(8, Math.min(y, innerHeight - 380)) + "px";
}
// un tocco fuori dal menu lo chiude
document.addEventListener("pointerdown", e => { const m = $("#ds-menu"); if (m && !m.hidden && !m.contains(e.target)) m.hidden = true; }, true);

// ---------- scheda: modifica il testo ----------
function apriScheda(id) {
  const v = leggi(id); let f = $("#ds-foglio");
  if (!f) { f = document.createElement("div"); f.id = "ds-foglio"; document.body.appendChild(f); }
  f.innerHTML = `<div class="ds-velo" data-ds="chiudi"></div><div class="ds-scheda"><h2>Modifica</h2>
    <textarea id="ds-testo" rows="3">${C.esc(v.testo || "")}</textarea>
    <div class="ds-scelte">${VOCI_MENU.filter(([k]) => !["mod", "elimina"].includes(k)).map(([k, n]) => `<button data-ds="${k}" data-dsid="${id}">${n}</button>`).join("")}</div>
    <div class="ds-piede"><button class="ds-elimina" data-ds="elimina" data-dsid="${id}">Elimina</button><button data-ds="chiudi">Annulla</button><button class="ds-salva" data-ds="salva" data-dsid="${id}">Salva</button></div></div>`;
  f.hidden = false;
  setTimeout(() => $("#ds-testo")?.focus(), 50);
}
const chiudiScheda = () => { const f = $("#ds-foglio"); if (f) { f.hidden = true; f.innerHTML = ""; } };

document.addEventListener("click", e => {
  const b = e.target.closest("[data-ds]"); if (!b) return;
  const k = b.dataset.ds, id = b.dataset.dsid;
  const m = $("#ds-menu"); if (m) m.hidden = true;
  if (k === "aiuto") { V.aiuto = !V.aiuto; return C.disegna(); }
  if (k === "dorme") { V.dorme = !V.dorme; return C.disegna(); }
  if (k === "chiudi") return chiudiScheda();
  if (k === "salva") {
    const t = $("#ds-testo").value.trim();
    if (t) { scrivi(leggi(id), { testo: t }); C.avvisa("Salvata", true); C.disegna(); }
    return chiudiScheda();
  }
  if (k === "mod") return apriScheda(id);
  if (k === "agenda") { const v = leggi(id); chiudiScheda(); return RP.apriPiu("impegno", v.testo, id); }
  chiudiScheda();
  if (k === "r2" || k === "r4") return sposta(id, "ricorda", k === "r2" ? 2 : 4);
  sposta(id, k);
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { chiudiScheda(); const m = $("#ds-menu"); if (m) m.hidden = true; } });
