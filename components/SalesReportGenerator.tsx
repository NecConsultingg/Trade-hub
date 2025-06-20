'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/userId';
import { useToast } from "@/components/ui/use-toast";
import { Download, Calendar, MapPin, Filter } from 'lucide-react';
import { es } from 'date-fns/locale';

interface SalesReportData {
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  salesByDate: {
    date: string;
    count: number;
    amount: number;
  }[];
  topProducts: {
    name: string;
    quantity: number;
    total: number;
  }[];
  salesByClient: {
    clientName: string;
    count: number;
    amount: number;
  }[];
  detailedSales: {
    id: number;
    date: string;
    clientName: string;
    location: string;
    salesman: string;
    items: {
      name: string;
      quantity: number;
      price: number;
      total: number;
    }[];
    subtotal: number;
    discount: number;
    total: number;
  }[];
}

// Add new interfaces for the database types
interface Product {
  name: string;
}

interface Variant {
  product?: Product;
}

interface SalesItem {
  variant?: Variant;
  quantity_sold: number;
  sale_price: number;
}

interface Sale {
  id: number;
  created_at: string;
  location: number;
  salesman?: string;
  total_amount: number;
  discount_percentage?: number;
  sales_items?: SalesItem[];
  clients?: {
    name: string;
  };
}

interface SalesReportGeneratorProps {
  locations: Record<number, string>;
}

const SalesReportGenerator: React.FC<SalesReportGeneratorProps> = ({ locations }) => {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [reportData, setReportData] = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfComponents, setPdfComponents] = useState<any>(null);

  const [pdfReady, setPdfReady] = useState(false);

  // Dynamically import PDF components only on client side
  useEffect(() => {
    const loadPdfComponents = async () => {
      try {
        const pdfRenderer = await import('@react-pdf/renderer');
        setPdfComponents(pdfRenderer);
      } catch (error) {
        console.error('Error loading PDF components:', error);
      }
    };

    loadPdfComponents();
  }, []);

  useEffect(() => {
  setPdfReady(false);
}, [startDate, endDate, selectedLocation]);


const toLocalISOString = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString();
};

const fetchSalesData = async (
  userId: string,
  startDate: Date,
  endDate: Date,
  selectedLocation: number | null,
  locations: Record<number, string>
): Promise<SalesReportData | null> => {

  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setUTCHours(23, 59, 59, 999);

  const formattedStartDate = start.toISOString();
  const formattedEndDate = end.toISOString();
  

  let query = supabase
    .from('sales')
    .select(`
      *,
      sales_items:sales_items(
        *,
        variant:variant_id(
          *,
          product:product_id(*)
        )
      ),
      clients(name)
    `)
    .eq('user_id', userId)
    .gte('created_at', formattedStartDate)
    .lte('created_at', formattedEndDate)
    .order('created_at', { ascending: true });

  if (selectedLocation !== null) {
    query = query.eq('location', selectedLocation);
  }

  const { data: sales, error } = await query;
  if (error || !sales || sales.length === 0) return null;

  const detailedSales = sales.map((sale: Sale) => ({
    id: sale.id,
    date: new Date(sale.created_at).toLocaleString('es-MX'),
    clientName: sale.clients?.name || 'Sin cliente',
    location: locations[sale.location] || 'Ubicación desconocida',
    salesman: sale.salesman || 'Vendedor no especificado',
    items: sale.sales_items?.map((item: SalesItem) => ({
      name: item.variant?.product?.name || 'Producto desconocido',
      quantity: item.quantity_sold,
      price: item.sale_price,
      total: item.quantity_sold * item.sale_price
    })) || [],
    subtotal: sale.sales_items?.reduce((sum, item) => sum + (item.quantity_sold * item.sale_price), 0) || 0,
    discount: sale.discount_percentage || 0,
    total: sale.total_amount
  }));

  const salesByDate: Record<string, { count: number; amount: number }> = {};
  const productSales: Record<string, { quantity: number; total: number }> = {};
  const clientSales: Record<string, { count: number; amount: number }> = {};

  let totalAmount = 0;
  let totalSales = sales.length;

  sales.forEach(sale => {
    const date = new Date(sale.created_at).toLocaleDateString();
    const amount = sale.total_amount;
    totalAmount += amount;

    salesByDate[date] = salesByDate[date] || { count: 0, amount: 0 };
    salesByDate[date].count++;
    salesByDate[date].amount += amount;

    const clientName = sale.clients?.name || 'Sin cliente';
    clientSales[clientName] = clientSales[clientName] || { count: 0, amount: 0 };
    clientSales[clientName].count++;
    clientSales[clientName].amount += amount;

    sale.sales_items?.forEach(item => {
      const name = item.variant?.product?.name || 'Producto desconocido';
      productSales[name] = productSales[name] || { quantity: 0, total: 0 };
      productSales[name].quantity += item.quantity_sold;
      productSales[name].total += item.quantity_sold * item.sale_price;
    });
  });

  const topProducts = Object.entries(productSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const topClients = Object.entries(clientSales)
    .map(([name, data]) => ({ clientName: name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    totalSales,
    totalAmount,
    averageTicket: totalSales ? totalAmount / totalSales : 0,
    salesByDate: Object.entries(salesByDate).map(([date, data]) => ({
      date,
      ...data,
    })),
    topProducts,
    salesByClient: topClients,
    detailedSales,
  };
};

const generateReport = async () => {
  if (!startDate || !endDate) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "Por favor seleccione un rango de fechas",
    });
    return;
  }

  try {
    setLoading(true);
    const userId = await getUserId();

    const data = await fetchSalesData(userId, startDate, endDate, selectedLocation, locations);

    if (!data) {
      toast({
        variant: "default",
        title: "Sin datos",
        description: "No se encontraron ventas para el filtro seleccionado.",
      });
      setReportData(null);
      setPdfReady(false);
      return;
    }

    setReportData(data);
    setPdfReady(true);
  } catch (err) {
    console.error('Error generating report:', err);
    toast({
      variant: "destructive",
      title: "Error",
      description: "Error al generar el reporte",
    });
    setPdfReady(false);
  } finally {
    setLoading(false);
  }
};



  // PDF Document Component - only create when PDF components are loaded
  const createPDFDocument = () => {
    if (!pdfComponents || !reportData || !startDate || !endDate) return null;

    const { Document, Page, Text, View, StyleSheet } = pdfComponents;

    // PDF Styles
    const styles = StyleSheet.create({
      page: {
        padding: 30,
        fontSize: 12,
      },
      header: {
        marginBottom: 20,
        textAlign: 'center',
      },
      title: {
        fontSize: 24,
        marginBottom: 10,
      },
      subtitle: {
        fontSize: 14,
        marginBottom: 5,
      },
      section: {
        marginBottom: 20,
      },
      sectionTitle: {
        fontSize: 16,
        marginBottom: 15,
        borderBottom: '1 solid #ccc',
        paddingBottom: 8,
        marginTop: 20,
      },
      table: {
        display: 'flex',
        width: 'auto',
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#bfbfbf',
        marginBottom: 15,
        borderRadius: 4,
      },
      tableRow: {
        flexDirection: 'row',
      },
      tableCol: {
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: '#bfbfbf',
        padding: 8,
      },
      tableHeader: {
        backgroundColor: '#f0f0f0',
        fontWeight: 'bold',
      },
      summary: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#f8f8f8',
        borderRadius: 4,
      },
      saleItem: {
        marginBottom: 10,
        padding: 8,
        backgroundColor: '#f8f8f8',
        borderRadius: 4,
      },
      saleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 5,
        borderBottom: '1 solid #ddd',
        paddingBottom: 5,
      },
      saleItems: {
        marginLeft: 10,
        marginTop: 5,
      },
      saleItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 2,
      },
      saleTotal: {
        marginTop: 5,
        borderTop: '1 solid #ddd',
        paddingTop: 5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontWeight: 'bold',
      },
    });

    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Reporte de Ventas</Text>
            <Text style={styles.subtitle}>
              {selectedLocation ? `Ubicación: ${locations[selectedLocation]}` : 'Todas las ubicaciones'}
            </Text>
            <Text style={styles.subtitle}>
              Del {startDate?.toISOString().split('T')[0].split('-').reverse().join('/')} al {endDate?.toISOString().split('T')[0].split('-').reverse().join('/')}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resumen General</Text>
            <View style={styles.summary}>
              <Text>Total de Ventas: {reportData.totalSales}</Text>
              <Text>Monto Total: ${reportData.totalAmount.toLocaleString('es-MX')} MXN</Text>
              <Text>Ticket Promedio: ${reportData.averageTicket.toLocaleString('es-MX')} MXN</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ventas por Día</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.tableCol, { width: '40%' }]}>
                  <Text>Fecha</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Ventas</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Total</Text>
                </View>
              </View>
              {reportData.salesByDate.map((sale, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={[styles.tableCol, { width: '40%' }]}>
                    <Text>{sale.date}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>{sale.count}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>${sale.amount.toLocaleString('es-MX')} MXN</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top 5 Productos</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.tableCol, { width: '40%' }]}>
                  <Text>Producto</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Cantidad</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Total</Text>
                </View>
              </View>
              {reportData.topProducts.map((product, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={[styles.tableCol, { width: '40%' }]}>
                    <Text>{product.name}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>{product.quantity}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>${product.total.toLocaleString('es-MX')} MXN</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top 5 Clientes</Text>
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHeader]}>
                <View style={[styles.tableCol, { width: '40%' }]}>
                  <Text>Cliente</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Compras</Text>
                </View>
                <View style={[styles.tableCol, { width: '30%' }]}>
                  <Text>Total</Text>
                </View>
              </View>
              {reportData.salesByClient.map((client, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={[styles.tableCol, { width: '40%' }]}>
                    <Text>{client.clientName}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>{client.count}</Text>
                  </View>
                  <View style={[styles.tableCol, { width: '30%' }]}>
                    <Text>${client.amount.toLocaleString('es-MX')} MXN</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalle de Ventas</Text>
            {reportData.detailedSales.map((sale, index) => (
              <View key={index} style={styles.saleItem}>
                <View style={styles.saleHeader}>
                  <Text>Venta #{sale.id}</Text>
                  <Text>{sale.date}</Text>
                </View>
                <Text>Cliente: {sale.clientName}</Text>
                <Text>Ubicación: {sale.location}</Text>
                <Text>Vendedor: {sale.salesman}</Text>
                
                <View style={styles.saleItems}>
                  {sale.items.map((item, itemIndex) => (
                    <View key={itemIndex} style={styles.saleItemRow}>
                      <Text>{item.quantity}x {item.name}</Text>
                      <Text>${item.total.toLocaleString('es-MX')} MXN</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.saleTotal}>
                  <Text>Subtotal:</Text>
                  <Text>${sale.subtotal.toLocaleString('es-MX')} MXN</Text>
                </View>
                {sale.discount > 0 && (
                  <View style={styles.saleItemRow}>
                    <Text>Descuento ({sale.discount}%):</Text>
                    <Text>-${((sale.subtotal * sale.discount) / 100).toLocaleString('es-MX')} MXN</Text>
                  </View>
                )}
                <View style={styles.saleTotal}>
                  <Text>Total:</Text>
                  <Text>${sale.total.toLocaleString('es-MX')} MXN</Text>
                </View>
              </View>
            ))}
          </View>
        </Page>
      </Document>
    );
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="space-y-2">
          <Label htmlFor="startDate" className="text-base">Fecha Inicial</Label>
          <div className="relative">
            <input
              type="date"
              id="startDate"
              value={startDate ? startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
              className={`w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !startDate ? 'text-gray-400' : 'text-gray-900'
              }`}
            />
            <Filter className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="endDate" className="text-base">Fecha Final</Label>
          <div className="relative">
            <input
              type="date"
              id="endDate"
              value={endDate ? endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
              className={`w-full pl-9 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !endDate ? 'text-gray-400' : 'text-gray-900'
              }`}
            />
            <Filter className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location" className="text-base">Ubicación</Label>
          <div className="relative">
            <select
              id="location"
              value={selectedLocation || ''}
              onChange={(e) => setSelectedLocation(e.target.value ? Number(e.target.value) : null)}
              className="w-full pl-9 pr-4 py-2 h-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas las ubicaciones</option>
              {Object.entries(locations).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <MapPin className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          onClick={async () => {
            await new Promise(resolve => setTimeout(resolve, 0)); // espera un ciclo del event loop
            generateReport();
          }}
          disabled={loading || !startDate || !endDate}
          className="bg-blue-500 hover:bg-blue-600 h-10 px-6"
        >
          {loading ? 'Generando...' : 'Generar Reporte'}
        </Button>

        {pdfReady && reportData && pdfComponents && (
          <pdfComponents.PDFDownloadLink
            document={createPDFDocument()}
            fileName={`reporte-ventas-${startDate?.toISOString().split('T')[0]}-${endDate?.toISOString().split('T')[0]}.pdf`}
            className="inline-flex items-center gap-2 px-6 h-10 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            {({ loading: pdfLoading }: { loading: boolean }) => (
              <>
                <Download className="w-4 h-4" />
                {pdfLoading ? 'Preparando PDF...' : 'Descargar PDF'}
              </>
            )}
          </pdfComponents.PDFDownloadLink>
        )}
      </div>
    </div>
  );
};

export default SalesReportGenerator;