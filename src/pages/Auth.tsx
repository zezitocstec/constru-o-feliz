import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Building2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

type AuthView = 'login' | 'signup' | 'forgot';

const Auth = () => {
  const [view, setView] = useState<AuthView>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading) {
      navigate('/admin');
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    try {
      if (view === 'login') {
        loginSchema.parse({ email, password });
      } else if (view === 'signup') {
        signupSchema.parse({ email, password, confirmPassword, fullName });
      }
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrors({ email: 'Informe seu email' });
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
      setView('login');
    }
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (view === 'forgot') {
      return handleForgotPassword(e);
    }

    if (!validateForm()) return;
    
    setIsSubmitting(true);

    try {
      if (view === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Erro ao entrar',
            description: error.message === 'Invalid login credentials' 
              ? 'Email ou senha incorretos' 
              : error.message,
          });
        } else {
          toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
          navigate('/admin');
        }
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast({
            variant: 'destructive',
            title: 'Erro ao cadastrar',
            description: error.message.includes('already registered')
              ? 'Este email já está cadastrado'
              : error.message,
          });
        } else {
          toast({ title: 'Cadastro realizado!', description: 'Verifique seu email para confirmar a conta.' });
          setView('login');
        }
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Ocorreu um erro inesperado. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const titles: Record<AuthView, string> = {
    login: 'Entrar',
    signup: 'Criar Conta',
    forgot: 'Recuperar Senha',
  };

  const descriptions: Record<AuthView, string> = {
    login: 'Acesse sua conta administrativa',
    signup: 'Cadastre-se para acessar o sistema',
    forgot: 'Informe seu email para receber o link de recuperação',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 hero-gradient rounded-xl flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display">{titles[view]}</CardTitle>
          <CardDescription>{descriptions[view]}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input id="fullName" type="text" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            
            {view !== 'forgot' && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>
            )}

            {view === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
            )}

            {view === 'login' && (
              <div className="text-right">
                <Button type="button" variant="link" className="p-0 h-auto text-sm" onClick={() => { setView('forgot'); setErrors({}); }}>
                  Esqueceu a senha?
                </Button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Carregando...' : view === 'login' ? 'Entrar' : view === 'signup' ? 'Cadastrar' : 'Enviar Link'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            {view === 'forgot' ? (
              <Button variant="link" className="p-0 h-auto" onClick={() => { setView('login'); setErrors({}); }}>
                ← Voltar ao login
              </Button>
            ) : (
              <>
                <span className="text-muted-foreground">
                  {view === 'login' ? 'Não tem conta? ' : 'Já tem conta? '}
                </span>
                <Button variant="link" className="p-0 h-auto" onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setErrors({}); }}>
                  {view === 'login' ? 'Cadastre-se' : 'Faça login'}
                </Button>
              </>
            )}
          </div>

          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              ← Voltar para a loja
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
