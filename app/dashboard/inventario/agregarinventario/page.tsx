'use client';
import { Suspense } from 'react';
import AddProductToStock from '@/components/AddProductToStock';
import { useRouter, useSearchParams } from 'next/navigation';

function AgregarProductoContent() {
  const router = useRouter();
  const params = useSearchParams();
  // lee el productId si viene en ?productId=123
  const productIdParam = params.get('productId');
  const initialProductId = productIdParam ? parseInt(productIdParam, 10) : undefined;
  // lee optional locationId si viene en ?locationId=123
  const locationIdParam = params.get('locationId');
  const initialLocationId = locationIdParam ? parseInt(locationIdParam, 10) : undefined;

  return (
    <div className='h-full m-5'>
      <AddProductToStock
        // le pasamos el id si lo hay, si no será undefined y el usuario lo elige manualmente
        initialProductId={initialProductId}
        initialLocationId={initialLocationId}
        hideLocationSelect={Boolean(initialLocationId)}
        onClose={() => router.push('/dashboard/inventario')}
        onSaveStock={() => router.push('/dashboard/inventario')}
      />
    </div>
  );
}

export default function AgregarProductoPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
      </div>
    }>
      <AgregarProductoContent />
    </Suspense>
  );
}
