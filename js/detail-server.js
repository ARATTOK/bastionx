document.addEventListener('alpine:init', () => {
  Alpine.data('detailApp', () => ({
    loading: true,
    user: null,
    isSuperAdmin: false,
    canEdit: false,
    server: null,
    serverCreds: null,
    tags: [],
    tasks: [],
    taskLogs: [],
    logFilter: 'all',
    newTaskTitulo: '',
    newTaskDesc: '',
    newTaskCriticidad: 'normal',
    showDeleteConfirm: false,
    showCompleteModal: false,
    completeTaskDesc: '',
    pendingCompleteTask: null,
    showEvidenceModal: false,
    evidenceTask: null,

    async init() {
      try {
        const { data: { session } } = await sb.auth.getSession()
        if (!session) { window.location.href = 'login.html'; return }
        const { error: userErr } = await sb.auth.getUser()
        if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
        this.user = session.user
        let role = 'readonly'
        try {
          const { data } = await sb.from('user_profiles').select('role').eq('id', this.user.id).single()
          if (data?.role) role = data.role
        } catch(e) {}
        this.isSuperAdmin = role === 'superadmin'
        this.canEdit = this.isSuperAdmin || role === 'admin'

        const params = new URLSearchParams(window.location.search)
        const id = params.get('id')
        if (!id) { window.location.href = 'dashboard.html'; return }

        const { data: server, error: srvErr } = await sb.from('servers').select('*').eq('id', id).maybeSingle()
        if (srvErr || !server) {
          this.loading = false
          this.server = null
          return
        }
        this.server = server

        const { data: creds } = await sb.from('server_credentials').select('*').eq('server_id', id).maybeSingle()
        if (creds) this.serverCreds = creds

        const { data: sts } = await sb.from('server_tags').select('tag_id').eq('server_id', id)
        if (sts && sts.length > 0) {
          const tagIds = sts.map(s => s.tag_id)
          const { data: tags } = await sb.from('tags').select('*').in('id', tagIds)
          if (tags) this.tags = tags
        }
        await this.loadTasks()
        this.loading = false
      } catch (err) {
        console.error('Init error:', err)
        Alpine.store('toast').error('Error al cargar datos del servidor')
        this.loading = false
      }
    },

    async loadTasks() {
      if (!this.server) return
      const { data: tasks } = await sb.from('server_tasks')
        .select('*')
        .eq('server_id', this.server.id)
        .order('created_at', { ascending: false })
      this.tasks = tasks || []
      await this.loadTaskLogs(this.server.id)
    },

    get filteredLogs() {
      if (this.logFilter === 'all') return this.taskLogs
      return this.taskLogs.filter(l => l.accion === this.logFilter)
    },

    deleteServer() {
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      await auditLog(this.server.id, this.user.id, 'server.eliminada', null, 'Servidor eliminado: ' + this.server.hostname)
      await sb.from('server_tags').delete().eq('server_id', this.server.id)
      await sb.from('server_credentials').delete().eq('server_id', this.server.id)
      await sb.from('server_tasks').delete().eq('server_id', this.server.id)
      await sb.from('servers').delete().eq('id', this.server.id)
      const t = Alpine.store('toast')
      if (t) t.success('Servidor eliminado')
      setTimeout(() => { window.location.href = 'dashboard.html' }, 400)
    },

    goBack() { window.location.href = 'dashboard.html' },
    goEdit() { window.location.href = 'edit-server.html?id=' + this.server.id },

    async addTask() {
      if (!this.newTaskTitulo.trim()) return
      const { data, error } = await sb.from('server_tasks').insert({
        server_id: this.server.id,
        titulo: this.newTaskTitulo.trim(),
        descripcion: this.newTaskDesc.trim(),
        criticidad: this.newTaskCriticidad,
        created_by: this.user.id
      }).select().single()
      if (error) {
        const t = Alpine.store('toast')
        if (t) t.error('Error: ' + error.message)
        return
      }
      if (data) {
        this.tasks.push(data)
        await this.insertLog(data.id, 'creada', null)
      }
      this.newTaskTitulo = ''
      this.newTaskDesc = ''
      this.newTaskCriticidad = 'normal'
    },

    openCompleteModal(task) {
      this.pendingCompleteTask = task
      this.completeTaskDesc = ''
      this.showCompleteModal = true
    },

    async completeTask() {
      const task = this.pendingCompleteTask
      if (!task) return
      const desc = this.completeTaskDesc.trim()
      if (!desc) return
      const { error } = await sb.from('server_tasks').update({
        completada: true,
        completed_at: new Date().toISOString()
      }).eq('id', task.id)
      if (!error) {
        task.completada = true
        task.completed_at = new Date().toISOString()
        await this.insertLog(task.id, 'completada', desc)
        const t = Alpine.store('toast')
        if (t) t.success('Tarea completada')
      }
      this.showCompleteModal = false
      this.pendingCompleteTask = null
      this.completeTaskDesc = ''
    },

    async toggleTask(task) {
      if (task.completada) {
        this.viewEvidence(task)
      } else {
        this.openCompleteModal(task)
      }
    },

    async reopenTask(task) {
      const { error } = await sb.from('server_tasks').update({ completada: false, completed_at: null }).eq('id', task.id)
      if (!error) {
        task.completada = false
        task.completed_at = null
        await this.insertLog(task.id, 'desmarcada', null)
        this.showEvidenceModal = false
        this.evidenceTask = null
      }
    },

    async deleteTask(id) {
      await this.insertLog(id, 'eliminada', null)
      await sb.from('server_tasks').delete().eq('id', id)
      this.tasks = this.tasks.filter(t => t.id !== id)
    },

    async insertLog(taskId, accion, descripcion) {
      await sb.from('server_task_logs').insert({
        task_id: taskId,
        server_id: this.server.id,
        user_id: this.user.id,
        accion,
        descripcion
      })
      await this.loadTaskLogs(this.server.id)
    },

    async loadTaskLogs(serverId) {
      const { data: logs } = await sb.from('server_task_logs')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: false })
      if (logs && logs.length > 0) {
        const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))]
        const emailMap = {}
        if (userIds.length > 0) {
          const { data: profiles } = await sb
            .from('user_profiles')
            .select('id, email')
            .in('id', userIds)
          if (profiles) profiles.forEach(p => { emailMap[p.id] = p.email })
        }
        this.taskLogs = logs.map(l => ({ ...l, user_email: emailMap[l.user_id] || (l.user_id ? l.user_id.slice(0, 8) : '—') }))
      } else {
        this.taskLogs = []
      }
    },

    viewEvidence(task) {
      this.evidenceTask = task
      this.showEvidenceModal = true
    },

    taskEvidenceDesc(taskId) {
      const log = this.taskLogs.find(l => l.task_id === taskId && l.accion === 'completada')
      return log ? log.descripcion : ''
    },

    logUserEmail(log) {
      return log?.user_email || (log?.user_id ? log.user_id.slice(0, 8) + '...' : '—')
    },

    logAccionClass(accion) {
      if (accion === 'completada') return 'log-completada'
      if (accion === 'creada') return 'log-creada'
      if (accion === 'eliminada') return 'log-eliminada'
      return 'log-desmarcada'
    },

    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },

    taskSeverityClass(c) {
      if (c === 'critica') return 'tsk-critical'
      if (c === 'configuracion') return 'tsk-config'
      return 'tsk-normal'
    },

    taskSeverityLabel(c) {
      if (c === 'critica') return 'Cr\u00edtica'
      if (c === 'configuracion') return 'Configuraci\u00f3n'
      return 'Normal'
    },

    parseDiscos(raw) {
      try {
        const d = typeof raw === 'string' ? JSON.parse(raw) : (raw || [])
        return Array.isArray(d) ? d : []
      } catch { return [] }
    },

    diskCount(s) {
      const raids = this.parseDiscos(s.discos)
      if (raids.length === 0) return 0
      if (raids[0].nombre !== undefined)
        return raids.reduce((sum, r) => sum + (Array.isArray(r.discos) ? r.discos.length : 0), 0)
      return raids.length
    },

    diskDetail(s) {
      const raids = this.parseDiscos(s.discos)
      if (!Array.isArray(raids) || raids.length === 0) return []
      if (raids[0].nombre !== undefined) return raids
      return raids.filter(x => x && x.bay)
    },

    groupedDisks(s) {
      const raids = this.parseDiscos(s.discos)
      if (!Array.isArray(raids) || raids.length === 0) return []
      if (raids[0] && raids[0].nombre !== undefined)
        return raids.filter(r => Array.isArray(r.discos) && r.discos.length > 0)
      const disks = raids.filter(x => x && x.bay)
      if (disks.length === 0) return []
      const groups = {}
      disks.forEach(x => {
        const key = x.raid || ''
        if (!groups[key]) groups[key] = { nombre: key, discos: [] }
        groups[key].discos.push({ bay: x.bay, tipo: x.tipo || '', tamano: x.tamano || '', velocidad: x.velocidad || '' })
      })
      return Object.values(groups)
    },
  }))
})
