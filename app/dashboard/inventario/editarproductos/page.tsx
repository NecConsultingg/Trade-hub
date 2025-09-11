'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { Edit, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Characteristic {
  characteristics_id: number;
  name: string;
}

interface Variant {
  variant_id: number;
  options: {
    characteristics_id: number;
    value: string;
  }[];
}

interface Product {
  id: number;
  name: string;
  characteristics: Characteristic[];
  variants: Variant[];
}

interface ProductCharacteristic {
  characteristics_id: number;
  name: string;
}

interface ProductVariant {
  variant_id: number;
  optionVariants: {
    characteristics_options: {
      characteristics_id: number;
      values: string;
    };
  }[];
}

interface OptionVariant {
  characteristics_options: {
    characteristics_id: number;
    values: string;
  };
}

const EditarProductosPage = () => {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadProducts = async () => {
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      const { data, error: supaErr } = await supabase
        .from('products')
        .select(`
          id,
          name,
          product_characteristics (
            characteristics_id,
            name
          ),
          productVariants (
            variant_id,
            optionVariants (
              characteristics_options (
                characteristics_id,
                values
              )
            )
          )
        `)
        .eq('user_id', userId);

      if (supaErr) throw supaErr;

      const formattedProducts: Product[] = data.map(product => ({
        id: product.id,
        name: product.name,
        characteristics: product.product_characteristics.map((pc: ProductCharacteristic) => ({
          characteristics_id: pc.characteristics_id,
          name: pc.name
        })),
        variants: product.productVariants.map((variant: ProductVariant) => ({
          variant_id: variant.variant_id,
          options: variant.optionVariants.map((opt: OptionVariant) => ({
            characteristics_id: opt.characteristics_options.characteristics_id,
            value: opt.characteristics_options.values
          }))
        }))
      }));

      setProducts(formattedProducts);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (productId: number) => {
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId)
        .eq('user_id', userId);  // ✅ ADDED: User ID filter for security

      if (error) throw error;
      
      setProducts(products.filter(p => p.id !== productId));
      setDeleteConfirm(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="text-red-500">Error: {error}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/inventario"
          className="px-3 py-2 flex items-center gap-2 rounded-sm border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Editar Productos</h1>
      </div>

      <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f5f5]">
                <th className="px-6 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                  Producto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                  Características
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#667085] uppercase tracking-wider">
                  Variantes
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-[#667085] uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6e6]">
              {products.map(product => (
                <tr key={product.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#667085]">
                    {product.characteristics.map(c => c.name).join(', ')}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#667085]">
                    {product.variants.map((variant, vIndex) => (
                      <div key={variant.variant_id} className={vIndex > 0 ? 'mt-2' : ''}>
                        {variant.options.map((opt, index) => {
                          const characteristic = product.characteristics.find(
                            c => c.characteristics_id === opt.characteristics_id
                          );
                          return (
                            <span key={opt.characteristics_id}>
                              {characteristic?.name || 'Desconocido'}: {opt.value}
                              {index < variant.options.length - 1 ? ', ' : ''}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => router.push(`/dashboard/inventario/editarproducto/${product.id}`)}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-full transition-colors"
                        title="Editar producto"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {deleteConfirm === product.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="px-2 py-1 text-sm text-red-600 hover:text-red-900 hover:bg-red-50 rounded transition-colors"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(product.id)}
                          className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
};

export default EditarProductosPage; 