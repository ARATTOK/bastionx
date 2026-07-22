document.addEventListener('alpine:init', () => {
  Alpine.data('adminApp', () => ({
    loading: true,
    user: null,
    isSuperAdmin: false,
    users: [],
    auditLogs: [],
    searchUserQuery: '',
    auditActionFilter: 'all',
    searchAuditQuery: '',
    auditDetailItem: null,

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
        this.user = session.user

        const { data: profile } = await sb.from('user_profiles').select('role').eq('id', this.user.id).maybeSingle()
        if (!profile || profile.role !== 'superadmin') {
          const t = Alpine.store('toast')
          if (t) t.error('Acceso denegado: Requiere rol Superadmin')
          setTimeout(() => { window.location.href = 'dashboard.html' }, 500)
          return
        }

        this.isSuperAdmin = true
        await this.loadUsers()
        await this.loadAuditLogs()
      } catch (err) {
        console.error('Admin init error:', err)
        const t = Alpine.store('toast')
        if (t) t.error('Error al inicializar panel de administración')
      } finally {
        this.loading = false
      }
    },

    async loadUsers() {
      const { data: profiles, error } = await sb.from('user_profiles').select('*').order('created_at', { ascending: false })
      if (error) {
        console.error('Error fetching users:', error)
        return
      }
      this.users = profiles || []
    },

    async loadAuditLogs() {
      const { data: logs, error } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200)
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
          user_email: emailMap[l.user_id] || (l.user_id ? l.user_id.slice(0, 8) : '—')
        }))
      } else {
        this.auditLogs = []
      }
    },

    get filteredUsers() {
      if (!this.searchUserQuery.trim()) return this.users
      const q = this.searchUserQuery.toLowerCase().trim()
      return this.users.filter(u =>
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q)) ||
        (u.id && u.id.toLowerCase().includes(q))
      )
    },

    get filteredAuditLogs() {
      let result = this.auditLogs
      if (this.auditActionFilter !== 'all') {
        result = result.filter(l => l.accion === this.auditActionFilter)
      }
      if (this.searchAuditQuery.trim()) {
        const q = this.searchAuditQuery.toLowerCase().trim()
        result = result.filter(l =>
          (l.user_email && l.user_email.toLowerCase().includes(q)) ||
          (l.descripcion && l.descripcion.toLowerCase().includes(q)) ||
          (l.accion && l.accion.toLowerCase().includes(q))
        )
      }
      return result
    },

    get roleStats() {
      const stats = { superadmin: 0, admin: 0, readonly: 0 }
      this.users.forEach(u => {
        const r = u.role || 'readonly'
        stats[r] = (stats[r] || 0) + 1
      })
      return stats
    },

    async changeUserRole(userId, targetRole, userEmail) {
      if (userId === this.user.id && targetRole !== 'superadmin') {
        const t = Alpine.store('toast')
        if (t) t.error('No puedes remover tu propio rol de Superadmin')
        await this.loadUsers()
        return
      }

      const { error } = await sb.from('user_profiles').update({ role: targetRole }).eq('id', userId)
      if (error) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al cambiar rol: ' + error.message)
        await this.loadUsers()
        return
      }

      await auditLog(null, this.user.id, 'user.role_changed', { target_user_id: userId, new_role: targetRole }, `Cambio de rol a ${targetRole} para ${userEmail || userId.slice(0, 8)}`)
      const t = Alpine.store('toast')
      if (t) t.success(`Rol actualizado a "${targetRole}" para ${userEmail || 'usuario'}`)
      await this.loadUsers()
      await this.loadAuditLogs()
    },

    viewAuditDetail(log) {
      this.auditDetailItem = log
    },

    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },

    logAccionClass(accion) {
      if (!accion) return ''
      if (accion.includes('cread') || accion.includes('insert')) return 'log-creada'
      if (accion.includes('eliminad') || accion.includes('delete')) return 'log-eliminada'
      if (accion.includes('completad')) return 'log-completada'
      return 'log-desmarcada'
    },

    formatDiffVal(val) {
      if (val === null || val === undefined) return '—'
      if (typeof val === 'object') return JSON.stringify(val)
      return String(val)
    }
  }))
})
