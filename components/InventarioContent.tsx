import React, { useState, useEffect } from 'react';
import {
  Eye,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Package,
  AlertCircle,
  TrendingUp,
  Edit
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useRouter } from 'next/navigation';
import LocationSelector from '@/components/locationSelection';

interface InventoryItem {
  id: number;
  variant_id: number;
  productName: string;
  quantity: number;
  entryDate: string;
  ubicacion_nombre: string;
  caracteristicas: string[];
  unitPrice?: number;
  imageUrl?: string | null;
  attributes?: any[];
}

interface ProductsGeneralInfo{
  product_id: number;
  product_name: string;
  attributes: string;
  total_stock: number;
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

// Función para obtener los datos de los productos para la tabla
async function fetchProductsGeneralInfo(userId: number) {
  const { data, error } = await supabase.rpc('get_products_general_info', { user_id_param: userId });

  if (error) {
    console.error('Error al obtener productos:', error);
    return [];
  }
  console.log('Datos de productos obtenidos:', data);
  return data as ProductsGeneralInfo[];
}

const InventarioContent: React.FC = () => {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'ConStock'>('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inventory, setInventory] = useState<ProductsGeneralInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showLocationSelector, setShowLocationSelector] = useState(false);

  const itemsPerPage = 6;

    // const ProductswithStock = inventory.filter(item =>
    //   (filterStatus === 'Todos' || item.total_stock > 0) &&
    //   item.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    // );

  const totalPages = Math.ceil(inventory.length / itemsPerPage);
  const pageData = inventory.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  console.log('Datos de la página actual:', pageData);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  const toggleDropdown = () => {
    setIsDropdownOpen(open => !open);
  };

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado.');

      const formatted = await fetchProductsGeneralInfo(Number(userId));

      console.log('Datos de inventario formateados:', formatted);
      setInventory(formatted);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

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

  const handleOpenAvailableProducts = () => {
    setShowLocationSelector(true);
  };

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="flex justify-between gap-4 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard/inventario/crearproducto')}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Plus className="w-4 h-4" />
            Crear producto
          </button>
          <button
            onClick={handleOpenAvailableProducts}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Plus className="inline-block w-4 h-4 mr-1" />
            Agregar Inventario
          </button>
        </div>
        <button
          onClick={() => router.push('/dashboard/inventario/editarproductos')}
          className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
        >
          <Edit className="w-4 h-4" />
          Editar Productos
        </button>
      </div>

      {showLocationSelector && (
        <LocationSelector
          isOpen={true}
          onClose={() => setShowLocationSelector(false)}
          onLocationSelected={() => { /* keep for compatibility, we route on continue */ }}
          onContinue={(locationId) => {
            setShowLocationSelector(false);
            router.push(`/dashboard/sucursales/${locationId}/disponibles`);
          }}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Total Inventory Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Inventario Total</h2>
            <Package className="w-6 h-6 text-violet-500" />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-gray-900">
              {inventory.reduce((sum, item) => sum + Number(item.total_stock || 0), 0)}
            </span>
            <span className="ml-2 text-sm text-gray-500">unidades</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">Total de productos en inventario</p>
        </div>

        {/* Products with Stock Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Productos con Stock</h2>
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-gray-900">
              {inventory.filter(item => item.total_stock > 0).length}
            </span>
            <span className="ml-2 text-sm text-gray-500">productos</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">Productos disponibles actualmente</p>
        </div>

        {/* Products without Stock Card */}

        <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md border border-[#e6e6e6]  transition-shadow duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold capitalize">Productos sin Stock</h2>
            <TrendingUp className="w-6 h-6 text-orange-500" />
          </div>
          <div className="flex items-baseline">
            <span className="text-3xl font-bold text-gray-900">
              {inventory.filter(item => item.total_stock === 0).length}
            </span>
            <span className="ml-2 text-sm text-gray-500">productos</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">Productos que necesitan reabastecimiento</p>
        </div>
      </div>

      <input
  type="text"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Buscar producto..."
  className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
/>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm mt-8">
        <div className="px-6 py-4 border-b border-[#e6e6e6] flex justify-between items-center">
          <h2 className="text-lg font-semibold capitalize">Lista de Inventario</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
            <tr className="bg-[#f5f5f5] text-center">
              {['Producto', 'Atributos', 'Stock', 'Ver más'].map(h => (
                <th key={h} className="px-3 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e6e6e6] text-center">
            {pageData.map(item => (
              <tr key={item.product_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                  {item.product_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                  {item.attributes}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                  {item.total_stock}
                </td>
  
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => router.push(`/dashboard/inventario/${item.product_id}`)}
                    className="text-indigo-600 hover:text-indigo-900"
                  >
                    <Eye className="w-4 h-4 mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-4 border-t border-[#e6e6e6] flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`border-2 px-3 py-2 flex items-center gap-2 rounded-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <span className="text-xs font-medium text-[#667085] uppercase tracking-wider">
                Página {currentPage} de {totalPages}
              </span> 
              <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className={`border-2 px-3 py-2 flex items-center gap-2 rounded-sm ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default InventarioContent;