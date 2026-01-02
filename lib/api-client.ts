const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://zaco-backend.onrender.com/api"

interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private token: string | null = null
  private refreshToken: string | null = null
  private lastVersionCheck: number = 0
  private cachedVersion: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
      this.refreshToken = localStorage.getItem("refresh_token")
      
      // On initialization, validate and clean old tokens
      this.validateAndCleanTokens()
    }
  }

  /**
   * Validate tokens on initialization and remove expired/invalid ones
   * Prevents looping with stale tokens
   */
  private validateAndCleanTokens() {
    if (!this.token) return
    
    try {
      // Decode JWT without verification (just to check expiry time)
      const parts = this.token.split('.')
      if (parts.length !== 3) {
        // Invalid JWT format, clear it
        this.clearToken()
        return
      }
      
      const payload = JSON.parse(atob(parts[1]))
      const now = Date.now() / 1000
      
      // If token expired more than 1 minute ago, clear both tokens
      // (This prevents using stale tokens that will immediately fail)
      if (payload.exp && payload.exp < now - 60) {
        console.warn('[ApiClient] Stored token is stale (expired >1min ago), clearing')
        this.clearToken()
        // Emit event to trigger re-login if needed
        try { this.emitSessionExpired() } catch { /* ignore */ }
      }
    } catch (err) {
      // If we can't parse/validate token, clear it to prevent loops
      console.warn('[ApiClient] Failed to validate stored token, clearing', err)
      this.clearToken()
    }
  }

  /**
   * Check backend version and force page reload if deployment updated
   * This ensures all clients get fresh code and tokens after deployment
   */
  private async checkVersion() {
    const now = Date.now()
    // Only check version once per 5 minutes
    if (now - this.lastVersionCheck < 5 * 60 * 1000 && this.cachedVersion) {
      return
    }
    
    try {
      this.lastVersionCheck = now
      const response = await fetch(`${API_BASE_URL}/version`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        const data = await response.json()
        const newVersion = data.version || 'unknown'
        
        if (this.cachedVersion && this.cachedVersion !== newVersion) {
          console.warn('[ApiClient] Deployment detected - version changed from', this.cachedVersion, 'to', newVersion)
          console.warn('[ApiClient] Forcing hard refresh to load new code')
          
          // Force hard refresh to clear all caches
          if (typeof window !== 'undefined' && window.location) {
            // Disable service worker cache for this reload
            if (navigator.serviceWorker) {
              navigator.serviceWorker.getRegistrations().then(registrations => {
                registrations.forEach(reg => reg.unregister())
              })
            }
            // Hard refresh with cache busting
            window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 't=' + Date.now()
          }
        }
        
        this.cachedVersion = newVersion
      }
    } catch (err) {
      // Version check failed - continue anyway but log it
      console.debug('[ApiClient] Version check failed (non-critical)', err)
    }
  }

  setToken(token: string, refreshToken?: string) {
    this.token = token
    if (refreshToken) this.refreshToken = refreshToken
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
      if (refreshToken) localStorage.setItem("refresh_token", refreshToken)
    }
  }

  clearToken() {
    this.token = null
    this.refreshToken = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
      localStorage.removeItem("refresh_token")
    }
  }

  private sessionExpiredListeners: Array<() => void> = []
  onSessionExpired(cb: () => void) {
    this.sessionExpiredListeners.push(cb)
  }
  private emitSessionExpired() {
    for (const cb of this.sessionExpiredListeners) cb()
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) return false
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      })
      if (!response.ok) return false
      const data = await response.json()
      if (data.token) {
        this.setToken(data.token, this.refreshToken)
        return true
      }
      return false
    } catch (err) {
      return false
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Check for deployment updates periodically
    // This runs in the background without blocking requests
    try {
      this.checkVersion().catch(() => {}) // Fire and forget
    } catch { /* ignore */ }

    // Simple public endpoint detection - extend if you add more public endpoints
    const publicPrefixes = ['/auth/', '/version', '/documents/']
    const isPreviewEndpoint = endpoint.includes('/preview') || endpoint.includes('/preview-url')
    const isPublic = publicPrefixes.some(p => endpoint.startsWith(p)) || isPreviewEndpoint || endpoint === '/version'

    // If endpoint requires auth and we don't have a token, fail fast to avoid noisy 401s
    if (!this.token && !isPublic) {
      throw new Error('Access token required')
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    if (this.token) {
      (headers as any)["Authorization"] = `Bearer ${this.token}`
    }

    // Timeout & abort support
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      })
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Request timeout')
      throw err
    } finally {
      clearTimeout(timeout)
    }

    // If 401, try to refresh token once and retry (only if we had a refresh token)
    if (response.status === 401) {
      if (!this.refreshToken) {
        console.warn('[ApiClient] 401 received and no refresh token available')
        this.clearToken()
        try { this.emitSessionExpired() } catch { /* ignore */ }
      } else {
        const refreshed = await this.refreshAccessToken()
        if (refreshed) {
          // Retry request with new token
          const newHeaders: HeadersInit = {
            "Content-Type": "application/json",
            ...options.headers,
          }
          if (this.token) {
            (newHeaders as any)["Authorization"] = `Bearer ${this.token}`
          }

          const retryController = new AbortController()
          const retryTimeout = setTimeout(() => retryController.abort(), 10000)
          try {
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
              ...options,
              headers: newHeaders,
              signal: retryController.signal,
            })
          } finally {
            clearTimeout(retryTimeout)
          }
        } else {
          console.warn('[ApiClient] 401 and refresh failed, clearing tokens')
          this.clearToken()
          try {
            this.emitSessionExpired()
          } catch { /* ignore */ }
        }
      }
    }

    // Treat 204 No Content and 304 Not Modified as empty responses
    if (response.status === 204 || response.status === 304) {
      return null as any
    }

    if (!response.ok) {
      // Try to parse JSON error body, otherwise fallback to plain text
      let errorObj: any = null
      try {
        errorObj = await response.json()
      } catch (jsonErr) {
        try {
          const txt = await response.text()
          errorObj = { error: txt }
        } catch (txtErr) {
          // ignore
        }
      }

      // Build a friendly message from common error shapes
      let message = 'Request failed'
      if (errorObj) {
        if (Array.isArray(errorObj.errors) && errorObj.errors.length) {
          message = errorObj.errors.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('; ')
        } else if (errorObj.error || errorObj.message) {
          message = String(errorObj.error || errorObj.message)
        } else if (typeof errorObj === 'string') {
          message = errorObj
        } else {
          message = JSON.stringify(errorObj)
        }
      }

      throw new Error(message)
    }

    return response.json()
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ token: string; refreshToken: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
    this.setToken(data.token, data.refreshToken)
    return data
  }

  async register(userData: { username: string; password: string; full_name: string; role: string }) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  // Documents
  async getDocuments(params?: { status?: string; type?: string; search?: string; tenant_id?: number }) {
    const queryParams = new URLSearchParams(params as any).toString()
    const res = await this.request<any[]>(`/documents${queryParams ? `?${queryParams}` : ""}`)
    return res || []
  }

  async getDocumentByBarcode(barcode: string) {
    return this.request<any>(`/documents/${barcode}`)
  }

  async createDocument(document: any) {
    return this.request<any>("/documents", {
      method: "POST",
      body: JSON.stringify(document),
    })
  }

  async updateDocument(barcode: string, document: any) {
    return this.request<any>(`/documents/${barcode}`, {
      method: "PUT",
      body: JSON.stringify(document),
    })
  }

  async deleteDocument(barcode: string) {
    return this.request(`/documents/${barcode}`, {
      method: "DELETE",
    })
  }

  // Stamp a document PDF by placing a barcode image at provided coordinates (server overwrites original file)
  async stampDocument(barcode: string, payload: { x: number; y: number; containerWidth?: number; containerHeight?: number; stampWidth?: number }) {
    // Longer timeout for stamping operations (server can take time to fetch/embed/overwrite)
    const controller = new AbortController()
    const timeoutMs = 60_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const headers: any = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    try {
      const res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(barcode)}/stamp`, { method: 'POST', body: JSON.stringify(payload), headers, signal: controller.signal })
      if (!res.ok) {
        let body: any = null
        try { body = await res.json() } catch (e) { body = await res.text().catch(() => null) }
        let msg = 'Stamp failed'
        if (body) msg = body?.error || body?.message || String(body)
        throw new Error(msg)
      }
      return res.json()
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Request timeout')
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async getPreviewUrl(barcode: string, index?: number) {
    const qp = (typeof index === 'number') ? `?idx=${encodeURIComponent(String(index))}` : ''
    const res = await this.request<any>(`/documents/${encodeURIComponent(barcode)}/preview-url${qp}`)
    return res?.previewUrl || null
  }

  // Add an attachment to an existing document: uploadFile should be used first,
  // then call this method with the uploaded file metadata. This will fetch the
  // current document attachments and update the document with the new list.
  async addAttachment(barcode: string, uploaded: any) {
    // Fetch current doc to get existing attachments
    const doc = await this.getDocumentByBarcode(barcode).catch(() => null)
    const existing = (doc && Array.isArray(doc.attachments)) ? doc.attachments : []
    const newAttachments = [uploaded, ...existing]
    return this.updateDocument(barcode, { attachments: newAttachments })
  }

  async getStatement(barcode: string) {
    return this.request<any>(`/documents/${encodeURIComponent(barcode)}/statement`)
  }

  async getStatistics() {
    return this.request<any>("/documents/stats/summary")
  }

  // Backups (admin)
  async listBackups() {
    return this.request<any>(`/backups`).then((r) => r || { items: [] })
  }

  async createBackup() {
    return this.request<any>(`/backups`, { method: 'POST' })
  }

  async downloadJsonBackupBlob() {
    const headers: any = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const controller = new AbortController()
    const timeoutMs = 60_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${API_BASE_URL}/backups/json`, { method: 'GET', headers, signal: controller.signal })
      if (!res.ok) {
        let body: any = null
        try { body = await res.json() } catch { body = await res.text().catch(() => null) }
        throw new Error(body?.error || body?.message || String(body || 'Download failed'))
      }
      return await res.blob()
    } catch (err: any) {
      if (err && err.name === 'AbortError') throw new Error('Request timeout')
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async restoreJsonBackup(file: File) {
    const form = new FormData()
    form.append('file', file)
    const headers: any = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const res = await fetch(`${API_BASE_URL}/backups/json/restore`, { method: 'POST', body: form, headers })
    if (!res.ok) {
      let body: any = null
      try { body = await res.json() } catch { body = await res.text().catch(() => null) }
      throw new Error(body?.error || body?.message || String(body || 'Restore failed'))
    }
    return res.json()
  }

  async restoreBackupUpload(file: File) {
    const form = new FormData()
    form.append('file', file)
    const headers: any = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`
    const controller = new AbortController()
    const timeoutMs = 5 * 60_000
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${API_BASE_URL}/backups/restore-upload`, { method: 'POST', body: form, headers, signal: controller.signal })
      if (!res.ok) {
        let body: any = null
        try { body = await res.json() } catch { body = await res.text().catch(() => null) }
        throw new Error(body?.error || body?.message || String(body || 'Upload restore failed'))
      }
      return res.json()
    } catch (err: any) {
      if (err && err.name === 'AbortError') throw new Error('Request timeout')
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  async downloadBackupUrl(key: string) {
    return this.request<any>(`/backups/download?key=${encodeURIComponent(key)}`)
  }

  async deleteBackup(key: string) {
    return this.request<any>(`/backups?key=${encodeURIComponent(key)}`, { method: 'DELETE' })
  }

  async restoreBackup(key: string) {
    return this.request<any>(`/backups/restore`, { method: 'POST', body: JSON.stringify({ key }) })
  }

  // Barcodes
  async searchBarcodes(q?: string) {
    const qp = q ? `?q=${encodeURIComponent(q)}` : ""
    return this.request<any[]>(`/barcodes${qp}`)
  }

  async getBarcode(barcode: string) {
    return this.request<any>(`/barcodes/${encodeURIComponent(barcode)}`)
  }

  async getBarcodeTimeline(barcode: string) {
    return this.request<any[]>(`/barcodes/${encodeURIComponent(barcode)}/timeline`)
  }

  async addBarcodeTimeline(barcode: string, payload: { action: string; actor_id?: number; meta?: any }) {
    return this.request<any>(`/barcodes/${encodeURIComponent(barcode)}/timeline`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  }

  // File upload (multipart/form-data) with retry and longer timeout for flaky networks
  async uploadFile(file: File, maxAttempts = 3) {
    const form = new FormData()
    form.append('file', file)
    const headers: any = {}
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const attemptUpload = async (attempt: number): Promise<any> => {
      const controller = new AbortController()
      // longer timeout to account for slow connections; will retry on network failures
      const timeoutMs = 60_000
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form, headers, signal: controller.signal })
        const body = await res.json().catch(() => null)
        if (!res.ok) {
          let msg = 'Upload failed'
          if (body) {
            if (Array.isArray(body.errors)) msg = body.errors.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('; ')
            else if (body.error || body.message) msg = body.error || body.message
            else msg = JSON.stringify(body)
          }
          throw new Error(msg)
        }
        return body
      } catch (err: any) {
        const isAbort = err && err.name === 'AbortError'
        const isNetwork = String(err?.message || '').includes('Failed to fetch') || String(err?.message || '').includes('NetworkError') || String(err?.message || '').includes('ERR_') || isAbort
        // Retry on network-related failures
        if (attempt < maxAttempts && isNetwork) {
          const backoff = attempt * 500
          await new Promise((r) => setTimeout(r, backoff))
          return attemptUpload(attempt + 1)
        }

        // Build friendly message
        let friendly = 'Upload failed'
        if (err?.message) friendly = err.message
        if (isAbort) friendly = 'Upload timed out or was aborted. Check your connection and try again.'
        throw new Error(friendly)
      } finally {
        clearTimeout(timeout)
      }
    }

    return attemptUpload(1)
  }

  // Tenants
  async getTenants() {
    return this.request<any[]>(`/tenants`)
  }

  // Change own password
  async changePassword(current_password: string, new_password: string) {
    return this.request<any>(`/users/me/password`, {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    })
  }

  // Admin: set another user's password
  async setUserPassword(id: number | string, new_password: string) {
    return this.request<any>(`/users/${id}/password`, {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    })
  }

  async createTenant(payload: { name: string; slug: string; logo_url?: string }) {
    return this.request<any>(`/tenants`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateTenant(id: number | string, payload: { name?: string; slug?: string; logo_url?: string }) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async deleteTenant(id: number | string) {
    return this.request<any>(`/tenants/${id}`, {
      method: 'DELETE',
    })
  }

  // Users
  async getUsers() {
    return this.request<any[]>("/users")
  }

  async createUser(payload: { username: string; password: string; full_name: string; role: string }) {
    return this.request<any>("/users", {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async updateUser(id: number | string, payload: { full_name?: string; role?: string; password?: string; manager_id?: number | null; signature_url?: string; stamp_url?: string }) {
    return this.request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  // Approvals System
  async createApprovalRequest(payload: { title: string; description?: string; attachment_url: string; manager_id: number }) {
    return this.request<any>("/approvals", {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  async getMyApprovalRequests() {
    return this.request<any[]>("/approvals/my-requests")
  }

  async getPendingApprovals() {
    return this.request<any[]>("/approvals/pending")
  }

  async updateApprovalRequest(id: number | string, payload: { status: 'APPROVED' | 'REJECTED'; rejection_reason?: string; signed_attachment_url?: string }) {
    return this.request<any>(`/approvals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async updateRequestAttachment(id: number | string, payload: { attachment_url: string }) {
    return this.request<any>(`/approvals/${id}/attachment`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }

  async deleteUser(id: number | string) {
    return this.request<any>(`/users/${id}`, {
      method: 'DELETE',
    })
  }

  async getCurrentUser() {
    try {
      return await this.request<any>("/users/me")
    } catch (err) {
      // return null on 401/timeout/etc to allow UI to handle redirects
      return null
    }
  }

  // Admin status & logs
  async getAdminStatus() {
    return this.request<any>(`/admin/status`)
  }

  // Audit Logs
  async getAuditLogs(limit = 100, offset = 0) {
    return this.request<any[]>(`/audit?limit=${limit}&offset=${offset}`)
  }

  async logAction(action: string, entityType?: string, entityId?: string, details?: string) {
    // Fire and forget - don't block UI
    this.request(`/audit`, {
      method: 'POST',
      body: JSON.stringify({ action, entityType, entityId, details })
    }).catch(err => console.warn('Failed to log action', err))
  }

  async clearAdminLogs() {
    return this.request<any>(`/admin/status/clear`, { method: 'POST' })
  }

  async fixSequences() {
    return this.request<any>(`/admin/fix-sequences`, { method: 'POST' })
  }

  // Version endpoint (used by AppVersionWatcher to detect deployments)
  async getAppVersion() {
    return this.request<any>(`/version`)
  }

}

export const apiClient = new ApiClient()
