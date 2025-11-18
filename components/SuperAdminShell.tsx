'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu as MenuIcon, LogOut, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [userName, setUserName] = useState('Cargando…');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [superAdminId, setSuperAdminId] = useState<string | null>(null);

  useEffect(() => {
      async function getUserData() {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user?.id) {
            setUserName('No session');
            return;
          }

          // First check the user's role
          const { data: userRole, error: roleError } = await supabase
            .rpc('get_user_role', {
              auth_user_id: session.user.id
            });

          if (roleError) {
            console.error('Error getting user role:', roleError);
            setUserName('Error getting role');
            return;
          }

          if (userRole !== 'superadmin') {
            setUserName('Not authorized');
            return;
          }

          // Get superadmin profile using id_sa
          const { data: profiles, error } = await supabase
            .from('super_admin')
            .select('name')
            .eq('id_sa', session.user.id);

          if (error) {
            console.error('Error fetching superadmin:', error);
            setUserName('Error fetching');
            return;
          }

          if (!profiles || profiles.length === 0) {
            setUserName('No superadmin profile');
            return;
          }

          const profile = profiles[0];
          setUserName(profile.name);
          setSuperAdminId(session.user.id);
          
        } catch (error) {
          console.error('Unexpected error:', error);
          setUserName('Error');
        }
      }
      getUserData();
    }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { label: 'Negocios', href: '/dashboard-superadmin/negocios', icon: <Building2 /> }
  ];

  const currentMenuItem = menuItems.find(item =>
    pathname === item.href || pathname.startsWith(item.href + '/')
  );
  const pageTitle = currentMenuItem?.label || 'SuperAdmin';

  return (
    <div className="flex h-screen bg-[#f5f5f5]">
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed md:static md:flex flex-col w-44 bg-white border-r h-full z-30
        transition-transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="p-4">
          <h1 className="text-xl font-bold">Trade Hub</h1>
        </div>
        <nav className="flex-1 px-2 overflow-y-auto">
          {menuItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-2 mb-1 text-sm rounded-md
                  ${isActive ? 'bg-[#e8f1fd] text-[#007aff]' : 'text-[#667085] hover:bg-[#f5f5f5]'}`}
              >
                {/* Renderizamos el icono antes del label */}
                <span className="mr-3">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <button 
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm hover:bg-[#f5f5f5] hover:text-red-600 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b py-4 px-6 flex items-center justify-between">
          <button className="md:hidden" onClick={() => setIsMobileMenuOpen(o => !o)}>
            <MenuIcon className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-[#007aff] text-white flex items-center justify-center">
                {userName
                  .split(' ')
                  .map(n => n[0])
                  .join('')
                  .toUpperCase()
                  .substring(0, 2)}
              </div>
              <button className="ml-2 flex items-center text-sm">
                {userName}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-[#f5f5f5]">
          {children}
        </main>
      </div>
    </div>
  );
}

