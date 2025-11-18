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

interface ProductDetailViewProps {}

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

// -------- NUEVO: tipos para filtros/atributos --------
type VariantAttr = {
  characteristics_id: number;
  option_id: number;
  value: string;
};

type VariantRow = { 
  variant_id: number;
  title: string; 
  stock: number;
  attributes: VariantAttr[];
};

type FilterOption = { option_id: number; value: string };
type FilterDef = { characteristics_id: number; name: string; options: FilterOption[] };
type SelectedFilters = Record<number, Set<number>>;
// -----------------------------------------------------

const ProductDetailView: React.FC<ProductDetailViewProps> = () => {
  const router = useRouter();
  const params = useParams<{ id?: string; productId?: string }>();
  // Handle both route structures: /inventario/[id] and /sucursales/[id]/inventario/[productId]
  const productId = params.productId || params.id;

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

  // -------- NUEVO: estado de filtros --------
  const [filterDefs, setFilterDefs] = useState<FilterDef[]>([]);
  const [selected, setSelected] = useState<SelectedFilters>({});
  // -----------------------------------------

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

        // 2) Variantes + stock (+ attributes_json si existe)
        const { data: variants, error: e2 } = await supabase
          .rpc('get_product_variants_with_stock', { product_id_param: pid });

        if (e2) throw e2;

        // Mapeo base
        let rows: VariantRow[] = (variants ?? []).map((v: any) => ({
          variant_id: v.variant_id ?? 0,
          title: v.variant_title || 'Sin título',
          stock: v.total_stock || 0,
          attributes: Array.isArray(v.attributes_json) ? v.attributes_json : [] // podría venir vacío
        }));

        // Si no hay attributes_json, hacemos fallback para traer atributos
        const needsAttrFetch = rows.some(r => r.attributes.length === 0) && rows.some(r => r.variant_id);
        if (needsAttrFetch) {
          const variantIds = rows.map(r => r.variant_id).filter(Boolean);
          if (variantIds.length > 0) {
            const { data: ov, error: eOv } = await supabase
              .from('optionVariants')
              .select('variant_id, option_id, characteristics_options(id, values, characteristics_id)')
              .in('variant_id', variantIds);

            if (!eOv && Array.isArray(ov)) {
              const grouped = new Map<number, VariantAttr[]>();
              ov.forEach((row: any) => {
                const co = row.characteristics_options;
                if (!grouped.has(row.variant_id)) grouped.set(row.variant_id, []);
                if (co) {
                  grouped.get(row.variant_id)!.push({
                    characteristics_id: co.characteristics_id,
                    option_id: co.id,
                    value: co.values
                  });
                }
              });
              rows = rows.map(r => ({
                ...r,
                attributes: grouped.get(r.variant_id) ?? r.attributes
              }));
            }
          }
        }

        setVariantTable(rows);

        // 3) Definiciones de filtros (RPC si existe, si no fallback con 2 consultas)
        let defs: any[] | null = null;
        let e3: any = null;

        // intento RPC
        const rpcDefs = await supabase
          .rpc('get_product_filter_definitions', { product_id_param: pid });

        if (rpcDefs.error) {
          e3 = rpcDefs.error;
        } else {
          defs = rpcDefs.data ?? null;
        }

        if (e3 || !defs) {
          // Fallback: product_characteristics + characteristics_options
          const { data: chars, error: ec } = await supabase
            .from('product_characteristics')
            .select('characteristics_id, name')
            .eq('product_id', pid)
            .order('characteristics_id', { ascending: true });

          if (ec) throw ec;

          const charIds = (chars ?? []).map(c => c.characteristics_id);
          let options: any[] = [];
          if (charIds.length > 0) {
            const { data: opts, error: eo } = await supabase
              .from('characteristics_options')
              .select('id, characteristics_id, values')
              .in('characteristics_id', charIds)
              .order('characteristics_id', { ascending: true })
              .order('id', { ascending: true });
            if (eo) throw eo;
            options = opts ?? [];
          }

          const byChar = new Map<number, FilterDef>();
          (chars ?? []).forEach((c: any) => {
            byChar.set(c.characteristics_id, {
              characteristics_id: c.characteristics_id,
              name: c.name,
              options: []
            });
          });
          options.forEach((o: any) => {
            const bucket = byChar.get(o.characteristics_id);
            if (bucket) {
              bucket.options.push({ option_id: o.id, value: o.values });
            }
          });

          setFilterDefs(Array.from(byChar.values()));
        } else {
          // Agrupar defs del RPC
          const byChar = new Map<number, FilterDef>();
          (defs ?? []).forEach((r: any) => {
            if (!byChar.has(r.characteristics_id)) {
              byChar.set(r.characteristics_id, {
                characteristics_id: r.characteristics_id,
                name: r.characteristic_name,
                options: []
              });
            }
            byChar.get(r.characteristics_id)!.options.push({
              option_id: r.option_id,
              value: r.option_value
            });
          });
          setFilterDefs(Array.from(byChar.values()));
        }

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

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar el producto');
      }
      
      toast({
        title: "¡Éxito!",
        description: "Producto eliminado correctamente",
      });
      router.push('/dashboard/inventario');
      router.refresh();
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

  // -------- NUEVO: lógica de filtrado --------
  function matchesFilters(variant: VariantRow, selected: SelectedFilters): boolean {
    // AND entre características: cada característica con selección activa debe cumplirse
    for (const [charIdStr, optSet] of Object.entries(selected)) {
      const charId = Number(charIdStr);
      if (!optSet || optSet.size === 0) continue; // sin filtros en esa característica

      const optsForChar = variant.attributes.filter(a => a.characteristics_id === charId);
      if (optsForChar.length === 0) return false;

      // OR dentro de la característica
      const hasAny = optsForChar.some(a => optSet.has(a.option_id));
      if (!hasAny) return false;
    }
    return true;
  }

  const filteredVariants = variantTable.filter(v => matchesFilters(v, selected));
  // -------------------------------------------

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

          {/* -------- NUEVO: Filtros por atributos -------- */}
          {filterDefs.length > 0 && (
            <div className="mt-6 mb-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Filtrar por atributos</h2>
                <Button
                  variant="outline"
                  onClick={() => setSelected({})}
                >
                  Limpiar filtros
                </Button>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filterDefs.map(fd => (
                  <div key={fd.characteristics_id} className="border rounded-md p-3">
                    <div className="font-medium mb-2">{fd.name}</div>
                    <div className="flex flex-col gap-2">
                      {fd.options.map(op => {
                        const checked = !!selected[fd.characteristics_id]?.has(op.option_id);
                        return (
                          <label key={op.option_id} className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="scale-110 accent-blue-600"
                              checked={checked}
                              onChange={(e) => {
                                setSelected(prev => {
                                  const copy = { ...prev };
                                  const set = new Set<number>(copy[fd.characteristics_id] ?? []);
                                  if (e.target.checked) set.add(op.option_id);
                                  else set.delete(op.option_id);
                                  copy[fd.characteristics_id] = set;
                                  return copy;
                                });
                              }}
                            />
                            <span>{op.value}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* --------------------------------------------- */}

          {filteredVariants.length > 0 && (
            // Tabla de variantes del producto
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">Variantes del producto</h2>
                <span className="text-sm text-slate-600">
                  Mostrando {filteredVariants.length} de {variantTable.length}
                </span>
              </div>
              <table className="w-full text-left border">
                <thead>
                  <tr>
                    <th className="border px-4 py-2">Combinación</th>
                    <th className="border px-4 py-2">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVariants.map((variant) => (
                    <tr key={variant.variant_id}>
                      <td className="border px-4 py-2">{variant.title}</td>
                      <td className="border px-4 py-2">{variant.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredVariants.length === 0 && (
            <div className="mt-6 text-sm text-slate-500">
              No hay variantes que coincidan con los filtros seleccionados.
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
