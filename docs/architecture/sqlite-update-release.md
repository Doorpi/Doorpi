# Migração SQLite e distribuição

O cutover usa schema local 1, Doorpi 0.4.31 e updater 0.1.2 como capacidades mínimas. Compilar o aplicativo não autoriza publicar uma atualização nem comprova a recuperação completa em uma máquina Windows instalada.

## Ordem da atualização

1. O aplicativo instala o updater oferecido pelo manifesto e confirma sua versão mínima antes do handoff.
2. O updater verifica assinatura, validade e versão do manifesto; espera o aplicativo anterior sair e obtém os mutexes da interface/supervisor para impedir reabertura durante o cutover.
3. O ZIP é conferido por tamanho, SHA-256 e manifesto interno. `storageSchemaVersion` e `minUpdaterVersion` estão dentro do ZIP protegido pelo hash assinado.
4. Antes de substituir binários, `StorageMigration.Prepare` cria um checkpoint recuperável em `storage/checkpoints/<operationId>`. Um banco anterior recebe backup consistente pela API SQLite. As fontes legadas são preservadas e copiadas para o checkpoint.
5. A migração termina no updater. Só então os binários são aplicados. O inventário de rollback registra arquivos introduzidos para que DLLs novas não permaneçam misturadas com a versão anterior.
6. Os mutexes são liberados para uma inicialização identificada pelo sinal de saúde daquela operação. A aplicação só confirma saúde após prontidão interativa, versão correspondente e integridade do armazenamento.
7. Se o primeiro boot falhar, o updater encerra somente os processos Doorpi da instalação/sessão, obtém novamente os mutexes e restaura dados e binários compatíveis. Falha de recuperação preserva os backups e bloqueia a reabertura automática.

Uma operação interrompida é reconhecida pelo estado de bootstrap e pelo checkpoint imutável. Uma abertura comum não pode confirmar saúde de outra operação nem abrir os dados durante aplicação/recuperação. A recuperação é repetível; a ausência de um checkpoint que já havia sido confirmado é erro, não uma indicação de sucesso.

## Contratos físicos de bootstrap

`updates/state.json`, `updates/manifest-state.json` e `updates/manifest-cache.json` continuam físicos para permitir o handoff entre uma aplicação legada, o updater novo e a aplicação nova sem importar o banco antes do backup. O recibo `.checkpoint`, os manifestos de pacotes e os manifestos de distribuição também são contratos explícitos de atualização. Isso não torna essas pastas um armazenamento alternativo de perfis, bibliotecas ou controles.

O estado operacional usa substituição atômica, flush e cópia anterior. Corrupção de ambas as cópias bloqueia a operação. Os checkpoints de armazenamento ficam fora da limpeza dos pacotes temporários e permanecem disponíveis após a atualização.

## Downgrade

`allowRollback` assinado autoriza a direção da versão, mas não garante compatibilidade dos dados. O updater rejeita um pacote legado sem suporte ao schema quando já existe banco SQLite. O rollback automático do primeiro boot usa o checkpoint exato da operação; não é equivalente a baixar arbitrariamente uma versão antiga. Não excluir o banco para permitir um downgrade.

## Artefatos assinados

`scripts/build-release.ps1` exige uma chave privada cuja identidade pública já esteja em `TrustedUpdateKeys`, executa os testes de storage/update, publica ambos os componentes e verifica a DLL nativa SQLite. Depois calcula tamanhos e hashes reais, assina um manifesto novo e reabre os pacotes para verificar assinatura confiável, hashes, entry points e capacidades. Falha de validação remove o manifesto recém-gerado. O manifesto acompanhado no repositório não é alterado automaticamente.

Exemplo da geração local final, sem publicar:

```powershell
./scripts/build-release.ps1 -DoorpiVersion 0.4.31 -UpdaterVersion 0.1.2 `
  -ManifestPrivateKeyPath '<caminho da chave existente confiável>'
```

O manifesto final e os ZIPs ficam em `artifacts/release`. A versão do manifesto precisa ser superior à já distribuída; a validade e os URLs precisam corresponder ao momento da distribuição. Gerar os arquivos não envia nada ao GitHub nem ao servidor.

Se for desejável distribuir primeiro apenas o updater, a ponte reutiliza o ZIP real anterior do Doorpi, sem recompilar código atual com uma versão antiga e sem inventar hashes:

```powershell
./scripts/build-release.ps1 -UpdaterBridge -DoorpiVersion 0.4.30 `
  -UpdaterVersion 0.1.2 -BridgeDoorpiPackagePath '<ZIP real do Doorpi 0.4.30>' `
  -ManifestPrivateKeyPath '<caminho da chave existente confiável>'
```

Essa saída fica em `artifacts/release-updater-bridge`, separada do release final. Para uma instalação já em 0.4.30, o manifesto ponte oferece apenas o avanço do updater; o manifesto final 0.4.31 introduz o cutover. A ponte não permite downgrade e exige o pacote legado real como entrada.

## Instalador

O instalador Inno desta entrega aceita instalação limpa. Ele bloqueia instalação por cima de um Doorpi ou de dados existentes porque a cópia direta de arquivos do Inno não participa do checkpoint/health rollback do updater. Atualizações de instalações existentes devem passar pelo updater interno. Reinstalação com dados retidos também exige recuperação compatível; apagar dados para contornar essa proteção não faz parte do fluxo.

`build-installer.ps1`, inclusive com `-SkipReleaseBuild`, confere as versões dos pacotes e revalida o manifesto assinado antes de gerar o instalador.

## Verificação e limites

`Doorpi.UpdateCore.Tests` exercita requisitos do updater, proteção da assinatura, bloqueio de schemas incompatíveis, remoção de DLLs introduzidas no rollback, recuperação do estado de bootstrap, política de inicialização, migração real de JSON e restauração de banco anterior após falha de saúde. `Doorpi.Storage.Tests` cobre transações, concorrência, corrupção e interrupção em dados sintéticos.

Antes da publicação, ainda é necessário testar o conjunto instalado em Windows: primeira instalação, upgrade da versão distribuída, corte de energia/processo durante migração/aplicação, falha do primeiro boot, falta de espaço, locks de arquivos e retorno à versão anterior. O teste de health rollback do Core não simula sozinho a sessão gráfica do Windows ou todas as operações do instalador.
