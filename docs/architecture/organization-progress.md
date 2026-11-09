# Organização incremental — registro de continuidade

## Etapa 1 — inventário e primeiras fronteiras

Data: 07/11/2026. Escopo desta rodada: inventariar a solução, isolar configuração
do WebView, localizar a bridge e subdividir o controlador da intro. Não houve
alteração da estratégia de boot nem implementação da política nova de permissões.

### Concluído

- [x] Registrar o propósito do produto e as decisões vigentes em `README.md`.
- [x] Criar inventário reproduzível por `scripts/Get-ArchitectureInventory.cjs`.
- [x] Indexar 349 arquivos de código/configuração e 48 recursos adicionais no escopo
  visível, abrangendo seis projetos. Há 94 arquivos C#; ignorados e dados pessoais
  são explicitamente excluídos.
- [x] Relacionar áreas funcionais, projetos/helpers, frontend e dependências no mapa.
- [x] Registrar 19 bundles, 130 fragmentos JS, 22 fragmentos de CSS principal e
  39 blocos CSS injetados. O mapa detalha cada bundle.
- [x] Registrar candidatos literais da comunicação sem contar novamente os bundles
  gerados. Os 643 candidatos não são apresentados como 643 comandos confirmados.
- [x] Extrair `BuildWebViewAdditionalArguments` para
  `Doorpi/Browser/WebViewRuntimeArguments.cs`, como `Build` estático.
- [x] Atualizar exatamente os três pontos de chamada: home, recuperação da home e
  ambientes compartilhados de mídia. Preservar corpo, flags e precedência do ambiente.
- [x] Mover o handler da bridge e a validação de origem para
  `Doorpi/MainWindow.WebMessageBridge.cs`, mantendo instância, ordem e dispatcher.
- [x] Subdividir a intro em oito fontes ordenadas, na mesma IIFE e com conteúdo
  recomposto idêntico. Preservar macros CSS e a API pública.
- [x] Atualizar mapa de fragmentos e inventário de estilos.
- [x] Conferir o propósito da extensão interna de trailers no seu código.
- [x] Alinhar a nova política de câmera/microfone com o autor e registrar requisitos
  antes da implementação.

### Fronteiras e evidência de preservação

| Antes | Depois | Evidência |
| --- | --- | --- |
| Configuração de argumentos dentro de `MainWindow.WebApps.cs` | Classe independente `WebViewRuntimeArguments` | Corpo preservado; mudança restrita à assinatura/nome e três chamadas; build passou |
| Bridge de 2.560 linhas dentro de `MainWindow.xaml.cs` | Mesmo trecho em partial específico | Bloco preservado; reinseri-lo e reverter o nome da chamada recompõe exatamente o arquivo anterior |
| Intro em um fragmento de 702 linhas | Oito fragmentos de 53 a 161 linhas | Concatenação das fontes recompõe exatamente o texto anterior; bundle não mudou |

O método estático é uma extração real de configuração sem dependência WPF. A
bridge ainda é um partial da janela com regras de negócio acopladas. A intro ainda
compartilha o escopo original. Não marcar essas duas áreas como serviços totalmente
independentes.

Os contadores de linha refletem os arquivos imediatamente antes desta etapa e
podem divergir da baseline histórica anterior às mudanças de boot.

### Validação executada

- `Build-FrontendScripts.ps1 -Check`: 19 bundles, 130 fontes e 39 blocos CSS válidos.
- `Build-FrontendStyles.ps1 -Check`: 22 fontes, 170.827 bytes preservados.
- `node scripts/Test-FrontendIntegrity.cjs`: geração e sintaxe dos 19 bundles passam.
- `node scripts/Test-BootIntroLifecycle.cjs`: handoff nativo, execução única,
  inicialização sem supervisão e destinos de intro desabilitada/recuperação passam.
- `dotnet build Doorpi/Doorpi.csproj --no-restore -m:1 -c Release -v minimal`:
  compilação com zero avisos e zero erros. O comando usou `DOTNET_CLI_HOME` em
  `artifacts/dotnet-cli-home`, restrito à invocação.
- Comparação SHA-256: nenhum dos 27 arquivos CSS/JS/HTML de runtime inventariados
  mudou em relação ao início desta rodada.
- Comparação inversa: `MainWindow.xaml.cs` e `MainWindow.WebApps.cs` recompõem
  exatamente o texto anterior ao reinserir os trechos movidos; os outros dois
  partials alterados têm somente a troca da chamada de argumentos.
- Corpo do handler, validação de origem, construção de argumentos e multiconjunto
  de candidatos literais de mensagens preservados.
- `DesktopVkbWindow.cs`, que já tinha uma alteração independente, permanece com
  o mesmo hash capturado no início desta rodada.

Snapshots e provas locais estão em `artifacts/architecture-step-1`. Essa pasta é
ignorada pelo Git; o inventário atual e este registro são versionáveis. As provas
comparam esta extração com o workspace anterior, não com a baseline histórica que
antecede as mudanças de boot já autorizadas.

Os scripts PowerShell foram verificados com `-NoProfile -ExecutionPolicy Bypass`
somente no processo invocado; nenhuma política persistente foi modificada.

### Decisões esclarecidas pelo autor

- Bloquear permissões foi uma escolha para evitar interrupções, não código sem uso.
- A política futura aprovada é: streamings integrados bloqueiam; apps cadastrados
  e navegador perguntam ao usar câmera/microfone; localização/notificações bloqueiam.
- O motivo histórico da reinstalação da extensão de trailers não é conhecido.
  Sua função é limpar visualmente o player incorporado e produzir o fundo do vídeo,
  não um bloqueio geral de anúncios. A rotina de reinstalação foi preservada.

## Próximas etapas e dependências

- [ ] Revisar a bridge por grupos de funcionalidade: payloads, respostas, efeitos,
  contexto de usuário, thread e cancelamento. Preservar nomes e ordem dos comandos.
- [ ] Separar responsabilidades reunidas em `MainWindow.Modules.cs`: UA, permissões
  e SMTC. Somente depois definir contratos e proprietários de estado adequados.
- [x] Implementar a política de permissões aprovada em mudança própria, incluindo
  popups, perfis e confirmação pelo controle. O autor escolheu salvar por perfil,
  app e site, com revogação, e confirmou isolamento entre perfis de apps compartilhados.
- [ ] Prosseguir com templates, estilos inline e `cssText`, distinguindo valores
  fixos de estado/geometria; preservar momento de injeção e cascata.
- [ ] Organizar scripts injetados por C#, `TrailerExtension` e pacotes de intro.
- [ ] Auditar sessões e arbitragem de input: determinar proprietário do estado e
  da ação em cada contexto, aproveitando o núcleo existente.
- [ ] Medir inicialização em máquina lenta, com fases e runtime/driver efetivos.
- [ ] Comparar bootstrap e entrada direta sob condições equivalentes; não retirar
  Explorer ou alterar startup de terceiros como consequência de mera organização.
- [ ] Medir extensão, perfis e áudio antes de adiar/reduzir trabalho inicial.
- [ ] Extrair tokens de aparência preservando valores; definir contrato de tema
  sem atribuir controle da sessão aos pacotes visuais.
- [ ] Validar percursos de controle, escalas, retorno e falhas no aplicativo real.

Este registro não encerra a reorganização completa. Áreas apenas inventariadas,
separadas fisicamente ou dependentes de validação continuam assinaladas como tal.

## Etapa 2 — permissões web por perfil, app e site

Mudança funcional aprovada, separada das extrações sem alteração de comportamento.

- Política, persistência e coordenação em `Browser/BrowserPermissionPolicy.cs`,
  `BrowserPermissionStore.cs` e `BrowserPermissionService.cs`.
- Adaptador em `MainWindow.WebPermissions.cs`, contexto de navegação/janela e
  confirmação nativa em `BrowserPermissionDialog.xaml/.cs`.
- Identidade usa o perfil Doorpi ativo; não herda autorizações do proprietário de
  um app compartilhado nem as grava no cache de permissões Chromium.
- Home, streamings integrados e utilitários continuam bloqueados. Apps cadastrados
  e navegador perguntam para câmera/microfone; outros tipos seguem bloqueados.
- Decisões de permitir/bloquear são salvas localmente; cancelar não grava decisão.
- Configurações ganhou Permissões dos apps, com revogação de concessão (fecha app
  aberto) e remoção de bloqueios. Popups seguem o contexto que os abriu.
- Input é reservado à confirmação e liberado após neutralidade; navegação e fechamento
  cancelam pedidos e respostas de outro perfil são descartadas.
- 57 verificações isoladas C# passaram; teste JS de configurações passou; XAML
  renderizado fora da tela em duas larguras. Testes de intro e integridade continuam passando.
- Entre os 27 arquivos de runtime acompanhados, mudaram somente `nav-menu.js` e
  `strings.js`, conforme a funcionalidade nova. `DesktopVkbWindow.cs` permanece intacto
  em relação à alteração independente existente no início do trabalho.
- Contagem atual: 19 bundles, 131 fontes JS e 40 blocos CSS injetados. O inventário
  inclui o novo harness e os arquivos novos.

A validação de dispositivos reais e de foco/controle no aplicativo permanece
pendente. Ver [política e validação](web-permissions.md) para limites e comandos.

## Etapa 3 — bootstrap: responsabilidades e experimento controlado

O autor esclareceu que o bootstrap tratava travamento gráfico no primeiro logon de
PCs lentos e roubo de foco por programas de inicialização. A presença do Explorer
não é um sinal de GPU pronta. A proteção temporária de foco foi aprovada até a
primeira tela interativa de perfis/setup/home; depois segue a política normal.

- Entrada direta experimental em `App.DirectStartup.cs` e sessão local em
  `Boot/InProcessBootSession.cs`, com o mesmo protocolo de apresentação e intro.
  O caminho padrão supervisionado e a preparação de Explorer foram preservados.
- Seleção validada em `Boot/BootStartupSelection.cs`; arquivo inválido não remove
  silenciosamente o supervisor. Não foi ativado experimento na máquina atual.
- Proteção de foco em `MainWindow.StartupFocus.cs`, encerrada também por sessão
  externa, recuperação, fechamento ou limite de segurança. Handoff entre processos
  concede foreground apenas ao filho. As APIs continuam sujeitas às regras do Windows.
- Probes antigos descartados antes de decidir saúde/reinício, com validade
  novamente conferida na thread WPF. Recuperação cancela ações pendentes.
- Relançamentos não supervisionados aguardam a saída do processo anterior antes
  de adquirir o mutex, corrigindo uma corrida de reinicialização.
- Trace opt-in assíncrono por processo, fases, runtime carregado e amostras de CPU/
  memória. Scripts de seleção, reversão e coleta; testes usam apenas fixtures na workspace.
- Build Release passou com zero avisos/erros. Harness de boot, ferramentas,
  integridade dos bundles, intro e configurações de permissões passaram.
- Nenhum dos 25 arquivos CSS/JS/HTML em `wwwroot` presentes no inventário mudou nesta etapa.
  A alteração independente em `DesktopVkbWindow.cs` continua preservada.

O PC lento já está em modo imersivo, conforme o autor. Ainda faltam preparar a
publicação de teste equivalente à instalação e executar o A/B em logon real.
Não se concluiu a causa histórica do travamento nem a remoção definitiva do
supervisor. O caminho direto não oferece supervisão externa de um dispatcher
completamente travado. Procedimento e limites em
[bootstrap-comparison.md](bootstrap-comparison.md).
