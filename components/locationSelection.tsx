"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/lib/userId";
import { Building } from "lucide-react";
import { useRouter } from "next/navigation";

interface Location {
  id: number;
  name: string;
  location: string;
}

interface LocationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onLocationSelected: (locationId: number) => void;
  onContinue?: (locationId: number) => void;
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  isOpen,
  onClose,
  onLocationSelected,
  onContinue,
}) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null
  );
  const router = useRouter();

  // notify parent on selection change for external state if needed
  const handleSelect = (id: number) => {
    setSelectedLocationId(id);
    try {
      onLocationSelected(id);
    } catch (_) {
      // optional for backward compatibility
    }
  };

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        setLoading(true);
        const userId = await getUserId();

        const { data, error } = await supabase
          .from("locations")
          .select("id, name, location")
          .eq("user_id", userId)
          .order("name");

        if (error) throw error;

        setLocations(data || []);

        // Auto-select first location
        if (data && data.length > 0 && !selectedLocationId) {
          setSelectedLocationId(data[0].id);
        }
      } catch (error) {
        console.error("Error fetching locations:", error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchLocations();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seleccionar sucursal</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
          </div>
        ) : locations.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">No hay sucursales disponibles</p>
            <p className="text-sm">
              Por favor, crea una sucursal antes de realizar una venta.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              {locations.map((location) => (
                <div
                  key={location.id}
                  onClick={() => handleSelect(location.id)}
                  className={`flex items-center p-3 border rounded-md cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedLocationId === location.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex-shrink-0 mr-3">
                    <Building className="h-5 w-5 text-gray-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{location.name}</h3>
                    <p className="text-sm text-gray-500">
                      {location.location}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            onClick={() => {
              if (selectedLocationId === null) return;
              if (onContinue) {
                onContinue(selectedLocationId);
                onClose();
              } else {
                router.push(`/dashboard/ventas/agregarventa?locationId=${selectedLocationId}`);
              }
            }}
            disabled={
              loading || locations.length === 0 || selectedLocationId === null
            }
            className="bg-[#1366D9] hover:bg-[#0d4ea6]"
          >
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocationSelector;
