document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    loading: true,
    loginEmail: '',
    loginPassword: '',
    loginError: '',

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (session) {
          const { error } = await sb.auth.getUser()
          if (!error) {
            window.location.href = 'dashboard.html'
            return
          }
          await sb.auth.signOut()
        }
      } catch (e) {
        // Error de red — se muestra el formulario igual
      }
      this.loading = false
    },

    async login() {
      if (this.loading) return
      this.loading = true
      this.loginError = ''
      try {
        if (!this.loginEmail || !this.loginPassword) {
          this.loginError = 'Completa todos los campos antes de ingresar.'
          return
        }
        const { data, error } = await sb.auth.signInWithPassword({
          email: this.loginEmail,
          password: this.loginPassword
        })
        if (error) {
          const msgs = {
            'Invalid login credentials': 'Credenciales incorrectas. Verifica tu email y contraseña.',
            'Email not confirmed': 'Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.',
            'Too many requests': 'Demasiados intentos. Espera unos minutos y vuelve a intentar.',
            'Invalid email or password': 'Credenciales incorrectas. Verifica tu email y contraseña.',
          }
          this.loginError = msgs[error.message] || `Error: ${error.message}`
        } else {
          window.location.href = 'dashboard.html'
        }
      } catch (e) {
        if (e.message && e.message.includes('NetworkError')) {
          this.loginError = 'Error de conexión. Verifica tu red e intenta de nuevo.'
        } else {
          this.loginError = 'Error de conexión. Intenta de nuevo.'
        }
      } finally {
        this.loading = false
      }
    },
  }))
})
