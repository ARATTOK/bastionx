document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    loading: true,
    authenticating: false,
    showPassword: false,
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
        // Error de red
      }
      this.loading = false
    },

    async login() {
      if (this.authenticating) return
      this.loginError = ''

      if (!this.loginEmail.trim() || !this.loginPassword) {
        this.loginError = 'Completa todos los campos antes de ingresar.'
        return
      }

      this.authenticating = true
      try {
        const { data, error } = await sb.auth.signInWithPassword({
          email: this.loginEmail.trim(),
          password: this.loginPassword
        })

        if (error) {
          const msgs = {
            'Invalid login credentials': 'Credenciales incorrectas. Verifica tu correo y contraseña.',
            'Email not confirmed': 'Tu correo no ha sido confirmado. Revisa tu bandeja de entrada.',
            'Too many requests': 'Demasiados intentos. Por favor espera unos minutos.',
            'Invalid email or password': 'Credenciales incorrectas. Verifica tu correo y contraseña.'
          }
          this.loginError = msgs[error.message] || `Error: ${error.message}`
        } else {
          Alpine.store('toast').success('Sesión iniciada correctamente')
          setTimeout(() => { window.location.href = 'dashboard.html' }, 300)
        }
      } catch (e) {
        this.loginError = 'Error de conexión. Intenta de nuevo.'
      } finally {
        this.authenticating = false
      }
    }
  }))
})
