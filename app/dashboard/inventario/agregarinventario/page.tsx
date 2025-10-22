'use client';
import AddProductToStock from '@/components/AddProductToStock';
import { useRouter } from 'next/navigation';

export default function AgregarProductoPage() {
  const router = useRouter();

  return (
    <div className='h-full m-5'>
    <AddProductToStock
      onClose={() => router.push('/dashboard/inventario')}
      onSaveStock={() => router.push('/dashboard/inventario')}
    />
    </div>
  );
}
