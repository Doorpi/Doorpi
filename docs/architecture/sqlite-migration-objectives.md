# Decisão: migrar o estado interno para SQLite

## Objetivo verificável

A migração existe para impedir mistura de dados entre usuários, perda silenciosa de alterações concorrentes e confirmação de estados parcialmente persistidos. Também deve eliminar a regravação de bibliotecas completas em operações que alteram uma entidade. Trocar o formato dos arquivos não é, por si só, uma entrega aceita.

## Garantias exigidas

1. **Uma autoridade por dado.** Depois do corte, dados internos são lidos do SQLite. JSON legado é origem de importação/backup, nunca fallback silencioso de um perfil para outro.
2. **Proprietário imutável.** Toda operação assíncrona captura usuário/identidade de destino e não usa o perfil corrente para decidir onde confirmar a gravação.
3. **Concorrência explícita.** Uma gravação baseada em snapshot obsoleto recebe conflito de revisão ou aplica um patch por entidade. Não substitui alterações confirmadas por outra operação.
4. **Atomicidade de domínio.** Perfil/históricos/controles/base de sync relacionados são confirmados em uma transação local. Falha em qualquer parte não deixa sucesso parcial.
5. **Migração recuperável.** Importação é idempotente, valida origem e relações, conserva proveniência e backup. Corrupção sem recuperação válida interrompe a migração; não vira uma coleção vazia.
6. **Rollback real.** Falha do primeiro boot reverte armazenamento e binários para estados compatíveis. A saúde só é confirmada depois de integridade e inicialização do storage.
7. **Nuvem recuperável.** Revisão/base comum só avança após confirmação local. Operações remotas pendentes são reconciliadas após crash; SQLite não fornece transação com Google Drive.
8. **Isolamento de exposição.** Banco, backups e documentos privados não são publicados para páginas externas pelo host virtual do navegador.
9. **Consultas proporcionais.** Controles e configurações usam snapshots em memória; alteração de arte não deve regravar histórico e catálogo completos.

## Critério de conclusão

As garantias são verificadas por testes de concorrência, troca de usuário durante await, falha injetada na importação/commit e rollback de primeiro boot, além de build, publish e teste do pacote instalado. Uma camada de compatibilidade com caminhos legados só serve à transição; não substitui as garantias acima nem representa desacoplamento completo do MainWindow.

## Escopo dos JSONs

O estado interno controlado pelo Doorpi migra para SQLite, incluindo configurações, coleções, caches e metadados de sessão. Permanecem físicos os contratos que outro componente exige: manifestos assinados de distribuição/pacote, manifestos de extensões/Chromium e formato de intercâmbio da nuvem. Os pequenos recibos de handoff entre versões do updater são protocolo de recuperação e têm política específica; não podem ser confundidos com a autoridade dos dados do usuário.

## Critério de release

O updater com capacidade de migração chega antes do aplicativo que exige o novo schema. O manifesto deve referenciar pacotes reais, hashes/tamanhos reais, versão mínima do updater, validade e assinatura por chave já confiável. Não se substitui assinatura válida por um manifesto editado manualmente. Publicar depende também de validação de dados legados e recuperação, não apenas da compilação.
