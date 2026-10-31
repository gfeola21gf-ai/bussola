/* colori.js — due tavolozze, ognuna al suo posto (scelta dell'utente):
   - COLORI: i colori dell'app (ruoli, card, sezioni, Mesi). Sono quelli dello stile di Bussola, più vivaci.
   - COLORI_G: i colori degli EVENTI = la stessa tavolozza di Google Calendar (24 colori). Regola dell'utente: «decide chi
     crea». Evento nato in Calendar → arriva col suo colore, poi in Bussola si cambia senza toccare Calendar. Blocco nato
     in Bussola → Calendar prende lo stesso colore se è uno degli 11 «classici» (gid), altrimenti il predefinito; dopo, le
     due app sono indipendenti. */
export const COLORI = [
  { k: "viola", nome: "Viola", c: "#A75CF2" }, { k: "giallo", nome: "Giallo", c: "#FBC23C", t: "#2B2205" }, { k: "corallo", nome: "Corallo", c: "#FF7452" },
  { k: "verde", nome: "Verde", c: "#58C03E" }, { k: "cielo", nome: "Cielo", c: "#3FB0F2" }, { k: "rosa", nome: "Rosa", c: "#F2609B" },
  { k: "blu", nome: "Blu", c: "#2E62E8" }, { k: "acqua", nome: "Acqua", c: "#17AFA0" }, { k: "arancio", nome: "Arancio", c: "#FF9A1F", t: "#2B1A05" }, { k: "grafite", nome: "Grafite", c: "#4A4E57" },
];
/* La tavolozza degli EVENTI: i 24 colori del menu di Google Calendar, con i nomi italiani di Calendar.
   gid = colorId di Google: solo 11 colori «classici» passano tra le app (gli altri Google non li fa ricevere né leggere). */
export const COLORI_G = [
  { k: "radicchio", nome: "Radicchio", c: "#AD1457" }, { k: "ciliegio", nome: "Fiore di ciliegio", c: "#D81B60" },
  { k: "fenicottero", nome: "Fenicottero", c: "#E67C73", gid: "4" }, { k: "pomodoro", nome: "Pomodoro", c: "#D50000", gid: "11" },
  { k: "mandarino", nome: "Mandarino", c: "#F4511E", gid: "6" }, { k: "zucca", nome: "Zucca", c: "#EF6C00" },
  { k: "mango", nome: "Mango", c: "#F09300" }, { k: "banana", nome: "Banana", c: "#F6BF26", t: "#2B2205", gid: "5" },
  { k: "cedro", nome: "Cedro", c: "#E4C441", t: "#2B2205" },
  { k: "avocado", nome: "Avocado", c: "#C0CA33", t: "#2B2205" }, { k: "pistacchio", nome: "Pistacchio", c: "#7CB342" },
  { k: "basilico", nome: "Basilico", c: "#0B8043", gid: "10" }, { k: "salvia", nome: "Salvia", c: "#33B679", gid: "2" },
  { k: "eucalipto", nome: "Eucalipto", c: "#009688" }, { k: "pavone", nome: "Pavone", c: "#039BE5", gid: "7" },
  { k: "cobalto", nome: "Cobalto", c: "#4285F4" }, { k: "lavanda", nome: "Lavanda", c: "#7986CB", gid: "1" },
  { k: "mirtillo", nome: "Mirtillo", c: "#3F51B5", gid: "9" },
  { k: "glicine", nome: "Glicine", c: "#B39DDB", t: "#2B2205" }, { k: "ametista", nome: "Ametista", c: "#9E69AF" },
  { k: "vinaccia", nome: "Vinaccia", c: "#8E24AA", gid: "3" }, { k: "cacao", nome: "Cacao", c: "#795548" },
  { k: "grafite", nome: "Grafite", c: "#616161", gid: "8" }, { k: "betulla", nome: "Betulla", c: "#A79B8E" },
];
/** colore dell'app → il colore evento più vicino (per i sassi grandi in agenda) */
export const VERSO_G = { viola: "ametista", giallo: "banana", corallo: "mandarino", verde: "pistacchio", cielo: "pavone", rosa: "ciliegio", blu: "cobalto", acqua: "eucalipto", arancio: "zucca", grafite: "grafite" };
const DA_G = { 3: "viola", 5: "giallo", 6: "corallo", 2: "verde", 7: "cielo", 4: "rosa", 9: "blu", 10: "acqua", 8: "grafite", 11: "corallo", 1: "viola" };
/** colore dell'app (se arriva un id di Google lo converto nel colore dell'app più vicino) */
export const col = k => COLORI.find(x => x.k === k) || COLORI.find(x => x.k === DA_G[k]) || COLORI[0];
/** colore di un evento: nome della tavolozza, oppure colorId di Google, oppure colore dell'app (→ il più vicino) */
export const colG = k => COLORI_G.find(x => x.k === k) || COLORI_G.find(x => x.gid && x.gid === String(k)) || COLORI_G.find(x => x.k === VERSO_G[k]) || COLORI_G.find(x => x.k === "grafite");
