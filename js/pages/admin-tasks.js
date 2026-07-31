document.addEventListener('alpine:init', () => {
  Alpine.data('adminTasksApp', () => ({
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

    tasks: [],
    usersList: [],
    serversList: [],
    searchQuery: '',
    filterStatus: 'all',

    showCreateModal: false,
    newTitle: '',
    newDesc: '',
    newServerId: '',
    newAssignedTo: '',
    newPriority: 'Media',
    newDeadline: '',
    creating: false,

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

        await Promise.all([
          this.loadAllTasks(),
          this.loadUsers(),
          this.loadServers()
        ])
      } catch (err) {
        console.error('Error init admin tasks:', err)
      } finally {
        this.loading = false
      }
    },

    async loadAllTasks() {
      const { data, error } = await sb.from('server_tasks')
        .select('*, servers(id, hostname, ubicacion)')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching global tasks:', error)
        return
      }

      this.tasks = data || []
    },

    async loadUsers() {
      const { data } = await sb.from('user_profiles').select('id, email, role').order('email')
      if (data) this.usersList = data
    },

    async loadServers() {
      const { data } = await sb.from('servers').select('id, hostname, ubicacion').order('hostname')
      if (data) this.serversList = data
    },

    get filteredTasks() {
      return this.tasks.filter(t => {
        if (this.filterStatus === 'pending' && t.completada) return false
        if (this.filterStatus === 'completed' && !t.completada) return false

        if (this.searchQuery.trim()) {
          const q = this.searchQuery.toLowerCase().trim()
          const matchTitle = t.titulo?.toLowerCase().includes(q)
          const matchDesc = t.descripcion?.toLowerCase().includes(q)
          const matchServer = t.servers?.hostname?.toLowerCase().includes(q)
          const matchUser = t.assigned_to?.toLowerCase().includes(q)
          return matchTitle || matchDesc || matchServer || matchUser
        }
        return true
      })
    },

    getUserEmail(userIdOrEmail) {
      if (!userIdOrEmail) return 'Cualquier usuario'
      const found = this.usersList.find(u => u.id === userIdOrEmail || u.email === userIdOrEmail)
      return found ? found.email : userIdOrEmail
    },

    openCreateModal() {
      this.newTitle = ''
      this.newDesc = ''
      this.newServerId = this.serversList[0]?.id || ''
      this.newAssignedTo = this.usersList[0]?.email || ''
      this.newPriority = 'Media'
      this.newDeadline = ''
      this.showCreateModal = true
    },

    async createTask() {
      if (!this.newTitle.trim() || !this.newServerId) {
        BastionUtils.showToast('error', 'Completa el título y el servidor de destino')
        return
      }

      this.creating = true
      try {
        const payload = {
          server_id: this.newServerId,
          titulo: this.newTitle.trim(),
          descripcion: this.newDesc.trim(),
          criticidad: this.newPriority.toLowerCase(),
          fecha_limite: this.newDeadline ? new Date(this.newDeadline).toISOString() : null,
          assigned_to: this.newAssignedTo,
          completada: false
        }

        const { data, error } = await sb.from('server_tasks').insert(payload).select().single()
        if (error) throw error

        await auditLog(
          this.newServerId,
          this.user.id,
          'task.assigned',
          payload,
          `Superadmin asignó tarea "${this.newTitle}" a ${this.getUserEmail(this.newAssignedTo)}`
        )

        BastionUtils.showToast('success', 'Tarea asignada exitosamente')
        this.showCreateModal = false
        await this.loadAllTasks()
      } catch (err) {
        console.error('Error creating task:', err)
        BastionUtils.showToast('error', 'Error al crear la tarea: ' + err.message)
      } finally {
        this.creating = false
      }
    },

    async deleteTask(taskId) {
      if (!confirm('¿Seguro que deseas eliminar esta tarea asignada?')) return
      try {
        const { error } = await sb.from('server_tasks').delete().eq('id', taskId)
        if (error) throw error
        BastionUtils.showToast('info', 'Tarea eliminada')
        await this.loadAllTasks()
      } catch (err) {
        BastionUtils.showToast('error', 'Error al eliminar tarea')
      }
    },

    formatDate(ts) {
      return BastionUtils.formatDate(ts)
    }
  }))
})
