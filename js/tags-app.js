document.addEventListener('alpine:init', () => {
  Alpine.data('tagsApp', () => ({
    loading: true,
    tags: [],
    showModal: false,
    showDeleteConfirm: false,
    pendingDeleteId: null,
    editingTag: null,
    form: { name: '', color: '#6c5ce7' },

    async init() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { window.location.href = 'login.html'; return }
      const { data: profile } = await sb.from('user_profiles').select('role').eq('id', session.user.id).single()
      if (profile?.role !== 'superadmin') { window.location.href = 'dashboard.html'; return }
      await this.loadTags()
      this.loading = false
    },

    async loadTags() {
      const { data } = await sb.from('tags').select('*').order('name')
      if (data) this.tags = data
    },

    openAdd() {
      this.editingTag = null
      this.form = { name: '', color: '#6c5ce7' }
      this.showModal = true
    },

    openEdit(tag) {
      this.editingTag = tag
      this.form = { name: tag.name, color: tag.color }
      this.showModal = true
    },

    async save() {
      if (!this.form.name.trim()) return
      const t = Alpine.store('toast')
      if (this.editingTag) {
        await sb.from('tags').update({ name: this.form.name.trim(), color: this.form.color }).eq('id', this.editingTag.id)
        if (t) t.success('Tag actualizado')
      } else {
        await sb.from('tags').insert({ name: this.form.name.trim(), color: this.form.color })
        if (t) t.success('Tag creado')
      }
      this.showModal = false
      await this.loadTags()
    },

    deleteTag(id) {
      this.pendingDeleteId = id
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      await sb.from('server_tags').delete().eq('tag_id', this.pendingDeleteId)
      await sb.from('tags').delete().eq('id', this.pendingDeleteId)
      await this.loadTags()
      this.showDeleteConfirm = false
      this.pendingDeleteId = null
      const t = Alpine.store('toast')
      if (t) t.success('Tag eliminado')
    },

    cancelDelete() {
      this.showDeleteConfirm = false
      this.pendingDeleteId = null
    },
  }))
})
