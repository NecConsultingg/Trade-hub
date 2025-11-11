"use client";

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useToast } from "@/components/ui/use-toast";

export interface Product { id: number; name: string; }
export interface Attribute { characteristics_id: number; name: string; }
export interface OptionData { id: number; value: string; }
export interface Ubicacion { id: number; name: string; }

interface AddProductToStockProps {
  initialProductId?: number;
  initialLocationId?: number;
  hideProductSelect?: boolean;
  hideLocationSelect?: boolean;
  onSaveStock: () => void;
  onClose: () => void;
}

type VariantRow = {
  id: string;
  selectedOptions: Record<number, number | null>;
  quantity: number | string;
  price: number | string;
  existingPrice: number | null;
  currentStock: number;
  variantId: number | null;
  errors?: {
    options?: string;
    quantity?: string;
    price?: string;
  };
};

const AddProductToStock: React.FC<AddProductToStockProps> = ({ initialProductId, initialLocationId, hideProductSelect = false, hideLocationSelect = false, onSaveStock, onClose }) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productError, setProductError] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<Record<number, OptionData[]>>({});
  const [rows, setRows] = useState<VariantRow[]>([]);

  const [entryDate, setEntryDate] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [selectedLocationName, setSelectedLocationName] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

  // CRITICAL: Sync props to state when they change
  useEffect(() => {
    if (initialProductId !== undefined && initialProductId !== selectedProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  useEffect(() => {
    if (initialLocationId !== undefined && initialLocationId !== selectedLocationId) {
      setSelectedLocationId(initialLocationId);
    }
  }, [initialLocationId]);

  // Row helpers
  const generateRowId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const createEmptyRow = (attrs: Attribute[]): VariantRow => {
    const baseOptions: Record<number, number | null> = {};
    for (const attribute of attrs) {
      baseOptions[attribute.characteristics_id] = null;
    }
    return {
      id: generateRowId(),
      selectedOptions: baseOptions,
      quantity: '',
      price: '',
      existingPrice: null,
      currentStock: 0,
      variantId: null,
      errors: {},
    };
  };

  const ensureAtLeastOneRow = (attrs: Attribute[]) => {
    setRows(prev => (prev.length === 0 ? [createEmptyRow(attrs)] : prev));
  };

  // Validación previa al guardar
  const validateForm = (): boolean => {
    let valid = true;

    if (!selectedProductId) {
      setProductError("Por favor, selecciona un producto.");
      valid = false;
    } else {
      setProductError("");
    }

    if (!selectedLocationId) {
      setLocationError("Por favor, selecciona una ubicación.");
      valid = false;
    } else {
      setLocationError("");
    }

    // Validate each row
    const nextRows = rows.map(row => {
      const rowErrors: VariantRow['errors'] = {};
      const selectedOptionIds = Object.values(row.selectedOptions).filter(v => v !== null) as number[];
      if (attributes.length > 0 && selectedOptionIds.length !== attributes.length) {
        rowErrors.options = 'Selecciona una opción para cada atributo.';
        valid = false;
      }
      const qty = parseInt(row.quantity.toString(), 10);
      if (isNaN(qty) || qty <= 0) {
        rowErrors.quantity = 'Cantidad inválida (mayor a 0).';
        valid = false;
      }
      if (row.existingPrice === null) {
        const pr = parseFloat(row.price.toString());
        if (isNaN(pr) || pr <= 0) {
          rowErrors.price = 'Precio inválido (mayor a 0).';
          valid = false;
        }
      }
      return { ...row, errors: rowErrors };
    });
    setRows(nextRows);

    if (!entryDate) {
      setDateError("Por favor, selecciona la fecha de entrada.");
      valid = false;
    } else {
      setDateError("");
    }

    return valid;
  };

  // Carga inicial de productos y ubicaciones
  useEffect(() => {
    async function loadInitialData() {
      setIsLoading(true);
      try {
        const userId = await getUserId();
        if (!userId) throw new Error("Usuario no autenticado.");
        
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name')
          .eq('user_id', userId);
        if (productsError) throw productsError;
        setProducts(productsData || []);

        const { data: ubicacionesData, error: ubicacionesError } = await supabase
          .from('locations')
          .select('id, name')
          .eq('user_id', userId);
        if (ubicacionesError) throw ubicacionesError;
        setUbicaciones(ubicacionesData || []);
      } catch (error: any) {
        console.error('Error cargando datos iniciales:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar los datos iniciales. Por favor, intenta de nuevo.",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Load product name when selectedProductId changes
  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setSelectedProductName(product.name);
      }
    }
  }, [selectedProductId, products]);

  // Load location name when selectedLocationId changes
  useEffect(() => {
    if (selectedLocationId && ubicaciones.length > 0) {
      const location = ubicaciones.find(u => u.id === selectedLocationId);
      if (location) {
        setSelectedLocationName(location.name);
      }
    }
  }, [selectedLocationId, ubicaciones]);

  // Carga atributos al cambiar de producto
  useEffect(() => {
    async function getAttributes(productId: number | null) {
      if (productId === null) {
        setAttributes([]);
        setAttributeOptions({});
        setRows([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("product_characteristics")
          .select("characteristics_id, name")
          .eq("product_id", productId);
        if (error) throw error;
        setAttributes(data || []);
        setAttributeOptions({});
        // Reset rows with the new attributes
        setRows([createEmptyRow(data || [])]);
      } catch (error: any) {
        console.error("Error fetching attributes:", error);
        setAttributes([]);
      } finally {
        setIsLoading(false);
      }
    }
    getAttributes(selectedProductId);
  }, [selectedProductId]);

  // Carga opciones de cada atributo
  useEffect(() => {
    async function getAttributeOptions() {
      if (attributes.length === 0) {
        setAttributeOptions({});
        ensureAtLeastOneRow([]);
        return;
      }
      setIsLoading(true);
      try {
        let optionsMap: Record<number, OptionData[]> = {};
        for (const attribute of attributes) {
          const { data, error } = await supabase
            .from("characteristics_options")
            .select("id, values")
            .eq("characteristics_id", attribute.characteristics_id);

          if (error) {
            console.error(`Error fetching options for ${attribute.name}:`, error);
            optionsMap[attribute.characteristics_id] = [];
          } else {
            optionsMap[attribute.characteristics_id] = (data || []).map(o => ({
              id: o.id,
              value: o.values
            }));
          }
        }
        setAttributeOptions(optionsMap);
        // Rebuild rows to include new attribute keys if needed
        setRows(prev => {
          if (prev.length === 0) return [createEmptyRow(attributes)];
          return prev.map(r => {
            const nextSelected: Record<number, number | null> = {};
            for (const attr of attributes) {
              nextSelected[attr.characteristics_id] = r.selectedOptions[attr.characteristics_id] ?? null;
            }
            return { ...r, selectedOptions: nextSelected };
          });
        });
      } catch (error: any) {
        console.error("Unexpected error fetching attribute options:", error);
      } finally {
        setIsLoading(false);
      }
    }
    getAttributeOptions();
  }, [attributes]);

  const handleRowOptionChange = (rowId: string, characteristicId: number, optionIdStr: string) => {
    const optionId = optionIdStr ? parseInt(optionIdStr, 10) : null;
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const nextSelected = { ...r.selectedOptions, [characteristicId]: optionId };
      return { ...r, selectedOptions: nextSelected };
    }));
  };

  // Add new function to handle price conversion
  const convertPriceToNumber = (priceStr: string | number): number => {
    if (typeof priceStr === 'number') {
      // Ensure we're working with a clean number
      return Math.round(priceStr * 100) / 100;
    }
    // Remove any non-numeric characters except decimal point
    const cleanPrice = priceStr.replace(/[^\d.]/g, '');
    // Convert to number and ensure 2 decimal places
    const num = Number(cleanPrice);
    return Math.round(num * 100) / 100;
  };

  // Noisy price change logs removed for multi-row handling

  const handleRowPriceChange = (rowId: string, value: string) => {
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      setRows(prev => prev.map(r => r.id === rowId ? { ...r, price: value } : r));
    }
  };

  const handleRowPriceBlur = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      if (r.price === '') return r;
      const formatted = convertPriceToNumber(r.price).toString();
      return { ...r, price: formatted };
    }));
  };

  const handleRowQuantityChange = (rowId: string, value: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, quantity: value } : r));
  };

  const decrementRowQty = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const val = parseInt(r.quantity.toString() || '0', 10);
      const next = Math.max(0, val - 1);
      return { ...r, quantity: next };
    }));
  };

  const incrementRowQty = (rowId: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const val = parseInt(r.quantity.toString() || '0', 10);
      const next = val + 1;
      return { ...r, quantity: next };
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, createEmptyRow(attributes)]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== rowId));
  };

  // Calculate per-row variant and stock when options/location change
  const recalcRowVariantAndStock = async (row: VariantRow): Promise<VariantRow> => {
    try {
      if (!selectedProductId || !selectedLocationId) {
        return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
      }
      const selectedOptionIds = Object.values(row.selectedOptions).filter(id => id !== null) as number[];
      if (attributes.length > 0 && selectedOptionIds.length !== attributes.length) {
        return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
      }
      const userId = await getUserId();
      if (!userId) return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
      const optionsArrayLiteral = `{${selectedOptionIds.join(',')}}`;
      const { data: rpcResult, error: searchError } = await supabase
        .rpc('find_variant_by_options', {
          p_user_id: userId,
          p_product_id: selectedProductId,
          p_option_ids: optionsArrayLiteral
        });
      if (searchError) {
        console.error('Error finding variant:', searchError);
        return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
      }
      const foundVariantId = rpcResult?.[0]?.variant_id ?? null;
      if (!foundVariantId) {
        return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
      }
      const { data: stockCheck, error: stockError } = await supabase
        .from('stock')
        .select('id, stock, price')
        .eq('variant_id', foundVariantId)
        .eq('location', selectedLocationId)
        .maybeSingle();
      if (stockError) {
        console.error('Error checking stock:', stockError);
        return { ...row, variantId: foundVariantId, existingPrice: null, currentStock: 0 };
      }
      // Lookup any existing price for this variant across any branch
      let globalExistingPrice: number | null = null;
      const { data: anyPriceRows, error: anyPriceErr } = await supabase
        .from('stock')
        .select('price')
        .eq('variant_id', foundVariantId)
        .not('price', 'is', null)
        .limit(1);
      if (!anyPriceErr && anyPriceRows && anyPriceRows.length > 0) {
        const p = anyPriceRows[0]?.price as number | null;
        if (p !== null && typeof p !== 'undefined') globalExistingPrice = p;
      }
      return {
        ...row,
        variantId: foundVariantId,
        existingPrice: globalExistingPrice !== null ? globalExistingPrice : (stockCheck?.price ?? null),
        currentStock: stockCheck?.stock ?? 0,
      };
    } catch (e) {
      console.error('Error in recalcRowVariantAndStock:', e);
      return { ...row, variantId: null, existingPrice: null, currentStock: 0 };
    }
  };

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      const updated: VariantRow[] = [];
      for (const row of rows) {
        const next = await recalcRowVariantAndStock(row);
        if (isCancelled) return;
        updated.push(next);
      }
      if (!isCancelled) setRows(updated);
    };
    if (rows.length > 0) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, selectedLocationId, attributes, attributeOptions]);

  // Recalc when a specific row options change
  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      const updated: VariantRow[] = [];
      for (const row of rows) {
        const next = await recalcRowVariantAndStock(row);
        if (isCancelled) return;
        updated.push(next);
      }
      if (!isCancelled) setRows(updated);
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map(r => JSON.stringify(r.selectedOptions)).join('|')]);

  const handleSaveStock = async () => {
    // <-- validación primero -->
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error("Usuario no autenticado.");
      // Process each row
      for (const row of rows) {
        const selectedOptionIds = Object.values(row.selectedOptions).filter(id => id !== null) as number[];

        // 1) Ensure variant exists (use existing or create new)
        let variantId: number | null = row.variantId;
        if (!variantId) {
          const { data: newVariantData, error: variantInsertError } = await supabase
            .from('productVariants')
            .insert({
              product_id: selectedProductId,
              user_id: userId
            })
            .select('variant_id')
            .single();

          if (variantInsertError || !newVariantData?.variant_id) {
            throw new Error(`Error creando la nueva variante: ${variantInsertError?.message || 'No se obtuvo ID'}`);
          }
          variantId = newVariantData.variant_id;

          if (selectedOptionIds.length > 0) {
            const varianteOpcionesPayload = selectedOptionIds.map(optId => ({
              variant_id: variantId!,
              option_id: optId,
            }));
            const { error: optionsInsertError } = await supabase
              .from('optionVariants')
              .insert(varianteOpcionesPayload);
            if (optionsInsertError) {
              console.error('Error vinculando opciones, intentando eliminar variante huérfana...');
              await supabase.from('productVariants').delete().eq('variant_id', variantId);
              throw new Error(`Error vinculando opciones: ${optionsInsertError.message}`);
            }
          }
        }

        // 2) Upsert stock for this location
        const { data: stockCheck, error: stockCheckError } = await supabase
          .from('stock')
          .select('id, stock, price')
          .eq('variant_id', variantId)
          .eq('location', selectedLocationId)
          .maybeSingle();
        if (stockCheckError) {
          throw new Error(`Error al verificar stock existente: ${stockCheckError.message}`);
        }

        const qtyToAdd = parseInt(row.quantity.toString(), 10);
        const finalPriceForRow = row.existingPrice !== null
          ? row.existingPrice
          : (row.price !== '' ? convertPriceToNumber(row.price) : 0);

        if (stockCheck && stockCheck.id) {
          const currentStockLevel = stockCheck.stock || 0;
          const newStockLevel = currentStockLevel + qtyToAdd;
          const updateData: { stock: number; added_at: string; price?: number } = {
            stock: newStockLevel,
            added_at: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
          };
          if (!stockCheck.price && finalPriceForRow > 0) {
            updateData.price = finalPriceForRow;
          }
          const { error: updateError } = await supabase
            .from('stock')
            .update(updateData)
            .eq('id', stockCheck.id);
          if (updateError) {
            throw new Error(`Error actualizando stock: ${updateError.message}`);
          }
        } else {
          const payload: Record<string, any> = {
            variant_id: variantId,
            location: selectedLocationId,
            stock: qtyToAdd,
            user_id: userId,
            added_at: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
          };
          if (finalPriceForRow > 0) payload.price = finalPriceForRow;
          const { error: insertError } = await supabase
            .from('stock')
            .insert(payload);
          if (insertError) {
            throw new Error(`Error insertando nuevo stock: ${insertError.message}`);
          }
        }
      }

      toast({
        variant: "success",
        title: "¡Éxito!",
        description: "Inventario agregado para las variantes seleccionadas",
      });
      onSaveStock();
      // limpiar campos
      setSelectedProductId(initialProductId ?? null);
      setRows(attributes.length > 0 ? [createEmptyRow(attributes)] : []);
      setEntryDate('');
      setSelectedLocationId(initialLocationId ?? null);
      onClose();
    } catch (error: any) {
      console.error("Error detallado en handleSaveStock:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al guardar el stock. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
          <h1 className="text-lg font-semibold mb-4">Agregar inventario</h1>

          {/* Mostrar producto seleccionado cuando viene predefinido */}
          {hideProductSelect ? (
            selectedProductName ? (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <Label className="text-sm text-gray-600">Producto</Label>
                <p className="text-base font-medium text-gray-900 mt-1">{selectedProductName}</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <Label className="text-sm text-gray-600">Producto</Label>
                <p className="text-base text-gray-500 mt-1">Cargando...</p>
              </div>
            )
          ) : (
            <div className="my-4">
              <Label htmlFor="product-select">Producto</Label>
              <select
                id="product-select"
                className="w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373]"
                value={selectedProductId ?? ""}
                onChange={e => setSelectedProductId(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={isLoading}
              >
                <option value="" disabled>
                  {isLoading ? "Cargando productos..." : "Selecciona un producto"}
                </option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {productError && <p className="text-red-600 text-sm mt-1">{productError}</p>}
            </div>
          )}

          {/* Mostrar sucursal seleccionada cuando viene predefinida */}
          {hideLocationSelect ? (
            selectedLocationName ? (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <Label className="text-sm text-gray-600">Sucursal</Label>
                <p className="text-base font-medium text-gray-900 mt-1">{selectedLocationName}</p>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <Label className="text-sm text-gray-600">Sucursal</Label>
                <p className="text-base text-gray-500 mt-1">Cargando...</p>
              </div>
            )
          ) : (
            <div className="mb-4">
              <Label htmlFor="location-select">Sucursal</Label>
              <select
                id="location-select"
                className="w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373]"
                value={selectedLocationId ?? ''}
                onChange={e => setSelectedLocationId(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={isLoading || ubicaciones.length === 0}
              >
                <option value="" disabled>
                  {isLoading && ubicaciones.length === 0 ? 'Cargando sucursales...' : 'Selecciona una sucursal'}
                </option>
                {ubicaciones.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
              {locationError && <p className="text-red-600 text-sm mt-1">{locationError}</p>}
            </div>
          )}

          {/* Variantes múltiples */}
          <div className="mb-4 border border-gray-300 p-4 rounded-md bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">Variantes del producto</h2>
                <p className="text-sm text-gray-600">Agrega las cantidades para cada variante que desees ingresar</p>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                onClick={addRow} 
                disabled={isLoading || !selectedProductId || !selectedLocationId}
                className="bg-white hover:bg-gray-100"
              >
                + Agregar variante
              </Button>
            </div>
            
            {attributes.length === 0 && selectedProductId && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  ℹ️ Este producto no tiene variantes configuradas. Puedes agregar inventario directamente ingresando la cantidad y precio.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {rows.map((row, index) => (
                <div key={row.id} className="border border-gray-300 bg-white rounded-md p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Variante #{index + 1}</h3>
                    {rows.length > 1 && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeRow(row.id)} 
                        disabled={isLoading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        🗑️ Eliminar
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    {/* Attribute selectors per row */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {attributes.map(attr => {
                        const opts = attributeOptions[attr.characteristics_id] || [];
                        const sel = row.selectedOptions[attr.characteristics_id] ?? '';
                        return (
                          <div key={`${row.id}-${attr.characteristics_id}`}>
                            <Label htmlFor={`row-${row.id}-attr-${attr.characteristics_id}`}>{attr.name}</Label>
                            <select
                              id={`row-${row.id}-attr-${attr.characteristics_id}`}
                              className="w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373]"
                              value={sel}
                              onChange={e => handleRowOptionChange(row.id, attr.characteristics_id, e.target.value)}
                              disabled={isLoading}
                            >
                              <option value="" disabled>
                                {isLoading && opts.length === 0 ? 'Cargando opciones...' : `Selecciona ${attr.name}`}
                              </option>
                              {opts.length > 0 ? (
                                opts.map(o => <option key={o.id} value={o.id}>{o.value}</option>)
                              ) : (
                                !isLoading && <option value="" disabled>No hay opciones</option>
                              )}
                            </select>
                          </div>
                        );
                      })}
                    </div>

                    {/* Quantity */}
                    <div>
                      <Label>Cantidad a agregar</Label>
                      <div className="mt-1 flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => decrementRowQty(row.id)} 
                          className="w-9 h-9 border rounded grid place-items-center hover:bg-gray-100 transition-colors"
                          disabled={isLoading}
                        >
                          -
                        </button>
                        <Input
                          type="number"
                          value={row.quantity}
                          onChange={e => handleRowQuantityChange(row.id, e.target.value)}
                          className="w-24 text-center"
                          disabled={isLoading}
                          min={0}
                        />
                        <button 
                          type="button" 
                          onClick={() => incrementRowQty(row.id)} 
                          className="w-9 h-9 border rounded grid place-items-center hover:bg-gray-100 transition-colors"
                          disabled={isLoading}
                        >
                          +
                        </button>
                      </div>
                      <div className="mt-2 p-2 bg-white border border-gray-200 rounded">
                        <p className="text-xs text-gray-600">Existencia actual:</p>
                        <p className="text-sm font-semibold text-gray-900">{row.currentStock} unidades</p>
                      </div>
                      {row.errors?.quantity && <p className="text-red-600 text-sm mt-1">{row.errors.quantity}</p>}
                    </div>

                    {/* Price */}
                    <div>
                      <Label>Precio</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={row.price}
                          onChange={e => handleRowPriceChange(row.id, e.target.value)}
                          onBlur={() => handleRowPriceBlur(row.id)}
                          placeholder="Precio"
                          className="mt-1"
                          disabled={isLoading || row.existingPrice !== null}
                          min={0.01}
                          step={0.01}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">MXN</div>
                      </div>
                      {row.existingPrice !== null ? (
                        <p className="text-sm text-blue-500 mt-1">Precio actual: {row.existingPrice} MXN</p>
                      ) : row.errors?.price ? (
                        <p className="text-red-600 text-sm mt-1">{row.errors.price}</p>
                      ) : null}
                    </div>
                  </div>

                  {/* Row-level attribute error */}
                  {row.errors?.options && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                      <p className="text-red-600 text-sm">{row.errors.options}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fecha de entrada */}
          <div className="mb-4">
            <Label htmlFor="entry-date">Introduce la fecha de ingreso del inventario por agregar:</Label>
            <Input
              id="entry-date"
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="mt-1 text-[#737373]"
            />
            {dateError && <p className="text-red-600 text-sm mt-1">{dateError}</p>}
          </div>

          <div className="flex justify-center gap-4 mt-6">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveStock}
              className="bg-blue-500 hover:bg-blue-600"
              disabled={isLoading}
            >
              {isLoading ? 'Actualizando...' : 'Guardar'}
            </Button>
          </div>
      </CardContent>
    </Card>
  );
};

export default AddProductToStock;
