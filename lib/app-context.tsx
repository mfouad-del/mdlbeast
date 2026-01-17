"use client"
import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User, Correspondence } from '../types'
import { apiClient } from './api-client'
import { DocType } from '../types'

interface AppState {
  currentUser: User | null
  setCurrentUser: (u: User | null) => void
  docs: Correspondence[]
  setDocs: (d: Correspondence[]) => void
  users: User[]
  setUsers: (u: User[]) => void
}

const AppContext = createContext<AppState | undefined>(undefined)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [docs, setDocs] = useState<Correspondence[]>([])
  const [users, setUsers] = useState<User[]>([])

  return (
    <AppContext.Provider value={{ currentUser, setCurrentUser, docs, setDocs, users, setUsers }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppState must be used within AppProvider')
  return context
}
