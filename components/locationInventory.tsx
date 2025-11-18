'use client';

import React, { useState, useEffect } from 'react';
import { Eye, SlidersHorizontal, ChevronLeft, ChevronRight, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';


interface InventoryItem {
  id: number; 
  variant_id: number;
  product_id: number;
  productName: string;
  name: string;
  quantity: number;
  added_at: string;
  entryDate: string;
  ubicacion_nombre: string;
  caracteristicas: string[];
  unitPrice: number;
  image: string | null;
  attributes: string[];
}

type SupabaseStockItem = {
  id: number;
  variant_id: number;
  stock: number;
  added_at: string;
  locations: { name: string } | null;
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

const LocationInventory: React.FC = () => {
  const router = useRouter();
  const { id } = useParams();
  const locationId = Number(id);
  
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [errorInventory, setErrorInventory] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [totalItemsCount, setTotalItemsCount] = useState(0);

  const itemsPerPage = 5;
  const filteredData = inventory.filter(stock => filterStatus === "Todos");
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredData.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  }

  const fetchLocationName = async () => {
    try {
      const userId = await getUserId();
      if (!userId) throw new Error("Usuario no autenticado");
      
      const { data, error } = await supabase
        .from('locations')
        .select('name')
        .eq('id', locationId)
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      if (data) setLocationName(data.name);
    } catch (error) {
      console.error("Error fetching location name:", error);
    }
  };

  const loadLocationInventory = async () => {
    setLoadingInventory(true);
    setErrorInventory(null);
    
    try {
      const userId = await getUserId();
      if (!userId) throw new Error("Usuario no autenticado.");

      const { data, error } = await supabase
        .from('stock')
        .select(`
          id,
          variant_id,
          stock,
          added_at,
          locations ( name ),
          productVariants (
            product_id,
            products (
              name,
              product_characteristics ( name, characteristics_id )
            ),
            optionVariants (
              option_id,
              characteristics_options ( values, characteristics_id )
            )
          )
        `)
        .eq('user_id', userId)
        .eq('location', locationId)
        .returns<SupabaseStockItem[]>();

      if (error) {
        console.error("Error fetching location inventory:", error);
        setErrorInventory(error.message);
        setInventory([]);
        return;
      }

      if (data) {
        const formattedInventory: InventoryItem[] = data.map((item): InventoryItem | null => {
          const productVariant = item.productVariants;
          const productInfo = productVariant?.products;
          const locationInfo = item.locations;

          const productName = productInfo?.name ?? 'Nombre no encontrado';
          const locationName = locationInfo?.name ?? 'Ubicación no encontrada';
          const productCharacteristics = productInfo?.product_characteristics ?? [];
          const optionVariants = productVariant?.optionVariants ?? [];

          const characteristics = optionVariants.map(ov => {
            const charOption = ov.characteristics_options;
            if (!charOption) return 'Opción inválida';

            const matchingCharacteristic = productCharacteristics.find(
              pc => pc.characteristics_id === charOption.characteristics_id
            );
            const characteristicName = matchingCharacteristic?.name ?? 'Característica';
            return `${characteristicName}: ${charOption.values}`;
          });

          if (productName === 'Nombre no encontrado') {
            // Product name not found for this inventory item
          }

          return {
            id: item.id,
            variant_id: item.variant_id,
            product_id: productVariant?.product_id ?? 0,
            productName: productName,
            name: productName,
            quantity: item.stock,
            added_at: item.added_at,
            entryDate: new Date(item.added_at).toLocaleDateString(),
            ubicacion_nombre: locationName,
            caracteristicas: characteristics,
            unitPrice: 0,
            image: null,
            attributes: [],
          };
        }).filter((item): item is InventoryItem => item !== null);

        setInventory(formattedInventory);
        setTotalItemsCount(formattedInventory.reduce((sum, item) => sum + item.quantity, 0));
      }
    } catch (error: any) {
      console.error("Error loading location inventory:", error);
      setErrorInventory(error.message);
      setInventory([]);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    if (locationId) {
      fetchLocationName();
      loadLocationInventory();
    }
  }, [locationId]);

  if (loadingInventory) {
    return (
      <main className="flex-1 flex justify-center items-center h-screen bg-[#f5f5f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
      </main>
    );
  }

  if (errorInventory) {
    return (
      <main className="flex-1 flex justify-center items-center h-screen bg-[#f5f5f5]">
         <div className="text-red-500">Error al cargar el inventario: {errorInventory}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-lg font-semibold capitalize">Inventario {locationName}</h1>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard/inventario')}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Eye className="w-4 h-4 mx-auto" />
            Ver todo inventario
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white rounded-lg shadow p-10 mb-12">
        <div className="w-full">
          <table className='table-fixed w-full'>
            <tbody>
              <tr>
                <td><h2 className="whitespace-nowrap text-base font-bold uppercase text-violet-300">Productos en Sucursal</h2></td>
              </tr>
              <tr>
                <td>{inventory.length}</td>
                <td></td>
              </tr>
              <tr className='text-neutral-400 text-sm'>
                <td>Cantidad de productos</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className='w-full'>
          <table className='table-fixed w-full'>
            <tbody>
              <tr>
                <td><h2 className="text-base font-bold uppercase text-orange-300">Inventario Total en Sucursal</h2></td>
              </tr>
              <tr>
                <td>{totalItemsCount}</td>
                <td></td>
              </tr>
              <tr className='text-neutral-400 text-sm'>
                <td>Cantidad total de artículos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm mt-8">
        <div className="px-6 py-4 border-b border-[#e6e6e6] flex justify-between items-center">
          <h2 className="text-lg font-medium text-[#1b1f26] capitalize">Inventario {locationName}</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f5f5f5] text-center">
                {["Producto", "Características", "Cantidad", "Fecha de entrada", "Ver más"].map((header) => (
                  <th key={header} className="px-3 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6e6] text-center">
              {currentData.length > 0 ? (
                currentData.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1b1f26]  capitalize">{item.productName}</td>
                    <td className="px-6 py-4 text-sm text-[#667085] capitalize">{item.caracteristicas.join(', ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">{item.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">{item.entryDate}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        className="text-indigo-600 hover:text-indigo-900"
                        onClick={() => {
                          if (item.product_id && item.product_id > 0) {
                            router.push(`/dashboard/sucursales/${locationId}/inventario/${item.product_id}`);
                          } else {
                            console.error('Product ID is invalid:', item.product_id);
                          }
                        }}
                        disabled={!item.product_id || item.product_id === 0}
                      >
                        <Eye className="w-4 h-4 mx-auto" />
                      </button>
                      
                    </td>
                  </tr>
                  
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-[#667085]">
                    No hay productos en esta sucursal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {currentData.length > 0 && (
            <div className="px-6 py-4 border-t border-[#e6e6e6] flex justify-between items-center">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className={`border-2 px-3 py-2 flex items-center gap-2 rounded-sm ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-xs font-medium text-[#667085] uppercase tracking-wider">
                Página {currentPage} de {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className={`border-2 px-3 py-2 flex items-center gap-2 rounded-sm ${currentPage === totalPages || totalPages === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      <div className='text-center m-9'>
        <Button 
          variant="outline" 
          onClick={() => router.push(`/dashboard/sucursales/${locationId}`)}
        >
          Cerrar
        </Button>
      </div>
</main>
  );
};

export default LocationInventory;