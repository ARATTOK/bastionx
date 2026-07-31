document.addEventListener('alpine:init', () => {
  Alpine.data('adminServicesApp', () => ({
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

    serviceTypes: [],
    newServiceTypeName: '',
    newServiceTypeColor: '#6c5ce7',
    editingTag: null,

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

        await this.loadServiceTypes()
      } catch (err) {
        console.error('Admin services init error:', err)
      } finally {
        this.loading = false
      }
    },

    async loadServiceTypes() {
      try {
        const { data } = await sb.from('tags').select('*').order('name')
        if (data) this.serviceTypes = data
      } catch(e) {}
    },

    async addServiceType() {
      const name = this.newServiceTypeName.trim()
      if (!name) return
      try {
        const { data, error } = await sb.from('tags').insert({ name, color: this.newServiceTypeColor }).select().single()
        if (error) {
          BastionUtils.showToast('error', 'Error al crear tipo de servicio: ' + error.message)
        } else {
          BastionUtils.showToast('success', `Tipo de servicio "${name}" creado exitosamente`)
          this.newServiceTypeName = ''
          this.newServiceTypeColor = '#6c5ce7'
          await this.loadServiceTypes()
          await auditLog(null, this.user?.id, 'service_type.created', { name }, `Superadmin creo tipo de servicio global: ${name}`)
        }
      } catch(e) {
        BastionUtils.showToast('error', 'Error al guardar tipo de servicio')
      }
    },

    async deleteServiceType(tagId, name) {
      try {
        const { error } = await sb.from('tags').delete().eq('id', tagId)
        if (error) {
          BastionUtils.showToast('error', 'Error al eliminar: ' + error.message)
        } else {
          BastionUtils.showToast('success', `Tipo de servicio "${name}" eliminado`)
          await this.loadServiceTypes()
        }
      } catch(e) {}
    }
  }))
})
