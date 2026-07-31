document.addEventListener('alpine:init', () => {
  Alpine.data('infraApp', () => ({
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

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user
        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}
        await this.loadServers()
      } catch (err) {
        window.location.href = 'login.html'
      }
    },

    async loadServers() {
      this.loading = true
      const { data } = await sb.from('servers').select('*')
      if (data) this.servers = data
      this.loading = false
    },

    get totalRam() {
      return this.servers.reduce((acc, s) => {
        const m = (s.ram || '').match(/(\d+)/)
        return acc + (m ? parseInt(m[1], 10) : 0)
      }, 0)
    },

    get totalStorageTB() {
      let totalGB = 0
      this.servers.forEach(s => {
        if (s.discos && Array.isArray(s.discos)) {
          s.discos.forEach(d => {
            if (d.discos && Array.isArray(d.discos)) {
              d.discos.forEach(item => {
                const match = (item.tamano || '').match(/(\d+)\s*(GB|TB)/i)
                if (match) {
                  const val = parseInt(match[1], 10)
                  const unit = match[2].toUpperCase()
                  totalGB += unit === 'TB' ? val * 1024 : val
                }
              })
            }
          })
        }
      })
      return (totalGB / 1024).toFixed(1)
    },

    get totalCpuGHz() {
      let total = 0
      this.servers.forEach(s => {
        const match = (s.procesador || '').match(/(\d+(\.\d+)?)\s*GHz/i)
        if (match) total += parseFloat(match[1])
      })
      return total.toFixed(1)
    },

    get locationBreakdown() {
      const map = {}
      this.servers.forEach(s => {
        const loc = s.ubicacion || 'Sin Ubicación'
        if (!map[loc]) map[loc] = { count: 0, ram: 0, storageGB: 0 }
        map[loc].count += 1
        const ramM = (s.ram || '').match(/(\d+)/)
        if (ramM) map[loc].ram += parseInt(ramM[1], 10)
      })
      return Object.keys(map).map(loc => ({
        location: loc,
        count: map[loc].count,
        ram: map[loc].ram
      }))
    },

    get rackUnits() {
      // 42U Rack Simulation
      const units = []
      const occupiedMap = {}

      this.servers.forEach((s, idx) => {
        // Infer U slot from s.ubicacion (e.g. U36) or fallback to index assignment
        let uNum = 42 - (idx * 3)
        const matchU = (s.ubicacion || '').match(/U(\d+)/i)
        if (matchU) uNum = parseInt(matchU[1], 10)
        if (uNum > 0 && uNum <= 42) {
          occupiedMap[uNum] = s
        }
      })

      for (let u = 42; u >= 1; u--) {
        const server = occupiedMap[u] || null
        units.push({
          u: u,
          server: server,
          isOccupied: !!server
        })
      }
      return units
    },

    gotoServer(id) {
      if (!id) return
      window.location.href = 'server-detail.html?id=' + id
    }
  }))
})
