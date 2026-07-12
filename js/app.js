/*
 * BASTIONX LAB — Inventory Control
 * Componente principal Alpine.js
 *
 * Dependencias:
 *   - Alpine.js 3.x (CDN)
 *   - supabase.js (cliente Supabase)
 *   - auth.js (funciones de autenticación)
 *   - style.css (estilos)
 *
 * Este archivo registra el componente 'app' en Alpine.js,
 * que maneja todo el estado y la lógica de la interfaz:
 *   - Kanban board con servidores agrupados por estado
 *   - CRUD de servidores (admin)
 *   - Detalle de servidor con credenciales (admin)
 *   - Estadísticas del laboratorio
 */

document.addEventListener('alpine:init', () => {
  Alpine.data('app', () => ({
    // =============================================================
    // Estado de autenticación
    // =============================================================
    user: null,           // Objeto del usuario autenticado
    userRole: 'readonly', // Rol del usuario: 'admin' | 'readonly'
    loginEmail: '',       // Email ingresado en el formulario de login
    loginPassword: '',    // Contraseña ingresada
    loginError: '',       // Mensaje de error en login
    loginSuccess: '',     // Mensaje de éxito en login
    loading: false,       // Indicador de carga

    // =============================================================
    // Datos del inventario
    // =============================================================
    servers: [],          // Lista de servidores desde Supabase
    serverCreds: null,    // Credenciales del servidor seleccionado (solo admin)

    // =============================================================
    // Estado de la interfaz
    // =============================================================
    detailServer: null,   // Servidor seleccionado en el modal de detalle
    showAddServer: false, // Muestra/oculta el modal de agregar servidor
    showUsers: false,     // Muestra/oculta el modal de gestión de usuarios

    // =============================================================
    // Formulario de nuevo servidor
    // =============================================================
    newServer: {
      hostname: '',
      modelo: '',
      sn: '',
      ubicacion: '',
      procesador: '',
      ram_gb: 0,
      estado: 'Activo',
      discos_str: '[]'
    },

    // =============================================================
    // INICIALIZACIÓN
    // Se ejecuta automáticamente al cargar el componente.
    // Restaura la sesión previa y escucha cambios de autenticación.
    // =============================================================
    async init() {
      this.loading = true
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        this.user = session.user
        await this.fetchUserRole()
        await this.refreshServers()
        lucide.createIcons()
      }
      this.loading = false

      // Escucha cambios de autenticación en tiempo real
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session && event === 'SIGNED_IN') {
          this.user = session.user
          await this.fetchUserRole()
          await this.refreshServers()
          this.loginEmail = ''
          this.loginPassword = ''
          this.loginError = ''
          this.loginSuccess = ''
        }
        if (event === 'SIGNED_OUT') {
          this.user = null
          this.servers = []
          this.serverCreds = null
        }
        this.$nextTick(() => lucide.createIcons())
      })
    },

    // =============================================================
    // AUTH — login, logout, fetchUserRole
    // Definidos en auth.js
    // =============================================================
    login,
    logout,
    fetchUserRole,

    // =============================================================
    // SERVIDORES — CRUD y consultas
    // =============================================================

    /**
     * Recarga la lista de servidores desde Supabase.
     * Se ejecuta al iniciar sesión, al agregar/eliminar servidores,
     * y manualmente desde el botón "Recargar datos" del panel admin.
     */
    async refreshServers() {
      this.loading = true
      const { data, error } = await supabase
        .from('servers')
        .select('*')
        .order('ubicacion')
      if (data) this.servers = data
      this.loading = false
      this.$nextTick(() => lucide.createIcons())
    },

    /**
     * Abre el modal de detalle de un servidor.
     * Si el usuario es admin, también carga las credenciales
     * desde la tabla server_credentials.
     * @param {Object} s — Servidor a mostrar
     */
    async openDetail(s) {
      this.detailServer = s
      this.serverCreds = null
      if (this.userRole === 'admin') {
        const { data } = await supabase
          .from('server_credentials')
          .select('*')
          .eq('server_id', s.id)
          .maybeSingle()
        if (data) this.serverCreds = data
      }
      this.$nextTick(() => lucide.createIcons())
    },

    /**
     * Agrega un nuevo servidor a la base de datos.
     * Solo accesible para usuarios con role='admin'.
     * El formulario se valida en frontend y los discos se parsean como JSON.
     */
    async addServer() {
      try {
        const discos = JSON.parse(this.newServer.discos_str || '[]')
        const { data, error } = await supabase
          .from('servers')
          .insert({
            hostname: this.newServer.hostname,
            modelo: this.newServer.modelo,
            sn: this.newServer.sn,
            ubicacion: this.newServer.ubicacion,
            procesador: this.newServer.procesador,
            ram_gb: Number(this.newServer.ram_gb) || 0,
            estado: this.newServer.estado,
            discos: discos
          })
          .select()
        if (error) { alert('Error: ' + error.message); return }
        this.showAddServer = false
        this.newServer = {
          hostname: '', modelo: '', sn: '', ubicacion: '',
          procesador: '', ram_gb: 0, estado: 'Activo', discos_str: '[]'
        }
        await this.refreshServers()
      } catch (e) { alert('Error al guardar') }
    },

    /**
     * Elimina un servidor y sus credenciales asociadas.
     * Solo accesible para admin. Confirma antes de eliminar.
     * @param {string} id — UUID del servidor a eliminar
     */
    async deleteServer(id) {
      if (!confirm('¿Eliminar este servidor?')) return
      await supabase.from('server_credentials').delete().eq('server_id', id)
      await supabase.from('servers').delete().eq('id', id)
      this.detailServer = null
      await this.refreshServers()
    },

    // =============================================================
    // HELPERS — Funciones auxiliares de UI
    // =============================================================

    /**
     * Filtra servidores por estado.
     * @param {string} status — 'Activo' | 'Inactivo' | 'Pendiente' | 'Libre'
     * @returns {Array} Servidores que coinciden con el estado
     */
    serversByStatus(status) {
      return this.servers.filter(s => s.estado === status)
    },

    /**
     * Cuenta servidores por estado.
     * @param {string} status — Estado a contar
     * @returns {number} Cantidad de servidores
     */
    countByStatus(status) {
      return this.servers.filter(s => s.estado === status).length
    },

    /**
     * Calcula el total de RAM en GB de todos los servidores.
     * @returns {number} Suma total de RAM
     */
    get totalRam() {
      return this.servers.reduce((acc, s) => acc + Number(s.ram_gb || 0), 0)
    },

    /**
     * Acorta el nombre del procesador para mostrarlo en las tags.
     * Ej: "Intel Xeon Silver 4110 @ 2.10GHz" → "Silver 4110"
     * @param {string} cpu — Nombre completo del procesador
     * @returns {string} Versión abreviada
     */
    shortCpu(cpu) {
      if (!cpu || cpu === '') return '—'
      if (cpu.includes('Silver')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E5')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu.includes('E-')) return cpu.split('@')[0].replace('Intel ', '').trim()
      if (cpu === 'Pendiente') return 'Pendiente'
      return cpu
    },

    /**
     * Determina la clase CSS del tag de CPU según el modelo.
     * @param {Object} s — Servidor
     * @returns {string} Clase CSS: 'xeon' | 'silver' | 'e5' | 'pending-tag'
     */
    cpuTagClass(s) {
      if (!s.procesador || s.procesador === '' || s.procesador === 'Pendiente') return 'pending-tag'
      if (s.procesador.includes('Silver')) return 'silver'
      if (s.procesador.includes('E5')) return 'e5'
      if (s.procesador.includes('E-')) return 'xeon'
      return 'pending-tag'
    },

    /**
     * Cuenta la cantidad de discos de un servidor.
     * Maneja tanto strings JSON como objetos ya parseados.
     * @param {Object} s — Servidor
     * @returns {number} Cantidad de discos
     */
    diskCount(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        return Array.isArray(d) ? d.length : 0
      } catch { return 0 }
    },

    /**
     * Genera el detalle HTML de los discos de un servidor.
     * @param {Object} s — Servidor
     * @returns {string} HTML con bay y tipo de cada disco
     */
    diskDetail(s) {
      try {
        const d = typeof s.discos === 'string' ? JSON.parse(s.discos) : (s.discos || [])
        if (!Array.isArray(d) || d.length === 0) return ''
        return d.map(dd => dd.bay + ': ' + dd.tipo).join('<br>')
      } catch { return '' }
    },

    /**
     * Calcula el porcentaje de RAM usado respecto al máximo (384GB).
     * @param {Object} s — Servidor
     * @returns {number} Porcentaje (0-100)
     */
    ramPercent(s) {
      if (!s.ram_gb || s.ram_gb === 0) return 0
      return Math.min(100, (Number(s.ram_gb) / 384) * 100)
    },

    /**
     * Determina el color de la barra de progreso RAM según el porcentaje.
     * Verde < 25%, Azul < 50%, Amarillo < 75%, Rojo ≥ 75%
     * @param {Object} s — Servidor
     * @returns {string} Código de color hexadecimal
     */
    ramColor(s) {
      const pct = this.ramPercent(s)
      if (pct < 25) return '#2ecc71'
      if (pct < 50) return '#5dade2'
      if (pct < 75) return '#f39c12'
      return '#e74c3c'
    },
  }))
})
