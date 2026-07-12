/*
 * BASTIONX LAB — Inventory Control
 * Módulo de autenticación
 *
 * Dependencias:
 *   - supabase.js (cliente Supabase inicializado)
 *   - Alpine.js (registro del componente auth)
 *
 * Funciones:
 *   login()         — Inicia sesión con email y contraseña
 *   logout()        — Cierra la sesión actual
 *   fetchUserRole() — Obtiene el rol del usuario desde user_profiles
 *
 * Flujo de autenticación:
 *   1. El usuario ingresa email@bastionx.com + contraseña
 *   2. Supabase Auth valida las credenciales
 *   3. Se obtiene el rol desde la tabla user_profiles
 *   4. Alpine.js actualiza el estado según el rol (admin/readonly)
 *
 * Nota de seguridad:
 *   El signup público está deshabilitado en Supabase.
 *   Solo el admin puede crear nuevos usuarios desde el dashboard.
 */

/**
 * Inicia sesión con email y contraseña.
 * Valida contra Supabase Auth y maneja errores de conexión.
 */
async function login() {
  this.loading = true
  this.loginError = ''
  this.loginSuccess = ''
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: this.loginEmail,
      password: this.loginPassword
    })
    if (error) {
      this.loginError = 'Credenciales incorrectas. Verifica tu email y contraseña.'
    } else {
      this.loginSuccess = 'Inicio de sesión exitoso. Cargando...'
    }
  } catch (e) {
    this.loginError = 'Error de conexión. Intenta de nuevo.'
  }
  this.loading = false
}

/**
 * Cierra la sesión actual.
 * El listener onAuthStateChange actualizará el estado de la UI.
 */
async function logout() {
  await supabase.auth.signOut()
}

/**
 * Obtiene el rol del usuario autenticado desde la tabla user_profiles.
 * Si no existe perfil, asigna 'readonly' por defecto.
 * Solo los usuarios con role='admin' pueden ver credenciales y administrar.
 */
async function fetchUserRole() {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', this.user.id)
      .single()
    if (data) this.userRole = data.role || 'readonly'
  } catch (e) {
    this.userRole = 'readonly'
  }
}
