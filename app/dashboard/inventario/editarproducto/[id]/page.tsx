'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { ArrowLeft, Plus, X, Save } from 'lucide-react';
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

const EditarProductoPage = ({ params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCharacteristic, setNewCharacteristic] = useState('');
  const [newVariant, setNewVariant] = useState({
    options: [] as { characteristic_id: number; value: string }[]
  });

  const loadProduct = async () => {
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
        .eq('id', resolvedParams.id)
        .eq('user_id', userId)
        .single();

      if (supaErr) throw supaErr;
      if (!data) throw new Error('Producto no encontrado');

      const formattedProduct: Product = {
        id: data.id,
        name: data.name,
        characteristics: data.product_characteristics.map((pc: ProductCharacteristic) => ({
          characteristics_id: pc.characteristics_id,
          name: pc.name
        })),
        variants: data.productVariants.map((variant: ProductVariant) => ({
          variant_id: variant.variant_id,
          options: variant.optionVariants.map((opt: OptionVariant) => ({
            characteristics_id: opt.characteristics_options.characteristics_id,
            value: opt.characteristics_options.values
          }))
        }))
      };

      setProduct(formattedProduct);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [resolvedParams.id]);

  const handleSave = async () => {
    if (!product) return;
    
    setSaving(true);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      // Update product name
      const { error: productError } = await supabase
        .from('products')
        .update({ name: product.name })
        .eq('id', product.id)
        .eq('user_id', userId);

      if (productError) throw productError;

      // Update characteristics
      for (const char of product.characteristics) {
        const { error: charError } = await supabase
          .from('product_characteristics')
          .update({ name: char.name })
          .eq('characteristics_id', char.characteristics_id)
          .eq('product_id', product.id);

        if (charError) throw charError;
      }

      router.push('/dashboard/inventario/editarproductos');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCharacteristic = async () => {
    if (!product || !newCharacteristic.trim()) return;

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('product_characteristics')
        .insert({
          product_id: product.id,
          name: newCharacteristic.trim()
        })
        .select()
        .single();

      if (error) throw error;

      setProduct({
        ...product,
        characteristics: [
          ...product.characteristics,
          {
            characteristics_id: data.characteristics_id,
            name: data.name
          }
        ]
      });
      setNewCharacteristic('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    }
  };

  const handleRemoveCharacteristic = async (characteristics_id: number) => {
    if (!product) return;

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      // Verify the characteristic belongs to a product owned by the user
      const { data: characteristic, error: verifyError } = await supabase
        .from('product_characteristics')
        .select('characteristics_id, product_id')
        .eq('characteristics_id', characteristics_id)
        .eq('product_id', product.id)
        .single();

      if (verifyError || !characteristic) {
        throw new Error('Característica no encontrada');
      }

      // Verify the product belongs to the user
      const { data: productOwner, error: ownerError } = await supabase
        .from('products')
        .select('id')
        .eq('id', product.id)
        .eq('user_id', userId)
        .single();

      if (ownerError || !productOwner) {
        throw new Error('No autorizado para modificar este producto');
      }

      const { error } = await supabase
        .from('product_characteristics')
        .delete()
        .eq('characteristics_id', characteristics_id)
        .eq('product_id', product.id);

      if (error) throw error;

      setProduct({
        ...product,
        characteristics: product.characteristics.filter(c => c.characteristics_id !== characteristics_id)
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    }
  };

  const handleAddVariant = async () => {
    if (!product) return;

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      // Insert variant
      const { data: variantData, error: variantError } = await supabase
        .from('productVariants')
        .insert({
          product_id: product.id,
          user_id: userId
        })
        .select()
        .single();

      if (variantError) throw variantError;

      // Insert options for the variant
      for (const option of newVariant.options) {
        // First, get or create the characteristics_option
        const { data: optionData, error: optionError } = await supabase
          .from('characteristics_options')
          .insert({
            characteristics_id: option.characteristic_id,
            values: option.value
          })
          .select()
          .single();

        if (optionError) throw optionError;

        // Then link the option to the variant
        const { error: linkError } = await supabase
          .from('optionVariants')
          .insert({
            variant_id: variantData.variant_id,
            option_id: optionData.id
          });

        if (linkError) throw linkError;
      }

      // Refresh the product data
      await loadProduct();
      setNewVariant({ options: [] });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      console.error(err);
      setError(errorMessage);
    }
  };

  const handleRemoveVariant = async (variant_id: number) => {
    if (!product) return;

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado');

      // Verify the variant belongs to a product owned by the user
      const { data: variant, error: verifyError } = await supabase
        .from('productVariants')
        .select('variant_id, product_id')
        .eq('variant_id', variant_id)
        .eq('product_id', product.id)
        .single();

      if (verifyError || !variant) {
        throw new Error('Variante no encontrada');
      }

      // Verify the product belongs to the user
      const { data: productOwner, error: ownerError } = await supabase
        .from('products')
        .select('id')
        .eq('id', product.id)
        .eq('user_id', userId)
        .single();

      if (ownerError || !productOwner) {
        throw new Error('No autorizado para modificar este producto');
      }

      const { error } = await supabase
        .from('productVariants')
        .delete()
        .eq('variant_id', variant_id)
        .eq('product_id', product.id);

      if (error) throw error;

      setProduct({
        ...product,
        variants: product.variants.filter(v => v.variant_id !== variant_id)
      });
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

  if (!product) {
    return (
      <main className="flex-1 flex items-center justify-center h-screen bg-[#f5f5f5]">
        <div className="text-gray-500">Producto no encontrado</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/inventario/editarproductos"
          className="px-3 py-2 flex items-center gap-2 rounded-sm border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Editar Producto</h1>
      </div>

      <div className="space-y-6">
        {/* Product Name */}
        <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Nombre del Producto</h2>
          <input
            type="text"
            value={product.name}
            onChange={(e) => setProduct({ ...product, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre del producto"
          />
        </div>

        {/* Characteristics */}
        <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Características</h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                value={newCharacteristic}
                onChange={(e) => setNewCharacteristic(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nueva característica"
              />
              <button
                onClick={handleAddCharacteristic}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Agregar
              </button>
            </div>
            <div className="space-y-2">
              {product.characteristics.map((char) => (
                <div key={char.characteristics_id} className="flex items-center gap-4">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => {
                      setProduct({
                        ...product,
                        characteristics: product.characteristics.map(c =>
                          c.characteristics_id === char.characteristics_id
                            ? { ...c, name: e.target.value }
                            : c
                        )
                      });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => handleRemoveCharacteristic(char.characteristics_id)}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Variantes</h2>
          <div className="space-y-4">
            <div className="space-y-4">
              {product.characteristics.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {product.characteristics.map((char) => (
                    <div key={char.characteristics_id} className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        {char.name}
                      </label>
                      <input
                        type="text"
                        value={newVariant.options.find(o => o.characteristic_id === char.characteristics_id)?.value || ''}
                        onChange={(e) => {
                          const options = [...newVariant.options];
                          const index = options.findIndex(o => o.characteristic_id === char.characteristics_id);
                          if (index >= 0) {
                            options[index] = { ...options[index], value: e.target.value };
                          } else {
                            options.push({ characteristic_id: char.characteristics_id, value: e.target.value });
                          }
                          setNewVariant({ ...newVariant, options });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={`Valor para ${char.name}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleAddVariant}
                  disabled={newVariant.options.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Variante
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {product.variants.map((variant) => (
                <div key={variant.variant_id} className="flex items-center gap-4 p-4 border border-gray-200 rounded-md">
                  <div className="flex-1">
                    <div className="text-sm text-gray-500">
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
                  </div>
                  <button
                    onClick={() => handleRemoveVariant(variant.variant_id)}
                    className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </main>
  );
};

export default EditarProductoPage; 