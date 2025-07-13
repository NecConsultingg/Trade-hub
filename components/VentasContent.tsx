"use client"
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Printer, FileText } from 'lucide-react';
import LoginLogo from './login-logo';
import { supabase } from '@/lib/supabase';
import { getUserId, getUserRole } from '@/lib/userId';
import { useRouter } from 'next/navigation';
import LocationSelector from './locationSelection';
import SalesReportGenerator from './SalesReportGenerator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SaleItem {
  id: number;
  name: string;
  quantity: number;
  unitPrice: number;
  attributes?: Record<string, string>;
}

interface Venta {
  id: string;
  createdAt: string;
  items: SaleItem[];
  discount: number;
  subtotal: number;
  total: number;
  locationId: number;
  locationName: string;
  clientId: number | null;
  clientName: string;
  adminName: string;
  vendedorName: string;
}

interface SupabaseSale {
  id: number;
  user_id: number;
  total_amount: number;
  discount_percentage: number;
  location: number;
  created_at: string;
  client: number | null;
  salesman: string | null;
  admin?: {
    id: number;
    name: string;
  };
  sales_items?: {
    id: number;
    sale_id: number;
    variant_id: number;
    quantity_sold: number;
    sale_price: number;
    variant?: {
      id: number;
      product_id: number;
      sku: string;
      price: number;
      product?: {
        id: number;
        name: string;
      }
    }
  }[];
}

interface Location {
  id: number;
  name: string;
}

interface Client {
  id: number;
  name: string;
}

interface SalesItem {
  id: number;
  sale_id: number;
  variant_id: number;
  quantity_sold: number;
  sale_price: number;
  variant?: {
    id: number;
    product_id: number;
    sku: string;
    price: number;
    product?: {
      id: number;
      name: string;
    }
  }
}

const VentasContent: React.FC = () => {
  const router = useRouter();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState<number | null>(null);
  const [variantAttributes, setVariantAttributes] = useState<Record<number, Record<string, string>>>({});
  const [locations, setLocations] = useState<Record<number, string>>({});
  const [clients, setClients] = useState<Record<number, string>>({});
  const [openLocations, setOpenLocations] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const role = await getUserRole();
        setIsAdmin(role === 'admin' || role === 'superadmin');
      } catch (error) {
        console.error('Error checking user role:', error);
        setIsAdmin(false);
      }
    };
    
    checkUserRole();
  }, []);

  const fetchLocations = async () => {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('user_id', userId);
      
      if (error) throw error;
      
      const locationMap: Record<number, string> = {};
      data.forEach((location: Location) => {
        locationMap[location.id] = location.name;
      });
      
      return locationMap;
    } catch (error) {
      console.error('Error fetching locations:', error);
      return {};
    }
  };

  // New function to fetch clients
  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name');
      
      if (error) throw error;
      
      const clientMap: Record<number, string> = {};
      data.forEach((client: Client) => {
        clientMap[client.id] = client.name;
      });
      
      return clientMap;
    } catch (error) {
      console.error('Error fetching clients:', error);
      return {};
    }
  };

  const fetchVariantAttributes = async (variantIds: number[]) => {
    if (!variantIds.length) return {};
    
    try {
      const { data: optionVariantsData, error: optionVariantsError } = await supabase
        .from('optionVariants')
        .select('*')
        .in('variant_id', variantIds);
      if (optionVariantsError) throw optionVariantsError;
      const optionIds = [...new Set(optionVariantsData.map(ov => ov.option_id))];
      const { data: optionsData, error: optionsError } = await supabase
        .from('characteristics_options')
        .select('*, product_characteristics(name)')
        .in('id', optionIds);
      if (optionsError) throw optionsError;
      const varAttrs: Record<number, Record<string, string>> = {};   
      optionVariantsData.forEach(ov => {
        const option = optionsData.find(o => o.id === ov.option_id);
        if (option) {
          if (!varAttrs[ov.variant_id]) {
            varAttrs[ov.variant_id] = {};
          }
          const characteristicName = option.product_characteristics?.name || "Unknown";
          varAttrs[ov.variant_id][characteristicName] = option.values;
        }
      });
      
      return varAttrs;
    } catch (error) {
      console.error('Error fetching variant attributes:', error);
      return {};
    }
  };

  useEffect(() => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const userId = await getUserId();
        
        // Fetch locations and clients first
        const locationMap = await fetchLocations();
        setLocations(locationMap);
        
        const clientMap = await fetchClients();
        setClients(clientMap);
        
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            *,
            admin:user_id(
              id,
              name
            ),
            sales_items:sales_items(
              *,
              variant:variant_id(
                *,
                product:product_id(*)
              )
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (salesError) throw salesError;
        
        // Get unique variant IDs from all sales
        const variantIds = salesData.flatMap(sale => 
          sale.sales_items?.map((item: SalesItem) => item.variant_id) || []
        );
        
        // Fetch attributes for all variants
        const attributes = await fetchVariantAttributes([...new Set(variantIds)]);
        setVariantAttributes(attributes);
        
        const transformedSales = salesData.map((sale: SupabaseSale) => {
          const saleItems: SaleItem[] = sale.sales_items?.map(item => ({
            id: item.id,
            name: item.variant?.product?.name || 'Unknown Product',
            quantity: item.quantity_sold,
            unitPrice: item.sale_price,
            attributes: attributes[item.variant_id] || {}
          })) || [];
          
          const subtotal = saleItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
          
          const venta: Venta = {
            id: sale.id.toString(),
            createdAt: sale.created_at,
            items: saleItems,
            discount: sale.discount_percentage || 0,
            subtotal: subtotal,
            total: sale.total_amount,
            locationId: sale.location,
            locationName: locationMap[sale.location] || 'Ubicación desconocida',
            clientId: sale.client,
            clientName: sale.client ? clientMap[sale.client] || 'Cliente desconocido' : 'Sin cliente',
            adminName: sale.admin?.name || 'Admin no especificado',
            vendedorName: sale.salesman || 'Vendedor no especificado'
          };
          
          return venta;
        });
        
        setVentas(transformedSales);
        
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSales();
  }, []);

  const updateVentas = () => {
    const fetchSales = async () => {
      try {
        setLoading(true);
        const userId = await getUserId();
        
        const { data: salesData, error: salesError } = await supabase
          .from('sales')
          .select(`
            *,
            admin:user_id(
              id,
              name
            ),
            sales_items:sales_items(
              *,
              variant:variant_id(
                *,
                product:product_id(*)
              )
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        if (salesError) throw salesError;
        
        // Get unique variant IDs from all sales
        const variantIds = salesData.flatMap(sale => 
          sale.sales_items?.map((item: SalesItem) => item.variant_id) || []
        );
        
        // Fetch attributes for all variants
        const attributes = await fetchVariantAttributes([...new Set(variantIds)]);
        setVariantAttributes(attributes);
        
        // Transform Supabase data to our Venta format
        const transformedSales = salesData.map((sale: SupabaseSale) => {
          const saleItems: SaleItem[] = sale.sales_items?.map(item => ({
            id: item.id,
            name: item.variant?.product?.name || 'Unknown Product',
            quantity: item.quantity_sold,
            unitPrice: item.sale_price,
            attributes: attributes[item.variant_id] || {}
          })) || [];
          
          const subtotal = saleItems.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
          
          const venta: Venta = {
            id: sale.id.toString(),
            createdAt: sale.created_at,
            items: saleItems,
            discount: sale.discount_percentage || 0,
            subtotal: subtotal,
            total: sale.total_amount,
            locationId: sale.location,
            locationName: locations[sale.location] || 'Ubicación desconocida',
            clientId: sale.client,
            clientName: sale.client ? clients[sale.client] || 'Cliente desconocido' : 'Sin cliente',
            adminName: sale.admin?.name || 'Admin no especificado',
            vendedorName: sale.salesman || 'Vendedor no especificado'
          };
          
          return venta;
        });
        
        setVentas(transformedSales);
        
      } catch (error) {
        console.error('Error fetching sales:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSales();
  };

  // Filter sales based on search term and date
  const filteredVentas = ventas.filter(venta => {
    const matchesSearch = searchTerm === '' || 
      venta.items.some(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      venta.clientName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const saleDate = new Date(venta.createdAt);
    const filterDate = dateFilter ? new Date(dateFilter) : null;
    
    const matchesDate = !filterDate || 
      (saleDate.getUTCFullYear() === filterDate.getUTCFullYear() &&
       saleDate.getUTCMonth() === filterDate.getUTCMonth() &&
       saleDate.getUTCDate() === filterDate.getUTCDate());
    
    const matchesLocation = locationFilter === null || 
      (locationFilter !== null && Number(venta.locationId) === Number(locationFilter));
    
    return matchesSearch && matchesDate && matchesLocation;
  });

  // Helper function to format product name with attributes
  const formatProductWithAttributes = (item: SaleItem) => {
    if (!item.attributes || Object.keys(item.attributes).length === 0) {
      return item.name;
    }
    
    const attrString = Object.entries(item.attributes)
      .map(([characteristic, value]) => `${characteristic}: ${value}`)
      .join(", ");
    
    return `${item.name} (${attrString})`;
  };

  const [showModal, setShowModal] = useState(false);

  const handleButtonClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const handleLocationSelected = (locationId: number) => {
    setSelectedLocation(locationId);
    setIsDialogOpen(false); 
  };

  const handlePrint = (venta: Venta) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Format the date
    const fecha = new Date(venta.createdAt);
    const formattedDate = fecha.toLocaleDateString();
    const formattedTime = fecha.toLocaleTimeString();

    // Create the ticket HTML
    const ticketHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ticket de Venta #${venta.id}</title>
          <style>
            @media print {
              @page {
                size: 80mm 297mm;
                margin: 0;
              }
              body {
                width: 80mm;
                margin: 0;
                padding: 5mm;
                font-family: 'Courier New', monospace;
                font-size: 24px;
                font-weight: bold !important;
              }
              .ticket {
                width: 100%;
              }
              .header {
                text-align: center;
                margin-bottom: 10px;
              }
              // .header h1 {
              //   font-size: 26px !important;
              //   margin-bottom: 5px;
              // }
              // .header h3 {
              //   font-size: 23px !important;
              //   margin-bottom: 5px;
              // }
              .header p {
                margin: 2px 0;
              }
              .divider {
                border-top: 1px dashed #000;
                margin: 5px 0;
              }
              .item {
                margin: 3px 0;
              }
              .total {
                margin-top: 10px;
                font-weight: bold;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 19px;
              }
              .item, .totals, .footer, p, div {
                font-weight: bold !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <h2>Ticket de Venta</h2>
              <h3>${venta.adminName}</h3>
              <p>Venta #${venta.id}</p>
              <p>${formattedDate} ${formattedTime}</p>
              <p>Vendedor: ${venta.vendedorName}</p>
              <p>Ubicación: ${venta.locationName}</p>
              <p>Cliente: ${venta.clientName}</p>
            </div>
            <div class="divider"></div>
            <div class="items">
              ${venta.items.map(item => `
                <div class="item">
                  <div>${formatProductWithAttributes(item)}</div>
                  <div>${item.quantity} x $${item.unitPrice.toFixed(2)} = $${(item.quantity * item.unitPrice).toFixed(2)}</div>
                </div>
              `).join('')}
            </div>
            <div class="divider"></div>
            <div class="totals">
              <div>Subtotal: $${venta.subtotal.toFixed(2)}</div>
              ${venta.discount > 0 ? `<div>Descuento: ${venta.discount}%</div>` : ''}
              <div class="total">Total: $${venta.total.toFixed(2)}</div>
            </div>
            <div class="footer">
              <p>¡Gracias por su compra!</p>
              <p>Vuelva pronto</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Write the ticket HTML to the new window
    printWindow.document.write(ticketHTML);
    printWindow.document.close();

    // Wait for content to load then print
    printWindow.onload = function() {
      printWindow.print();
      // Close the window after printing (optional)
      // printWindow.close();
    };
  };

  return (
    <main className="flex-1 overflow-y-auto m-3 bg-[#f5f5f5] pb-10">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={handleButtonClick}
          className='px-3 py-3 flex items-center gap-2 rounded-sm bg-[#1366D9] text-white shadow-lg hover:bg-[#0d4ea6] transition-colors'>
          <Plus className="w-4 h-4" />
          Crear venta
        </button>
        {showModal && (
          <LocationSelector
            isOpen={true}
            onClose={() => {
              setIsDialogOpen(false);
              setShowModal(false);
            }}
            onLocationSelected={(locationId) => {
              setSelectedLocation(locationId);
              setIsDialogOpen(false);
              setShowModal(false);
            }}
          />
        )}

        <div className="flex gap-4 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar productos o clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"/>
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
          
          <div className="relative">
            <select
              value={locationFilter === null ? '' : locationFilter}
              onChange={(e) => {
                const value = e.target.value;
                setLocationFilter(value === '' ? null : Number(value));
              }}
              className={`pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                locationFilter === null ? 'text-gray-400' : 'text-gray-900'
              }`}
            >
              <option value="">Todas las ubicaciones</option>
              {Object.entries(locations).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <Filter className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>

          <div className="relative">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className={`pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                dateFilter === '' ? 'text-gray-400' : 'text-gray-900'
              }`}
            />
            <Filter className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>

          {isAdmin && (
            <Button
              onClick={() => setShowReportModal(true)}
              variant="outline"
              className="flex items-center gap-2 px-3 py-2 h-10"
            >
              <FileText className="w-4 h-4" />
              Reporte
            </Button>
          )}
        </div>
      </div>
      
      {/* Report Generator Modal */}
      {isAdmin && (
        <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Generador de Reportes de Ventas</DialogTitle>
            </DialogHeader>
            <SalesReportGenerator locations={locations} />
          </DialogContent>
        </Dialog>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#1366D9]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 justify-items-center md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {filteredVentas.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500">No hay ventas registradas</p>
            </div>
          ) : (
            filteredVentas.map((venta) => {
              const fecha = new Date(venta.createdAt);
              return (
                <div 
                  key={venta.id} 
                  className="relative flex flex-col bg-white shadow-sm border border-slate-200 rounded-lg w-full hover:shadow-md transition-shadow"
                >
                  {/* Print Button */}
                  <button
                    onClick={() => handlePrint(venta)}
                    className="absolute top-3 right-3 p-2 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Imprimir ticket"
                  >
                    <Printer className="w-5 h-5 text-[#1366D9]" />
                  </button>
                  {/* Header */}
                  <div className="mx-3 mb-0 border-b border-slate-200 pt-3 pb-2 px-1">
                    <div className="flex items-center gap-3">
                      <LoginLogo size={60} />
                      <div>
                        <h2 className="text-lg font-semibold capitalize">Venta #{venta.id}</h2>
                        <p className="font-light text-sm mt-2">Ubicación: {venta.locationName}</p>
                        <p className="font-light text-sm mt-2">Cliente: {venta.clientName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 mt-3 text-sm">
                      <p>{fecha.toLocaleDateString()}</p>
                      <p>{fecha.toLocaleTimeString()}</p>
                    </div>
                  </div>

                  {/* Product List */}
                  <div className="p-4 pb-20"> {/* <- Note the extra bottom padding */}
                    <div className="grid grid-cols-3 text-gray-400 pb-3 text-sm font-medium">
                      <span>Cantidad</span>
                      <span className="text-center">Producto</span>
                      <span className="text-right">Precio</span>
                    </div>

                    <ul className="text-slate-600 font-light text-sm">
                      {venta.items.slice(0, 3).map((producto, index) => (
                        <li key={index} className="grid grid-cols-3 py-1">
                          <span>{producto.quantity}</span>
                          <span className="text-center capitalize">
                            {formatProductWithAttributes(producto)}
                          </span>
                          <span className="text-right">
                            ${producto.unitPrice * producto.quantity} MXN
                          </span>
                        </li>
                      ))}

                      {venta.items.length > 3 && (
                        <li className="text-center text-blue-600 text-sm py-1 col-span-3">
                          {venta.items.length - 3} productos más...
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Fixed Bottom Section */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-2 flex justify-between items-center rounded-b-lg">
                    <p className="text-sm text-slate-600 font-medium">Total: ${venta.total} MXN</p>
                    <button 
                      onClick={() => router.push(`/dashboard/ventas/${venta.id}`)}
                      className="text-blue-600 text-sm font-medium hover:text-blue-800"
                    >
                      Ver más
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
};

export default VentasContent;