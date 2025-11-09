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

  const itemsPerPage = 6;

  const [rawSearch, setRawSearch] = useState('');
    useEffect(() => {
      const t = setTimeout(() => setSearchTerm(rawSearch), 250);
      return () => clearTimeout(t);
    }, [rawSearch]);

  const normalize = (s?: string) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  
   // Filtro + búsqueda antes de paginar
  const filtered = inventory.filter((item) => {
    const term = normalize(searchTerm);
    if (!term) {
      // sin término, solo aplica filtro de stock
      return filterStatus === 'Todos' ? true : (item.total_stock ?? 0) > 0;
    }

    const hayNombre = normalize(item.product_name).includes(term);
    const hayAttr = normalize(item.attributes).includes(term);

    const matchesSearch = hayNombre || hayAttr;
    const matchesStock =
      filterStatus === 'Todos' ? true : (item.total_stock ?? 0) > 0;

    return matchesSearch && matchesStock;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const pageData = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  console.log('Datos de la página actual:', pageData);

    useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchTerm]);

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
            onClick={() => router.push('/dashboard/inventario/agregarinventario')}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Plus className="inline-block w-4 h-4 mr-1" />
            Agregar Inventario
          </button>
          <button
            onClick={() => router.push('/dashboard/inventario/productosdisponibles')}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Package className="w-4 h-4" />
            Productos Disponibles
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
      <div>
        {/* Barra de búsqueda */}
      <input
          type="text"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="px-6 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm mt-8">
        <div className="px-6 py-4 border-b border-[#e6e6e6] flex justify-between items-center">
          <h2 className="text-lg font-semibold capitalize">Lista de Inventario</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[28%]" /> {/* Producto */}
              <col className="w-[54%]" /> {/* Atributos (la grande) */}
              <col className="w-[10%]" /> {/* Stock */}
              <col className="w-[8%]"  /> {/* Ver más */}
            </colgroup>

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
              {pageData.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-sm text-[#667085]">
                  No hay resultados para “{searchTerm}”.
                </td>
              </tr>
            ) : (
              pageData.map((item) => {
                const to = `/dashboard/inventario/${item.product_id}`
                return (
                  <tr
                    key={item.product_id}
                    onClick={() => router.push(to)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(to)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Abrir ${item.product_name}`}
                    title="Ver detalles"
                    className="cursor-pointer hover:bg-blue-50 focus:bg-gray-100 focus:outline-none transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-[#667085] truncate">
                      <span className="inline-block max-w-full" title={item.product_name}>
                        {item.product_name}
                      </span>
                    </td>

                    <td
                      className="px-6 py-4 text-sm text-[#667085] whitespace-normal break-words text-center"
                      title={item.attributes}
                    >
                      <div className="max-h-24 overflow-auto pr-1">
                        {item.attributes || '—'}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-[#667085]">
                      {item.total_stock}
                    </td>

                    {/* Ícono decorativo (no botón) */}
                    <td className="px-6 py-4 text-sm">
                      <Eye className="w-4 h-4 mx-auto opacity-70" aria-hidden="true" />
                    </td>
                  </tr>
                )
              })
            )}

            </tbody>
          </table>

          {/* Paginación */}
          <div className="px-6 py-4 border-t border-[#e6e6e6] flex justify-between items-center">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`border-2 px-3 py-2 flex items-center gap-2 rounded-sm ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <span className="text-xs font-medium text-[#667085] uppercase tracking-wider">
              Página {Math.min(currentPage, totalPages)} de {totalPages}
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