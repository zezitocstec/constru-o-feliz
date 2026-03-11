import { useEffect, useState } from 'react';
import { Truck, Search, Package, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface Supplier {
  id: string;
  cnpj: string | null;
  name: string;
  trade_name: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface SupplierProduct {
  id: string;
  supplier_price: number;
  supplier_product_code: string | null;
  last_purchase_date: string | null;
  product: { id: string; name: string; stock: number; ean: string | null } | null;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');
    setSuppliers(data || []);
    setLoading(false);
  };

  const openSupplierProducts = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setLoadingProducts(true);
    const { data } = await supabase
      .from('supplier_products')
      .select('id, supplier_price, supplier_product_code, last_purchase_date, product_id')
      .eq('supplier_id', supplier.id);

    if (data && data.length > 0) {
      const productIds = data.map((sp: any) => sp.product_id);
      const { data: products } = await supabase
        .from('products')
        .select('id, name, stock, ean')
        .in('id', productIds);

      const merged = data.map((sp: any) => ({
        ...sp,
        product: products?.find((p: any) => p.id === sp.product_id) || null,
      }));
      setSupplierProducts(merged);
    } else {
      setSupplierProducts([]);
    }
    setLoadingProducts(false);
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.cnpj?.includes(search) ||
    s.trade_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Fornecedores</h1>
          <p className="text-muted-foreground">Gerencie seus fornecedores e veja os produtos de cada um</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CNPJ ou razão social..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Fornecedores ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Nenhum fornecedor encontrado</p>
                <p className="text-sm text-muted-foreground">Importe um XML de NF-e para cadastrar fornecedores automaticamente</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{s.name}</p>
                          {s.trade_name && <p className="text-xs text-muted-foreground">{s.trade_name}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{s.cnpj || '-'}</TableCell>
                      <TableCell>{s.city && s.state ? `${s.city}/${s.state}` : '-'}</TableCell>
                      <TableCell>{s.phone || '-'}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openSupplierProducts(s)} className="gap-1">
                          <Package className="h-3 w-3" />
                          Produtos
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supplier products dialog */}
      <Dialog open={!!selectedSupplier} onOpenChange={() => setSelectedSupplier(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Produtos de {selectedSupplier?.name}</DialogTitle>
          </DialogHeader>
          {loadingProducts ? (
            <p className="text-center py-8 text-muted-foreground">Carregando...</p>
          ) : supplierProducts.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum produto vinculado</p>
          ) : (
            <div className="overflow-x-auto max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cód. Fornecedor</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>EAN</TableHead>
                    <TableHead className="text-right">Preço Compra</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead>Última Compra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierProducts.map(sp => (
                    <TableRow key={sp.id}>
                      <TableCell className="font-mono text-xs">{sp.supplier_product_code || '-'}</TableCell>
                      <TableCell className="font-medium">{sp.product?.name || 'Produto removido'}</TableCell>
                      <TableCell className="font-mono text-xs">{sp.product?.ean || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(sp.supplier_price)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={sp.product && sp.product.stock <= 5 ? 'destructive' : 'secondary'}>
                          {sp.product?.stock ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sp.last_purchase_date
                          ? new Date(sp.last_purchase_date).toLocaleDateString('pt-BR')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Suppliers;
