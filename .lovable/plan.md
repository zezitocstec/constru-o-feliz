
# Plano: Corrigir Links e Navegação do Site

## Problema Identificado

Vários botões e links do site não possuem ação ou navegação definida. Quando clicados, nada acontece.

## Solução Proposta

Vou conectar todos os botões às seções/páginas apropriadas:

| Botão/Link | Localização | Ação Atual | Ação Corrigida |
|------------|-------------|------------|----------------|
| "Fazer Orçamento Grátis" | Hero | Nenhuma | Rolar para seção de contato (#contato) |
| "Ver Produtos" | Hero | Nenhuma | Rolar para seção de produtos (#produtos) |
| "Fazer Orçamento" | Header | Nenhuma | Rolar para seção de contato (#contato) |
| "Ver todos os produtos" | Produtos | Nenhuma | Rolar para seção de produtos (#produtos) |
| Categorias | Seção Categorias | Link "#" quebrado | Rolar para seção de produtos (#produtos) |

## Arquivos a Modificar

1. **src/components/Hero.tsx**
   - Adicionar navegação ao botão "Ver Produtos" para `#produtos`
   - Adicionar navegação ao botão "Fazer Orçamento Grátis" para `#contato`

2. **src/components/Header.tsx**
   - Adicionar navegação ao botão "Fazer Orçamento" para `#contato` (desktop e mobile)

3. **src/components/FeaturedProducts.tsx**
   - Adicionar navegação ao botão "Ver todos os produtos" para `#produtos`

4. **src/components/Categories.tsx**
   - Conectar links das categorias à seção de produtos

---

## Detalhes Técnicos

### Método de Navegação

Utilizarei a função `scrollIntoView` do JavaScript para uma rolagem suave até as seções:

```typescript
const scrollToSection = (id: string) => {
  const element = document.getElementById(id);
  element?.scrollIntoView({ behavior: "smooth" });
};
```

### Alterações por Arquivo

**Hero.tsx:**
```tsx
<Button variant="hero" onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}>
  Ver Produtos
</Button>

<Button variant="heroOutline" onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}>
  Fazer Orçamento Grátis
</Button>
```

**Header.tsx:**
```tsx
<Button onClick={() => document.getElementById('contato')?.scrollIntoView({ behavior: 'smooth' })}>
  Fazer Orçamento
</Button>
```

**FeaturedProducts.tsx:**
```tsx
<Button variant="outline" onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}>
  Ver todos os produtos
</Button>
```

**Categories.tsx:**
```tsx
// Alterar href="#" para onClick com scroll suave
onClick={() => document.getElementById('produtos')?.scrollIntoView({ behavior: 'smooth' })}
```

## Resultado Esperado

Após as alterações, todos os botões de navegação funcionarão corretamente, levando o usuário às seções apropriadas com uma animação suave de rolagem.
