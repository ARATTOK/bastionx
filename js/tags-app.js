document.addEventListener('alpine:init', () => {
  Alpine.data('tagsApp', () => ({
    loading: true,
    tags: [],
    showModal: false,
    editingTag: null,
    form: { name: '', color: '#6c5ce7' },

    async init() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { window.location.href = 'login.html'; return }
      if (session.user.email !== 'admin@bastionx.com') { window.location.href = 'dashboard.html'; return }
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
      if (this.editingTag) {
        await sb.from('tags').update({ name: this.form.name.trim(), color: this.form.color }).eq('id', this.editingTag.id)
      } else {
        await sb.from('tags').insert({ name: this.form.name.trim(), color: this.form.color })
      }
      this.showModal = false
      await this.loadTags()
    },

    async deleteTag(id) {
      if (!confirm('¿Eliminar este tag?')) return
      await sb.from('server_tags').delete().eq('tag_id', id)
      await sb.from('tags').delete().eq('id', id)
      await this.loadTags()
    },
  }))
})
