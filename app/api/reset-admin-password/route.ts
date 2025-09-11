import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { adminId, newPassword } = await request.json();
    
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

    // Verify the authenticated user is a superadmin (only superadmins can reset admin passwords)
    const { data: userRole, error: roleError } = await supabase.rpc('get_user_role', {
      auth_user_id: user.id
    });
    
    if (roleError || !userRole || userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'No autorizado para resetear contraseñas de administradores' },
        { status: 403 }
      );
    }

    // Create admin client for password reset (verified user is superadmin)
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
      adminId,
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