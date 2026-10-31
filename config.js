/* config.js — indirizzo di Supabase (stesso progetto di Le mie routine, Annona e le altre app).
   Valori PUBBLICI: la sicurezza sta nelle regole di supabase/bussola.sql.
   ⚠️ Mai chiavi segrete qui. */
export const SUPABASE_URL = "https://hcseefgwbxfmtjccbrkq.supabase.co";
export const SUPABASE_CHIAVE_PUBBLICA = "sb_publishable_2m7zEzOSvmB2Gl8d5lEXfg_k3NSaOQr";

/* Google Calendar: id PUBBLICO del client OAuth (progetto Google Cloud «Bussola»). Non è un segreto. */
export const GOOGLE_CLIENT_ID = "239082804129-anudirtaorerfrle8kc7j2jes56hjjes.apps.googleusercontent.com";
/* «Collegato per sempre» (funzione Supabase google-token + segreto GOOGLE_CLIENT_SECRET nei Secrets di Supabase).
   Acceso il 2026-10-29: funzione pubblicata, segreto salvato, app Google in produzione. */
export const GOOGLE_PER_SEMPRE = true;
