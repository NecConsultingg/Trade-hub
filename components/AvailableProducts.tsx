'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, MapPin, ArrowLeft, Loader2 } from 'lucide-react';

interface AggregatedProductItem {
  productId: number;
  productName: string;
  totalQuantity: number;
  locationName: string;
}

type SupabaseRow = {
  id: number;
  stock: number;
  locations: { name: string } | null;
  productVariants: {
    product_id: number;
    products: { name: string } | null;
  } | null;
};

const AvailableProducts: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const locationId = Number(Array.isArray(params.id) ? params.id[0] : params.id);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [rows, setRows] = useState<SupabaseRow[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = await getUserId();
        if (!userId) throw new Error('Usuario no autenticado.');

        // Load location info for header
        const { data: loc, error: locErr } = await supabase
          .from('locations')
          .select('id, name')
          .eq('id', locationId)
          .eq('user_id', userId)
          .single();
        if (locErr) throw locErr;
        setLocationName(loc?.name ?? '');

        // Fetch all stock rows for this location with product linkage
        const { data, error: stockErr } = await supabase
          .from('stock')
          .select(`
            id,
            stock,
            locations ( name ),
            productVariants (
              product_id,
              products ( name )
            )
          `)
          .eq('user_id', userId)
          .eq('location', locationId)
          .returns<SupabaseRow[]>();
        if (stockErr) throw stockErr;

        setRows(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar los productos disponibles');
      } finally {
        setLoading(false);
      }
    };

    if (!Number.isNaN(locationId)) {
      fetchData();
    }
  }, [locationId]);

  const aggregated = useMemo<AggregatedProductItem[]>(() => {
    const byProduct = new Map<number, AggregatedProductItem>();
    for (const r of rows) {
      const productId = r.productVariants?.product_id ?? 0;
      const productName = r.productVariants?.products?.name ?? '—';
      const locName = r.locations?.name ?? '';
      if (!productId) continue;

      const existing = byProduct.get(productId);
      if (existing) {
        existing.totalQuantity += r.stock ?? 0;
      } else {
        byProduct.set(productId, {
          productId,
          productName,
          totalQuantity: r.stock ?? 0,
          locationName: locName,
        });
      }
    }
    return Array.from(byProduct.values()).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [rows]);

  if (loading) {
    return (
      <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
        <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
        <div className="mb-4">
          <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Atrás
          </Button>
        </div>
        <div className="text-red-600">{error}</div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Productos Disponibles</h1>
          <p className="text-sm text-gray-500">Sucursal: {locationName}</p>
        </div>
        <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Atrás
        </Button>
      </div>

      {aggregated.length === 0 ? (
        <div className="text-gray-600">No hay productos disponibles en esta sucursal.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aggregated.map(item => (
            <Card
              key={item.productId}
              className="p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => router.push(`/dashboard/sucursales/${locationId}/disponibles/${item.productId}`)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-800 font-medium">
                    <Package className="h-4 w-4 text-violet-600" />
                    {item.productName}
                  </div>
                  <div className="flex items-center gap-2 text-gray-600 text-sm">
                    <MapPin className="h-4 w-4" />
                    {item.locationName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{item.totalQuantity}</div>
                  <div className="text-xs text-gray-500">unidades</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
};

export default AvailableProducts;


