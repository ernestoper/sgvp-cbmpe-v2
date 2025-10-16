🧭 FLUXO COMPLETO DO PROCESSO – TIMELINE INTEGRADA
🔹 ETAPA 1 — CADASTRO DO PROCESSO
Usuário (Empresa):

Preenche as informações básicas do processo (CNPJ, endereço, dados da empresa).

Envia os documentos iniciais obrigatórios (ex: planta, ART, memorial, etc.).

Após anexar os arquivos, clica em “Enviar para análise”.

O sistema marca o status da etapa como:

🕓 Aguardando análise do CBM-PE

Admin (CBM-PE / Bombeiro):

Recebe o processo com o status “Aguardando análise”.

Visualiza os documentos enviados e pode:

✅ Aprovar → Avança para a etapa Triagem;

❌ Reprovar → Retorna ao usuário com justificativa e opção de corrigir/reenviar.

Após aprovação, o sistema atualiza:

Usuário: “✅ Cadastro aprovado – aguardando triagem”

Admin: “✅ Cadastro concluído”

🔹 ETAPA 2 — TRIAGEM
Usuário:

Nesta fase, o usuário aguarda o CBM-PE revisar se toda a documentação inicial está correta.

Caso algo falte, recebe uma notificação de pendência, podendo corrigir e reenviar documentos.

Admin:

Verifica conformidade documental.

Pode:

✅ Aprovar → Encaminha para Vistoria;

❌ Reprovar → Retorna ao usuário para correção.

Quando aprovada:

Usuário vê: “✅ Triagem concluída – aguardando vistoria”

Admin vê: “✅ Triagem aprovada”

🔹 ETAPA 3 — VISTORIA
Usuário:

Recebe notificação que a vistoria foi agendada.

Pode anexar imagens, relatórios ou laudos complementares (caso exigido).

Após anexar, aguarda a análise.

Admin:

Realiza ou agenda a vistoria no local.

Anexa relatório de vistoria (documento ou imagem).

Pode:

✅ Aprovar → Encaminha para Comissão;

❌ Reprovar → Retorna ao usuário para ajustes/correções (novos anexos possíveis).

Status sincronizados:

Usuário: “✅ Vistoria aprovada – aguardando comissão”

Admin: “✅ Vistoria concluída”

🔹 ETAPA 4 — COMISSÃO
Usuário:

Apenas acompanha o andamento.

Pode ser solicitado a enviar documentos complementares (ex: ART revisada, declarações, etc.)

Caso isso ocorra, habilita-se o botão “Corrigir/Reenviar Documento”.

Admin:

Comissão interna analisa todo o processo técnico e decide aprovação ou ajustes.

Pode:

✅ Aprovar → Encaminha para Aprovação Final;

❌ Reprovar → Retorna ao usuário com observações e liberação para reenviar.

Status sincronizados:

Usuário: “✅ Comissão aprovada – aguardando aprovação final”

Admin: “✅ Comissão concluída”

🔹 ETAPA 5 — APROVAÇÃO FINAL
Usuário:

Visualiza status: “🕓 Aguardando aprovação final do CBM-PE”.

Nenhuma ação necessária até a decisão final.

Admin:

Verifica toda a documentação, relatórios e pareceres anteriores.

Pode:

✅ Aprovar para carimbo → Envia para etapa Conclusão;

❌ Reprovar → Retorna ao usuário para reenviar os documentos solicitados.

Status sincronizados:

Usuário: “✅ Aprovado para carimbo – aguardando liberação final”

Admin: “✅ Aprovado – pronto para carimbo”

🔹 ETAPA 6 — CONCLUSÃO E CARIMBO
Admin (CBM-PE):

Abre o documento final aprovado.

Define manualmente a área onde o carimbo será aplicado (preview interativo).

Clica em “Aplicar carimbo e concluir processo”.

O sistema:

Gera o PDF carimbado (com data, hora, e identificador digital);

Atualiza status do processo para “Concluído”;

Armazena o documento carimbado.

Status exibido:

✅ Processo concluído com sucesso
📎 Documento carimbado salvo em /uploads/processos/{id}/documento_carimbado.pdf

Usuário (Empresa):

Recebe notificação:

“Seu documento foi aprovado e carimbado pelo CBM-PE.”

Na timeline, a última etapa muda para:

✅ Concluído — Documento Carimbado

Exibe botão:

⬇️ Baixar Documento Carimbado

O documento fica somente leitura, sem opção de exclusão ou reenvio.


🧩 REGRAS GERAIS

❌ O usuário não pode excluir anexos — apenas corrigir/reenviar.

✅ Todos os documentos reprovados voltam habilitados para reenviar.

🔒 Após aprovação de uma etapa, os anexos anteriores ficam bloqueados.

🔔 Cada movimentação (aprovação/reprovação/envio) gera notificação automática.

🧾 O histórico de cada ação é registrado (com data, hora e responsável).