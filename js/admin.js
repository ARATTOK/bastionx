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
    showCreateUserModal: false,
    newUserEmail: '',
    newUserPassword: '',
    newUserRole: 'admin',
    creatingUser: false,
    showResetPasswordModal: false,
    resetPasswordUser: null,
    resetNewPassword: '',
    resettingPassword: false,
    showDeleteUserModal: false,
    deleteUserTarget: null,
    deletingUser: false,

    openCreateUserModal() {
      this.newUserEmail = ''
      this.newUserPassword = ''
      this.newUserRole = 'admin'
      this.showCreateUserModal = true
    },

    openResetPasswordModal(user) {
      this.resetPasswordUser = user
      this.resetNewPassword = ''
      this.showResetPasswordModal = true
    },

    openDeleteUserModal(u) {
      if (u.id === this.user.id) {
        const t = Alpine.store('toast')
        if (t) t.error('No puedes eliminar tu propia cuenta de Superadmin')
        return
      }
      this.deleteUserTarget = u
      this.showDeleteUserModal = true
    },

    async confirmDeleteUser() {
      if (!this.deleteUserTarget) return
      if (this.deleteUserTarget.id === this.user.id) {
        const t = Alpine.store('toast')
        if (t) t.error('No puedes eliminar tu propia cuenta de Superadmin')
        return
      }

      this.deletingUser = true
      try {
        const { error } = await sb.from('user_profiles').delete().eq('id', this.deleteUserTarget.id)
        if (error) throw error

        await auditLog(null, this.user.id, 'user.deleted', { deleted_user_id: this.deleteUserTarget.id, email: this.deleteUserTarget.email }, `Eliminación de usuario ${this.deleteUserTarget.email || this.deleteUserTarget.id}`)

        const t = Alpine.store('toast')
        if (t) t.success(`Usuario ${this.deleteUserTarget.email || 'eliminado'} removido correctamente`)

        this.showDeleteUserModal = false
        this.deleteUserTarget = null
        await this.loadUsers()
        await this.loadAuditLogs()
      } catch (e) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al eliminar usuario: ' + e.message)
      } finally {
        this.deletingUser = false
      }
    },

    async resetUserPassword() {
      if (!this.resetNewPassword || this.resetNewPassword.length < 6) {
        const t = Alpine.store('toast')
        if (t) t.error('La contraseña debe tener al menos 6 caracteres')
        return
      }

      this.resettingPassword = true
      try {
        if (this.resetPasswordUser.id === this.user.id) {
          const { error } = await sb.auth.updateUser({ password: this.resetNewPassword })
          if (error) throw error
        } else {
          const { error } = await sb.auth.resetPasswordForEmail(this.resetPasswordUser.email)
          if (error) throw error
        }

        await auditLog(null, this.user.id, 'user.password_reset', { target_user_id: this.resetPasswordUser.id, email: this.resetPasswordUser.email }, `Reinicio de contraseña para usuario ${this.resetPasswordUser.email || this.resetPasswordUser.id}`)

        const t = Alpine.store('toast')
        if (t) t.success(`Solicitud de cambio de contraseña procesada para ${this.resetPasswordUser.email || 'usuario'}`)
        this.showResetPasswordModal = false
      } catch (e) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al resetear contraseña: ' + e.message)
      } finally {
        this.resettingPassword = false
      }
    },

    async createUser() {
      if (!this.newUserEmail.trim() || !this.newUserPassword) {
        const t = Alpine.store('toast')
        if (t) t.error('Email y contraseña son obligatorios')
        return
      }

      this.creatingUser = true
      try {
        const { data, error } = await sb.auth.signUp({
          email: this.newUserEmail.trim(),
          password: this.newUserPassword
        })

        if (error) {
          const t = Alpine.store('toast')
          if (t) t.error('Error al crear usuario: ' + error.message)
          return
        }

        if (data?.user) {
          await sb.from('user_profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            role: this.newUserRole
          })

          await auditLog(null, this.user.id, 'user.created', { created_user_id: data.user.id, role: this.newUserRole }, `Creación de usuario ${data.user.email} con rol ${this.newUserRole}`)

          const t = Alpine.store('toast')
          if (t) t.success(`Usuario ${data.user.email} creado con rol ${this.newUserRole}`)

          this.showCreateUserModal = false
          await this.loadUsers()
          await this.loadAuditLogs()
        }
      } catch (e) {
        const t = Alpine.store('toast')
        if (t) t.error('Error al registrar usuario: ' + e.message)
      } finally {
        this.creatingUser = false
      }
    },

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
        this.user = session.user

        const { data: profile } = await sb.from('user_profiles').select('role').eq('id', this.user.id).maybeSingle()
        if (!profile) {
          await sb.from('user_profiles').upsert({ id: this.user.id, email: this.user.email, role: 'superadmin' })
          this.isSuperAdmin = true
        } else if (profile.role === 'superadmin' || profile.role === 'admin') {
          this.isSuperAdmin = true
        } else {
          const t = Alpine.store('toast')
          if (t) t.error('Acceso denegado: Requiere permisos de Administración')
          setTimeout(() => { window.location.href = 'dashboard.html' }, 500)
          return
        }

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
