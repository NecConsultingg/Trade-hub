'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {Card, CardContent} from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

interface AddNegocioProps {
  onClose: () => void;
  onNegocioAdded: () => void;
}

interface Negocio {
  id: number;
  name: string;
  billingDay: number;
  billingAmount: string;
}

const AddNegocio: React.FC<AddNegocioProps> = ({ onClose, onNegocioAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [billingDay, setBillingDay] = useState('');
  const [billingAmount, setBillingAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    billingDay?: string;
    billingAmount?: string;
    general?: string;
  }>({});

  const validateForm = () => {
    let isValid = true;
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
      isValid = false;
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(name)) {
      newErrors.name = 'El nombre solo puede contener letras (incluyendo acentos) y espacios';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio';
      isValid = false;
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        newErrors.email = 'El formato del email no es válido';
        isValid = false;
      }
    }

    if (!password.trim()) {
      newErrors.password = 'La contraseña es obligatoria';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
      isValid = false;
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'La confirmación de contraseña es obligatoria';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
      isValid = false;
    }

    if (!billingDay.trim()) {
      newErrors.billingDay = 'El día de cobro es obligatorio';
      isValid = false;
    } else if (isNaN(parseFloat(billingDay))) {
      newErrors.billingDay = 'El día de cobro debe ser un número';
      isValid = false;
    }

    if (!billingAmount.trim()) {
      newErrors.billingAmount = 'El monto de cobro es obligatorio';
      isValid = false;
    } else if (isNaN(parseFloat(billingAmount))) {
      newErrors.billingAmount = 'El monto de cobro debe ser un número';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // Create the auth user through our API endpoint
      const response = await fetch('/api/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          role: 'admin'
        }),
      });

      const { user: authData, error: authError } = await response.json();

      if (authError) {
        if (authError.includes('Email')) {
          setErrors({ email: 'El email no es válido o ya está en uso' });
        } else {
          throw new Error(authError);
        }
        return;
      }

      if (!authData?.id) {
        throw new Error('No se pudo crear el usuario de autenticación');
      }

      // Get the next available user_id
      const { data: maxUserId, error: maxIdError } = await supabase
        .from('admins')
        .select('user_id')
        .order('user_id', { ascending: false })
        .limit(1)
        .single();

      if (maxIdError && maxIdError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error getting max user_id:', maxIdError);
        throw new Error('Error al obtener el siguiente ID de usuario');
      }

      const nextUserId = (maxUserId?.user_id || 0) + 1;

      // Create the admin record
      const { error: adminError } = await supabase
        .from('admins')
        .insert([
          {
            id: authData.id, // This is the UUID for the admin record
            user_id: nextUserId, // This is the next available numeric user_id
            name,
            billing_day: parseInt(billingDay),
            billing_amount: parseFloat(billingAmount),
          },
        ]);

      if (adminError) {
        console.error('Error creating admin:', adminError);
        setErrors({ 
          general: 'Error al crear el negocio. Por favor, contacte al administrador del sistema.' 
        });
        return;
      }

      // Create default client for the new admin
      const { error: clientError } = await supabase
        .from('clients')
        .insert([
          {
            name: 'Público en General',
            user_id: nextUserId, // Using the numeric user_id instead of UUID
            discount: 0,
            is_default: true,
            num_compras: 0,
            total_compras: 0,
            phone: 'N/A'
          }
        ]);

      if (clientError) {
        console.error('Error creating default client:', clientError);
        // Don't throw here as the admin is already created
        // Just log the error and continue
      }

      // Update the auth user's metadata with the role
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          role: 'admin'
        }
      });

      if (updateError) {
        console.error('Error updating user metadata:', updateError);
        // Don't throw here as the admin is already created
      }

      onNegocioAdded();
      onClose();
     
    } catch (err: any) {
      console.error('Error al agregar negocio:', err);
      setErrors({ 
        general: err.message || 'Error al agregar negocio. Por favor, intente nuevamente.' 
      }); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full">
      <Card className="w-full">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold capitalize mb-4">Agregar negocio</h1>
          
          <div className="mb-4">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Nombre del negocio"
              onChange={(e) => setName(e.target.value)}
              required
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className={`mt-1 ${errors.email ? 'border-red-500' : ''}`}
              value={email}
              placeholder="Correo electrónico"
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="password">Contraseña</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`mt-1 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                value={password}
                placeholder="Contraseña inicial"
                onChange={(e) => setPassword(e.target.value)}
                required
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
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                className={`mt-1 pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                value={confirmPassword}
                placeholder="Confirma la contraseña"
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="billingAmount">Cobro mensual</Label>
            <Input
              id="billingAmount"
              type="number"
              className={`mt-1 ${errors.billingAmount ? 'border-red-500' : ''}`}
              value={billingAmount}
              placeholder="Monto de cobro mensual"
              onChange={(e) => setBillingAmount(e.target.value)}
              required
            />
            {errors.billingAmount && <p className="text-red-500 text-xs mt-1">{errors.billingAmount}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="billingDay">Fecha de cobro</Label>
            <Input
              id="billingDay"
              type="number"
              min="1"
              max="31"
              className={`mt-1 ${errors.billingDay ? 'border-red-500' : ''}`}
              value={billingDay}
              placeholder="Día del mes (1-31)"
              onChange={(e) => setBillingDay(e.target.value)}
              required
            />
            {errors.billingDay && <p className="text-red-500 text-xs mt-1">{errors.billingDay}</p>}
          </div>

          {errors.general && <p className="text-red-500 text-xs mt-2">{errors.general}</p>}

          <div className="flex justify-end gap-4 mt-6">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-blue-500 hover:bg-blue-600">
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddNegocio;
