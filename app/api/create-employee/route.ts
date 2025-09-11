import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email, password, role } = await request.json();
    
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

    // Verify the authenticated user is an admin (can create employees)
    const { data: userRole, error: roleError } = await supabase.rpc('get_user_role', {
      auth_user_id: user.id
    });
    
    if (roleError || !userRole || (userRole !== 'admin' && userRole !== 'superadmin')) {
      return NextResponse.json(
        { error: 'No autorizado para crear empleados' },
        { status: 403 }
      );
    }

    // Create the user using admin API (this requires service role key, but we've verified the user is authorized)
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

    const { data: authData, error: createUserError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        role: role
      }
    });

    if (createUserError) {
      return NextResponse.json({ error: createUserError.message }, { status: 400 });
    }

    // Create the employee record in the database
    const { error: employeeError } = await supabase
      .from('employees')
      .insert({
        auth_id: authData.user.id,
        name: email.split('@')[0], // Use email prefix as name
        email: email.toLowerCase().trim(),
        role: role,
        user_id: userId
      });

    if (employeeError) {
      // If employee creation fails, try to delete the auth user
      try {
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
      } catch (deleteError) {
        console.error('Error deleting auth user after employee creation failure:', deleteError);
      }
      return NextResponse.json({ error: employeeError.message }, { status: 400 });
    }

    return NextResponse.json({ user: authData.user });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 