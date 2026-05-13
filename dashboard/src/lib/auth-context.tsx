import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import {  login as apiLogin, register as apiRegister, clearTokens, logoutApi, setTokens } from "./api"
import type {User} from "./api";

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("accessToken")
    if (token) {
      // We don't store user details separately; just mark as authenticated
      // The API will validate the token on first request
      setUser({ id: "", email: "", role: "" })
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const data = await apiRegister(email, password)
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    logoutApi().catch(() => {})
    clearTokens()
    setUser(null)
    window.location.href = "/login"
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
