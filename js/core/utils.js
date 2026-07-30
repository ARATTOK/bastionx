/**
 * BASTIONX LAB — Shared Utility Functions Module
 * Clean Code Principle: Single Responsibility & DRY
 */

window.BastionUtils = (function () {
  /**
   * Copies text to clipboard without revealing plain text in UI, showing a Toast feedback.
   * @param {string} text - Text to copy
   * @param {string} [successMessage='Contraseña copiada al portapapeles'] - Optional message
   */
  async function copyToClipboard(text, successMessage = 'Contraseña copiada al portapapeles') {
    if (!text) return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      showToast('success', successMessage)
    } catch (err) {
      showToast('error', 'Error al copiar al portapapeles')
    }
  }

  /**
   * Displays an Alpine toast message safely.
   * @param {'success'|'error'|'info'} type 
   * @param {string} message 
   */
  function showToast(type, message) {
    if (window.Alpine && window.Alpine.store('toast')) {
      const store = window.Alpine.store('toast')
      if (typeof store[type] === 'function') {
        store[type](message)
        return
      }
    }
    console.log(`[Toast ${type.toUpperCase()}]`, message)
  }

  /**
   * Validates if a string is a valid IPv4 address.
   * @param {string} ip 
   * @returns {boolean}
   */
  function isValidIPv4(ip) {
    if (!ip || !ip.trim()) return true
    const parts = ip.trim().split('.')
    if (parts.length !== 4) return false
    return parts.every(part => {
      const num = Number(part)
      return !isNaN(num) && num >= 0 && num <= 255 && part === String(num)
    })
  }

  /**
   * Validates if a value is a valid TCP/UDP port number (1-65535).
   * @param {number|string} port 
   * @returns {boolean}
   */
  function isValidPort(port) {
    if (!port || !String(port).trim()) return true
    const p = Number(port)
    return !isNaN(p) && Number.isInteger(p) && p >= 1 && p <= 65535
  }

  /**
   * Formats ISO date string into locale date format.
   * @param {string|Date} dateVal 
   * @returns {string}
   */
  function formatDate(dateVal) {
    if (!dateVal) return '—'
    const date = new Date(dateVal)
    if (isNaN(date.getTime())) return String(dateVal)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  /**
   * Returns severity CSS badge class name for a task.
   * @param {string} criticidad 
   * @returns {string}
   */
  function taskSeverityClass(criticidad) {
    switch (criticidad) {
      case 'critica': return 'sev-critica'
      case 'configuracion': return 'sev-config'
      case 'normal': default: return 'sev-normal'
    }
  }

  /**
   * Calculates remaining days countdown text from a target date string.
   * @param {string} fechaString 
   * @returns {string}
   */
  function getCountdownText(fechaString) {
    if (!fechaString) return ''
    const target = new Date(fechaString + 'T23:59:59')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return `Vencido (${Math.abs(diffDays)}d)`
    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Mañana'
    return `En ${diffDays} días`
  }

  /**
   * Calculates countdown CSS badge class name based on remaining days.
   * @param {string} fechaString 
   * @returns {string}
   */
  function getCountdownClass(fechaString) {
    if (!fechaString) return ''
    const target = new Date(fechaString + 'T23:59:59')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'cd-overdue'
    if (diffDays <= 3) return 'cd-urgent'
    return 'cd-upcoming'
  }

  /**
   * Gets the active simulated role set by Superadmin (if any).
   * @returns {string}
   */
  function getSimulatedRole() {
    return localStorage.getItem('bastion_simulated_role') || ''
  }

  /**
   * Sets active simulated role.
   * @param {string} role 
   */
  function setSimulatedRole(role) {
    if (!role) {
      localStorage.removeItem('bastion_simulated_role')
      showToast('info', 'Restablecido a vista Superadmin real')
    } else {
      localStorage.setItem('bastion_simulated_role', role)
      showToast('info', 'Simulando vista como rol: ' + role.toUpperCase())
    }
  }

  return {
    copyToClipboard,
    showToast,
    isValidIPv4,
    isValidPort,
    formatDate,
    taskSeverityClass,
    getCountdownText,
    getCountdownClass,
    getSimulatedRole,
    setSimulatedRole
  }
})()
