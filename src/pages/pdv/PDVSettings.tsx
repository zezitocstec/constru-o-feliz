import { PDVLayout } from '@/components/pdv/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Settings } from 'lucide-react';

const PDVSettings = () => {
  return (
    <PDVLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Configurações do PDV</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Settings className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Configurações em breve</p>
            <p className="text-sm">Personalize dados da empresa, impressora e cupom fiscal.</p>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
};

export default PDVSettings;
