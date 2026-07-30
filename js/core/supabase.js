/*
 * BASTIONX LAB — Inventory Control
 * Configuración del cliente Supabase (Compatible con GitHub Pages y despliegue estático)
 */

const DEFAULT_SUPABASE_URL = 'https://unaadjavtrsogkzcbmev.supabase.co'
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuYWFkamF2dHJzb2dremNibWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4ODI0NzEsImV4cCI6MjA5OTQ1ODQ3MX0.B7Vac60sWnvKlBTNAOdH_OkVrj2JFCZghfbV1JRQaaU'

// Permite sobreescribir la configuración localmente o mediante config.js sin alterar el cliente estático
const SUPABASE_URL = (window.BASTION_CONFIG && window.BASTION_CONFIG.SUPABASE_URL) || DEFAULT_SUPABASE_URL
const SUPABASE_ANON_KEY = (window.BASTION_CONFIG && window.BASTION_CONFIG.SUPABASE_ANON_KEY) || DEFAULT_SUPABASE_ANON_KEY

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(function() {})
}
