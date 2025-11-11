'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import AddProductToStock from '@/components/AddProductToStock';

export default function AgregarProductoPage() {
  const router = useRouter();

  const [initialProductId, setInitialProductId] = useState<number | undefined>(undefined);
  const [initialLocationId, setInitialLocationId] = useState<number | undefined>(undefined);

  // Usamos useEffect para asegurarnos que useSearchParams solo se ejecute en el cliente
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // lee el productId si viene en ?productId=123
    const productIdParam = params.get('productId');
    const productId = productIdParam ? parseInt(productIdParam, 10) : undefined;
    setInitialProductId(productId);

    // lee el locationId si viene en ?locationId=123
    const locationIdParam = params.get('locationId');
    const locationId = locationIdParam ? parseInt(locationIdParam, 10) : undefined;
    setInitialLocationId(locationId);
  }, []);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="h-full m-5">
        <AddProductToStock
          // le pasamos el id si lo hay, si no será undefined y el usuario lo elige manualmente
          initialProductId={initialProductId}
          initialLocationId={initialLocationId}
          hideProductSelect={Boolean(initialProductId)}
          hideLocationSelect={Boolean(initialLocationId)}
          onClose={() => router.push('/dashboard/inventario')}
          onSaveStock={() => router.push('/dashboard/inventario')}
        />
      </div>
    </Suspense>
  );
}