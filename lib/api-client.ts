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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    }

    if (this.token) {
      (headers as any)["Authorization"] = `Bearer ${this.token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Network error" }))
      throw new Error(error.error || "Request failed")
    }

    return response.json()
  }

  // Auth
  async login(username: string, password: string) {
    const data = await this.request<{ token: string; user: any }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    })
    this.setToken(data.token)
    return data
  }

  async register(userData: { username: string; password: string; full_name: string; role: string }) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    })
  }

  // Documents
  async getDocuments(params?: { status?: string; type?: string; search?: string }) {
    const queryParams = new URLSearchParams(params as any).toString()
    return this.request<any[]>(`/documents${queryParams ? `?${queryParams}` : ""}`)
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
    return this.request<any>("/users/me")
  }
}

export const apiClient = new ApiClient()
