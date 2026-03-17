#!/bin/bash
# =============================================================
# Deploy Edge Functions para Supabase Self-Hosted
# MD DEPÓSITO - Materiais de Construção
# =============================================================

set -e

# ===================== CONFIGURAÇÃO =====================
SUPABASE_API_URL="${SUPABASE_API_URL:-https://sb.sega4.com.br}"
PROJECT_REF="${PROJECT_REF:-default}"
FUNCTIONS=("chatbot" "parse-product-file" "notify-order-status")

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Deploy Edge Functions - Supabase Self-Host ${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo "API URL:     $SUPABASE_API_URL"
echo "Project Ref: $PROJECT_REF"
echo ""

# ===================== PRÉ-REQUISITOS =====================
# Verificar se supabase CLI está instalado
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}Supabase CLI não encontrado. Instalando...${NC}"
    if command -v brew &> /dev/null; then
        brew install supabase/tap/supabase
    elif command -v npm &> /dev/null; then
        npm install -g supabase
    else
        echo -e "${RED}Erro: Instale o Supabase CLI manualmente:${NC}"
        echo "  https://supabase.com/docs/guides/cli/getting-started"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Supabase CLI encontrado${NC}"

# ===================== VERIFICAR ESTRUTURA =====================
echo ""
echo -e "${YELLOW}Verificando arquivos das functions...${NC}"

for fn in "${FUNCTIONS[@]}"; do
    if [ ! -f "supabase/functions/$fn/index.ts" ]; then
        echo -e "${RED}✗ supabase/functions/$fn/index.ts não encontrado${NC}"
        echo "  Execute este script na raiz do projeto."
        exit 1
    fi
    echo -e "${GREEN}  ✓ $fn/index.ts${NC}"
done

# ===================== CONFIGURAR SECRETS =====================
echo ""
echo -e "${YELLOW}Configurando secrets...${NC}"

# Solicitar GOOGLE_GEMINI_API_KEY se não estiver definida
if [ -z "$GOOGLE_GEMINI_API_KEY" ]; then
    read -p "Digite sua GOOGLE_GEMINI_API_KEY: " GOOGLE_GEMINI_API_KEY
fi

if [ -n "$GOOGLE_GEMINI_API_KEY" ]; then
    echo -e "  Definindo GOOGLE_GEMINI_API_KEY..."
    supabase secrets set GOOGLE_GEMINI_API_KEY="$GOOGLE_GEMINI_API_KEY" \
        --project-ref "$PROJECT_REF" 2>/dev/null || \
    echo -e "${YELLOW}  ⚠ Não foi possível definir via CLI. Configure manualmente no painel.${NC}"
fi

# WhatsApp (opcional)
if [ -n "$WHATSAPP_API_URL" ] && [ -n "$WHATSAPP_API_KEY" ]; then
    echo -e "  Definindo WHATSAPP_API_URL e WHATSAPP_API_KEY..."
    supabase secrets set \
        WHATSAPP_API_URL="$WHATSAPP_API_URL" \
        WHATSAPP_API_KEY="$WHATSAPP_API_KEY" \
        --project-ref "$PROJECT_REF" 2>/dev/null || true
fi

# ===================== DEPLOY =====================
echo ""
echo -e "${YELLOW}Iniciando deploy das Edge Functions...${NC}"
echo ""

FAILED=0
for fn in "${FUNCTIONS[@]}"; do
    echo -e "  Deploying ${GREEN}$fn${NC}..."
    
    # --no-verify-jwt para funções que precisam de acesso público
    NO_VERIFY=""
    if [ "$fn" = "chatbot" ]; then
        NO_VERIFY="--no-verify-jwt"
    fi

    if supabase functions deploy "$fn" \
        --project-ref "$PROJECT_REF" \
        $NO_VERIFY 2>&1; then
        echo -e "  ${GREEN}✓ $fn deployed com sucesso${NC}"
    else
        echo -e "  ${RED}✗ Falha no deploy de $fn${NC}"
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# ===================== RESULTADO =====================
echo -e "${GREEN}=============================================${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  ✓ Todas as 3 functions deployadas!${NC}"
else
    echo -e "${RED}  ✗ $FAILED function(s) falharam${NC}"
fi
echo -e "${GREEN}=============================================${NC}"
echo ""
echo "URLs das functions:"
for fn in "${FUNCTIONS[@]}"; do
    echo "  $SUPABASE_API_URL/functions/v1/$fn"
done
echo ""

# ===================== TESTE RÁPIDO =====================
echo -e "${YELLOW}Testando chatbot (health check)...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$SUPABASE_API_URL/functions/v1/chatbot" \
    -H "Content-Type: application/json" \
    -d '{"messages":[{"role":"user","content":"oi"}],"session_id":"test"}' \
    2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}  ✓ Chatbot respondeu com HTTP 200${NC}"
elif [ "$HTTP_CODE" = "000" ]; then
    echo -e "${YELLOW}  ⚠ Não foi possível conectar. Verifique a URL.${NC}"
else
    echo -e "${YELLOW}  ⚠ Chatbot respondeu com HTTP $HTTP_CODE${NC}"
fi

echo ""
echo -e "${GREEN}Deploy finalizado!${NC}"
