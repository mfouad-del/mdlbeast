const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://zaco-backend.onrender.com/api"

interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private token: string | null = null
  private refreshToken: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
      this.refreshToken = localStorage.getItem("refresh_token")
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

    // If 401, try to refresh token once and retry
    if (response.status === 401) {
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
        // Refresh failed; clear token and notify listeners
        this.clearToken()
        try {
          this.emitSessionExpired()
        } catch (e) {}
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

  async getPreviewUrl(barcode: string) {
    const res = await this.request<any>(`/documents/${encodeURIComponent(barcode)}/preview-url`)
    return res?.previewUrl || null
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

  async updateUser(id: number | string, payload: { full_name?: string; role?: string; password?: string }) {
    return this.request<any>(`/users/${id}`, {
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

  async clearAdminLogs() {
    return this.request<any>(`/admin/status/clear`, { method: 'POST' })
  }


}

export const apiClient = new ApiClient()
