'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Loader2, Building } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AggregatedProductItem {
  productId: number;
  productName: string;
  totalQuantity: number;
  locationName: string;
}

interface Location {
  id: number;
  name: string;
  location: string;
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

const ProductosDisponiblesContent: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locationName, setLocationName] = useState<string>('');
  const [rows, setRows] = useState<SupabaseRow[]>([]);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);

  // Cargar sucursales al montar el componente
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoadingLocations(true);
        const userId = await getUserId();
        if (!userId) throw new Error('Usuario no autenticado.');

        const { data, error: locError } = await supabase
          .from('locations')
          .select('id, name, location')
          .eq('user_id', userId)
          .order('name');

        if (locError) throw locError;
        setLocations(data || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar las sucursales');
      } finally {
        setLoadingLocations(false);
      }
    };

    fetchLocations();
  }, []);

  // Cargar productos cuando se selecciona una sucursal
  useEffect(() => {
    const fetchProducts = async () => {
      if (!selectedLocationId) {
        setRows([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const userId = await getUserId();
        if (!userId) throw new Error('Usuario no autenticado.');

        // Obtener información de la sucursal
        const { data: loc, error: locErr } = await supabase
          .from('locations')
          .select('id, name')
          .eq('id', selectedLocationId)
          .eq('user_id', userId)
          .single();
        if (locErr) throw locErr;
        setLocationName(loc?.name ?? '');

        // Obtener productos de la sucursal
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
          .eq('location', selectedLocationId)
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

    fetchProducts();
  }, [selectedLocationId]);

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

  if (loadingLocations) {
    return (
      <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando sucursales…
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Productos Disponibles</h1>
        <p className="text-sm text-gray-500 mb-6">
          Selecciona una sucursal para ver los productos disponibles
        </p>

        {/* Selector de sucursal */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sucursal
          </label>
          <Select
            value={selectedLocationId?.toString() || ''}
            onValueChange={(value) => setSelectedLocationId(Number(value))}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecciona una sucursal">
                {selectedLocationId && (
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span>
                      {locations.find((loc) => loc.id === selectedLocationId)?.name}
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <div>
                      <div className="font-medium">{location.name}</div>
                      <div className="text-xs text-gray-500">{location.location}</div>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {!selectedLocationId && !loading && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          Por favor, selecciona una sucursal para ver los productos disponibles.
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando productos…
        </div>
      )}

      {/* Lista de productos */}
      {selectedLocationId && !loading && !error && (
        <>
          {aggregated.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay productos disponibles en esta sucursal.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Se encontraron <span className="font-semibold">{aggregated.length}</span> productos en{' '}
                  <span className="font-semibold">{locationName}</span>
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {aggregated.map((item) => (
                  <Card
                    key={item.productId}
                    className="p-5 hover:shadow-md transition-shadow duration-200 bg-white"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 text-gray-800 font-medium">
                          <Package className="h-5 w-5 text-violet-600 flex-shrink-0" />
                          <span className="break-words">{item.productName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="break-words">{item.locationName}</span>
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {item.totalQuantity}
                        </div>
                        <div className="text-xs text-gray-500">unidades</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
};

export default ProductosDisponiblesContent;

