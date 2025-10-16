#!/bin/bash

# Script para remover logs de debug antes do deploy
# Execute: bash v2/scripts/remove-debug-logs.sh

echo "🧹 Removendo logs de debug..."

# Backup do arquivo
cp v2/src/pages/DetalheProcessoAdmin.tsx v2/src/pages/DetalheProcessoAdmin.tsx.backup

# Remover linhas com console.log de debug (emojis)
sed -i "/console\.log('🔄/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('📝/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('✅/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('🟢/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('🔵/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('🔴/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('📄/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('User:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Process:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Selected document:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('New status:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Stage approved:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Current status:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Status flow:/d" v2/src/pages/DetalheProcessoAdmin.tsx
sed -i "/console\.log('Rejection reason:/d" v2/src/pages/DetalheProcessoAdmin.tsx

echo "✅ Logs de debug removidos!"
echo "📦 Backup salvo em: v2/src/pages/DetalheProcessoAdmin.tsx.backup"
