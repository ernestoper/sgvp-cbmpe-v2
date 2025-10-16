#!/usr/bin/env node

/**
 * Script para gerar PDF da documentação da arquitetura
 * Uso: node scripts/generate-pdf.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Função para gerar HTML a partir do Markdown
function generateHTML() {
  const arquiteturaPath = path.join(__dirname, '../docs/ARQUITETURA.md');
  const readmePath = path.join(__dirname, '../README.md');
  
  if (!fs.existsSync(arquiteturaPath)) {
    console.error('❌ Arquivo ARQUITETURA.md não encontrado!');
    process.exit(1);
  }

  const arquiteturaContent = fs.readFileSync(arquiteturaPath, 'utf8');
  const readmeContent = fs.readFileSync(readmePath, 'utf8');

  // Template HTML com estilos para PDF
  const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SGVP CBM-PE v2 - Documentação da Arquitetura</title>
    <style>
        @page {
            size: A4;
            margin: 2cm;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0;
            padding: 0;
        }
        
        .cover-page {
            text-align: center;
            padding: 4cm 0;
            page-break-after: always;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: -2cm;
            padding: 6cm 2cm;
        }
        
        .cover-page h1 {
            font-size: 3em;
            margin-bottom: 0.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .cover-page h2 {
            font-size: 1.5em;
            margin-bottom: 2em;
            opacity: 0.9;
        }
        
        .cover-page .info {
            background: rgba(255,255,255,0.1);
            padding: 2em;
            border-radius: 10px;
            margin: 2em auto;
            max-width: 500px;
        }
        
        .cover-page .date {
            font-size: 1.2em;
            margin-top: 2em;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 0.5em;
            page-break-before: always;
        }
        
        h2 {
            color: #34495e;
            border-left: 4px solid #3498db;
            padding-left: 1em;
            margin-top: 2em;
        }
        
        h3 {
            color: #7f8c8d;
            margin-top: 1.5em;
        }
        
        code {
            background: #f8f9fa;
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        pre {
            background: #f8f9fa;
            padding: 1em;
            border-radius: 5px;
            border-left: 4px solid #3498db;
            overflow-x: auto;
            font-size: 0.85em;
        }
        
        .mermaid-placeholder {
            background: #e8f4fd;
            border: 2px dashed #3498db;
            padding: 2em;
            text-align: center;
            border-radius: 8px;
            margin: 1em 0;
            color: #2980b9;
            font-weight: bold;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 0.75em;
            text-align: left;
        }
        
        th {
            background: #f8f9fa;
            font-weight: bold;
        }
        
        .emoji {
            font-size: 1.2em;
        }
        
        .highlight-box {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 5px;
            padding: 1em;
            margin: 1em 0;
        }
        
        .tech-stack {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1em;
            margin: 1em 0;
        }
        
        .tech-item {
            background: #f8f9fa;
            padding: 1em;
            border-radius: 8px;
            border-left: 4px solid #3498db;
        }
        
        .footer {
            text-align: center;
            margin-top: 3em;
            padding: 2em;
            border-top: 2px solid #3498db;
            color: #7f8c8d;
        }
        
        @media print {
            .cover-page {
                background: #667eea !important;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
            }
        }
    </style>
</head>
<body>
    <!-- Página de Capa -->
    <div class="cover-page">
        <h1>🔥 SGVP CBM-PE v2</h1>
        <h2>Sistema de Gestão de Vistorias e Processos</h2>
        
        <div class="info">
            <h3>📊 Documentação da Arquitetura</h3>
            <p><strong>Portal do Cidadão</strong></p>
            <p>Corpo de Bombeiros Militar de Pernambuco</p>
        </div>
        
        <div class="date">
            📅 Gerado em: ${new Date().toLocaleDateString('pt-BR', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}
        </div>
    </div>

    <!-- Conteúdo Principal -->
    ${convertMarkdownToHTML(arquiteturaContent)}
    
    <!-- Resumo do README -->
    <h1>📚 Resumo do Sistema</h1>
    ${convertMarkdownToHTML(readmeContent.split('## 🎯 **Fluxo do Sistema**')[0])}
    
    <!-- Rodapé -->
    <div class="footer">
        <p><strong>🚒 Corpo de Bombeiros Militar de Pernambuco</strong></p>
        <p>Sistema desenvolvido para modernizar e digitalizar os processos de vistoria</p>
        <p><em>Desenvolvido com ❤️ para o CBM-PE</em></p>
    </div>
</body>
</html>`;

  return htmlTemplate;
}

// Função simples para converter Markdown para HTML
function convertMarkdownToHTML(markdown) {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    
    // Mermaid diagrams
    .replace(/```mermaid[\s\S]*?```/g, '<div class="mermaid-placeholder">📊 Diagrama Mermaid<br><em>Visualize este diagrama no arquivo original ou em ferramentas online</em></div>')
    
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre><code>${code}</code></pre>`;
    })
    
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    
    // Lists
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.*)$/gim, '<p>$1</p>')
    
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<h[1-6]>.*<\/h[1-6]>)<\/p>/g, '$1')
    .replace(/<p>(<ul>.*<\/ul>)<\/p>/g, '$1')
    .replace(/<p>(<pre>.*<\/pre>)<\/p>/g, '$1')
    .replace(/<p>(<div.*<\/div>)<\/p>/g, '$1');
}

// Função principal
function main() {
  console.log('📄 Gerando PDF da documentação da arquitetura...');
  
  try {
    const html = generateHTML();
    const outputPath = path.join(__dirname, '../docs/SGVP-CBM-PE-v2-Arquitetura.html');
    
    fs.writeFileSync(outputPath, html, 'utf8');
    
    console.log('✅ HTML gerado com sucesso!');
    console.log(`📁 Arquivo: ${outputPath}`);
    console.log('');
    console.log('🖨️  Para gerar o PDF:');
    console.log('1. Abra o arquivo HTML no navegador');
    console.log('2. Use Ctrl+P (Cmd+P no Mac)');
    console.log('3. Selecione "Salvar como PDF"');
    console.log('4. Configure margens como "Mínimas"');
    console.log('5. Ative "Gráficos de fundo" para manter as cores');
    console.log('');
    console.log('🌐 Ou use ferramentas online:');
    console.log('- https://www.html-to-pdf.net/');
    console.log('- https://pdfcrowd.com/html-to-pdf-api/');
    
  } catch (error) {
    console.error('❌ Erro ao gerar HTML:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { generateHTML, convertMarkdownToHTML };