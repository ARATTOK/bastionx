document.addEventListener('alpine:init', () => {
  Alpine.data('tasksApp', () => ({
    loading: true,
    user: null,
    tasks: [],
    filterStatus: 'pending',
    searchQuery: '',

    showCompleteModal: false,
    selectedTask: null,
    completionNote: '',
    completing: false,

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        this.user = session.user

        await this.loadMyTasks()
      } catch (err) {
        console.error('Error init tasks:', err)
      } finally {
        this.loading = false
      }
    },

    async loadMyTasks() {
      const { data, error } = await sb.from('server_tasks')
        .select('*, servers(id, hostname, ubicacion, estado)')
        .order('fecha_limite', { ascending: true })

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      if (data) {
        // Filter tasks assigned to current user, or if assigned_user is null/all
        this.tasks = data.filter(t => !t.assigned_to || t.assigned_to === this.user.id || t.assigned_to === this.user.email)
      }
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
          return matchTitle || matchDesc || matchServer
        }
        return true
      })
    },

    get pendingCount() {
      return this.tasks.filter(t => !t.completada).length
    },

    get completedCount() {
      return this.tasks.filter(t => t.completada).length
    },

    getUrgencyInfo(deadline, completada) {
      if (completada) return { status: 'completed', label: 'Completada', color: '#2ecc71', icon: 'lucide:check-circle-2' }
      if (!deadline) return { status: 'normal', label: 'Sin fecha límite', color: '#aaa', icon: 'lucide:clock' }

      const diffMs = new Date(deadline).getTime() - new Date().getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      if (diffHours < 0) {
        const absDays = Math.abs(Math.floor(diffHours / 24))
        return { status: 'overdue', label: `Vencida hace ${absDays === 0 ? 'pocas horas' : absDays + 'd'}`, color: '#e74c3c', icon: 'lucide:alert-circle' }
      } else if (diffHours < 48) {
        const h = Math.floor(diffHours)
        return { status: 'urgent', label: `Vence en ${h}h`, color: '#f39c12', icon: 'lucide:clock' }
      } else {
        const d = Math.floor(diffHours / 24)
        return { status: 'normal', label: `Vence en ${d}d`, color: '#2ecc71', icon: 'lucide:clock' }
      }
    },

    openCompleteModal(task) {
      this.selectedTask = task
      this.completionNote = ''
      this.showCompleteModal = true
    },

    async confirmCompletion() {
      if (!this.selectedTask) return
      this.completing = true

      try {
        const taskId = this.selectedTask.id
        const serverId = this.selectedTask.server_id
        const note = this.completionNote.trim() || 'Tarea completada por el usuario asignado'

        // 1. Update task in server_tasks
        const { error: taskErr } = await sb.from('server_tasks')
          .update({
            completada: true,
            completed_at: new Date().toISOString()
          })
          .eq('id', taskId)

        if (taskErr) throw taskErr

        // 2. Insert into server_task_logs
        await sb.from('server_task_logs').insert({
          server_id: serverId,
          task_id: taskId,
          user_id: this.user.id,
          accion: 'completada',
          descripcion: note
        })

        // 3. Register audit log
        await auditLog(
          serverId,
          this.user.id,
          'task.completed',
          { task_id: taskId, note },
          `Cumplimiento de tarea "${this.selectedTask.titulo}": ${note}`
        )

        BastionUtils.showToast('success', 'Tarea marcada como completada exitosamente')
        this.showCompleteModal = false
        this.selectedTask = null
        await this.loadMyTasks()
      } catch (err) {
        console.error('Error completing task:', err)
        BastionUtils.showToast('error', 'Error al completar la tarea: ' + err.message)
      } finally {
        this.completing = false
      }
    },

    gotoServerDetail(serverId) {
      if (serverId) {
        window.location.href = `server-detail.html?id=${serverId}`
      }
    },

    formatDate(ts) {
      return BastionUtils.formatDate(ts)
    }
  }))
})
