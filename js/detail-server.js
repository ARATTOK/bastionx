document.addEventListener('alpine:init', () => {
  Alpine.data('detailApp', () => ({
    loading: true,
    user: null,
    isSuperAdmin: false,
    server: null,
    serverCreds: null,
    tags: [],
    showDeleteConfirm: false,

    async init() {
      const { data: { session } } = await sb.auth.getSession()
      if (!session) { window.location.href = 'login.html'; return }
      const { error: userErr } = await sb.auth.getUser()
      if (userErr) { await sb.auth.signOut(); window.location.href = 'login.html'; return }
      this.user = session.user
      this.isSuperAdmin = this.user.email === 'admin@bastionx.com'

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

      this.loading = false
      this.$nextTick(() => { try { lucide.createIcons() } catch(e) {} })
    },

    deleteServer() {
      this.showDeleteConfirm = true
    },

    async confirmDelete() {
      await sb.from('server_tags').delete().eq('server_id', this.server.id)
      await sb.from('server_credentials').delete().eq('server_id', this.server.id)
      await sb.from('servers').delete().eq('id', this.server.id)
      window.location.href = 'dashboard.html'
    },

    goBack() { window.location.href = 'dashboard.html' },
    goEdit() { window.location.href = 'edit-server.html?id=' + this.server.id },

    diskCount(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        return Array.isArray(d) ? d.length : 0
      } catch { return 0 }
    },

    diskDetail(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return ''
        return d
      } catch { return [] }
    },
  }))
})
