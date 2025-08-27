import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { error: 'ID de producto no proporcionado' },
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
        { status: 401 }
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

    // Verify the stock entry belongs to the authenticated user before deleting
    const { data: stockEntry, error: verifyError } = await supabase
      .from('stock')
      .select('id, user_id')
      .eq('id', parseInt(productId, 10))
      .eq('user_id', userId)
      .single();

    if (verifyError || !stockEntry) {
      return NextResponse.json(
        { error: 'Producto no encontrado o no autorizado para eliminar' },
        { status: 404 }
      );
    }

    // Now delete the stock entry (it's verified to belong to the user)
    const { error: deleteError } = await supabase
      .from('stock')
      .delete()
      .eq('id', parseInt(productId, 10))
      .eq('user_id', userId); // Double security: filter by user_id again

    if (deleteError) {
      console.error('Error deleting stock entry:', deleteError);
      return NextResponse.json(
        { error: `Error al eliminar el producto: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Producto eliminado exitosamente',
      deletedProduct: { id: productId }
    });
  } catch (error: unknown) {
    console.error('Error in delete-product:', error);
    return NextResponse.json({ 
      error: 'Error inesperado al eliminar el producto'
    }, { status: 500 });
  }
} 