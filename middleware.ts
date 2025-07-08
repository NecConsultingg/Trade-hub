import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Get the current path
  const path = request.nextUrl.pathname

  // Skip middleware for static files and images
  if (
    path.startsWith('/_next/') ||
    path === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif)$/.test(path)
  ) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

    const supabase = createServerClient(
      'https://dijctnuytoiqorvkcjmq.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

  // Define public paths that don't require authentication
  const publicPaths = ['/']
  const isPublicPath = publicPaths.includes(path)

  // If user is not signed in and trying to access a protected route
if (!user && !isPublicPath) {
  return NextResponse.redirect(new URL('/', request.url));
}


  // If user is signed in, handle role-based routing
if (user) {
  const { data: userRole } = await supabase.rpc('get_user_role', {
    auth_user_id: user.id,
  });

    // Handle initial login redirect
    if (path === '/') {
      if (userRole === 'employee') {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('role')
          .eq('auth_id', user.id)
          .single()

        if (employeeData?.role === 'inventario') {
          return NextResponse.redirect(new URL('/dashboard/inventario', request.url))
        } else if (employeeData?.role === 'ventas') {
          return NextResponse.redirect(new URL('/dashboard/ventas', request.url))
        }
      } else if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/dashboard/menu', request.url))
      } else if (userRole === 'superadmin') {
        return NextResponse.redirect(new URL('/dashboard-superadmin', request.url))
      }
    }

    // Handle protected route access
    if (path.startsWith('/dashboard/')) {
      if (userRole === 'employee') {
        const { data: employeeData } = await supabase
          .from('employees')
          .select('role')
          .eq('auth_id', user.id)
          .single()

        const isInventoryEmployee = employeeData?.role === 'inventario'
        const isSalesEmployee = employeeData?.role === 'ventas'
        const isInventoryPath = path.startsWith('/dashboard/inventario')
        const isSalesPath = path.startsWith('/dashboard/ventas')

        // Redirect if trying to access unauthorized path
        if (isInventoryEmployee && !isInventoryPath) {
          return NextResponse.redirect(new URL('/dashboard/inventario', request.url))
        }
        if (isSalesEmployee && !isSalesPath) {
          return NextResponse.redirect(new URL('/dashboard/ventas', request.url))
        }
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths
    '/:path*',
  ],
} 