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

const ProductDetailView: React.FC<ProductDetailViewProps> = () => {
  const params = useParams();
  const router = useRouter();
  const { id: productId } = useParams<{ id: string }>();
  //const productIdFromParams = params?.productId || params?.id;
  //const productId = Array.isArray(productIdFromParams) ? productIdFromParams[0] : productIdFromParams;
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
    const loadProductDetails = async () => {
      if (!productId) {
        setError('ID de producto no proporcionado.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const userId = await getUserId();
        if (!userId) throw new Error('Usuario no autenticado.');

        const { data, error: supaErr } = await supabase
          .from('stock')
          .select(`
            id,
            variant_id,
            stock,
            price,
            added_at,
            location,
            locations ( name, id ),
            productVariants (
              products (
                name,
                product_characteristics ( name, characteristics_id )
              ),
              optionVariants (
                characteristics_options ( values, characteristics_id )
              )
            )
          `)
          .eq('user_id', userId)
          .eq('id', productId)
          .single()
          .returns<SupabaseStockItem>();
          console.log("Iddddd", productId)

        if (supaErr) throw supaErr;

        if (data) {
          const prod = data.productVariants?.products;
          const opts = data.productVariants?.optionVariants ?? [];
          const loc = data.locations?.name ?? '—';

          const chars = opts.map(o => {
            const co = o.characteristics_options;
            const pc = prod?.product_characteristics.find(
              pc => pc.characteristics_id === co?.characteristics_id
            );
            return {
              name: pc?.name ?? 'Cualquiera',
              value: co?.values ?? ''
            };
          });          
          
          const productData = {
            id: data.id,
            variant_id: data.variant_id,
            productName: prod?.name ?? '—',
            quantity: data.stock,
            entryDate: new Date(data.added_at).toLocaleDateString(),
            ubicacion_nombre: loc,
            caracteristicas: chars,
            price: data.price, 
            location_id: data.location 
          };

          setProduct(productData);
          setEditedQuantity(data.stock);
          setEditedPrice(data.price || 0);
        } else {
          setError('Producto no encontrado.');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadProductDetails();
  }, [productId, router ]);

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

  if (!product) {
    return <div>No se encontraron detalles del producto.</div>;
  }

  return (
    <div className="h-full">
      <Card className="w-full overflow-hidden">
        <CardContent>
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between mt-3">
            <h1 className="text-lg font-semibold capitalize">Producto</h1>
            <p className="text-md font-light flex items-center gap-2">
              ID #{product.id}
            </p>
          </div>
          <div className="mt-3 mb-3">
            <h2 className="font-semibold">Detalles principales</h2>
          </div>
          <div className="mb-3 mt-3">
            <p><strong>Nombre:</strong> {product.productName}</p>
            
            {isEditing ? (
              <>
                <div className="my-2">
                  <Label htmlFor="quantity">Cantidad</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={editedQuantity}
                    onChange={(e) => setEditedQuantity(e.target.value)}
                    className="mt-1"
                    min="0"
                  />
                </div>
                <div className="my-2">
                  <Label htmlFor="price">Precio (MXN)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={editedPrice}
                    onChange={(e) => setEditedPrice(e.target.value)}
                    className="mt-1"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </>
            ) : (
              <>
                <p><strong>Cantidad: </strong> {product.quantity}</p>
                <p><strong>Precio: </strong> {product.price?.toFixed(2)} MXN</p>
              </>
            )}
            
            <p><strong>Ubicación:</strong> {product.ubicacion_nombre}</p>
            <p><strong>Fecha de Entrada:</strong> {product.entryDate}</p>
          </div>
          {product.caracteristicas.length > 0 && (
            <div>
              <div className="mb-3 mt-3">
                <h2 className="font-semibold">Características</h2>
              </div>
              <ul>
                {product.caracteristicas.map((char, index) => (
                  <li key={index}>
                    <p>
                      <strong>{char.name}:</strong> {char.value}
                    </p>
                  </li>
                ))}
              </ul>
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