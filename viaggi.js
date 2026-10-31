/* viaggi.js — tempi di viaggio IN AUTO a Roma, senza Google Maps (dal 2026-10-29).
   1. L'indirizzo di ogni luogo diventa un punto sulla mappa con Nominatim (OpenStreetMap, gratis, senza chiave).
   2. OSRM (gratis, senza chiave) dà i minuti tra tutti i luoghi «a strade vuote» (metodo.durate["A|B"]).
   3. stima() aggiunge il traffico di Roma secondo giorno, ora e direzione (verso il centro o verso fuori/GRA),
      il parcheggio (10' vicino al centro, 5' altrove) e la correzione imparata («ci hai messo di più?»), arrotondando ai 5'.
   Tabella approvata dall'utente in anteprima/telefono.html. */
const CENTRO = [41.8986, 12.4768];   // piazza Venezia / Pantheon
const km = (a, b) => {
  const R = 6371, r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const pos = l => l && l.lat != null ? [Number(l.lat), Number(l.lon)] : null;

/** l'indirizzo → { lat, lon, nome } (il primo risultato in Italia), oppure null */
export async function cerca(indirizzo) {
  const q = new URLSearchParams({ format: "json", limit: "1", countrycodes: "it", q: indirizzo });
  const r = await fetch("https://nominatim.openstreetmap.org/search?" + q, { headers: { "Accept-Language": "it" } });
  if (!r.ok) throw new Error("mappa " + r.status);
  const [x] = await r.json();
  return x ? { lat: Number(x.lat), lon: Number(x.lon), nome: x.display_name } : null;
}
/** i minuti in auto a strade vuote tra tutti i luoghi che hanno un punto: { "A|B": min } */
export async function durate(luoghi) {
  const L = luoghi.filter(pos);
  if (L.length < 2) return {};
  const coord = L.map(l => `${Number(l.lon).toFixed(5)},${Number(l.lat).toFixed(5)}`).join(";");
  const r = await fetch(`https://router.project-osrm.org/table/v1/driving/${coord}?annotations=duration`);
  if (!r.ok) throw new Error("percorsi " + r.status);
  const d = await r.json(), D = {};
  L.forEach((a, i) => L.forEach((b, j) => { if (i !== j && d.durations?.[i]?.[j] != null) D[a.nome + "|" + b.nome] = Math.round(d.durations[i][j] / 60); }));
  return D;
}
/** quanto pesa il traffico: q = { g (0 = lunedì), min (minuti dalla mezzanotte) }; senza q = un giorno feriale a mezzogiorno */
export function fattore(da, a, q) {
  const g = q?.g ?? 2, t = q?.min ?? 720;
  const pa = pos(da), pb = pos(a);
  const versoCentro = pa && pb ? km(pb, CENTRO) + 1 < km(pa, CENTRO) : false;
  if (g === 6) return 1.25;                                                    // domenica
  if (g === 5) return t >= 480 && t < 1200 ? (versoCentro ? 1.6 : 1.4) : 1.2;  // sabato
  if (t >= 435 && t < 585) return versoCentro ? 1.9 : 1.5;                     // 7:15-9:45
  if (t >= 585 && t < 990) return versoCentro ? 1.5 : 1.35;                    // 9:45-16:30
  if (t >= 990 && t < 1200) return versoCentro ? 1.6 : 1.9;                    // 16:30-20:00
  return 1.2;                                                                  // sera e notte
}
export function parcheggio(a) {
  if (!a || a.nome === "Casa") return 0;
  const p = pos(a);
  return p && km(p, CENTRO) < 3 ? 10 : 5;
}
/** minuti porta a porta: strade vuote × traffico × correzione + parcheggio, arrotondati ai 5' sopra */
export function stima(base, da, a, q, corr = 1) {
  return Math.ceil((base * fattore(da, a, q) * corr + parcheggio(a)) / 5) * 5;
}
/** per le impostazioni: «22' a strade vuote · 30-45' di giorno» */
export function forbice(base, da, a, corr = 1) {
  const v = [{ g: 2, min: 900 }, { g: 0, min: 480 }, { g: 2, min: 1080 }].map(q => stima(base, da, a, q, corr));
  return `${base}' a strade vuote · ${Math.min(...v)}-${Math.max(...v)}' di giorno`;
}
