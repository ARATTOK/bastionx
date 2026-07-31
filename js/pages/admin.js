document.addEventListener('alpine:init', () => {
  Alpine.data('adminApp', () => ({
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

    stats: {
      usersCount: 0,
      serviceTypesCount: 0,
      subnetsCount: 0,
      auditLogsCount: 0,
      globalTasksCount: 0
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

        await this.loadHubStats()
      } catch (err) {
        console.error('Admin hub init error:', err)
      } finally {
        this.loading = false
      }
    },

    async loadHubStats() {
      try {
        const { count: usersCount } = await sb.from('user_profiles').select('*', { count: 'exact', head: true })
        this.stats.usersCount = usersCount || 0
      } catch(e) {}

      try {
        const { count: tagsCount } = await sb.from('tags').select('*', { count: 'exact', head: true })
        this.stats.serviceTypesCount = tagsCount || 0
      } catch(e) {}

      try {
        const storedSubnets = localStorage.getItem('bastion_managed_subnets')
        if (storedSubnets) {
          const parsed = JSON.parse(storedSubnets)
          this.stats.subnetsCount = parsed.length
        } else {
          this.stats.subnetsCount = 3
        }
      } catch(e) {}

      try {
        const { count: auditCount } = await sb.from('audit_logs').select('*', { count: 'exact', head: true })
        this.stats.auditLogsCount = auditCount || 0
      } catch(e) {}

      try {
        const { count: tasksCount } = await sb.from('server_tasks').select('*', { count: 'exact', head: true })
        this.stats.globalTasksCount = tasksCount || 0
      } catch(e) {}
    },

    gotoModule(url) {
      window.location.href = url
    }
  }))
})
