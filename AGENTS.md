# Doorpi: armazenamento e releases

- O estado interno do aplicativo deve usar a biblioteca `Doorpi.Storage` e SQLite. JSON físico fica restrito a contratos externos (manifestos assinados de distribuição, pacotes/extensões, intercâmbio da nuvem) e ao bootstrap de compatibilidade explicitamente documentado.
- Uma operação de perfil deve capturar o usuário de destino e validar sua revisão/geração antes de confirmar alterações após um `await`.
- Migrações devem ser idempotentes, preservar a origem e ter backup/rollback compatível com o rollback automático do updater. Não tratar arquivo corrompido como coleção vazia.
- Em toda entrega de atualização, preparar também os manifestos correspondentes: versões, `minUpdaterVersion`, versão monotônica do manifesto, validade, URLs, tamanho e SHA-256 dos pacotes efetivamente gerados.
- Manifestos de produção precisam de assinatura com uma chave já confiável pelo Doorpi. Nunca alterar campos assinados mantendo a assinatura anterior, gerar uma chave nova para contornar a confiança ou desativar as verificações de produção.
- Uma versão que exige novo schema de armazenamento deve exigir antes o updater compatível. Testar instalação limpa, atualização de dados legados, interrupção da migração e recuperação de falha no primeiro boot.
- Não afirmar que uma versão está publicada ou pronta para produção apenas porque compilou. Informar quais pacotes, assinaturas e verificações foram realmente produzidos.
