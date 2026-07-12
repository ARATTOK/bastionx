/*
 * BASTIONX LAB — Inventory Control
 * Configuración del cliente Supabase
 *
 * Uso:
 *   Este archivo se encarga de inicializar el cliente de Supabase
 *   utilizando la URL del proyecto y la anon key pública.
 *
 *   La anon key es pública por diseño (segura gracias a RLS policies).
 *   La service_role key NUNCA debe estar en frontend.
 *
 * Variables de entorno (reemplazar en producción):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 */

const SUPABASE_URL = 'https://unaadjavtrsogkzcbmev.supabase.co'

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuYWFkamF2dHJzb2dremNibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODI0NzEsImV4cCI6MjA5OTQ1ODQ3MX0.B7Vac60sWnvKlBTNAOdH_OkVrj2JFCZghfbV1JRQaaU'

/*
 * Inicializa el cliente de Supabase.
 * Se usa window.supabase.createClient() que viene del CDN:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js">
 *
 * @constant {SupabaseClient} supabase
 */
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
