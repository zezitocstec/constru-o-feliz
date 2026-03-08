import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

const PDVCustomers = () => {
  return (
    <PDVLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Módulo de clientes em breve</p>
            <p className="text-sm">O cadastro de clientes para o PDV será implementado em breve.</p>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
};

export default PDVCustomers;
