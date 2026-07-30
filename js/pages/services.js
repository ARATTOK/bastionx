document.addEventListener('alpine:init', () => {
  Alpine.data('servicesApp', () => ({
    loading: true,
    user: null,
    realUserRole: 'readonly',
    simulatedRole: BastionUtils.getSimulatedRole(),

    get userRole() {
      return (this.realUserRole === 'superadmin' && this.simulatedRole) ? this.simulatedRole : this.realUserRole
    },

    get isSuperAdmin() {
      return this.userRole === 'superadmin'
    },

    get canEdit() {
      return this.isSuperAdmin || this.userRole === 'admin'
    },

    simulateRole(role) {
      this.simulatedRole = role
      BastionUtils.setSimulatedRole(role)
    },

    resetSimulation() {
      this.simulatedRole = ''
      BastionUtils.setSimulatedRole('')
    },

    services: [],
    searchQuery: '',
    selectedCategory: 'todos',

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user
        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}
        await this.loadServices()
      } catch (err) {
        window.location.href = 'login.html'
      }
    },

    async loadServices() {
      this.loading = true
      const { data: servers } = await sb.from('servers').select('*')
      const list = []
      if (servers) {
        servers.forEach(s => {
          if (s.servicios && Array.isArray(s.servicios)) {
            s.servicios.forEach(svc => {
              const port = parseInt(svc.puerto, 10) || 0
              let cat = 'web'
              if ([5432, 3306, 27017, 1433, 5433].includes(port)) cat = 'database'
              else if ([6379, 11211, 5672, 9092].includes(port)) cat = 'cache'
              else if ([22, 53, 123, 161].includes(port)) cat = 'infra'

              list.push({
                ...svc,
                server_id: s.id,
                hostname: s.hostname,
                server_ip: s.ip,
                category: cat
              })
            })
          }
        })
      }
      this.services = list
      this.loading = false
    },

    get filteredServices() {
      return this.services.filter(s => {
        const q = this.searchQuery.toLowerCase().trim()
        const matchesQ = !q || s.nombre?.toLowerCase().includes(q) || s.hostname?.toLowerCase().includes(q) || s.puerto?.toString().includes(q)
        const matchesCat = this.selectedCategory === 'todos' || s.category === this.selectedCategory
        return matchesQ && matchesCat
      })
    },

    openService(svc) {
      const ip = (svc.ips && svc.ips[0]) ? svc.ips[0] : svc.server_ip
      if (!ip) return
      const protocol = [443, 8443].includes(parseInt(svc.puerto, 10)) ? 'https://' : 'http://'
      const portStr = svc.puerto ? ':' + svc.puerto : ''
      const url = `${protocol}${ip}${portStr}`
      window.open(url, '_blank', 'noopener,noreferrer')
    },

    copyPass(pass) {
      BastionUtils.copyToClipboard(pass, 'Contraseña de servicio copiada al portapapeles')
    }
  }))
})
