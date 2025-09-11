"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
// Import icons (assuming you use lucide-react, common with shadcn/ui)
import { Eye, EyeOff, Loader2 } from "lucide-react" 
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { getUserRole } from '@/lib/userId';

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  // --- 1. Add state for password visibility ---
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return; // evita múltiples envíos rápidos

    setEmailError("")
    setPasswordError("")

    let isValid = true

    if (!email) {
      setEmailError("Por favor, ingresa tu correo electrónico")
      isValid = false
    } else if (!email.includes("@") || !email.includes(".")) {
      setEmailError("El correo electrónico debe contener @ y un dominio válido")
      isValid = false
    }

    if (!password) {
      setPasswordError("Por favor, ingresa tu contraseña")
      isValid = false
    }

    if (isValid) {
      try {
        setIsLoading(true)
        await supabase.auth.signOut();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          console.error("Login error:", error)
          setPasswordError("Correo electrónico o contraseña incorrectos")

          // Delay para evitar rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000)); // espera 1 segundo

          return
        }

        if (data.user) {
          // Get user role after successful login
          const role = await getUserRole();
          
          if (role === 'superadmin') {
            router.push("/dashboard-superadmin/negocios");
          } else if (role === 'employee') {
            const { data: employeeData } = await supabase
              .from('employees')
              .select('role')
              .eq('auth_id', data.user.id)
              .single();

            if (employeeData?.role === 'inventario') {
              router.push("/dashboard/inventario");
            } else if (employeeData?.role === 'ventas') {
              router.push("/dashboard/ventas");
            }
          } else {
            // Default to admin dashboard
            router.push("/dashboard/menu");
          }
        }
      } catch (error) {
        console.error("Login error:", error)
        setPasswordError("Error al iniciar sesión. Por favor, intenta de nuevo.")
      } finally {
        setIsLoading(false)
      }
    }
  }
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="flex w-full max-w-4xl flex-col items-center justify-center gap-8 md:flex-row md:items-start md:gap-16">
        <div className="flex flex-col items-center">
          <Image 
            src="/logo.jpg" 
            alt="Logo" 
            width={400} 
            height={400}
            priority
            className="w-auto h-auto"
            style={{ maxWidth: '400px' }}
          />
        </div>
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center md:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">Bienvenido a TradeHub</h1>
            <p className="text-sm text-muted-foreground">Ingresa con tu datos personales.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <label htmlFor="email" className="text-lg font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email" 
                placeholder="Ingresa tu correo electrónico"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError("")
                }}
                className={emailError ? "border-red-500" : ""}
                required
                disabled={isLoading}
              />
              {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-lg font-medium">
                  Contraseña
                </label>
              </div>
              <div className="relative"> 
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"} 
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError) setPasswordError("")
                  }}
                  className={`${passwordError ? "border-red-500" : ""} pr-10`} 
                  required
                  disabled={isLoading}
                />

                <Button
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-gray-500 hover:text-gray-700" 
                  onClick={togglePasswordVisibility} 
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
              <div className="text-right">
                <Link href="mailto:necconsultingg@gmail.com" className="text-xs text-blue-500 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
            <div className="text-center text-sm">
              ¿No tienes una cuenta?{" "}
              <Link href="mailto:necconsultingg@gmail.com" className="text-blue-500 hover:underline">
                Contacta a un administrador.
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
