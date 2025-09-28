'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useRouter, useParams } from 'next/navigation'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Pencil } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InventoryItem {
  id: number;
  variant_id: number;
  productName: string;
  quantity: number;
  entryDate: string;
  ubicacion_nombre: string;
  caracteristicas: { name: string; value: string }[];
  unitPrice?: number;
  imageUrl?: string | null;
  attributes?: any[];
  price?: number; 
  location_id?: number; 
}

type SupabaseStockItem = {
  id: number;
  variant_id: number;
  stock: number;
  added_at: string;
  price: number;
  location: number;
  locations: { name: string; id: number } | null;
  productVariants: {
    product_id: number;
    products: {
      name: string;
      product_characteristics: {
        name: string;
        characteristics_id: number;
      }[];
    } | null;
    optionVariants: {
      option_id: number;
      characteristics_options: {
        values: string;
        characteristics_id: number;
      } | null;
    }[];
  } | null;
  user_id: string;
};

interface ProductDetailViewProps {
}

interface ProductOverview {
  product_id: number;
  product_name: string;
  total_variants: number;
  total_stock: number;
  locations_count: number;
  last_entry_at: string | null;
  min_price: number | null;
  max_price: number | null;
  characteristics: string[];
}

type VariantRow = { title: string; stock: number };

const ProductDetailView: React.FC<ProductDetailViewProps> = () => {
  const params = useParams();
  const router = useRouter();
  const { id: productId } = useParams<{ id: string }>();
  //const productIdFromParams = params?.productId || params?.id;
  //const productId = Array.isArray(productIdFromParams) ? productIdFromParams[0] : productIdFromParams;
  const [overview, setOverview] = useState<ProductOverview | null>(null);
  const [variantTable, setVariantTable] = useState<VariantRow[]>([]);

  const { toast } = useToast();
  const [product, setProduct] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // States for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuantity, setEditedQuantity] = useState<number | string>('');
  const [editedPrice, setEditedPrice] = useState<number | string>('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

 useEffect(() => {
  const load = async () => {
    if (!productId) return;

    const pid = Number(productId);
    try {
      // 1) Overview
      const { data: ovw, error: e1 } = await supabase
        .rpc('get_product_overview', { product_id_param: pid });

      if (e1) throw e1;
      if (!ovw || ovw.length === 0) {
        setError('Producto no encontrado.');
        setOverview(null);
        return;
      }
      setOverview(ovw[0]);

      // 2) Variantes + stock agregado (tu RPC previo ya corregido)
      const { data: variants, error: e2 } = await supabase
        .rpc('get_product_variants_with_stock', { product_id_param: pid });

      if (e2) throw e2;

      const rows: VariantRow[] = (variants ?? []).map((v: any) => ({
        title: v.variant_title || 'Sin título',
        stock: v.total_stock || 0
      }));
      setVariantTable(rows);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error cargando producto');
    } finally {
      setLoading(false);
    }
  };

  setLoading(true);
  setError(null);
  load();
}, [productId]);

  // Function to handle entering edit mode
  const handleEditClick = () => {
    setIsEditing(true);
    setUpdateError(null);
  };

  // Function to handle canceling edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    if (product) {
      setEditedQuantity(product.quantity);
      setEditedPrice(product.price || 0);
    }
    setUpdateError(null);
  };

  // Function to handle saving edited data
  const handleSaveEdit = async () => {
    if (!product) return;
    
    setUpdateLoading(true);
    setUpdateError(null);
    
    const quantityNum = parseInt(editedQuantity.toString(), 10);
    const priceNum = parseFloat(editedPrice.toString());
    
    if (isNaN(quantityNum) || quantityNum < 0) {
      setUpdateError('La cantidad debe ser un número mayor o igual a 0.');
      setUpdateLoading(false);
      return;
    }
    
    if (isNaN(priceNum) || priceNum <= 0) {
      setUpdateError('El precio debe ser un número mayor a 0.');
      setUpdateLoading(false);
      return;
    }
    
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado.');
      
      const { error: updateError } = await supabase
        .from('stock')
        .update({
          stock: quantityNum,
          price: priceNum,
        })
        .eq('id', product.id)
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
      
      // Update local state
      setProduct({
        ...product,
        quantity: quantityNum,
        price: priceNum
      });
      
      setIsEditing(false);
      toast({
        variant: "success",
        title: "¡Éxito!",
        description: "Producto actualizado correctamente",
      });
    } catch (err: any) {
      console.error('Error al actualizar el producto:', err);
      setUpdateError(`Error al actualizar: ${err.message}`);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al actualizar el producto. Por favor, intenta de nuevo.",
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // Function to handle deleting product
  const handleDelete = async () => {
    if (!product) return;
    
    console.log('=== Frontend Delete Process Start ===');
    console.log('Attempting to delete product:', product.id);
    
    setUpdateLoading(true);
    setUpdateError(null);
    
    try {
      const response = await fetch(`/api/delete-product?id=${product.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      console.log('Delete API Response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar el producto');
      }

      console.log('Product deleted successfully, closing view and redirecting...');
      
      toast({
        title: "¡Éxito!",
        description: "Producto eliminado correctamente",
      });
      // Close the detail view and redirect to products list
      router.push('/dashboard/inventario');
      router.refresh(); // Force a refresh of the page data
      //router.refresh(); // Force a refresh of the page data
    } catch (err: any) {
      console.error('Error in frontend delete handler:', err);
      const errorMessage = err.message || 'Error desconocido al eliminar el producto';
      setUpdateError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage || "Error desconocido al eliminar el producto. Por favor, intenta de nuevo.",
      });
    } finally {
      console.log('=== Frontend Delete Process Complete ===');
      setUpdateLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#1366D9]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">{error}</div>
    );
  }

  // if (!product) {
  //   return <div>No se encontraron detalles del producto.</div>;
  // }

  return (
    <div className="h-full">
      <Card className="w-full overflow-hidden">
        <CardContent>
          {overview && (
            <Card className="w-full overflow-hidden">
              <CardContent>
                <div className="border-b border-slate-200 pb-2 flex items-center justify-between mt-3">
                  <h1 className="text-lg font-semibold capitalize">Producto</h1>
                  <p className="text-md font-light">ID #{overview.product_id}</p>
                </div>

                <div className="mt-3 mb-3">
                  <h2 className="font-semibold">Detalles principales</h2>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p><strong>Nombre:</strong> {overview.product_name}</p>
                    <p><strong>Variantes:</strong> {overview.total_variants}</p>
                    <p><strong>Stock total:</strong> {overview.total_stock}</p>
                  </div>
                  <div>
                    <p><strong>Ubicaciones:</strong> {overview.locations_count}</p>
                    <p>
                      <strong>Último movimiento:</strong>{' '}
                      {overview.last_entry_at
                        ? new Date(overview.last_entry_at).toLocaleString()
                        : '—'}
                    </p>
                    <p>
                      <strong>Rango de precios:</strong>{' '}
                      {overview.min_price != null && overview.max_price != null
                        ? `${overview.min_price.toFixed(2)} — ${overview.max_price.toFixed(2)} MXN`
                        : '—'}
                    </p>
                  </div>
                </div>

                {overview.characteristics.length > 0 && (
                  <>
                    <div className="mb-3 mt-4">
                      <h2 className="font-semibold">Características definidas</h2>
                    </div>
                    <ul className="list-disc ml-6">
                      {overview.characteristics.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          {variantTable.length > 0 && (
            // Tabla de variantes del producto
            <div className="mt-6">
              <h2 className="text-lg font-semibold mb-2">Variantes del producto</h2>
              <table className="w-full text-left border">
                <thead>
                  <tr>
                    <th className="border px-4 py-2">Combinación</th>
                    <th className="border px-4 py-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {variantTable.map((variant, index) => (
                    <tr key={index}>
                      <td className="border px-4 py-2">{variant.title}</td>
                      <td className="border px-4 py-2">{variant.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {updateError && (
            <div className="text-red-500 my-2">{updateError}</div>
          )}
          <div className="flex flex-wrap justify-center gap-3 mt-6 relative">
            <div className="lg:text-center sm:text-left w-full">
              {isEditing ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={handleCancelEdit} 
                    disabled={updateLoading}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="bg-blue-500 hover:bg-blue-600" 
                    onClick={handleSaveEdit} 
                    disabled={updateLoading}
                  >
                    {updateLoading ? 'Guardando...' : 'Guardar'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => router.back()}>
                    Cerrar
                  </Button>
                </>
              )}
            </div>

            {!isEditing && (
              <div className="absolute bottom-0 right-0 flex gap-3">
                <Button 
                  className="bg-blue-500 hover:bg-blue-600" 
                  onClick={handleEditClick}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button 
                  variant="destructive" 
                  className="bg-red-600 hover:bg-red-700 !text-white"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={updateLoading}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente este producto del inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={updateLoading}
            >
              {updateLoading ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProductDetailView;