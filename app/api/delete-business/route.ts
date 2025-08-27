import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('id');

    console.log('Attempting to delete business with ID:', businessId);

    if (!businessId) {
      console.error('No business ID provided');
      return NextResponse.json(
        { error: 'ID de negocio no proporcionado' },
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

    // Verify the authenticated user is trying to delete their own business
    if (effectiveUserId !== businessId) {
      return NextResponse.json(
        { error: 'No autorizado para eliminar este negocio' },
        { status: 403 }
      );
    }

    // First get the business data using id (UUID)
    console.log('Fetching business data for ID:', businessId);
    const { data: businessData, error: businessError } = await supabase
      .from('admins')
      .select('id, user_id, name')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json(
        { error: `Error al buscar el negocio: ${businessError.message}` },
        { status: 400 }
      );
    }

    if (!businessData) {
      console.error('Business not found');
      return NextResponse.json(
        { error: 'No se encontró el negocio' },
        { status: 404 }
      );
    }


    // Limpieza de datos relacionados (usa user_id, no id UUID)
    const userId = businessData.user_id;

    // 1. Borrar ventas y items
    await supabase.from('sales_items').delete().in(
      'sale_id',
      (await supabase.from('sales').select('id').eq('user_id', userId)).data?.map(s => s.id) || []
    );
    await supabase.from('sales').delete().eq('user_id', userId);

    // 2. Stock
    await supabase.from('stock').delete().eq('user_id', userId);

    // 3. Variantes y opciones
    await supabase.from('optionVariants').delete().in(
      'variant_id',
      (await supabase.from('productVariants').select('variant_id').eq('user_id', userId)).data?.map(v => v.variant_id) || []
    );
    await supabase.from('productVariants').delete().eq('user_id', userId);

    // 4. Características y opciones
    await supabase.from('characteristics_options').delete().in(
      'characteristics_id',
      (await supabase.from('product_characteristics').select('characteristics_id').eq('product_id', (await supabase.from('products').select('id').eq('user_id', userId)).data?.map(p => p.id) || [])).data?.map(c => c.characteristics_id) || []
    );
    await supabase.from('product_characteristics').delete().in(
      'product_id',
      (await supabase.from('products').select('id').eq('user_id', userId)).data?.map(p => p.id) || []
    );

    // 5. Productos
    await supabase.from('products').delete().eq('user_id', userId);

    // 6. Empleados
    await supabase.from('employees').delete().eq('user_id', userId);

    // 7. Clientes y pagos
    await supabase.from('client_payments').delete().eq('user_id', userId);
    await supabase.from('clients').delete().eq('user_id', userId);

    // 8. Ubicaciones
    await supabase.from('locations').delete().eq('user_id', userId);

    // First try to delete the auth user
    if (businessData.id) {
      try {
        console.log('Attempting to delete auth user:', businessData.id);
        const { error: authError } = await supabase.auth.admin.deleteUser(
          businessData.id
        );

        if (authError) {
          console.error('Error deleting auth user:', authError);
          return NextResponse.json(
            { error: `Error al eliminar el usuario de autenticación: ${authError.message}` },
            { status: 400 }
          );
        }
        console.log('Auth user deleted successfully');
      } catch (authError: unknown) {
        const errorMessage = authError instanceof Error ? authError.message : 'Error desconocido';
        console.error('Error during auth user deletion:', authError);
        return NextResponse.json(
          { error: `Error al eliminar el usuario de autenticación: ${errorMessage}` },
          { status: 400 }
        );
      }
    }

    // Then delete the business record
    console.log('Attempting to delete business record');
    const { error: deleteError } = await supabase
      .from('admins')
      .delete()
      .eq('id', businessId);

    if (deleteError) {
      console.error('Error deleting business record:', deleteError);
      return NextResponse.json(
        { error: `Error al eliminar el registro del negocio: ${deleteError.message}` },
        { status: 400 }
      );
    }

    console.log('Business record deleted successfully');

    return NextResponse.json({ 
      message: 'Negocio eliminado exitosamente',
      deletedBusiness: {
        id: businessId,
        name: businessData.name
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Unexpected error in delete-business:', error);
    return NextResponse.json({ 
      error: errorMessage,
      details: errorStack
    }, { status: 500 });
  }
} 