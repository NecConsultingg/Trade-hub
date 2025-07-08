"use client"
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Minus, Image, Trash2, Search, Filter, Building, Users, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from '@/lib/supabase';
import { getUserId, getUserRole } from '@/lib/userId';
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ProductVariant {
  variant_id: number; 
  product_id: number;
  sku: string;
  price: number;
  image_url: string | null;
}

interface Product {
  id: number;
  name: string;
  description: string;
  user_id: number;
  category?: string;
}

interface StockItem {
  id: number;
  variant_id: number;
  location: number;
  stock: number;
  price: number;
  added_at: string;
}

interface Location {
  id: number;
  name: string;
  location: string;
}

// New Client interface
interface Client {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  user_id: number;
  discount: number;
  is_default?: boolean;
}

// Interface for cart items
interface ProductoCarrito {
  id: number;
  variant_id: number;
  name: string;
  type: string[];
  unitPrice: number;
  quantity: number;
  image: string | null;
  sku: string;
  attributes: Record<string, string>;
}

// Props for the component
interface CheckoutVentaProps {
  onClose: () => void;
  locationId: number;
}

// Add new interface for selected attributes
interface SelectedAttributes {
  [characteristicName: string]: string;
}

// Add new interface for variant validation
interface VariantValidation {
  isValid: boolean;
  message: string;
}

// Add new interface for product selections
interface ProductSelections {
  [productId: number]: {
    attributes: SelectedAttributes;
    variantId: string;
    validation: VariantValidation;
  };
}

const CheckoutVenta: React.FC<CheckoutVentaProps> = ({ onClose, locationId }) => {
  // All useState hooks first
  const { toast } = useToast();
  const [locationInfo, setLocationInfo] = useState<Location | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<Record<number, Record<string, string>>>({});
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loadingClients, setLoadingClients] = useState<boolean>(true);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [descuento, setDescuento] = useState<number>(0);
  const [inputDescuento, setInputDescuento] = useState<string>("0");
  const [ventaItems, setVentaItems] = useState<ProductoCarrito[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [productSelections, setProductSelections] = useState<ProductSelections>({});
  const [isConfirmingSale, setIsConfirmingSale] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');

  // All useMemo hooks next
  const variantsByProduct = useMemo(() => {
    const result: Record<number, ProductVariant[]> = {};
    productVariants.forEach(variant => {
      if (!result[variant.product_id]) {
        result[variant.product_id] = [];
      }
      result[variant.product_id].push(variant);
    });
    return result;
  }, [productVariants]);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || 
                             (product.category && product.category === selectedCategory);
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // All useCallback hooks next
  const getAvailableOptions = useCallback((productId: number, characteristicName: string, currentSelections: SelectedAttributes): string[] => {
    const productVariants = variantsByProduct[productId] || [];
    const options = new Set<string>();
    
    // Get all variants that match the current selections
    const matchingVariants = productVariants.filter(variant => {
      const attrs = variantAttributes[variant.variant_id];
      if (!attrs) return false;

      // Check if this variant matches all currently selected attributes
      // except for the one we're currently getting options for
      return Object.entries(currentSelections).every(([name, value]) => {
        if (!value) return true; // Skip unselected attributes
        if (name === characteristicName) return true; // Skip the attribute we're getting options for
        return attrs[name] === value; // Check if this variant has the selected value
      });
    });

    // Get all unique values for the requested characteristic from matching variants
    matchingVariants.forEach(variant => {
      const attrs = variantAttributes[variant.variant_id];
      if (attrs && attrs[characteristicName]) {
        options.add(attrs[characteristicName]);
      }
    });
    
    return Array.from(options).sort();
  }, [variantsByProduct, variantAttributes]);

  const validateVariantSelection = useCallback((productId: number, selections: SelectedAttributes): VariantValidation => {
    const productVariants = variantsByProduct[productId] || [];
    const characteristicNames = productVariants.length > 0 
      ? getCharacteristicNames(productVariants[0].variant_id)
      : [];
    
    const allSelected = characteristicNames.every(name => selections[name]);
    if (!allSelected) {
      return {
        isValid: false,
        message: 'Selecciona todas las opciones'
      };
    }
    
    const variantExists = productVariants.some(variant => {
      const attrs = variantAttributes[variant.variant_id];
      if (!attrs) return false;
      
      return Object.entries(selections).every(([name, value]) => attrs[name] === value);
    });
    
    if (!variantExists) {
      return {
        isValid: false,
        message: 'Esta combinación no está disponible'
      };
    }
    
    return {
      isValid: true,
      message: ''
    };
  }, [variantsByProduct, variantAttributes]);

  const getVariantIdFromAttributes = useCallback((productId: number, selections: SelectedAttributes): number | null => {
    const productVariants = variantsByProduct[productId] || [];
    const validation = validateVariantSelection(productId, selections);
    
    if (!validation.isValid) {
      return null;
    }
    
    const variant = productVariants.find(variant => {
      const attrs = variantAttributes[variant.variant_id];
      if (!attrs) return false;
      
      return Object.entries(selections).every(
        ([name, value]) => attrs[name] === value
      );
    });
    
    return variant?.variant_id || null;
  }, [variantsByProduct, variantAttributes, validateVariantSelection]);

  const handleAttributeChange = useCallback((productId: number, characteristicName: string, value: string) => {
    setProductSelections(prev => {
      const currentSelections = prev[productId] || {
        attributes: {},
        variantId: '',
        validation: { isValid: true, message: '' }
      };

      // Create new selections object
      const newAttributes = { ...currentSelections.attributes };
      
      if (value === "__CLEAR__") {
        // If clear option selected, remove this attribute and all subsequent ones
        delete newAttributes[characteristicName];
        
        // Clear all subsequent selections
        const characteristicNames = Object.keys(variantAttributes[productVariants[0]?.variant_id] || {});
        const currentIndex = characteristicNames.indexOf(characteristicName);
        if (currentIndex !== -1) {
          characteristicNames.slice(currentIndex).forEach(name => {
            delete newAttributes[name];
          });
        }
      } else {
        // Set the new value
        newAttributes[characteristicName] = value;
        
        // Clear subsequent selections
        const characteristicNames = Object.keys(variantAttributes[productVariants[0]?.variant_id] || {});
        const currentIndex = characteristicNames.indexOf(characteristicName);
        if (currentIndex !== -1) {
          characteristicNames.slice(currentIndex + 1).forEach(name => {
            delete newAttributes[name];
          });
        }
      }

      // Validate new selections
      const validation = validateVariantSelection(productId, newAttributes);
      const variantId = validation.isValid 
        ? getVariantIdFromAttributes(productId, newAttributes)?.toString() || ''
        : '';

      return {
        ...prev,
        [productId]: {
          attributes: newAttributes,
          variantId,
          validation
        }
      };
    });
  }, [productVariants, variantAttributes, validateVariantSelection, getVariantIdFromAttributes]);

  const handleClearAllAttributes = useCallback((productId: number) => {
    setProductSelections(prev => ({
      ...prev,
      [productId]: {
        attributes: {},
        variantId: '',
        validation: { isValid: true, message: '' }
      }
    }));
  }, []);

  // All useEffect hooks last
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const userId = await getUserId();
        
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId);
        
        if (error) throw error;
        
        // Create default "Público en General" client if it doesn't exist
        let publicoGeneral = data?.find(client => 
          client.name.toLowerCase() === 'público en general' || 
          client.name.toLowerCase() === 'publico en general'
        );
        
        if (!publicoGeneral) {
          // Insert the default client
          const { data: newClient, error: insertError } = await supabase
            .from('clients')
            .insert([
              {
                name: 'Público en General',
                user_id: userId,
                discount: 0,
                is_default: true
              }
            ])
            .select()
            .single();
          
          if (insertError) throw insertError;
          publicoGeneral = newClient;
        }
        
        // Combine the default client with other clients
        const allClients = publicoGeneral 
          ? [publicoGeneral, ...(data?.filter(c => c.id !== publicoGeneral?.id) || [])]
          : data || [];
        
        setClients(allClients);
        
        // Always select "Público en General" by default
        if (publicoGeneral) {
          setSelectedClientId(publicoGeneral.id);
          setDescuento(publicoGeneral.discount || 0);
          setInputDescuento(publicoGeneral.discount?.toString() || "0");

        } else if (data && data.length > 0) {
          // Fallback to first client if somehow publicoGeneral wasn't created
          setSelectedClientId(data[0].id);
          setDescuento(data[0].discount || 0);
          setInputDescuento(data[0].discount?.toString() || "0");
        }
        
      } catch (error) {
        console.error('Error fetching clients:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar los clientes",
        });
      } finally {
        setLoadingClients(false);
      }
    };
    
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchLocationInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name, location')
          .eq('id', locationId)
          .single();
        
        if (error) throw error;
        setLocationInfo(data);
      } catch (error) {
        console.error('Error fetching location info:', error);
      }
    };

    if (locationId) {
      fetchLocationInfo();
    }
  }, [locationId]);

  useEffect(() => {
    const fetchProductData = async () => {
      setLoading(true);
      try {
        // Get user ID
        const userId = await getUserId();
        
        // First, fetch stock items for the selected location
        // This is the key change - we only get stock from the specified location
        const { data: stockData, error: stockError } = await supabase
          .from('stock')
          .select('*')
          .eq('location', locationId)
          .eq('user_id', userId);
        
        if (stockError) throw stockError;
        
        // If there's no stock at this location, set empty arrays and return early
        if (!stockData || stockData.length === 0) {
          setStockItems([]);
          setProductVariants([]);
          setProducts([]);
          setLoading(false);
          return;
        }
        
        // Extract variant IDs from stock to fetch only relevant variants
        const variantIds = stockData.map(item => item.variant_id);
        
        // Fetch only the product variants that exist in this location's stock
        const { data: variantsData, error: variantsError } = await supabase
          .from('productVariants')
          .select('*')
          .in('variant_id', variantIds);
        
        if (variantsError) throw variantsError;
        
        // Extract product IDs to fetch only relevant products
        const productIds = variantsData.map(variant => variant.product_id);
        
        // Fetch only the products that have variants in this location's stock
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds)
          .eq('user_id', userId);
        
        if (productsError) throw productsError;
        const { data: optionVariantsData, error: optionVariantsError } = await supabase
          .from('optionVariants')
          .select('*')
          .in('variant_id', variantIds);
        
        if (optionVariantsError) throw optionVariantsError;
        
        // Fetch characteristics options
        const { data: optionsData, error: optionsError } = await supabase
          .from('characteristics_options')
          .select('*, product_characteristics(name)')
          .in('id', optionVariantsData.map(ov => ov.option_id));
        
        if (optionsError) throw optionsError;
        
        // Process the data
        setProducts(productsData);
        setProductVariants(variantsData);
        setStockItems(stockData);
        
        // Process variant attributes into a more usable format
        const varAttrs: Record<number, Record<string, string>> = {};
        
        optionVariantsData.forEach(ov => {
          const option = optionsData.find(o => o.id === ov.option_id);
          if (option) {
            if (!varAttrs[ov.variant_id]) {
              varAttrs[ov.variant_id] = {};
            }
            // Use the characteristic name from the joined product_characteristics
            const characteristicName = option.product_characteristics?.name || "Unknown";
            varAttrs[ov.variant_id][characteristicName] = option.values;
          }
        });
        
        setVariantAttributes(varAttrs);
        
        // Initialize quantities for each variant
        const initialQuantities: Record<number, number> = {};
        variantsData.forEach((variant: ProductVariant) => {
          initialQuantities[variant.variant_id] = 0;
        });
        setCantidades(initialQuantities);
        
        // Extract categories from products
        if (productsData.length > 0) {
          const uniqueCategories = Array.from(new Set(
            productsData
              .map(p => p.category)
              .filter(Boolean) // Filter out undefined or null values
          ));
          setCategories(uniqueCategories as string[]);
        }
        
      } catch (error) {
        console.error('Error fetching product data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (locationId) {
      fetchProductData();
    }
  }, [locationId]);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const role = await getUserRole();
        setIsAdmin(role === 'admin' || role === 'superadmin');
      } catch (error) {
        console.error('Error checking user role:', error);
        setIsAdmin(false);
      }
    };
    
    checkUserRole();
  }, []);

  useEffect(() => {
    // Remove the old validation effect as it's now handled in handleAttributeChange
  }, []);

  // Format variant name with attributes
  const formatVariantName = (variantId: number): string => {
    const attrs = variantAttributes[variantId];
    const attrLines = Object.entries(attrs)
      .map(([characteristicName, value]) => ` ${value}`)
      .join("\n");
    return `${attrLines}`;
  };
  
  const getCharacteristicNames = (variantId: number): string[] => {
    const attrs = variantAttributes[variantId];
    if (!attrs) return [];
    return Object.keys(attrs);
  };

  // Increase quantity respecting stock limits
  const aumentar = (variantId: number) => {
    const stock = getAvailableStock(variantId);
    setCantidades(prev => ({
      ...prev,
      [variantId]: prev[variantId] < stock ? prev[variantId] + 1 : prev[variantId]
    }));
  };

  // Decrease quantity (minimum 0)
  const disminuir = (variantId: number) => {
    setCantidades(prev => ({
      ...prev,
      [variantId]: prev[variantId] > 1 ? prev[variantId] - 1 : 0
    }));
  };

  // Get available stock for a variant
  const getAvailableStock = (variantId: number): number => {
    const stockItem = stockItems.find(item => item.variant_id === variantId);
    return stockItem ? stockItem.stock : 0;
  };

  // Add product to cart
  const agregarAlCarrito = (productId: number) => {
    const selection = productSelections[productId];
    if (!selection || !selection.variantId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Selecciona todas las opciones del producto",
      });
      return;
    }

    const variantId = Number(selection.variantId);
    const variant = productVariants.find(v => v.variant_id === variantId);
    if (!variant) {
      console.error("Variant details not found for ID:", variantId);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se encontraron detalles del producto.",
      });
      return;
    }

    const product = products.find(p => p.id === productId);
    if (!product) {
      console.error("Product not found for ID:", productId);
      return;
    }

    const stockItem = stockItems.find(item => item.variant_id === variantId);
    if (!stockItem || typeof stockItem.price !== 'number') {
      console.error("Stock information not found for variant ID:", variantId);
      toast({
        variant: "destructive",
        title: "Error",
        description: `Precio no encontrado en el inventario para ${formatVariantName(variantId)}. No se puede agregar.`,
      });
      return;
    }

    const unitPrice = stockItem.price;
    const variantName = formatVariantName(variantId);
    const variantType = getCharacteristicNames(variantId);

    setVentaItems(prev => {
      const existe = prev.find(item => item.variant_id === variantId);
      if (existe) {
        return prev.map(item =>
          item.variant_id === variantId
            ? { ...item, quantity: cantidades[variantId], unitPrice: unitPrice }
            : item
        );
      }
      return [...prev, {
        id: Date.now(),
        variant_id: variantId,
        name: `${product.name} - ${variantName}`,
        type: variantType,
        unitPrice: unitPrice,
        quantity: cantidades[variantId],
        image: variant.image_url,
        sku: variant.sku,
        attributes: variantAttributes[variantId] || {}
      }];
    });

    // Clear the selections for this product after successfully adding to cart
    setProductSelections(prev => ({
      ...prev,
      [productId]: {
        attributes: {},
        variantId: '',
        validation: { isValid: true, message: '' }
      }
    }));

    // Reset quantity to 1 for this variant
    setCantidades(prev => ({
      ...prev,
      [variantId]: 0
    }));
  };
  const eliminarDelCarrito = (variantId: number) => {
    setVentaItems(prev => prev.filter(item => item.variant_id !== variantId));
  };
  const subtotal = ventaItems.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const descuentoAplicado = descuento ? subtotal * (descuento / 100) : 0;
  const total = subtotal - descuentoAplicado;

  const handleConfirmSale = () => {
    setShowConfirmation(true);
  };

  const confirmarVenta = async () => {
    setShowConfirmation(false); // Close the confirmation modal
    if (ventaItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay productos en el carrito",
      });
      return;
    }

    try {
      setIsConfirmingSale(true);
      const userId = await getUserId();
      const role = await getUserRole();
      let userName = '';
      if (role === 'employee') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          const { data: employeeData } = await supabase
            .from('employees')
            .select('name')
            .eq('auth_id', session.user.id)
            .single();
          userName = employeeData?.name || 'Empleado no registrado';
        }
      } else {
        const { data: adminData } = await supabase
          .from('admins')
          .select('name')
          .eq('user_id', userId)
          .single();
        userName = adminData?.name || 'Admin no registrado';
      }

      // Start a transaction
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            user_id: userId,
            total_amount: total < 0 ? 0 : total,
            discount_percentage: descuento,
            created_at: new Date().toISOString(),
            location: locationId,
            client: selectedClientId,
            salesman: userName,
            payment_method: paymentMethod
          }
        ])
        .select();
      
      if (saleError) throw saleError;
      if (!saleData || saleData.length === 0) throw new Error('Failed to create sale');
      const saleId = saleData[0].id;

      // If there's a selected client, update their balance and sales statistics
      if (selectedClientId) {
        // Get current client data
        const { data: clientData, error: clientError } = await supabase
          .from('clients')
          .select('saldo, num_compras, total_compras')
          .eq('id', selectedClientId)
          .single();

        if (clientError) throw clientError;

        // Calculate new values
        const currentBalance = clientData?.saldo || 0;
        const newBalance = currentBalance + (total < 0 ? 0 : total);
        const currentNumCompras = clientData?.num_compras || 0;
        const currentTotalCompras = clientData?.total_compras || 0;
        const newNumCompras = currentNumCompras + 1;
        const newTotalCompras = currentTotalCompras + (total < 0 ? 0 : total);

        // Update client data
        const { error: updateError } = await supabase
          .from('clients')
          .update({ 
            saldo: newBalance,
            num_compras: newNumCompras,
            total_compras: newTotalCompras
          })
          .eq('id', selectedClientId);

        if (updateError) throw updateError;
      }

      const saleItems = ventaItems.map(item => ({
        sale_id: saleId,
        variant_id: item.variant_id,
        quantity_sold: item.quantity,
        sale_price: item.unitPrice
      }));
      
      const { error: itemsError } = await supabase
        .from('sales_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update inventory for each item
      for (const item of ventaItems) {
        // First get current stock
        const { data: stockData, error: stockFetchError } = await supabase
          .from('stock')
          .select('stock')
          .eq('variant_id', item.variant_id)
          .eq('location', locationId)
          .single();

        if (stockFetchError) throw stockFetchError;

        // Then update with new stock value
        const { error: stockError } = await supabase
          .from('stock')
          .update({ stock: (stockData?.stock || 0) - item.quantity })
          .eq('variant_id', item.variant_id)
          .eq('location', locationId);

        if (stockError) throw stockError;
      }

      toast({
        title: "Éxito",
        description: "Venta registrada correctamente",
      });

      onClose();
    } catch (error: any) {
      console.error('Error creating sale:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Error al registrar la venta",
      });
    } finally {
      setIsConfirmingSale(false);
    }
  };

  if (loading || loadingClients) {
    return(
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row">
      <div className="w-full lg:w-3/4 p-4 lg:p-8 bg-white rounded-lg h-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold capitalize">Nueva venta</h1>
          {locationInfo && (
            <div className="flex items-center rounded-full bg-blue-50 px-3 py-1">
              <Building className="w-4 h-4 text-blue-700 mr-2" />
              <span className="text-blue-700 font-medium">{locationInfo.name}</span>
            </div>
          )}
        </div>
        <div className="mb-6 flex gap-4">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
          
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
        </div>
        {products.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">No hay productos disponibles en esta sucursal</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-gray-500">No se encontraron productos</p>
          </div>
        ) : (
          Object.entries(variantsByProduct)
            .filter(([productId]) => filteredProducts.some(p => p.id === Number(productId)))
            .map(([productId, variants]) => {
              const product = products.find(p => p.id === Number(productId));
              if (!product) return null;
              
              const characteristicNames = variants.length > 0 
                ? getCharacteristicNames(variants[0].variant_id)
                : [];
              
              const selection = productSelections[Number(productId)] || {
                attributes: {},
                variantId: '',
                validation: { isValid: true, message: '' }
              };
              
              const selectedVariant = variants.find(v => v.variant_id === Number(selection.variantId));
              const selectedStockItem = selectedVariant
                ? stockItems.find(
                    item => item.variant_id === selectedVariant.variant_id && item.location === locationId
                  )
                : null;
              const selectedStock = selectedStockItem ? selectedStockItem.stock : 0;
              const selectedDisplayPrice = selectedStockItem ? selectedStockItem.price : null;

              return (
                <div key={productId} className="mb-8">
                  <Card className="border border-gray-300 rounded-lg w-full hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold capitalize">{product.name}</h2>
                        {Object.keys(selection.attributes).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleClearAllAttributes(Number(productId))}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Limpiar selecciones
                          </Button>
                        )}
                      </div>
                      
                      {/* Attribute dropdowns */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {characteristicNames.map((characteristicName, index) => {
                          const isDisabled = index > 0 && !characteristicNames.slice(0, index).every(
                            name => selection.attributes[name]
                          );
                          
                          return (
                            <div key={characteristicName} className="flex flex-col">
                              <label className="text-sm font-medium text-gray-700 mb-1">
                                {characteristicName}
                              </label>
                              <Select
                                value={selection.attributes[characteristicName] || ""}
                                onValueChange={(value) => handleAttributeChange(Number(productId), characteristicName, value)}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className={`w-full ${
                                  !selection.validation.isValid && selection.attributes[characteristicName] 
                                    ? 'border-red-500' 
                                    : isDisabled
                                    ? 'bg-gray-100'
                                    : ''
                                }`}>
                                  <SelectValue placeholder={
                                    isDisabled 
                                      ? `Selecciona ${characteristicNames[index - 1]} primero`
                                      : `Seleccionar ${characteristicName}`
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  {selection.attributes[characteristicName] && (
                                    <SelectItem value="__CLEAR__">
                                      <span className="text-gray-500">Limpiar selección</span>
                                    </SelectItem>
                                  )}
                                  {getAvailableOptions(Number(productId), characteristicName, selection.attributes).map(option => (
                                    <SelectItem key={option} value={option}>
                                      {option}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>

                      {/* Validation message */}
                      {!selection.validation.isValid && (
                        <div className="text-sm text-red-500 mb-4">
                          {selection.validation.message}
                        </div>
                      )}

                      {/* Product details and add to cart section */}
                      <div className="mt-4 space-y-4">
                        {/* Stock status */}
                        <div className={`text-sm ${
                          selectedVariant
                            ? selectedStock > 5
                              ? 'text-green-600'
                              : selectedStock > 0
                              ? 'text-orange-500'
                              : 'text-red-500'
                            : 'text-gray-400'
                        }`}>
                          {selectedVariant
                            ? selectedStock > 0
                              ? `Stock disponible: ${selectedStock} piezas`
                              : 'Sin stock'
                            : selection.validation.message}
                        </div>

                        {/* Price display */}
                        {selectedVariant && selectedDisplayPrice !== null && (
                          <div className="text-lg font-semibold text-gray-900">
                            MXN ${selectedDisplayPrice}
                          </div>
                        )}

                        {/* Quantity selector and add button */}
                        <div className="flex gap-4 items-center">
                          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden bg-white">
                            <button
                              onClick={() => selectedVariant && disminuir(selectedVariant.variant_id)}
                              className="p-2 text-gray-700 hover:bg-gray-200 transition"
                              disabled={!selectedVariant || selectedStock <= 0}
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={
                                selectedVariant
                                  ? selectedStock <= 0
                                    ? 0
                                    : cantidades[selectedVariant.variant_id] || 0
                                  : ''
                              }
                              onChange={(e) => {
                                if (!selectedVariant) return;
                                let valor = Number(e.target.value);
                                if (valor < 0) valor = 0;
                                if (valor > selectedStock) valor = selectedStock;
                                setCantidades((prev) => ({ ...prev, [selectedVariant.variant_id]: valor }));
                              }}
                              className="w-16 text-center outline-none bg-transparent"
                              disabled={!selectedVariant || selectedStock <= 0}
                              style={{ MozAppearance: 'textfield', appearance: 'textfield' }}
                            />
                            <button
                              onClick={() => selectedVariant && aumentar(selectedVariant.variant_id)}
                              className="p-2 text-gray-700 hover:bg-gray-200 transition"
                              disabled={
                                !selectedVariant ||
                                selectedStock <= 0 ||
                                (cantidades[selectedVariant?.variant_id] || 0) >= selectedStock
                              }
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          <button
                            onClick={() => agregarAlCarrito(Number(productId))}
                            className={`flex-1 h-10 rounded-md ${
                              !selectedVariant || selectedStock <= 0 || selectedDisplayPrice === null
                                ? 'bg-gray-300 cursor-not-allowed'
                                : 'bg-[#1366D9] hover:bg-[#0d4ea6]'
                            } text-white text-sm font-semibold transition-colors`}
                            disabled={!selectedVariant || selectedStock <= 0 || selectedDisplayPrice === null}
                          >
                            {!selectedVariant
                              ? selection.validation.message
                              : selectedStock <= 0
                              ? 'Sin stock'
                              : selectedDisplayPrice === null
                              ? 'Precio no disp.'
                              : 'Agregar al carrito'}
                          </button>
                        </div>



    
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
        )}
        <div className="text-center mt-10">
          <Button type="button" variant="outline" onClick={onClose} className="w-40 h-10">
            Cancelar 
          </Button>
        </div>
      </div>
      <div className="w-full lg:w-1/4 p-4 bg-white lg:mx-4 mt-4 lg:mt-0 h-full rounded-lg shadow-sm">
        <div className="sticky top-4">
          <h1 className="text-lg font-semibold capitalize mb-4">Resumen de venta</h1>
          
          {/* Client selection */}
          <div className="mb-6">
            
            <label htmlFor="client" className="text-sm font-medium mb-2 flex items-center">
              <Users className="w-4 h-4 mr-1 text-gray-500" />
              Cliente
            </label>
            
            {clients.length > 0 ? (
              <Select 
                value={selectedClientId?.toString() || ""} 
                onValueChange={(value) => {
                  const clientId = Number(value);
                  setSelectedClientId(clientId);
                  const selectedClient = clients.find(c => c.id === clientId);
                  if (selectedClient) {
                    setDescuento(selectedClient.discount || 0);
                    setInputDescuento(selectedClient.discount?.toString() || "0");
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem 
                      key={client.id} 
                      value={client.id.toString()}
                      className={client.is_default ? "font-semibold" : ""}
                    >
                      {client.name} {client.discount > 0 ? `(${client.discount}% desc.)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-gray-500">No hay clientes disponibles</p>
            )}
          </div>

            {/* Payment method selection */}
            <div className="mb-6">
              <label htmlFor="paymentMethod" className="text-sm font-medium mb-2 flex items-center">
                💳 Método de pago
              </label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Pago con tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

          {/* Cart items */}
          {ventaItems.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
              <ShoppingCart className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No hay productos agregados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cart items list */}
              <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                {ventaItems.map(item => (
                  <div key={item.id} className="flex flex-col bg-gray-50 rounded-lg p-3">
                    {/* Product header with delete button */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex flex-col">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.type.join(' - ')}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-600">
                              Cantidad: {item.quantity}
                            </span>
                            <span className="text-xs text-gray-600">
                              • ${item.unitPrice.toFixed(2)} c/u
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <button 
                          onClick={() => eliminarDelCarrito(item.variant_id)}
                          className="p-1 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                        <p className="text-sm font-medium text-gray-900">
                          ${(item.unitPrice * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary totals */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">MXN ${subtotal.toFixed(2)}</span>
                </div>
                
                {(descuento > 0 || isAdmin) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Descuento:</span>
                    <span className="font-medium">% {descuento}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                  <span>Total:</span>
                  <span className="text-[#1366D9]">
                    MXN ${(total < 0 ? 0 : total).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Discount input for admin */}
              {isAdmin && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <label htmlFor="descuento" className="block text-sm font-medium mb-2">
                    Descuento {selectedClientId && clients.find(c => c.id === selectedClientId)?.discount ? 
                      `(Descuento del cliente: ${clients.find(c => c.id === selectedClientId)?.discount}%)` : ''}
                  </label>
                  <div className="flex gap-2">
                    <Input 
                      type="number"
                      value={inputDescuento}
                      onChange={(e) => setInputDescuento(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      type="submit"
                      onClick={() => setDescuento(Number(inputDescuento))}
                      className="whitespace-nowrap"
                    > 
                      Aplicar
                    </Button>
                  </div>
                </div>
              )}

              {/* Client discount info for employees */}
              {!isAdmin && selectedClientId && (() => {
                const clientDiscount = clients.find(c => c.id === selectedClientId)?.discount || 0;
                return clientDiscount > 0 ? (
                  <div className="mt-2 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg">
                    Descuento del cliente aplicado: {clientDiscount}%
                  </div>
                ) : null;
              })()}

              {/* Confirm sale button */}
              <button 
                className="w-full h-12 mt-6 rounded-md bg-[#1366D9] text-white text-sm font-semibold shadow-sm hover:bg-[#0d4ea6] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={handleConfirmSale}
                disabled={ventaItems.length === 0 || isConfirmingSale}
              >
                {isConfirmingSale ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Procesando venta...
                  </>
                ) : (
                  'Confirmar venta'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add the confirmation dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Confirmar Venta
            </DialogTitle>
            <DialogDescription>
              Por favor, revisa los detalles de la venta antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Client Info */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Cliente:</p>
              <p className="font-bold text-lg text-blue-900">
                {clients.find(c => c.id === selectedClientId)?.name || 'Cliente no seleccionado'}
              </p>
            </div>

            {/* Payment Method Info */}
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">Método de pago:</p>
              <p className="font-bold text-base text-blue-900 capitalize">{paymentMethod}</p>
            </div>

            {/* Sale Summary */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Resumen de la venta:</p>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {ventaItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-gray-600 text-xs">
                        {item.quantity} x ${item.unitPrice.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-medium">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">MXN ${subtotal.toFixed(2)}</span>
              </div>
              {descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Descuento ({descuento}%):</span>
                  <span className="font-medium">-MXN ${descuentoAplicado.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-[#1366D9]">
                  MXN ${(total < 0 ? 0 : total).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarVenta}
              className="flex-1 sm:flex-none bg-[#1366D9] hover:bg-[#0d4ea6]"
              disabled={isConfirmingSale}
            >
              {isConfirmingSale ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Procesando...
                </>
              ) : (
                'Confirmar y procesar venta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutVenta;