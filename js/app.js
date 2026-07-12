document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    user: null,
    userRole: 'readonly',
    isSuperAdmin: false,
    loading: true,

    servers: [],
    serverCreds: null,

    detailServer: null,
    showAddServer: false,
    showUserManager: false,
    managedUsers: [],

    newServer: {
      hostname: '',
      modelo: '',
      sn: '',
      ubicacion: '',
      procesador: '',
      ram_gb: 0,
      estado: 'Activo',
      discos_str: '[]'
    },

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) {
          window.location.href = 'login.html'
          return
        }
        this.user = session.user
        await this.fetchUserRole()
        await this.refreshServers()
        this.loading = false
        this.$nextTick(() => lucide.createIcons())
      } catch (e) {
        window.location.href = 'login.html'
        return
      }

      sb.auth.onAuthStateChange(async (event, session) => {
        if (session && event === 'SIGNED_IN') {
          this.user = session.user
          await this.fetchUserRole()
          await this.refreshServers()
          this.$nextTick(() => lucide.createIcons())
        }
        if (event === 'SIGNED_OUT') {
          window.location.href = 'login.html'
        }
      })
    },

    async logout() {
      await sb.auth.signOut()
    },

    async fetchUserRole() {
      try {
        const { data } = await sb
          .from('user_profiles')
          .select('role')
          .eq('id', this.user.id)
          .single()
        if (data) this.userRole = data.role || 'readonly'
      } catch (e) {
        this.userRole = 'readonly'
      }
      this.isSuperAdmin = this.user?.email === 'admin@bastionx.com'
    },

    async refreshServers() {
      this.loading = true
      const { data } = await sb
        .from('servers')
        .select('*')
        .order('ubicacion')
      if (data) this.servers = data
      this.loading = false
      this.$nextTick(() => lucide.createIcons())
    },

    async openDetail(s) {
      this.detailServer = s
      this.serverCreds = null
      if (this.isSuperAdmin) {
        const { data } = await sb
          .from('server_credentials')
          .select('*')
          .eq('server_id', s.id)
          .maybeSingle()
        if (data) this.serverCreds = data
      }
      this.$nextTick(() => lucide.createIcons())
    },

    async addServer() {
      try {
        const discos = JSON.parse(this.newServer.discos_str || '[]')
        const { error } = await sb
          .from('servers')
          .insert({
            hostname: this.newServer.hostname,
            modelo: this.newServer.modelo,
            sn: this.newServer.sn,
            ubicacion: this.newServer.ubicacion,
            procesador: this.newServer.procesador,
            ram_gb: Number(this.newServer.ram_gb) || 0,
            estado: this.newServer.estado,
            discos: discos
          })
          .select()
        if (error) { alert('Error: ' + error.message); return }
        this.showAddServer = false
        this.newServer = {
          hostname: '', modelo: '', sn: '', ubicacion: '',
          procesador: '', ram_gb: 0, estado: 'Activo', discos_str: '[]'
        }
        await this.refreshServers()
      } catch (e) { alert('Error al guardar') }
    },

    async deleteServer(id) {
      if (!confirm('¿Eliminar este servidor?')) return
      await sb.from('server_credentials').delete().eq('server_id', id)
      await sb.from('servers').delete().eq('id', id)
      this.detailServer = null
      await this.refreshServers()
    },

    // =============================================================
    // USERS — admin-only, queries user_profiles
    // =============================================================

    async fetchUsers() {
      const { data } = await sb
        .from('user_profiles')
        .select('*')
        .order('created_at')
      if (data) this.managedUsers = data
    },

    async updateUserRole(userId, newRole) {
      const { error } = await sb
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId)
      if (error) {
        alert('Error al actualizar rol: ' + error.message)
      } else {
        await this.fetchUsers()
        // Si el admin cambió su propio rol, actualiza localmente
        if (userId === this.user.id) {
          this.userRole = newRole
        }
      }
    },

    serversByStatus(status) {
      return this.servers.filter(s => s.estado === status)
    },

    countByStatus(status) {
      return this.servers.filter(s => s.estado === status).length
    },

    get totalRam() {
      return this.servers.reduce((acc, s) => acc + Number(s.ram_gb || 0), 0)
    },

    shortCpu(cpu) {
      if (!cpu || cpu === '') return '\u2014'
      if (cpu.includes('Silver')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E5')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E-')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu === 'Pendiente') return 'Pendiente'
      return cpu
    },

    cpuTagClass(s) {
      if (!s.procesador || s.procesador === '' || s.procesador === 'Pendiente') return 'pending-tag'
      if (s.procesador.includes('Silver')) return 'silver'
      if (s.procesador.includes('E5')) return 'e5'
      if (s.procesador.includes('E-')) return 'xeon'
      return 'pending-tag'
    },

    diskCount(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        return Array.isArray(d) ? d.length : 0
      } catch { return 0 }
    },

    diskDetail(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return ''
        return d.map(dd => dd.bay + ': ' + dd.tipo).join('<br>')
      } catch { return '' }
    },

    ramPercent(s) {
      if (!s.ram_gb || s.ram_gb === 0) return 0
      return Math.min(100, (Number(s.ram_gb) / 384) * 100)
    },

    ramColor(s) {
      const pct = this.ramPercent(s)
      if (pct < 25) return '#2ecc71'
      if (pct < 50) return '#5dade2'
      if (pct < 75) return '#f39c12'
      return '#e74c3c'
    },
  }))
})
