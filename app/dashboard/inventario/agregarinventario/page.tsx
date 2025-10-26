'use client';
import AddProductToStock from '@/components/AddProductToStock';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function AgregarProductoPage() {
  const router = useRouter();
  const params = useSearchParams();
  // lee el productId si viene en ?productId=123
  const productIdParam = params.get('productId');
  const initialProductId = productIdParam ? parseInt(productIdParam, 10) : undefined;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className='h-full m-5'>
        <AddProductToStock
          // le pasamos el id si lo hay, si no será undefined y el usuario lo elige manualmente
          initialProductId={initialProductId}
          onClose={() => router.push('/dashboard/inventario')}
          onSaveStock={() => router.push('/dashboard/inventario')}
        />
      </div>
    </Suspense>
  );
}