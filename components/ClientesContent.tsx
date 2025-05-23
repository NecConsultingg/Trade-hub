'use client'
import React, { useState, useEffect } from 'react';
import { Eye, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useRouter } from 'next/navigation';

interface Client {
  id: number;
  name: string;
  phone: string;
  num_compras: number;
  total_compras: number;
  discount: number;
  saldo: number;
}

const ClientesContent = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter(); 
  const itemsPerPage = 6;

  const totalPages = Math.ceil(clients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = clients.slice(startIndex, startIndex + itemsPerPage);

  const loadClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Usuario no autenticado.');

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, num_compras, total_compras, discount, saldo')
        .eq('user_id', userId);

      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  if (loading) return (
    <main className="flex-1 flex justify-center items-center h-screen bg-[#f5f5f5]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
    </main>
  );

  if (error) return (
    <main className="flex-1 flex justify-center items-center h-screen bg-[#f5f5f5]">
      <div className="text-red-500">Error al cargar clientes: {error}</div>
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="flex gap-4 mb-6">
          <button
            onClick={() => router.push("/dashboard/clientes/agregarcliente")}
            className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'
          >
            <Plus className="w-4 h-4" />
            Agregar Cliente
          </button>
         </div>
      <div className="bg-white rounded-lg border border-[#e6e6e6] shadow-sm mt-8">
        <div className="px-6 py-4 border-b border-[#e6e6e6] flex justify-between items-center">
          <h2 className="text-lg font-semibold capitalize">Lista de Clientes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#e6e6e6]">
            <thead>
              <tr className="bg-[#f5f5f5] text-center">
                {['Cliente', 'Teléfono', 'Descuento', 'Saldo', 'Compras', 'Total', 'Acciones'].map(header => (
                  <th key={header} className="px-3 py-3 text-xs font-medium text-[#667085] uppercase tracking-wider">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6e6e6] text-center">
              {currentData.map(client => (
                <tr key={client.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1b1f26] capitalize">
                    {client.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    {client.phone}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    {client.discount}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    ${parseFloat(client.saldo.toString()).toLocaleString('es-MX')} MXN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    {client.num_compras}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#667085]">
                    ${parseFloat(client.total_compras.toString()).toLocaleString('es-MX')} MXN
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => router.push(`/dashboard/clientes/${client.id}`)}
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

export default ClientesContent;

