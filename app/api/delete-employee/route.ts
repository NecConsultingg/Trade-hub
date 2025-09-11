import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('id');

    console.log('Attempting to delete employee with ID:', employeeId);

    if (!employeeId) {
      console.error('No employee ID provided');
      return NextResponse.json(
        { error: 'ID de empleado no proporcionado' },
        { status: 400 }
      );
    }

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

    // First get the employee data and verify it belongs to the authenticated user
    console.log('Fetching employee data for ID:', employeeId);
    const { data: employeeData, error: employeeError } = await supabase
      .from('employees')
      .select('auth_id, name, email, user_id')
      .eq('id', employeeId)
      .eq('user_id', userId) // ✅ ADDED: Verify employee belongs to authenticated user
      .single();

    if (employeeError) {
      console.error('Error fetching employee:', employeeError);
      return NextResponse.json(
        { error: `Error al buscar el empleado: ${employeeError.message}` },
        { status: 400 }
      );
    }

    if (!employeeData) {
      console.error('Employee not found');
      return NextResponse.json(
        { error: 'No se encontró el empleado' },
        { status: 404 }
      );
    }

    // First try to delete the employee record
    console.log('Attempting to delete employee record first');
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)
      .eq('user_id', userId); // ✅ ADDED: Double security - filter by user_id

    if (deleteError) {
      console.error('Error deleting employee record:', deleteError);
      return NextResponse.json(
        { error: `Error al eliminar el registro del empleado: ${deleteError.message}` },
        { status: 400 }
      );
    }

    console.log('Employee record deleted successfully');

    // If we have an auth_id, try to delete the auth user
    if (employeeData.auth_id) {
      try {
        console.log('Attempting to delete auth user:', employeeData.auth_id);
        const { error: authError } = await supabase.auth.admin.deleteUser(
          employeeData.auth_id
        );

        if (authError) {
          console.warn('Warning: Could not delete auth user:', authError.message);
          // We don't return an error here because the employee record was already deleted
          // Just log the warning and continue
        } else {
          console.log('Auth user deleted successfully');
        }
      } catch (authError: unknown) {
        const errorMessage = authError instanceof Error ? authError.message : 'Error desconocido';
        console.warn('Warning: Error during auth user deletion:', errorMessage);
        // Continue with the success response since the employee record was deleted
      }
    } else {
      console.log('No auth_id found, skipping auth user deletion');
    }

    return NextResponse.json({ 
      message: 'Empleado eliminado exitosamente',
      deletedEmployee: {
        id: employeeId,
        name: employeeData.name,
        email: employeeData.email
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Unexpected error in delete-employee:', error);
    return NextResponse.json({ 
      error: errorMessage,
      details: errorStack
    }, { status: 500 });
  }
} 