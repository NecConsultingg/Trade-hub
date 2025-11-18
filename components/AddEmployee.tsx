'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {Card, CardContent} from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getUserId } from '@/lib/userId';
import { Eye, EyeOff } from 'lucide-react';

interface AddEmployeeProps {
  onClose: () => void;
  onEmployeeAdded: () => void;
}

interface Location {
  id: number;
  name: string;
  location: string;
  user_id?: string;
}

const AddEmployee: React.FC<AddEmployeeProps> = ({ onClose, onEmployeeAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [salary, setSalary] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    salary?: string;
    role?: string;
    phone?: string;
    locationId?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLocations = async () => {
      setLocationsLoading(true);
      setLocationsError(null);
      try {
        const userId = await getUserId();
        const { data, error } = await supabase
          .from('locations')
          .select('id, name, location')
          .eq('user_id', userId);
        if (error) throw error;
        setLocations(data || []);
      } catch (err: any) {
        console.error('Error al cargar sucursales:', err);
        setLocationsError(err.message);
      } finally {
        setLocationsLoading(false);
      }
    };

    fetchLocations();
  }, []);

  const validateForm = () => {
    let isValid = true;
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
      isValid = false;
    } else if (!/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(name)) {
      newErrors.name = 'El nombre solo puede contener letras (incluyendo acentos) y espacios';
      isValid = false;
    } else if (name.length > 50) {
      newErrors.name = 'El nombre no puede exceder los 50 caracteres';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'El email es obligatorio';
      isValid = false;
    } else if (email.length > 100) {
      newErrors.email = 'El email no puede exceder los 100 caracteres';
      isValid = false;
    } else {
      // More comprehensive email validation
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
    } else if (password.length > 50) {
      newErrors.password = 'La contraseña no puede exceder los 50 caracteres';
      isValid = false;
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'La confirmación de contraseña es obligatoria';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden';
      isValid = false;
    }

    if (!salary.trim()) {
      newErrors.salary = 'El salario es obligatorio';
      isValid = false;
    } else if (isNaN(parseFloat(salary))) {
      newErrors.salary = 'El salario debe ser un número';
      isValid = false;
    }

    if (!role) {
      newErrors.role = 'El rol es obligatorio';
      isValid = false;
    }

    if (!phone.trim()) {
      newErrors.phone = 'El teléfono es obligatorio';
      isValid = false;
    } else if (isNaN(parseInt(phone))) {
      newErrors.phone = 'El teléfono debe ser un número';
      isValid = false;
    } else if (phone.length > 15) {
      newErrors.phone = 'El teléfono no puede exceder los 15 caracteres';
      isValid = false;
    }

    if (!selectedLocationId) {
      newErrors.locationId = 'La sucursal es obligatoria';
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
      const userId = await getUserId();

      // Create the auth user through our API endpoint
      const response = await fetch('/api/create-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          role: 'employee'
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

      // Then create the employee record
      const { error: employeeError } = await supabase
        .from('employees')
        .insert([
          {
            name,
            email: email.toLowerCase().trim(),
            salary: parseFloat(salary),
            role: role.toLowerCase(),
            phone: parseInt(phone),
            location_id: selectedLocationId,
            user_id: userId,
            auth_id: authData.id
          },
        ]);

      if (employeeError) {
        console.error('Error creating employee:', employeeError);
        // Instead of trying to delete the auth user (which requires admin privileges),
        // we'll just log the error and let the user know
        setErrors({ 
          general: 'Error al crear el empleado. Por favor, contacte al administrador del sistema.' 
        });
        return;
      }

      // Update the auth user's metadata with the role
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          role: 'employee'
        }
      });

      if (updateError) {
        console.error('Error updating user metadata:', updateError);
        // Don't throw here as the employee is already created
      }

      setLoading(false);
      onEmployeeAdded();
      onClose();
     
    } catch (err: any) {
      console.error('Error al agregar empleado:', err);
      setErrors({ 
        general: err.message || 'Error al agregar empleado. Por favor, intente nuevamente.' 
      }); 
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
   <div className="h-full">
         <Card className="w-full">
           <CardContent className="p-6">
               <h1 className="text-lg font-semibold capitalize">Agregar empleado</h1>

          <div className="my-4">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              className={`mt-1 ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Nombre del empleado"
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
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
              maxLength={100}
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
                     maxLength={50}
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
                maxLength={50}
                required
              />
            </div>
            {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="salary">Salario</Label>
            <Input
              id="salary"
              type="number"
              className={`mt-1 ${errors.salary ? 'border-red-500' : ''}`}
              value={salary}
              placeholder="Salario"
              onChange={(e) => setSalary(e.target.value)}
              required
            />
            {errors.salary && <p className="text-red-500 text-xs mt-1">{errors.salary}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              className={`mt-1 ${errors.phone ? 'border-red-500' : ''}`}
              value={phone}
              placeholder="Número telefónico"
              onChange={(e) => setPhone(e.target.value)}
              maxLength={15}
              required
            />
            {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="role">Rol</Label>
            <select
              id="role"
              className={`w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373] ${errors.role ? 'border-red-500' : ''}`}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="">Seleccionar rol</option>
                   <option value="inventario">Inventario</option>
                   <option value="ventas">Ventas</option>
            </select>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
          </div>

          <div className="mb-4">
            <Label htmlFor="locationId" className="block text-sm font-bold mb-2">Sucursal:</Label>
            {locationsLoading ? (
              <p>Cargando sucursales...</p>
            ) : locationsError ? (
              <p className="text-red-500 text-sm">{locationsError}</p>
            ) : (
              <select
                id="locationId"
                className={`w-full border shadow-xs rounded-[8px] p-1.5 mt-1 text-[#737373] ${errors.locationId ? 'border-red-500' : ''}`}
                value={selectedLocationId === null ? '' : selectedLocationId}
                onChange={(e) => setSelectedLocationId(parseInt(e.target.value))}
                required
              >
                <option value="">Seleccionar sucursal</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.location})
                  </option>
                ))}
              </select>
            )}
            {errors.locationId && <p className="text-red-500 text-xs mt-1">{errors.locationId}</p>}
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

export default AddEmployee;
