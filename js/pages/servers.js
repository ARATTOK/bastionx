document.addEventListener('alpine:init', () => {
  Alpine.data('serversApp', () => ({
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

    servers: [],
    credsMap: {},
    searchQuery: '',
    activeFilter: 'todos',
    selectedLocation: 'todos',
    viewMode: 'grid', // 'grid' | 'table'

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user
        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}
        await this.refreshServers()
      } catch (err) {
        window.location.href = 'login.html'
      }
    },

    async refreshServers() {
      this.loading = true
      const { data } = await sb.from('servers').select('*').order('hostname')
      if (data) this.servers = data

      // Load IPMI creds for quick connect launch buttons
      const { data: creds } = await sb.from('server_credentials').select('server_id, ipmi')
      if (creds) {
        const map = {}
        creds.forEach(c => { if (c.ipmi) map[c.server_id] = c.ipmi })
        this.credsMap = map
      }
      this.loading = false
    },

    get locations() {
      const set = new Set()
      this.servers.forEach(s => { if (s.ubicacion) set.add(s.ubicacion) })
      return Array.from(set)
    },

    get filteredServers() {
      return this.servers.filter(s => {
        const q = this.searchQuery.toLowerCase().trim()
        const matchesQ = !q || s.hostname?.toLowerCase().includes(q) || s.ip?.toLowerCase().includes(q) || s.modelo?.toLowerCase().includes(q)
        const matchesFilter = this.activeFilter === 'todos' || (s.estado && s.estado.toLowerCase() === this.activeFilter.toLowerCase())
        const matchesLoc = this.selectedLocation === 'todos' || s.ubicacion === this.selectedLocation
        return matchesQ && matchesFilter && matchesLoc
      })
    },

    countByStatus(status) {
      return this.servers.filter(s => s.estado && s.estado.toLowerCase() === status.toLowerCase()).length
    },

    gotoServer(id) {
      window.location.href = 'server-detail.html?id=' + id
    },

    openIpmi(ipmi) {
      if (!ipmi) return
      const url = ipmi.startsWith('http') ? ipmi : 'https://' + ipmi
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }))
})
