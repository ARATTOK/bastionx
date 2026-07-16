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
    newTaskTitulo: '',
    newTaskDesc: '',
    newTaskCriticidad: 'normal',
    showDeleteConfirm: false,
    showCompleteModal: false,
    completeTaskDesc: '',
    pendingCompleteTask: null,

    async init() {
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

      const { data: server } = await sb.from('servers').select('*').eq('id', id).single()
      if (!server) { window.location.href = 'dashboard.html'; return }
      this.server = server

      const { data: creds } = await sb.from('server_credentials').select('*').eq('server_id', id).maybeSingle()
      if (creds) this.serverCreds = creds

      const { data: sts } = await sb.from('server_tags').select('tag_id').eq('server_id', id)
      if (sts && sts.length > 0) {
        const tagIds = sts.map(s => s.tag_id)
        const { data: allTags } = await sb.from('tags').select('*')
        if (allTags) this.tags = allTags.filter(t => tagIds.includes(t.id))
      }

      const { data: tasks } = await sb.from('server_tasks').select('*').eq('server_id', id).order('created_at')
      if (tasks) this.tasks = tasks

      await this.loadTaskLogs(id)

      this.loading = false
      this.$nextTick(() => { try { lucide.createIcons() } catch(e) {} })
    },

    deleteServer() {
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      await sb.from('server_tags').delete().eq('server_id', this.server.id)
      await sb.from('server_credentials').delete().eq('server_id', this.server.id)
      await sb.from('server_tasks').delete().eq('server_id', this.server.id)
      await sb.from('servers').delete().eq('id', this.server.id)
      window.location.href = 'dashboard.html'
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
      if (error) { alert('Error: ' + error.message); return }
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
      }
      this.showCompleteModal = false
      this.pendingCompleteTask = null
      this.completeTaskDesc = ''
    },

    async toggleTask(task) {
      if (task.completada) {
        const { error } = await sb.from('server_tasks').update({ completada: false, completed_at: null }).eq('id', task.id)
        if (!error) {
          task.completada = false
          task.completed_at = null
          await this.insertLog(task.id, 'desmarcada', null)
        }
      } else {
        this.openCompleteModal(task)
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
      this.taskLogs = logs || []
    },

    logUserEmail(log) {
      return log.user_id?.slice(0, 8) + '...'
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
      if (c === 'critica') return 'Crítica'
      if (c === 'configuracion') return 'Configuración'
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
