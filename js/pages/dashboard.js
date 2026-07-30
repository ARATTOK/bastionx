document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
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
    allServicesCount: 0,
    subnetsCount: 0,

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
        this.user = session.user
        await this.fetchUserRole()
        await this.loadHubStats()
        this.loading = false
      } catch (e) {
        window.location.href = 'login.html'
      }
    },

    async logout() {
      await sb.auth.signOut()
      window.location.href = 'login.html'
    },

    async fetchUserRole() {
      try {
        const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).maybeSingle()
        if (data && data.role) {
          this.realUserRole = data.role
        } else {
          await sb.from('user_profiles').upsert({ id: this.user.id, email: this.user.email, role: 'superadmin' })
          this.realUserRole = 'superadmin'
        }
      } catch (e) {
        this.realUserRole = 'superadmin'
      }
    },

    async loadHubStats() {
      const { data: servers } = await sb.from('servers').select('*')
      if (servers) {
        this.servers = servers
        let svcCount = 0
        const subnetsSet = new Set()
        servers.forEach(s => {
          if (s.ip) {
            const parts = s.ip.split('.')
            if (parts.length === 4) subnetsSet.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
          }
          if (s.servicios && Array.isArray(s.servicios)) {
            svcCount += s.servicios.length
            s.servicios.forEach(svc => {
              if (svc.ips) {
                svc.ips.forEach(ip => {
                  const parts = ip.split('.')
                  if (parts.length === 4) subnetsSet.add(`${parts[0]}.${parts[1]}.${parts[2]}.0/24`)
                })
              }
            })
          }
        })
        this.allServicesCount = svcCount
        this.subnetsCount = subnetsSet.size
      }
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

    get totalRam() {
      return this.servers.reduce((acc, s) => {
        const m = (s.ram || '').match(/(\d+)/)
        return acc + (m ? parseInt(m[1], 10) : 0)
      }, 0)
    },

    get totalCpuGHz() {
      let total = 0
      this.servers.forEach(s => {
        const match = (s.procesador || '').match(/(\d+(\.\d+)?)\s*GHz/i)
        if (match) total += parseFloat(match[1])
      })
      return total.toFixed(1)
    }
  }))
})
