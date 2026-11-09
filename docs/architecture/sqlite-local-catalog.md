# Catálogo local e contrato da nuvem

## Fronteira preservada

O contrato remoto continua sendo `CloudProfileV1`, schema 5. `Games` representa
histórico e estatísticas; não é o inventário de jogos instalados. A migração não
exporta o SQLite, `GameModel`, `AppCacheModel`, fingerprints ou pastas monitoradas.
Cada computador mantém sua própria biblioteca e seus caminhos de execução.
As associações de controles conservam o contrato remoto anterior, inclusive seu
campo `ExecutablePath`; nenhuma alteração desse protocolo está incluída aqui.

## Schema local 2

`installed_apps` contém as linhas do cache por documento local e loja/origem:
identidade, proprietário, ordem, nome, nome normalizado para busca, origem,
executável, URL de lançamento, versão e payload dos demais atributos. Os índices
cobrem leitura ordenada, nome normalizado e caminho. A identidade é local à
coleção e não substitui o `GameKey` do histórico remoto.

Fingerprints e supressões permanecem em linhas de `nested_entities`, com o
proprietário do documento; timestamps das pastas ficam no envelope de metadados.
Isso preserva as preferências por perfil que já existiam. Não há novo inventário
remoto nem alteração da biblioteca de outro computador.

O carregamento lê metadados e linhas num snapshot consistente com sua revisão,
sem construir um JSON agregado. A gravação mantém linhas de instalações
inalteradas, atualiza as alteradas e remove as ausentes. O adapter ainda serializa
e valida a entrada completa ao salvar; fingerprints e supressões ainda usam a
projeção estruturada. Ícones continuam no payload individual. Paginação da UI,
separação dos ícones e resultados completos/incompletos por scanner são trabalhos
adicionais, não benefícios alegados desta mudança.

O snapshot do cache captura caminho, usuário e revisão. Uma gravação atrasada
rejeita perfil diferente ou revisão desatualizada. `UpdateAppCacheAsync` captura o
destino antes de aguardar a trava e verifica novamente o perfil após a varredura.
Falhas de leitura não são convertidas silenciosamente em cache vazio.

## Migração e recuperação

Instalações limpas e importações dos JSONs legados já criam schema 2. Bancos no
schema 1 recebem backup SQLite validado antes da alteração. A transferência das
linhas antigas para `installed_apps`, sua remoção de `nested_entities` e a mudança
de `user_version` são uma única transação. Uma falha mantém o estado anterior.
Os arquivos legados e os backups continuam preservados.

O checkpoint do updater copia o banco sem inicializar/atualizar seu schema. Isso
é necessário para que rollback de binários também restaure o schema anterior.
O suporte está declarado no updater 0.1.3 e o pipeline passa a declarar schema 2
e exigir `minUpdaterVersion` 0.1.3. Pacotes schema 1 continuam exigindo no mínimo
0.1.2; schema 2 é rejeitado com esse updater antigo.

## Entrega de teste

Esta mudança está no build isolado `artifacts/local-sqlite-test/catalog-v2/app`.
O estado vem de um clone consistente do teste anterior, via SQLite Backup API;
não foi gravado o banco da instalação normal nem o teste anterior.

O clone contém 184 instalações no schema 2 e passou por `integrity_check`.
Os testes automatizados cobrem migração, backup anterior ao upgrade, rollback,
reexecução após falha, versões incrementais, revisão obsoleta, troca de perfil e
preservação do catálogo/biblioteca durante a confirmação local da sincronização.
A suíte de sincronização exercita armazenamento local, não dois clientes Drive
reais. A interface do novo build ainda precisa de validação manual.

Não foram gerados novos pacotes nem manifestos assinados de produção para esta
etapa. Os manifestos assinados anteriores continuam descrevendo os pacotes antigos
e não devem ser usados para distribuir este build. Uma entrega de produção exige
regenerar e assinar os manifestos com os pacotes reais e validar updater antes do
aplicativo, inclusive falha no primeiro boot.
