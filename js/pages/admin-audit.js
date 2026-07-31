document.addEventListener('alpine:init', () => {
  Alpine.data('adminAuditApp', () => ({
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

    auditLogs: [],
    auditActionFilter: 'all',
    searchAuditQuery: '',
    auditDetailItem: null,

    simulateRole(role) {
      this.simulatedRole = role
      BastionUtils.setSimulatedRole(role)
      if (role) {
        BastionUtils.showToast('info', `Vista simulada como: ${role}`)
      } else {
        BastionUtils.showToast('success', 'Vista restaurada a Superadmin')
      }
    },

    resetSimulation() {
      this.simulatedRole = ''
      BastionUtils.setSimulatedRole('')
      BastionUtils.showToast('success', 'Vista restaurada a Superadmin')
    },

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user

        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) this.realUserRole = data.role
        } catch(e) {}

        if (this.realUserRole !== 'superadmin') {
          BastionUtils.showToast('error', 'Acceso denegado: Requiere permisos de Superadmin')
          setTimeout(() => { window.location.href = 'dashboard.html' }, 500)
          return
        }

        await this.loadAuditLogs()
      } catch (err) {
        console.error('Admin audit init error:', err)
      } finally {
        this.loading = false
      }
    },

    async loadAuditLogs() {
      const { data: logs, error } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300)
      if (error) {
        console.error('Error fetching audit logs:', error)
        return
      }

      if (logs && logs.length > 0) {
        const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))]
        const emailMap = {}
        if (userIds.length > 0) {
          const { data: profiles } = await sb.from('user_profiles').select('id, email').in('id', userIds)
          if (profiles) profiles.forEach(p => { emailMap[p.id] = p.email })
        }
        this.auditLogs = logs.map(l => ({
          ...l,
          user_email: emailMap[l.user_id] || l.user_id || 'Sistema'
        }))
      } else {
        this.auditLogs = []
      }
    },

    get filteredAuditLogs() {
      return this.auditLogs.filter(l => {
        const q = this.searchAuditQuery.toLowerCase().trim()
        const matchesQ = !q ||
          l.accion?.toLowerCase().includes(q) ||
          l.descripcion?.toLowerCase().includes(q) ||
          l.user_email?.toLowerCase().includes(q) ||
          l.server_id?.toLowerCase().includes(q)

        let matchesFilter = true
        if (this.auditActionFilter !== 'all') {
          const filter = this.auditActionFilter.toLowerCase()
          if (filter === 'servidores') matchesFilter = l.accion?.includes('server')
          else if (filter === 'usuarios') matchesFilter = l.accion?.includes('user') || l.accion?.includes('role')
          else if (filter === 'tareas') matchesFilter = l.accion?.includes('task')
          else if (filter === 'mantenimiento') matchesFilter = l.accion?.includes('mantenimiento') || l.accion?.includes('maint')
        }
        return matchesQ && matchesFilter
      })
    },

    viewAuditDetail(log) {
      this.auditDetailItem = log
    },

    formatDate(ts) {
      return BastionUtils.formatDate(ts)
    },

    logAccionClass(accion) {
      if (!accion) return ''
      if (accion.includes('cread') || accion.includes('insert')) return 'log-creada'
      if (accion.includes('eliminad') || accion.includes('delete')) return 'log-eliminada'
      if (accion.includes('completad')) return 'log-completada'
      return 'log-desmarcada'
    }
  }))
})
