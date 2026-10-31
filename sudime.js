/* sudime.js — «Cosa so di te» (dal 2026-10-31, v4; anteprima approvata anteprima/finale-v4.html).
   La memoria dell'assistente: frasi semplici che l'utente legge, corregge e cancella. Gemini (funzione bussola-ia) le usa per
   dividere quello che scrivi nel «+» e per ordinare gli spazi liberi. A Gemini vanno solo queste frasi, mai il calendario intero.
   Chiave `sudime` = { fatti: [{ t, da: "tu" | "notato", quando }], storia: [{ k, f }], no: ["k|f"] }:
     storia = dove hai messo gli ultimi impegni (k = prima parola del titolo, f = mattina | pomeriggio | sera);
     se le ultime 3 volte la stessa parola è finita nella stessa fascia, «Ho notato…» chiede se ricordarlo (no = rifiutati).
   Usa SOLO data-sd / data-sdi (gli altri attributi sono di app.js, pianifica.js, rapide.js, aggiungi.js, dasistemare.js). */
let C;
export function init(ctx) { C = ctx; }
const $ = s => document.querySelector(s);
const dati = () => ({ fatti: [], storia: [], no: [], ...(C.D.leggi("sudime") || {}) });
const scrivi = d => C.D.scrivi("sudime", d);
/** le frasi da mandare a Gemini */
export const fatti = () => dati().fatti.map(f => f.t);
export function aggiungi(t, da = "tu") {
  t = t.trim(); if (!t) return;
  const d = dati(); if (d.fatti.some(f => f.t.toLowerCase() === t.toLowerCase())) return;
  scrivi({ ...d, fatti: [...d.fatti, { t: t[0].toUpperCase() + t.slice(1), da, quando: C.oggi() }] });
}
const FASCE = { mattina: "la mattina", pomeriggio: "il pomeriggio", sera: "la sera" };
const fascia = min => min < 12 * 60 ? "mattina" : min < 18 * 60 ? "pomeriggio" : "sera";
/** dopo «Metti in calendario»: ricordo dove l'hai messo (solo la prima parola del titolo, es. «chiamata») */
export function registra(titolo, min) {
  const k = (titolo.toLowerCase().match(/[a-zà-ú]{3,}/) || [])[0]; if (!k) return;
  const d = dati(); scrivi({ ...d, storia: [...d.storia, { k, f: fascia(min) }].slice(-60) });
}
function notato() {
  const d = dati(), per = {};
  d.storia.forEach(s => (per[s.k] ||= []).push(s.f));
  for (const [k, F] of Object.entries(per)) {
    const ult = F.slice(-3);
    if (ult.length === 3 && ult.every(f => f === ult[0]) && !d.no.includes(k + "|" + ult[0]) && !d.fatti.some(f => f.t.toLowerCase().includes(k)))
      return { k, f: ult[0], testo: `Le ultime volte ${k === "chiamata" ? "le chiamate" : `«${k}»`} le hai messe ${FASCE[ult[0]]}. Me lo ricordo?`, frase: `${k === "chiamata" ? "Le chiamate le preferisco" : `«${k[0].toUpperCase() + k.slice(1)}» lo preferisco`} ${FASCE[ult[0]]}.` };
  }
  return null;
}
export function html() {
  const d = dati(), n = notato();
  return `<details class="paper sd-box" open><summary class="H">Cosa so di te <small>${d.fatti.length ? `${d.fatti.length} ${d.fatti.length === 1 ? "cosa" : "cose"} · le uso per proporti gli orari` : "l'assistente impara da qui"}</small></summary>
    ${n ? `<div class="sd-notato"><p><b>Ho notato:</b> ${C.esc(n.testo)}</p><div><button class="sd-si" data-sd="si" data-k="${C.esc(n.k + "|" + n.f)}" data-frase="${C.esc(n.frase)}">Sì, ricordalo</button><button data-sd="no" data-k="${C.esc(n.k + "|" + n.f)}">No</button></div></div>` : ""}
    <div class="sd-lista">${d.fatti.map((f, i) => `<div class="sd-r"><p contenteditable="true" spellcheck="false" data-sdi="${i}">${C.esc(f.t)}</p><button data-sd="via" data-sdi="${i}" aria-label="Dimentica">×</button></div>`).join("")}
      <div class="sd-r sd-nuovo"><input data-sd="nuovo" placeholder="Aggiungi qualcosa su di te (es. «Il lunedì mattina sono lento»)" enterkeyhint="done"></div></div>
    <p class="sub sd-nota">Tocca una frase per correggerla, la × per farla dimenticare. Puoi anche scrivere nel «+»: «ricordati che…». A Gemini mando solo queste frasi, il titolo e gli spazi liberi: mai il tuo calendario.</p></details>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sd]"); if (!b || b.tagName === "INPUT") return;
  const d = dati(), k = b.dataset.sd;
  if (k === "via") { const i = Number(b.dataset.sdi); scrivi({ ...d, fatti: d.fatti.filter((_, j) => j !== i) }); C.avvisa("Dimenticato", true); }
  else if (k === "si") { aggiungi(b.dataset.frase, "notato"); C.avvisa("Ricordato", true, "spunta"); }
  else if (k === "no") { scrivi({ ...d, no: [...d.no, b.dataset.k] }); }
  C.disegna();
});
document.addEventListener("keydown", e => {
  if (e.target.dataset?.sd === "nuovo" && e.key === "Enter" && e.target.value.trim()) { aggiungi(e.target.value); C.disegna(); setTimeout(() => $('[data-sd="nuovo"]')?.focus(), 30); }
  if (e.target.dataset?.sdi != null && e.target.isContentEditable && e.key === "Enter") { e.preventDefault(); e.target.blur(); }
});
document.addEventListener("focusout", e => {
  if (e.target.dataset?.sdi == null || !e.target.isContentEditable) return;
  const d = dati(), i = Number(e.target.dataset.sdi), t = e.target.textContent.trim();
  if (!d.fatti[i] || d.fatti[i].t === t) return;
  scrivi({ ...d, fatti: t ? d.fatti.map((f, j) => j === i ? { ...f, t } : f) : d.fatti.filter((_, j) => j !== i) });
  C.disegna();
});
