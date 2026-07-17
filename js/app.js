document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    user: null,
    userRole: 'readonly',
    isSuperAdmin: false,
    canEdit: false,
    loading: true,

    servers: [],
    activeFilter: 'todos',

    showUserManager: false,
    serverTagsMap: {},
    allTagsMap: {},
    pendingTasksMap: {},
    tasksProgressMap: {},
    credsMap: {},
    managedUsers: [],

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) {
          window.location.href = 'login.html'
          return
        }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) {
          await sb.auth.signOut()
          window.location.href = 'login.html'
          return
        }
        this.user = session.user
        await this.fetchUserRole()
        await this.refreshServers()
        await this.loadTags()
        await this.loadTasks()
        await this.loadCreds()
        this.loading = false
      } catch (e) {
        window.location.href = 'login.html'
        return
      }

      sb.auth.onAuthStateChange(async (event, session) => {
        if (session && event === 'SIGNED_IN') {
          this.user = session.user
          await this.fetchUserRole()
          await this.refreshServers()
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
      this.isSuperAdmin = this.userRole === 'superadmin'
      this.canEdit = this.isSuperAdmin || this.userRole === 'admin'
    },

    async refreshServers() {
      this.loading = true
      const { data } = await sb
        .from('servers')
        .select('*')
        .order('ubicacion')
      if (data) this.servers = data
      this.loading = false
    },

    gotoServer(id) {
      window.location.href = 'server-detail.html?id=' + id
    },

    async loadTags() {
      const { data: sts } = await sb.from('server_tags').select('*')
      const { data: tags } = await sb.from('tags').select('*')
      if (tags) {
        this.allTagsMap = {}
        tags.forEach(t => { this.allTagsMap[t.id] = t })
      }
      this.serverTagsMap = {}
      if (sts && tags) {
        sts.forEach(st => {
          if (!this.serverTagsMap[st.server_id]) this.serverTagsMap[st.server_id] = []
          if (this.allTagsMap[st.tag_id]) this.serverTagsMap[st.server_id].push(this.allTagsMap[st.tag_id])
        })
      }
    },

    async loadTasks() {
      const { data: tasks } = await sb
        .from('server_tasks')
        .select('*')
      this.pendingTasksMap = {}
      this.tasksProgressMap = {}
      if (tasks) {
        const byServer = {}
        tasks.forEach(t => {
          if (!byServer[t.server_id]) byServer[t.server_id] = { all: [], pending: [] }
          byServer[t.server_id].all.push(t)
          if (!t.completada) byServer[t.server_id].pending.push(t)
        })
        Object.entries(byServer).forEach(([sid, group]) => {
          this.tasksProgressMap[sid] = {
            completed: group.all.length - group.pending.length,
            total: group.all.length
          }
          this.pendingTasksMap[sid] = group.pending
        })
      }
    },

    async loadCreds() {
      const { data } = await sb.from('server_credentials').select('server_id,ipmi,ip_servicio')
      this.credsMap = {}
      if (data) {
        data.forEach(c => { if (!this.credsMap[c.server_id]) this.credsMap[c.server_id] = c })
      }
    },

    serverCardSeverity(serverId) {
      const pts = this.pendingTasksMap[serverId]
      if (!pts || pts.length === 0) return null
      const hasCritica = pts.some(t => t.criticidad === 'critica')
      if (hasCritica) return 'critical'
      const hasConfig = pts.some(t => t.criticidad === 'configuracion')
      if (hasConfig) return 'config'
      return 'other'
    },

    async updateServerStatus(id, newStatus) {
      await sb.from('servers').update({ estado: newStatus }).eq('id', id)
      await this.refreshServers()
      await this.loadTags()
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

    get filteredServers() {
      const sorted = [...this.servers].sort((a, b) =>
        (a.ubicacion || '').localeCompare(b.ubicacion || '')
      )
      if (this.activeFilter === 'todos') return sorted
      return sorted.filter(s => s.estado === this.activeFilter)
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
        if (!Array.isArray(d)) return 0
        if (d.length === 0) return 0
        if (d[0] && d[0].nombre !== undefined)
          return d.reduce((sum, r) => sum + (Array.isArray(r.discos) ? r.discos.length : 0), 0)
        return d.length
      } catch { return 0 }
    },

    diskDetail(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return ''
        if (d[0] && d[0].nombre !== undefined) {
          return d.flatMap(r => Array.isArray(r.discos) ? r.discos : [])
            .map(dd => dd.bay + ': ' + (dd.tipo || '—')).join('<br>')
        }
        return d.map(dd => dd.bay + ': ' + (dd.tipo || '—')).join('<br>')
      } catch { return '' }
    },

    taskPercent(s) {
      const p = this.tasksProgressMap[s.id]
      if (!p || p.total === 0) return 0
      return (p.completed / p.total) * 100
    },

    taskColor(s) {
      const pct = this.taskPercent(s)
      if (pct >= 100) return '#2ecc71'
      if (pct >= 50) return '#5dade2'
      if (pct >= 25) return '#f39c12'
      return '#e74c3c'
    },
  }))
})
