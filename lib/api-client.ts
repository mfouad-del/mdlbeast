const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://zaco-backend.onrender.com/api"

interface ApiResponse<T> {
  data?: T
  error?: string
}

class ApiClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== "undefined") {
      this.token = localStorage.getItem("auth_token")
    }
  }

  setToken(token: string) {
    this.token = token
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token)
    }
  }

  clearToken() {
    this.token = null
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token")
    }
  }

  private sessionExpiredListeners: Array<() => void> = []

  onSessionExpired(cb: () => void) {
    this.sessionExpiredListeners.push(cb)
  }

  private emitSessionExpired() {
    for (const cb of this.sessionExpiredListeners) cb()
  }

  private async refresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      if (!res.ok) return false
      const body = await res.json().catch(() => null)
      if (!body || !body.token) return false
      this.setToken(body.token)
      return true
    } catch (e) {
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

      // If token expired, attempt a single refresh and retry
      const isTokenExpired = errorObj && (errorObj.error === 'token_expired' || String(errorObj?.message || '').toLowerCase().includes('token_expired'))
      if (isTokenExpired && !(options as any)._retry) {
        const refreshed = await this.refresh()
        if (refreshed) {
          ;(options as any)._retry = true
          // retry original request with new token
          if (this.token) (headers as any)["Authorization"] = `Bearer ${this.token}`
          try {
            const retryRes = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers })
            if (!retryRes.ok) {
              let errBody = null
              try { errBody = await retryRes.json() } catch (e) { errBody = await retryRes.text().catch(() => null) }
              throw new Error(errBody?.error || errBody?.message || String(errBody))
            }
            return retryRes.json()
          } catch (e) {
            this.clearToken()
            this.emitSessionExpired()
            throw e
          }
        }

        // refresh failed
        this.clearToken()
        this.emitSessionExpired()
        throw new Error('Session expired')
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
    // send credentials include so server can set HttpOnly refresh cookie
    const res = await fetch(`${API_BASE_URL}/auth/login`, { method: 'POST', body: JSON.stringify({ username, password }), headers: { 'Content-Type': 'application/json' }, credentials: 'include' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.error || body?.message || 'Login failed')
    }
    const data = await res.json()
    if (data?.token) this.setToken(data.token)
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
      let res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(barcode)}/stamp`, { method: 'POST', body: JSON.stringify(payload), headers, signal: controller.signal })
      if (!res.ok) {
        let body: any = null
        try { body = await res.json() } catch (e) { body = await res.text().catch(() => null) }
        // handle token expiry: attempt refresh once
        if (res.status === 401 && body?.error === 'token_expired') {
          const refreshed = await this.refresh()
          if (refreshed) {
            if (this.token) headers['Authorization'] = `Bearer ${this.token}`
            res = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(barcode)}/stamp`, { method: 'POST', body: JSON.stringify(payload), headers, signal: controller.signal })
          } else {
            this.clearToken()
            this.emitSessionExpired()
            throw new Error('Session expired')
          }
        }

        if (!res.ok) {
          let body2: any = null
          try { body2 = await res.json() } catch (e) { body2 = await res.text().catch(() => null) }
          let msg = 'Stamp failed'
          if (body2) msg = body2?.error || body2?.message || String(body2)
          throw new Error(msg)
        }
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
        let res = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form, headers, signal: controller.signal })
        let body = await res.json().catch(() => null)
        if (!res.ok) {
          // handle token expiry — try refresh once
          if (res.status === 401 && body?.error === 'token_expired') {
            const refreshed = await this.refresh()
            if (refreshed) {
              if (this.token) headers['Authorization'] = `Bearer ${this.token}`
              res = await fetch(`${API_BASE_URL}/uploads`, { method: 'POST', body: form, headers, signal: controller.signal })
              body = await res.json().catch(() => null)
            } else {
              this.clearToken()
              this.emitSessionExpired()
              throw new Error('Session expired')
            }
          }

          if (!res.ok) {
            let msg = 'Upload failed'
            if (body) {
              if (Array.isArray(body.errors)) msg = body.errors.map((e: any) => e.msg || e.message || JSON.stringify(e)).join('; ')
              else if (body.error || body.message) msg = body.error || body.message
              else msg = JSON.stringify(body)
            }
            throw new Error(msg)
          }
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
}

export const apiClient = new ApiClient()
