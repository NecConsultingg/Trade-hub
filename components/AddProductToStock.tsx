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
  onSaveStock: () => void;
  onClose: () => void;
}

const AddProductToStock: React.FC<AddProductToStockProps> = ({ onSaveStock, onClose }) => {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productError, setProductError] = useState<string>('');

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [attributeOptions, setAttributeOptions] = useState<Record<number, OptionData[]>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number | null>>({});
  const [optionsError, setOptionsError] = useState<string>('');

  const [quantity, setQuantity] = useState<number | string>('');
  const [quantityError, setQuantityError] = useState<string>('');

  const [price, setPrice] = useState<number | string>('');
  const [priceError, setPriceError] = useState<string>('');
  const [existingPrice, setExistingPrice] = useState<number | null>(null);

  const [entryDate, setEntryDate] = useState<string>('');
  const [dateError, setDateError] = useState<string>('');

  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);

  // Add new useEffect to check for existing stock
  useEffect(() => {
    async function checkExistingStock() {
      if (!selectedProductId || !selectedLocationId || Object.values(selectedOptions).some(v => v === null)) {
        setExistingPrice(null);
        return;
      }

      try {
        const userId = await getUserId();
        if (!userId) return;

        // Get the variant ID first
        const selectedOptionIds = Object.values(selectedOptions).filter(id => id !== null) as number[];
        const optionsArrayLiteral = `{${selectedOptionIds.join(',')}}`;
        
        const { data: rpcResult, error: searchError } = await supabase
          .rpc('find_variant_by_options', {
            p_user_id: userId,
            p_product_id: selectedProductId,
            p_option_ids: optionsArrayLiteral 
          });

        if (searchError) {
          console.error("Error finding variant:", searchError);
          return;
        }

        const variantId = rpcResult?.[0]?.variant_id;
        if (!variantId) {
          setExistingPrice(null);
          return;
        }

        // Now check for existing stock
        const { data: stockCheck, error: stockError } = await supabase
          .from('stock')
          .select('id, stock, price')
          .eq('variant_id', variantId)
          .eq('location', selectedLocationId)
          .maybeSingle();

        if (stockError) {
          console.error("Error checking stock:", stockError);
          return;
        }

        console.log("Stock check result:", stockCheck); // Debug log
        if (stockCheck?.price) {
          console.log("Setting existing price to:", stockCheck.price); // Debug log
          setExistingPrice(stockCheck.price);
        } else {
          setExistingPrice(null);
        }
      } catch (error) {
        console.error("Error in checkExistingStock:", error);
        setExistingPrice(null);
      }
    }

    checkExistingStock();
  }, [selectedProductId, selectedLocationId, selectedOptions]);

  // Validación previa al guardar
  const validateForm = (): boolean => {
    let valid = true;

    if (!selectedProductId) {
      setProductError("Por favor, selecciona un producto.");
      valid = false;
    } else {
      setProductError("");
    }

    if (attributes.length > 0) {
      const selOpts = Object.values(selectedOptions).filter(v => v !== null);
      if (selOpts.length !== attributes.length) {
        setOptionsError("Por favor, selecciona una opción para cada atributo.");
        valid = false;
      } else {
        setOptionsError("");
      }
    } else {
      setOptionsError("");
    }

    if (!selectedLocationId) {
      setLocationError("Por favor, selecciona una ubicación.");
      valid = false;
    } else {
      setLocationError("");
    }

    const qty = parseInt(quantity.toString(), 10);
    if (isNaN(qty) || qty <= 0) {
      setQuantityError("Por favor, ingresa una cantidad válida (mayor a 0).");
      valid = false;
    } else {
      setQuantityError("");
    }

    if (existingPrice === null) {
      const pr = parseFloat(price.toString());
      if (isNaN(pr) || pr <= 0) {
        setPriceError("Por favor, ingresa un precio válido (mayor a 0).");
        valid = false;
      } else {
        setPriceError("");
      }
    } else {
      setPriceError("");
    }

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

  // Carga atributos al cambiar de producto
  useEffect(() => {
    async function getAttributes(productId: number | null) {
      if (productId === null) {
        setAttributes([]);
        setAttributeOptions({});
        setSelectedOptions({});
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
        setSelectedOptions({});
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
        return;
      }
      setIsLoading(true);
      try {
        let optionsMap: Record<number, OptionData[]> = {};
        let initialSelected: Record<number, number | null> = {};
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
          initialSelected[attribute.characteristics_id] = null;
        }
        setAttributeOptions(optionsMap);
        setSelectedOptions(initialSelected);
      } catch (error: any) {
        console.error("Unexpected error fetching attribute options:", error);
      } finally {
        setIsLoading(false);
      }
    }
    getAttributeOptions();
  }, [attributes]);

  const handleOptionChange = (characteristicId: number, optionIdStr: string) => {
    const optionId = optionIdStr ? parseInt(optionIdStr, 10) : null;
    setSelectedOptions(prev => ({
      ...prev,
      [characteristicId]: optionId,
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

  // Add effect to monitor price changes
  useEffect(() => {
    if (price !== '') {
      console.log('Price state changed:', { 
        original: price, 
        converted: convertPriceToNumber(price),
        type: typeof price 
      });
    }
  }, [price]);

  // Modify the price input handling
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and one decimal point
    if (/^\d*\.?\d{0,2}$/.test(value) || value === '') {
      // Store as string to preserve exact input
      setPrice(value);
    }
  };

  const handlePriceBlur = () => {
    if (price !== '') {
      // Convert to number and back to string to ensure consistent format
      const formattedPrice = convertPriceToNumber(price).toString();
      console.log('Price blur:', { 
        before: price, 
        after: formattedPrice 
      });
      setPrice(formattedPrice);
    }
  };

  const handleSaveStock = async () => {
    // <-- validación primero -->
    if (!validateForm()) return;

    // Ensure price is properly formatted before saving
    const finalPrice = price !== '' ? convertPriceToNumber(price) : 0;
    console.log('Saving price:', { 
      original: price, 
      final: finalPrice 
    });

    setIsLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error("Usuario no autenticado.");

      let varianteId: number;
      const selectedOptionIds = Object.values(selectedOptions).filter(id => id !== null) as number[];

      const optionsArrayLiteral = `{${selectedOptionIds.join(',')}}`;
      const { data: rpcResult, error: searchError } = await supabase
        .rpc('find_variant_by_options', {
          p_user_id: userId,
          p_product_id: selectedProductId,
          p_option_ids: optionsArrayLiteral 
        });

      if (searchError) {
        console.error("Error buscando variante via RPC:", searchError);
        throw new Error(`Error al buscar variante (RPC): ${searchError.message}. Verifica la función y el formato del array.`);
      }

      const foundVariant = rpcResult && rpcResult.length > 0 ? rpcResult[0] : null;

      if (foundVariant && foundVariant.variant_id) {
        varianteId = foundVariant.variant_id;
      } else {
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
        varianteId = newVariantData.variant_id;

        if (selectedOptionIds.length > 0) {
          const varianteOpcionesPayload = selectedOptionIds.map(optId => ({
            variant_id: varianteId,
            option_id: optId,
          }));

          const { error: optionsInsertError } = await supabase
            .from('optionVariants')
            .insert(varianteOpcionesPayload);

          if (optionsInsertError) {
            console.error("Error vinculando opciones, intentando eliminar variante huérfana...");
            await supabase.from('producto_variantes').delete().eq('variant_id', varianteId);
            throw new Error(`Error vinculando opciones: ${optionsInsertError.message}`);
          }
        } else {
          console.log("Producto sin opciones, no se inserta en variante_opciones.");
        }
      }

      const { data: stockCheck, error: stockCheckError } = await supabase
        .from('stock')
        .select('id, stock, price')
        .eq('variant_id', varianteId)
        .eq('location', selectedLocationId)
        .maybeSingle();

      if (stockCheckError) {
        throw new Error(`Error al verificar stock existente: ${stockCheckError.message}`);
      }

      console.log("Final stock check before save:", stockCheck); // Debug log
      console.log("Current existingPrice state:", existingPrice); // Debug log

      if (stockCheck && stockCheck.id) {
        const currentStock = stockCheck.stock || 0;
        const newStockLevel = currentStock + parseInt(quantity.toString(), 10);

        const updateData: {
          stock: number;
          added_at: string;
          price?: number;
        } = {
          stock: newStockLevel,
          added_at: new Date().toISOString()
        };

        // Only add price to update if it doesn't exist
        if (!stockCheck.price) {
          updateData.price = finalPrice;
        }

        console.log("Updating stock with data:", updateData); // Debug log

        const { error: updateError } = await supabase
          .from('stock')
          .update(updateData)
          .eq('id', stockCheck.id);

        if (updateError) {
          throw new Error(`Error actualizando stock: ${updateError.message}`);
        }
        console.log("Stock actualizado.");
      } else {
        console.log("Insertando nuevo registro de stock.");
        const { error: insertError } = await supabase
          .from('stock')
          .insert({
            variant_id: varianteId,
            location: selectedLocationId,
            stock: parseInt(quantity.toString(), 10),
            price: finalPrice,
            user_id: userId,
            added_at: new Date().toISOString()
          });

        if (insertError) {
          throw new Error(`Error insertando nuevo stock: ${insertError.message}`);
        }
        console.log("Nuevo stock insertado.");
      }

      toast({
        variant: "success",
        title: "¡Éxito!",
        description: "Stock agregado correctamente",
      });
      onSaveStock();
      // limpiar campos
      setSelectedProductId(null);
      setSelectedOptions({});
      setQuantity('');
      setPrice('');
      setEntryDate('');
      setSelectedLocationId(null);
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
    <div>
      <Card className="w-full">
        <CardContent className="p-6">
          <h1 className="text-lg font-semibold capitalize">Agregar Inventario</h1>

          {/* Producto */}
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

          {/* Atributos y opciones */}
          {attributes.length > 0 && (
            <div className="mb-4 border p-4 rounded-md">
              <h2 className="font-semibold mb-2">Selecciona Opciones</h2>
              {attributes.map(attr => {
                const opts = attributeOptions[attr.characteristics_id] || [];
                const sel = selectedOptions[attr.characteristics_id] ?? "";
                return (
                  <div key={attr.characteristics_id} className="mb-3">
                    <Label htmlFor={`attr-${attr.characteristics_id}`}>{attr.name}</Label>
                    <select
                      id={`attr-${attr.characteristics_id}`}
                      className="w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373]"
                      value={sel}
                      onChange={e => handleOptionChange(attr.characteristics_id, e.target.value)}
                      disabled={isLoading}
                    >
                      <option value="" disabled>
                        {isLoading && opts.length === 0
                          ? "Cargando opciones..."
                          : `Selecciona ${attr.name}`}
                      </option>
                      {opts.length > 0
                        ? opts.map(o => <option key={o.id} value={o.id}>{o.value}</option>)
                        : !isLoading && <option value="" disabled>No hay opciones</option>}
                    </select>
                  </div>
                );
              })}
              {optionsError && <p className="text-red-600 text-sm mt-1">{optionsError}</p>}
            </div>
          )}

          {/* Ubicación */}
          <div className="mb-4">
            <Label htmlFor="location-select">Ubicación</Label>
            <select
              id="location-select"
              className="w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373]"
              value={selectedLocationId ?? ""}
              onChange={e => setSelectedLocationId(e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={isLoading || ubicaciones.length === 0}
            >
              <option value="" disabled>
                {isLoading && ubicaciones.length === 0
                  ? "Cargando ubicaciones..."
                  : "Selecciona una ubicación"}
              </option>
              {ubicaciones.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
            {locationError && <p className="text-red-600 text-sm mt-1">{locationError}</p>}
          </div>

          {/* Cantidad */}
          <div className="mb-4">
            <Label htmlFor="quantity">Cantidad a agregar</Label>
            <Input
              id="quantity"
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="Cantidad"
              className="mt-1"
              disabled={isLoading}
              min={1}
            />
            {quantityError && <p className="text-red-600 text-sm mt-1">{quantityError}</p>}
          </div>

          {/* Precio */}
          <div className="mb-4">
            <Label htmlFor="price">
              {existingPrice !== null ? "Precio (valor existente)" : "Precio"}
            </Label>
            <div className="relative">
              <Input
                id="price"
                type="number"
                value={price}
                onChange={handlePriceChange}
                onBlur={handlePriceBlur}
                placeholder="Precio del producto"
                className="mt-1"
                disabled={isLoading || existingPrice !== null}
                min={0.01}
                step={0.01}
                // Add onFocus to prevent browser's number input behavior
                onFocus={(e) => {
                  // Select all text on focus for easier editing
                  e.target.select();
                }}
                // Prevent browser's default number input behavior
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                  }
                }}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                MXN
              </div>
            </div>
            {existingPrice !== null ? (
              <p className="text-sm text-blue-500 mt-1">
                Esta variante ya tiene un precio establecido de {existingPrice} MXN.
              </p>
            ) : priceError ? (
              <p className="text-red-600 text-sm mt-1">{priceError}</p>
            ) : null}
          </div>

          {/* Fecha de entrada */}
          <div className="mb-4">
            <Label htmlFor="entry-date">Fecha de entrada</Label>
            <Input
              id="entry-date"
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="mt-1 text-[#737373]"
            />
            {dateError && <p className="text-red-600 text-sm mt-1">{dateError}</p>}
          </div>

          <div className="flex justify-end gap-4 mt-6">
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
    </div>
  );
};

export default AddProductToStock;
