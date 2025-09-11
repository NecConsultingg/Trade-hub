import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { employeeId, newPassword } = await request.json();
    
    // Create a Supabase client with user authentication
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      );
    }

    // Get the user's effective ID (admin's ID for employees)
    const { data: effectiveUserId, error: effectiveError } = await supabase.rpc('get_effective_user_id', {
      auth_user_id: user.id
    });
    if (effectiveError || !effectiveUserId) {
      return NextResponse.json(
        { error: 'Error al obtener ID de usuario efectivo' },
        { status: 500 }
      );
    }

    // Get the numeric user_id from the admins table
    const { data: profile, error: profileError } = await supabase
      .from('admins')
      .select('user_id')
      .eq('id', effectiveUserId)
      .single();
    
    if (profileError || !profile?.user_id) {
      return NextResponse.json(
        { error: 'ID de usuario no encontrado' },
        { status: 401 }
      );
    }

    const userId = profile.user_id;

    // Verify the authenticated user is an admin (can reset employee passwords)
    const { data: userRole, error: roleError } = await supabase.rpc('get_user_role', {
      auth_user_id: user.id
    });
    
    if (roleError || !userRole || (userRole !== 'admin' && userRole !== 'superadmin')) {
      return NextResponse.json(
        { error: 'No autorizado para resetear contraseñas de empleados' },
        { status: 403 }
      );
    }

    // First get the auth_id from the employee record and verify it belongs to the authenticated user
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('auth_id')
      .eq('id', employeeId)
      .eq('user_id', userId) // ✅ ADDED: Verify employee belongs to authenticated user
      .single();

    if (employeeError || !employeeData?.auth_id) {
      return NextResponse.json(
        { error: 'No se encontró el ID de autenticación del empleado' },
        { status: 400 }
      );
    }

    // Create admin client for password reset (verified user is admin/superadmin)
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Update the user's password using admin API
    const { data: authData, error: updateError } = await adminSupabase.auth.admin.updateUserById(
      employeeData.auth_id,
      { password: newPassword }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ 
      message: 'Contraseña actualizada exitosamente',
      user: authData.user 
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 