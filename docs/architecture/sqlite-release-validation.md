# Estado da entrega SQLite 0.4.31 / updater 0.1.2

Pacotes locais gerados e manifesto assinado pela chave de produção existente. O pipeline verificou assinatura confiável, SHA-256, tamanhos, versão mínima do updater e capacidade de schema dos pacotes. `manifests/beta.json` contém o manifesto real gerado. Não houve publicação no servidor.

Passaram os harnesses de persistência (15), armazenamento (85), updater (41), controles (14), sincronização (14), permissões/recursos privados (79), integração de boot e os três verificadores JavaScript. Os testes usam dados sintéticos e não migraram dados pessoais.

O objetivo é integridade: propriedade explícita, rejeição de snapshots obsoletos, transações relacionadas, recuperação de interrupção e ausência de fallback entre perfis. Os contratos externos e recibos documentados de bootstrap continuam físicos. A camada de compatibilidade de caminhos permite a transição do código existente; ela não representa desacoplamento completo do MainWindow.

## Antes de publicar

- Validar instalação limpa e atualização instalada em uma máquina Windows de teste, incluindo queda durante migração e falha de primeiro boot.
- Exercitar sincronização Google Drive real entre dois computadores, com versões antigas/novas e alterações concorrentes.
- Validar reprodução/seek dos recursos locais no WebView após substituição do mapping privado.
- Resolver a operação de exclusão de histórico: a remoção e o reset de tempo da biblioteca ainda são etapas separadas; uma gravação concorrente pode recriar o registro no intervalo. É um achado remanescente, não coberto pela nova transação de gravação da biblioteca.
- Revisar os demais achados de sessão/janelas da auditoria original. Esta entrega não afirma corrigir todos os 18 achados.
- O instalador bloqueia upgrade direto sobre dados existentes; esse caminho deve passar pelo updater com checkpoint e rollback. Isso precisa constar das orientações da versão.

A assinatura do manifesto confirma autenticidade/integridade dos pacotes; não é certificação de funcionamento em produção nem assinatura Authenticode do instalador.
