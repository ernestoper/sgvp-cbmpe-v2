# 🔥 SGVP CBM-PE v2 - Sistema de Gestão de Vistorias e Processos

> **Portal do Cidadão** - Corpo de Bombeiros Militar de Pernambuco

## 🚀 **Funcionalidades Implementadas**

### 👤 **Portal do Cidadão**
- ✅ **Cadastro de usuários** com validação de CNPJ via BrasilAPI
- ✅ **Login seguro** com autenticação
- ✅ **Perfil automático** criado no DynamoDB
- ✅ **Dashboard personalizado** para acompanhamento

### 📋 **Gestão de Processos**
- ✅ **Criação de processos** com dados da empresa
- ✅ **Numeração automática** de processos
- ✅ **Timeline interativa** com histórico completo
- ✅ **Status em tempo real** (cadastro → triagem → vistoria → aprovação)

### 📄 **Gestão de Documentos**
- ✅ **Upload para AWS S3** com chaves organizadas
- ✅ **Visualização de PDFs** integrada
- ✅ **Download de documentos** via URLs assinadas
- ✅ **Exclusão de documentos** com confirmação
- ✅ **Suporte a múltiplos formatos** (PDF, imagens, Word, Excel)

### 📱 **Notificações WhatsApp**
- ✅ **Integração com Evolution API**
- ✅ **Notificação automática** na criação de processos
- ✅ **Mensagens personalizadas** com dados do processo
- ✅ **Formatação profissional** com emojis e estrutura

### 🗄️ **Banco de Dados**
- ✅ **AWS DynamoDB** para escalabilidade
- ✅ **Tabelas otimizadas**: processes, process_history, process_documents, profiles, user_roles
- ✅ **Mock do Supabase** para compatibilidade
- ✅ **CRUD completo** com logs detalhados

## 🛠️ **Tecnologias Utilizadas**

### **Frontend**
- **React 18** com TypeScript
- **Vite** para build otimizado
- **Tailwind CSS** para estilização
- **shadcn/ui** para componentes
- **React Router** para navegação
- **React Hook Form** para formulários

### **Backend & Infraestrutura**
- **Netlify Functions** (serverless)
- **AWS DynamoDB** (banco NoSQL)
- **AWS S3** (armazenamento de arquivos)
- **Evolution API** (WhatsApp)
- **BrasilAPI** (validação de CNPJ)

### **Autenticação**
- **Mock Supabase** integrado com DynamoDB
- **LocalStorage** para desenvolvimento
- **Roles e permissões** (admin/user)

## 🚀 **Como Executar**

### **1. Pré-requisitos**
```bash
# Node.js 18+ e npm
node --version
npm --version
```

### **2. Instalação**
```bash
# Clone o repositório
git clone <URL_DO_REPOSITORIO>
cd sgvp-cbmpe-v2

# Instale as dependências
npm install
```

### **3. Configuração**
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Configure as variáveis (veja seção abaixo)
nano .env
```

### **4. Execução**
```bash
# Desenvolvimento com Netlify Dev (recomendado)
npx netlify dev

# Ou apenas Vite (sem funções serverless)
npm run dev
```

## ⚙️ **Variáveis de Ambiente**

### **AWS (Obrigatório)**
```env
# DynamoDB
MY_AWS_REGION=us-east-1
MY_AWS_ACCESS_KEY_ID=sua_access_key
MY_AWS_SECRET_ACCESS_KEY=sua_secret_key

# S3
VITE_USE_S3=true
VITE_S3_BUCKET=seu-bucket
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=sua_access_key
VITE_AWS_SECRET_ACCESS_KEY=sua_secret_key
```

### **Supabase (Apenas para autenticação)**
```env
VITE_SUPABASE_PROJECT_ID=seu_project_id
VITE_SUPABASE_URL=https://seu-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

### **WhatsApp (Opcional)**
```env
VITE_EVOLUTION_API_URL=sua_evolution_api_url
VITE_EVOLUTION_API_TOKEN=seu_token
VITE_EVOLUTION_INSTANCE=sua_instance
```

## 🏗️ **Arquitetura do Sistema**

> **📊 [Ver Diagrama Completo da Arquitetura](./docs/ARQUITETURA.md)**

### **Visão Geral**
```
👤 Cidadão → 🌐 React App → ☁️ Netlify → 🔶 AWS (DynamoDB + S3) → 📱 WhatsApp
```

### **Stack Tecnológico**
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Netlify Functions (Serverless)
- **Database**: AWS DynamoDB (NoSQL)
- **Storage**: AWS S3 (Arquivos)
- **Auth**: Supabase Mock + LocalStorage
- **Notifications**: Evolution API (WhatsApp)

## 📊 **Estrutura do Projeto**

```
sgvp-cbmpe-v2/
├── src/
│   ├── pages/           # Páginas principais
│   │   ├── LoginUsuario.tsx    # Login do cidadão
│   │   ├── NovoProcesso.tsx    # Criação de processos
│   │   ├── DetalheProcesso.tsx # Visualização de processos
│   │   └── DashboardUsuario.tsx # Dashboard do cidadão
│   ├── components/      # Componentes reutilizáveis
│   │   ├── StatusBadge.tsx     # Badge de status
│   │   └── ProcessTimeline.tsx # Timeline do processo
│   ├── lib/            # Bibliotecas e utilitários
│   │   ├── dynamodb.ts         # Cliente DynamoDB
│   │   └── storage.ts          # Cliente S3
│   └── integrations/   # Integrações externas
│       └── supabase/           # Mock do Supabase
├── netlify/
│   └── functions/      # Funções serverless
│       └── analyses.js         # API universal DynamoDB
├── docs/              # Documentação
│   └── ARQUITETURA.md         # Diagrama da arquitetura
└── scripts/           # Scripts utilitários
```

## 🎯 **Fluxo do Sistema**

### **1. Cadastro do Cidadão**
1. Usuário acessa `/login/usuario`
2. Preenche dados pessoais e da empresa
3. Sistema valida CNPJ via BrasilAPI
4. Cria conta no mock Supabase
5. Cria perfil no DynamoDB
6. Redireciona para dashboard

### **2. Criação de Processo**
1. Usuário acessa `/processo/novo`
2. Preenche dados da empresa e contato
3. Sistema gera número único do processo
4. Salva no DynamoDB
5. Cria entrada no histórico
6. **Envia WhatsApp de confirmação**
7. Redireciona para detalhes do processo

### **3. Gestão de Documentos**
1. Usuário faz upload de documentos
2. Arquivos são enviados para S3
3. Metadados salvos no DynamoDB
4. Usuário pode visualizar, baixar ou excluir
5. Todas as ações são registradas no histórico

## 🔧 **Deploy**

### **Netlify (Recomendado)**
```bash
# Build do projeto
npm run build

# Deploy via Netlify CLI
netlify deploy --prod
```

### **Configurações no Netlify**
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Functions directory**: `netlify/functions`
- **Environment variables**: Copiar todas do `.env`

## 📱 **Usuários de Teste**

### **Usuários Hardcoded**
```
Admin:
- Email: admin@cbm.pe.gov.br
- Senha: Admin@CBM2025

Usuário:
- Email: usuario@empresa.com
- Senha: user123
```

### **Usuários Dinâmicos**
Qualquer usuário pode se cadastrar pelo portal e fazer login imediatamente.

## 🎨 **Screenshots**

- 🏠 **Homepage**: Interface moderna com gradientes
- 👤 **Login**: Tabs para login/cadastro
- 📋 **Novo Processo**: Formulário com validação CNPJ
- 📄 **Detalhes**: Timeline interativa + gestão de documentos
- 📱 **WhatsApp**: Notificações automáticas formatadas

## 🤝 **Contribuição**

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 **Licença**

Este projeto é propriedade do **Corpo de Bombeiros Militar de Pernambuco**.

## 🔥 **CBM-PE**

**Sistema desenvolvido para modernizar e digitalizar os processos de vistoria do Corpo de Bombeiros Militar de Pernambuco, proporcionando maior eficiência e transparência para cidadãos e empresas.**

---

**Desenvolvido com ❤️ para o CBM-PE** 🚒
