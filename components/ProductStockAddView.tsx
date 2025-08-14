'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ArrowLeft, Package } from 'lucide-react';
import AddProductToStock from '@/components/AddProductToStock';

const ProductStockAddView: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const locationId = Number(Array.isArray(params.id) ? params.id[0] : params.id);
  const productId = Number(Array.isArray(params.productId) ? params.productId[0] : params.productId);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>('');
  const [locationName, setLocationName] = useState<string>('');
  const [characteristicNameById, setCharacteristicNameById] = useState<Record<number, string>>({});
  const [optionValuesByCharId, setOptionValuesByCharId] = useState<Record<number, Set<string>>>({});
  const [stockByBranch, setStockByBranch] = useState<Array<{ locationId: number; locationName: string; stock: number }>>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const userId = await getUserId();
        if (!userId) throw new Error('Usuario no autenticado.');

        // 1) Product name
        const { data: prod, error: prodErr } = await supabase
          .from('products')
          .select('name')
          .eq('id', productId)
          .eq('user_id', userId)
          .single();
        if (prodErr) throw prodErr;
        setProductName(prod?.name ?? '');

        // 2) Location name (for context)
        const { data: loc, error: locErr } = await supabase
          .from('locations')
          .select('name')
          .eq('id', locationId)
          .eq('user_id', userId)
          .single();
        if (locErr) throw locErr;
        setLocationName(loc?.name ?? '');

        // 3) Load product characteristics names
        const { data: chars, error: charsErr } = await supabase
          .from('product_characteristics')
          .select('characteristics_id, name')
          .eq('product_id', productId);
        if (charsErr) throw charsErr;
        const nameById: Record<number, string> = {};
        for (const c of chars || []) nameById[c.characteristics_id] = c.name;
        setCharacteristicNameById(nameById);

        // 4) Load product variants with option values to derive available values per characteristic
        const { data: variants, error: variantsErr } = await supabase
          .from('productVariants')
          .select(`
            variant_id,
            optionVariants (
              characteristics_options ( characteristics_id, values )
            )
          `)
          .eq('product_id', productId);
        if (variantsErr) throw variantsErr;

        const optionSets: Record<number, Set<string>> = {};
        const variantIds: number[] = [];
        for (const v of variants || []) {
          if (v?.variant_id) variantIds.push(v.variant_id);
          const opts = v?.optionVariants || [];
          for (const ov of opts) {
            const cc = ov?.characteristics_options;
            if (!cc) continue;
            const cid = cc.characteristics_id as number;
            if (!optionSets[cid]) optionSets[cid] = new Set<string>();
            if (cc.values) optionSets[cid].add(cc.values);
          }
        }
        setOptionValuesByCharId(optionSets);

        // 5) Stock aggregated by branch for this product (via its variants)
        let stocks: Array<{ location: number; stock: number }> = [];
        if (variantIds.length > 0) {
          const { data: stockRows, error: stockErr } = await supabase
            .from('stock')
            .select('location, stock')
            .in('variant_id', variantIds)
            .eq('user_id', userId);
          if (stockErr) throw stockErr;
          const byLoc = new Map<number, number>();
          for (const r of stockRows || []) {
            const locId = r.location as number;
            const qty = r.stock as number;
            byLoc.set(locId, (byLoc.get(locId) || 0) + (qty || 0));
          }
          stocks = Array.from(byLoc.entries()).map(([location, stock]) => ({ location, stock }));
        }

        // 6) Resolve branch names for aggregated stock
        const locationIds = stocks.map(s => s.location);
        let stockWithNames: Array<{ locationId: number; locationName: string; stock: number }> = [];
        if (locationIds.length > 0) {
          const { data: locs, error: locsErr } = await supabase
            .from('locations')
            .select('id, name')
            .in('id', locationIds)
            .eq('user_id', userId);
          if (locsErr) throw locsErr;
          const nameByLocationId = new Map<number, string>();
          for (const l of locs || []) nameByLocationId.set(l.id, l.name);
          stockWithNames = stocks.map(s => ({
            locationId: s.location,
            locationName: nameByLocationId.get(s.location) || '—',
            stock: s.stock,
          }));
        }
        setStockByBranch(stockWithNames);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Error al cargar información.');
      } finally {
        setLoading(false);
      }
    };
    if (!Number.isNaN(locationId) && !Number.isNaN(productId)) load();
  }, [locationId, productId]);

  const characteristicValuesByName = useMemo(() => {
    const mapByName: Record<string, string[]> = {};
    for (const [idStr, set] of Object.entries(optionValuesByCharId)) {
      const id = Number(idStr);
      const name = characteristicNameById[id] || `Atributo ${id}`;
      mapByName[name] = Array.from(set || new Set()).sort();
    }
    return mapByName;
  }, [optionValuesByCharId, characteristicNameById]);

  const totalStock = useMemo(() => stockByBranch.reduce((sum, s) => sum + s.stock, 0), [stockByBranch]);

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-600" /> {productName || 'Producto'}
          </h1>
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {locationName || 'Sucursal'}
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Atrás
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-600">Cargando…</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <>
          {/* Header details card */}
          <Card className="w-full mb-4">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: product details */}
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">{productName}</h2>
                  <div className="text-sm text-gray-600">ID: {productId}</div>
                  <div className="mt-3 space-y-1">
                    {Object.entries(characteristicValuesByName).map(([charName, values]) => (
                      <div key={charName} className="text-sm text-gray-700">
                        <span className="font-medium">{charName}: </span>
                        <span>{values.join(', ') || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Right: stock details */}
                <div>
                  <div className="font-semibold text-gray-900">Cantidad en existencia</div>
                  <div className="text-3xl font-bold text-gray-900">{totalStock}</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-700">
                    {stockByBranch.length === 0 ? (
                      <div>No hay stock en sucursales.</div>
                    ) : (
                      stockByBranch.map((s) => (
                        <div key={s.locationId} className="flex justify-between">
                          <span>{s.locationName}</span>
                          <span>{s.stock} piezas</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Add inventory form (single card inside component to avoid double borders) */}
          <div className="w-full">
            <AddProductToStock
              initialProductId={productId}
              initialLocationId={locationId}
              hideProductSelect
              hideLocationSelect
              onSaveStock={() => router.refresh()}
              onClose={() => router.back()}
            />
          </div>
        </>
      )}
    </main>
  );
};

export default ProductStockAddView;


