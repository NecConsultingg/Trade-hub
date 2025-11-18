'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from 'lucide-react';


interface   NegociosViewProps {
  onClose: () => void;
}

const NegociosView: React.FC<NegociosViewProps> = ({ onClose }) => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  if (!params?.id) return null;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [negocioName, setNegocioName] = useState('');
  const [negocioBillingDay, setNegocioBillingDay] = useState('');
  const [negocioId, setNegocioId] = useState('');
  const [negocioBillingAmount, setNegocioBillingAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNegocio = async () => {
      try {
        const { data: negData, error: negErr } = await supabase
          .from('admins')
          .select('id, user_id, name, billing_day, billing_amount')
          .eq('id', id)
          .single();

        if (negErr || !negData) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Negocio no encontrado",
          });
          router.push('/dashboard-superadmin/negocios');
          return;
        }

        setNegocioId(negData.user_id.toString());
        setNegocioName(negData.name);
        setNegocioBillingDay(negData.billing_day.toString());
        setNegocioBillingAmount(negData.billing_amount.toString());

      } catch (err) {
        console.error('Error al cargar datos:', err);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Error al cargar los datos del negocio. Por favor, intenta de nuevo.",
        });
        router.push('/dashboard-superadmin/negocios');
      } finally {
        setLoading(false);
      }
    };

    fetchNegocio();
  }, [id, router, toast]);
  
  

  const handleResetPassword = async () => {
    if (!id) return;

    // Validate passwords
    if (!newPassword || !confirmPassword) {
      setPasswordError('Por favor, completa todos los campos');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }

    setIsResettingPassword(true);
    try {
      // Reset the password using our new admin-specific endpoint
      const response = await fetch('/api/reset-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId: id,  // Using the UUID directly
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al restablecer la contraseña');
      }

      toast({
        title: "Éxito",
        description: "Contraseña restablecida exitosamente",
      });
      setShowResetDialog(false);
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    } catch (err: any) {
      console.error('Error al restablecer contraseña:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Error al restablecer la contraseña. Por favor, intenta de nuevo.",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== negocioName) {
      setDeleteError('El nombre del negocio no coincide');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/delete-business?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al eliminar el negocio');
      }

      toast({
        title: "Éxito",
        description: `Negocio ${data.deletedBusiness?.name || ''} eliminado exitosamente`,
      });

      // Close dialog and navigate
      setIsDeleteDialogOpen(false);
      if (onClose) {
        onClose();
        router.refresh();
      } else {
        router.push('/dashboard-superadmin/negocios');
      }
    } catch (error: any) {
      console.error('Error deleting business:', error);
      const errorMessage = error.message || 'Error desconocido al eliminar el negocio';
      setDeleteError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Card className="w-full overflow-hidden mt-6">
        <CardContent>
          <div className="border-b border-slate-200 pb-2 flex items-center justify-between mt-3">
            <h1 className="text-lg font-semibold capitalize">Negocio</h1>
            <p className="text-lg font-light">ID# {negocioId}</p>
          </div>

          <section className="mt-6">
            <h2 className="font-semibold">Detalles principales</h2>
            <p><strong>Nombre:</strong> {negocioName}</p>
          </section>

          <section className="mt-6">
            <h2 className="font-semibold">Características</h2>
            <p><strong>Cobro mensaul:</strong> ${negocioBillingAmount} MXN</p>
            <p><strong>Fecha de cobro:</strong> {negocioBillingDay} de cada mes</p>
          </section>

          <section className="mt-6 flex gap-4 justify-center">
            <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  Recuperar Contraseña
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restablecer Contraseña</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ingresa la nueva contraseña para el negocio {negocioName}.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">Nueva Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  {passwordError && (
                    <p className="text-red-500 text-sm">{passwordError}</p>
                  )}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <Button
                    onClick={handleResetPassword}
                    disabled={isResettingPassword}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    {isResettingPassword ? 'Restableciendo...' : 'Restablecer'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="bg-red-500 hover:bg-red-600 text-white">
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                  <div className="space-y-4">
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente el negocio {negocioName} y todos sus datos asociados.
                    </AlertDialogDescription>
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Para confirmar, escribe el nombre del negocio:</p>
                      <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="Escribe el nombre del negocio"
                        className="mt-2"
                      />
                    </div>
                    {deleteError && (
                      <p className="text-sm text-red-500 mt-2">{deleteError}</p>
                    )}
                  </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => {
                    setDeleteConfirmation('');
                    setIsDeleteDialogOpen(false);
                  }}>
                    Cancelar
                  </AlertDialogCancel>
                  <Button
                    onClick={handleDelete}
                    disabled={isDeleting || deleteConfirmation !== negocioName}
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    {isDeleting ? 'Eliminando...' : 'Eliminar'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </section>
        </CardContent>
      </Card>
    </div>
  );
};

export default NegociosView;