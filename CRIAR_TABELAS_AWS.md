# 📋 Criar Tabelas no DynamoDB

## Acesse AWS Console

1. https://console.aws.amazon.com/dynamodb
2. Região: **us-east-1** (N. Virginia)

---

## Criar 5 Tabelas

### 1️⃣ Tabela: processes

```
1. Clique em "Create table"
2. Preencha:
   - Table name: processes
   - Partition key: id (String)
3. Settings: Default settings
4. Read/write capacity: On-demand
5. "Create table"
```

### 2️⃣ Tabela: process_history

```
1. Clique em "Create table"
2. Preencha:
   - Table name: process_history
   - Partition key: id (String)
3. Settings: Default settings
4. Read/write capacity: On-demand
5. "Create table"
```

### 3️⃣ Tabela: process_documents

```
1. Clique em "Create table"
2. Preencha:
   - Table name: process_documents
   - Partition key: id (String)
3. Settings: Default settings
4. Read/write capacity: On-demand
5. "Create table"
```

### 4️⃣ Tabela: profiles

```
1. Clique em "Create table"
2. Preencha:
   - Table name: profiles
   - Partition key: id (String)
3. Settings: Default settings
4. Read/write capacity: On-demand
5. "Create table"
```

### 5️⃣ Tabela: user_roles

```
1. Clique em "Create table"
2. Preencha:
   - Table name: user_roles
   - Partition key: id (String)
3. Settings: Default settings
4. Read/write capacity: On-demand
5. "Create table"
```

---

## ✅ Checklist

```
□ processes
□ process_history
□ process_documents
□ profiles
□ user_roles
```

---

## 🚀 Depois de Criar

Rode o v2:

```bash
cd v2
npx netlify dev
```

Acesse: http://localhost:8888
