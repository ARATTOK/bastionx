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
    selectedRack: 'RACK-MAIN-01',

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
      if (data) {
        this.servers = data
        const racks = this.availableRacks
        if (racks.length > 0 && !racks.includes(this.selectedRack)) {
          this.selectedRack = racks[0]
        }
      }
      this.loading = false
    },

    get availableRacks() {
      const set = new Set()
      this.servers.forEach(s => {
        const loc = (s.ubicacion || '').trim()
        const match = loc.match(/(?:(.*?),?\s*)?U(\d+)/i)
        if (match && match[1]) {
          set.add(match[1].trim())
        }
      })
      if (set.size === 0) set.add('RACK-MAIN-01')
      return Array.from(set)
    },

    get totalCpuInfo() {
      let sockets = 0
      let cores = 0
      this.servers.forEach(s => {
        const proc = s.procesador || ''
        const matchSock = proc.match(/(\d+)\s*Socket/i)
        sockets += matchSock ? parseInt(matchSock[1], 10) : 1
        const matchCore = proc.match(/(\d+)\s*Cores/i)
        if (matchCore) cores += parseInt(matchCore[1], 10)
      })
      return { sockets, cores }
    },

    get totalRamGB() {
      let total = 0
      this.servers.forEach(s => {
        if (s.ram_gb) {
          total += parseInt(s.ram_gb, 10)
        } else {
          const m = (s.ram || '').match(/(\d+)/)
          if (m) total += parseInt(m[1], 10)
        }
      })
      return total
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

    get rackOccupation() {
      const currentRack = (this.selectedRack || 'RACK-MAIN-01').toLowerCase().trim()
      let occupiedU = 0
      let serverCount = 0
      this.servers.forEach(s => {
        const loc = (s.ubicacion || '').trim()
        const match = loc.match(/(?:(.*?),?\s*)?U(\d+)(?:\s*-\s*U?(\d+))?/i)
        const rack = (match && match[1]) ? match[1].toLowerCase().trim() : 'rack-main-01'
        if (rack === currentRack) {
          serverCount += 1
          if (match) {
            const uStart = parseInt(match[2], 10)
            const uEnd = match[3] ? parseInt(match[3], 10) : uStart
            occupiedU += Math.abs(uEnd - uStart) + 1
          } else {
            occupiedU += 1
          }
        }
      })
      const percent = Math.min(100, Math.round((occupiedU / 42) * 100))
      return { occupiedU, percent, serverCount }
    },

    get locationBreakdown() {
      const map = {}
      this.servers.forEach(s => {
        const loc = s.ubicacion || 'Sin Ubicación'
        if (!map[loc]) map[loc] = { count: 0, ram: 0 }
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

    get rackDiagram() {
      const currentRack = (this.selectedRack || 'RACK-MAIN-01').toLowerCase().trim()
      const rackServers = []

      this.servers.forEach(s => {
        const loc = (s.ubicacion || '').trim()
        const match = loc.match(/(?:(.*?),?\s*)?U(\d+)(?:\s*-\s*U?(\d+))?/i)
        const rack = (match && match[1]) ? match[1].toLowerCase().trim() : 'rack-main-01'
        if (rack === currentRack) {
          if (match) {
            const u1 = parseInt(match[2], 10)
            const u2 = match[3] ? parseInt(match[3], 10) : u1
            const uStart = Math.min(u1, u2)
            const uEnd = Math.max(u1, u2)
            rackServers.push({
              server: s,
              uStart: uStart,
              uEnd: uEnd,
              uHeight: uEnd - uStart + 1
            })
          }
        }
      })

      const slotsMap = {}
      rackServers.forEach(rs => {
        for (let u = rs.uStart; u <= rs.uEnd; u++) {
          slotsMap[u] = rs
        }
      })

      const diagram = []
      for (let u = 42; u >= 1; u--) {
        const rs = slotsMap[u]
        if (rs) {
          if (u === rs.uEnd) { // top slot of multi-U block
            diagram.push({
              u: u,
              uRangeLabel: rs.uHeight > 1 ? `U${rs.uStart}-U${rs.uEnd}` : `U${rs.uStart}`,
              server: rs.server,
              height: rs.uHeight,
              isStart: true,
              isCovered: false,
              isOccupied: true
            })
          } else {
            diagram.push({
              u: u,
              isStart: false,
              isCovered: true,
              isOccupied: true
            })
          }
        } else {
          diagram.push({
            u: u,
            uRangeLabel: `U${u}`,
            server: null,
            height: 1,
            isStart: true,
            isCovered: false,
            isOccupied: false
          })
        }
      }

      return diagram
    },

    getStatusColor(estado) {
      const e = (estado || '').toLowerCase()
      if (e === 'activo') return '#2ecc71'
      if (e === 'mantenimiento') return '#f39c12'
      if (e === 'falla') return '#e74c3c'
      return '#636e72'
    },

    gotoServer(id) {
      if (!id) return
      window.location.href = 'server-detail.html?id=' + id
    }
  }))
})
