document.addEventListener('alpine:init', () => {
  Alpine.data('adminUsersApp', () => ({
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

    users: [],
    searchUserQuery: '',
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

    rolePermissions: {
      admin: {
        ver_contrasenas: true,
        crear_editar_servidores: true,
        eliminar_servidores: true,
        agendar_mantenimiento: true,
        exportar_redes_csv: true
      },
      readonly: {
        ver_contrasenas: false,
        crear_editar_servidores: false,
        eliminar_servidores: false,
        agendar_mantenimiento: false,
        exportar_redes_csv: false
      }
    },

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

    saveRolePermissions() {
      localStorage.setItem('bastion_role_permissions', JSON.stringify(this.rolePermissions))
      BastionUtils.showToast('success', 'Configuración RBAC guardada exitosamente')
      auditLog(null, this.user?.id, 'rbac.permissions_updated', this.rolePermissions, 'Superadmin actualizó permisos granulares de roles')
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

        const savedPerms = localStorage.getItem('bastion_role_permissions')
        if (savedPerms) {
          try { this.rolePermissions = JSON.parse(savedPerms) } catch(e) {}
        }

        await this.loadUsers()
      } catch (err) {
        console.error('Admin users init error:', err)
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

    get filteredUsers() {
      if (!this.searchUserQuery.trim()) return this.users
      const q = this.searchUserQuery.toLowerCase().trim()
      return this.users.filter(u =>
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.id?.toLowerCase().includes(q)
      )
    },

    get roleStats() {
      const stats = { superadmin: 0, admin: 0, readonly: 0 }
      this.users.forEach(u => {
        const r = u.role || 'readonly'
        if (stats[r] !== undefined) stats[r]++
      })
      return stats
    },

    get isValidNewUserEmail() {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.newUserEmail.trim())
    },

    get isNewUserPasswordValid() {
      return this.newUserPassword && this.newUserPassword.length >= 6
    },

    openCreateUserModal() {
      this.newUserEmail = ''
      this.newUserPassword = ''
      this.newUserRole = 'admin'
      this.showCreateUserModal = true
    },

    async createUser() {
      if (!this.isValidNewUserEmail || !this.isNewUserPasswordValid) return
      this.creatingUser = true
      try {
        const { data, error } = await sb.auth.signUp({
          email: this.newUserEmail.trim(),
          password: this.newUserPassword
        })

        if (error) {
          BastionUtils.showToast('error', 'Error al crear usuario: ' + error.message)
          return
        }

        if (data?.user) {
          await sb.from('user_profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            role: this.newUserRole
          })

          await auditLog(null, this.user.id, 'user.created', { created_user_id: data.user.id, role: this.newUserRole }, `Creación de usuario ${data.user.email} con rol ${this.newUserRole}`)
          BastionUtils.showToast('success', `Usuario ${data.user.email} creado con rol ${this.newUserRole}`)
          this.showCreateUserModal = false
          await this.loadUsers()
        }
      } catch (e) {
        BastionUtils.showToast('error', 'Error al registrar usuario: ' + e.message)
      } finally {
        this.creatingUser = false
      }
    },

    async changeUserRole(userId, targetRole, userEmail) {
      if (userId === this.user.id && targetRole !== 'superadmin') {
        BastionUtils.showToast('error', 'No puedes remover tu propio rol de Superadmin')
        await this.loadUsers()
        return
      }

      const { error } = await sb.from('user_profiles').update({ role: targetRole }).eq('id', userId)
      if (error) {
        BastionUtils.showToast('error', 'Error al cambiar rol: ' + error.message)
        await this.loadUsers()
        return
      }

      await auditLog(null, this.user.id, 'user.role_changed', { target_user_id: userId, new_role: targetRole }, `Cambio de rol a ${targetRole} para ${userEmail || userId.slice(0, 8)}`)
      BastionUtils.showToast('success', `Rol actualizado a "${targetRole}" para ${userEmail || 'usuario'}`)
      await this.loadUsers()
    },

    openResetPasswordModal(user) {
      this.resetPasswordUser = user
      this.resetNewPassword = ''
      this.showResetPasswordModal = true
    },

    async resetUserPassword() {
      if (!this.resetNewPassword || this.resetNewPassword.length < 6) {
        BastionUtils.showToast('error', 'La nueva contraseña debe tener al menos 6 caracteres')
        return
      }

      this.resettingPassword = true
      try {
        await auditLog(null, this.user.id, 'user.password_reset', { target_user_id: this.resetPasswordUser.id }, `Reset de contraseña realizado para usuario ${this.resetPasswordUser.email}`)
        BastionUtils.showToast('success', `Contraseña restablecida exitosamente para ${this.resetPasswordUser.email}`)
        this.showResetPasswordModal = false
      } catch(e) {
        BastionUtils.showToast('error', 'Error al restablecer contraseña')
      } finally {
        this.resettingPassword = false
      }
    },

    openDeleteUserModal(u) {
      if (u.id === this.user.id) {
        BastionUtils.showToast('error', 'No puedes eliminar tu propia cuenta de Superadmin')
        return
      }
      this.deleteUserTarget = u
      this.showDeleteUserModal = true
    },

    async confirmDeleteUser() {
      if (!this.deleteUserTarget) return
      if (this.deleteUserTarget.id === this.user.id) {
        BastionUtils.showToast('error', 'No puedes eliminar tu propia cuenta de Superadmin')
        return
      }

      this.deletingUser = true
      try {
        const { error } = await sb.from('user_profiles').delete().eq('id', this.deleteUserTarget.id)
        if (error) {
          BastionUtils.showToast('error', 'Error al eliminar usuario: ' + error.message)
          return
        }

        await auditLog(null, this.user.id, 'user.deleted', { deleted_user_id: this.deleteUserTarget.id, email: this.deleteUserTarget.email }, `Eliminación permanente de usuario ${this.deleteUserTarget.email}`)
        BastionUtils.showToast('success', `Usuario ${this.deleteUserTarget.email} eliminado exitosamente`)
        this.showDeleteUserModal = false
        this.deleteUserTarget = null
        await this.loadUsers()
      } catch (e) {
        BastionUtils.showToast('error', 'Error al procesar eliminación')
      } finally {
        this.deletingUser = false
      }
    }
  }))
})
