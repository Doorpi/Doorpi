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

## Etapa 4 — monitor, composição de temas e navegação por regiões

O repositório já incorporava `Doorpi.Storage`/SQLite ao iniciar esta etapa. Essa
política foi preservada; não houve novo schema, migração ou preferência persistida.

- Rota opcional `monitored`: supervisor sem ante-sala no boot saudável, host
  responsável pelo preparo, armazenamento e apresentação. Os caminhos anteriores
  foram preservados e o arquivo de seleção do usuário não foi alterado.
- A ante-sala do host cobre também a validação assíncrona de armazenamento. O
  supervisor não inicializa o banco nessa rota. A recuperação de atualização
  interrompida aguarda detach antes de lançar o updater.
- Correção do orçamento: dois minutos saudáveis passam a ser contados da prontidão,
  evitando que uma inicialização longa renove prematuramente as tentativas.
- Home dividida em nove fragmentos ordenados. 73 parâmetros públicos centralizados
  sem mudar valores padrão. O bundle principal passou de 22 a 32 módulos.
- O contrato distribuído de temas é gerado dos metadados e dos padrões CSS: os
  valores não precisam ser mantidos simultaneamente em CSS e JSON.
- Temas têm tokens e composição por regiões. O exemplo Aurora move o carrossel
  para cima, arte para a direita, metadados para antes do título e barra lateral da
  janela de adicionar itens para a direita. Grades personalizadas preservam todos
  os nomes de região e não substituem HTML nem comandos.
- O autor confirmou aparência/disposição dos componentes existentes como escopo e
  definiu o carrossel como região de navegação 0 da home. Retorno recupera o card
  anterior; memória volátil separada por perfil/aba, sem novo armazenamento físico.
- A política de foco foi centralizada; GridController deixou de substituir
  silenciosamente o adaptador de foco da navegação. As transições de entrada e
  chamadas do host continuam usando a API de compatibilidade.
- Testes de CSS reconstituem exatamente o bundle anterior ao substituir os tokens
  pelos padrões e excluir o adaptador opcional inativo. O navegador também compara
  propriedades computadas/geometria do padrão em quatro resoluções.
- Prévias usam CSS/runtime reais em fixture isolada: 24 imagens de home/diálogo
  em 720p, 1080p, 4:3 e 4K; verificam posição das regiões, foco 0, restauração de
  card e prioridade modal. Não são sessões completas do Doorpi/WebView2.
- Agora são 20 bundles, 133 fontes JS e 40 blocos CSS injetados. O inventário passa
  a descobrir todos os diretórios de projetos, incluindo Storage e harnesses novos.
- `DesktopVkbWindow.cs` permanece com o hash anterior a esta etapa.
- Compilação Release validada com zero avisos/erros; harness de boot e ferramentas
  passaram, assim como integridade, intro, permissões, temas, regiões e navegação
  com layouts alternativos. Storage passou 18 grupos/107 verificações, incluindo
  corrupção, interrupção e rollback, sem usar dados reais.

Ficam pendentes: logon real na rota monitorada, atualização/rollback completos com
ela, retorno de jogos/controle físico, migração do menu principal e das outras telas
para regiões, e UI de instalação de temas da comunidade. A seleção instalada e a
persistência SQLite por perfil foram implementadas na etapa seguinte.
A matriz de cobertura em [temas](../../Doorpi/Frontend/themes/README.md) mantém essas
áreas explícitas. Nenhum pacote de atualização, manifesto de distribuição ou
assinatura de produção foi gerado nesta entrega de código.

## Etapa 5 — seleção de temas instalados

- Configurações → Temas oferece Doorpi padrão e Orbit. Orbit reorganiza a home,
  move o destaque à direita e usa tons azuis/violetas. A proporção 2:3 dos cards é
  fixa no contrato; Default continua disponível durante carregamento/gravação.
- Preferência por perfil via Doorpi.Storage/SQLite, em documento lógico já existente,
  sem novo schema. CAS valida revisões do perfil/documento e geração da sessão.
  Carregamentos e respostas atrasados não afetam outro perfil ou uma escolha nova.
- Erros preservam a origem; tema indisponível recua ao padrão apenas nesta sessão.
  A UI informa falhas de persistência e permite restaurar o visual original.
- Controller, tela, CSS, catálogo e store permanecem separados. São 20 bundles,
  135 fragmentos JS, 41 blocos CSS injetados e 32 fragmentos CSS principais.
- Testes do store/catálogo: 30 verificações, incluindo conflitos, isolamento,
  corrupção preservada, importação legada e backup/rollback. Testes JS cobrem
  filas, respostas atrasadas, troca de perfil/ABA e restauração imediata.
- Chrome isolado: 36 casos/40 capturas em quatro resoluções, com cards verticais,
  seleção pelo menu real, direções/Enter/Voltar e comparação exata do padrão com
  baseline local. São fixtures; controle físico e sessão completa WebView2 permanecem
  para teste no aplicativo. Não houve alteração de perfis reais ou modo de boot.
- Nenhum instalador, pacote de atualização, manifesto ou assinatura de produção
  foi gerado. A build Release local serve para testar a implementação.

### Correções da seleção e do Orbit

- O hub passa a obter a ordem navegável do DOM agrupado, usando IDs para associar
  descrições e ações. Corrige o salto de Temas: a ordem de declaração anterior era
  diferente da ordem visual dos grupos Conta/Experiência/Sistema.
- A seleção virou lista rolável de nomes, sem mockups, com indicador Em uso.
  Cabeçalho/restauração permanecem fora da rolagem; cima/baixo percorrem os nomes e
  Voltar recupera Temas no hub. Não implementa a futura loja de temas.
- Cinco tokens de enquadramento do hero elevam o contrato a 78 padrões. Orbit usa
  imagem de fundo de tela inteira com máscara inferior; os padrões antigos seguem
  reconstituindo exatamente o CSS anterior.
- Validação visual ampliada a 40 casos/44 capturas em quatro resoluções, incluindo
  ordem do hub nos dois sentidos, lista com 32 temas e imagem real no hero da fixture.

## Etapa 6 — pacote visual por área e ambiente de autoria

- Decisões de produto: pacote inicial sem JS; pasta local + editor externo + prévia
  ao salvar; login como preferência do dispositivo. Efeitos JS isolados são futuros.
- Importação manual `.doorpitheme` adicionada. Arquivos externos imutáveis por hash,
  versões preservadas, validação de caminhos, tipos e limites, staging ignorado após
  interrupção. CSS é validado pelo navegador antes de aplicar a área. A importação
  não declara o pacote certificado para a loja nem o aplica automaticamente.
- Seleção independente de Home, nav-menu, painéis laterais, popups e login, com
  escopos/raízes explícitos. Preferências de perfil permanecem no documento lógico
  existente; login usa novo documento lógico genérico SQLite, sem novo schema.
  Revisões/geração são verificadas; corrupção não é convertida em preferências vazias.
- Trailer ganhou camada de apresentação própria desde o HTML inicial. Adaptador
  mede a arte com ResizeObserver, sem polling contínuo ou reparent de player ativo.
  Orbit seleciona `feature-art`; cinema preserva o caminho existente.
- Theme SDK separa projeto, Studio e empacotamento. Preview usa iframe sem origem
  compartilhada ou ponte nativa, fixtures e CSS reais. Modo sem CSS é inspeção, não
  remoção dos estados funcionais do app. Há exemplo Orbit Modular de cinco áreas.
- O runtime não mantém todos os payloads testados em cache indefinidamente. Temas
  lentos no início recuam ao padrão com prazo e recuperação, sem apagar a escolha.
- São 20 bundles, 137 fragmentos JS, 41 blocos CSS injetados e 32 fragmentos CSS.
  O inventário passa a incluir os fontes do ThemeSDK.
- Referência de validação: 45 casos/48 capturas em quatro resoluções; Studio com
  atualização real de arquivo/SSE e recuperação de CSS inválido; harness nativo de
  preferências e pacotes, incluindo interoperabilidade com o ZIP produzido pelo SDK.
- Restam validação no WebView2/controle físico e reprodução real de mídia, ampliação
  de regiões/navegação das outras telas, separação da dívida CSS funcional/visual,
  loja/assinaturas/publicação e a API futura de efeitos. A UI nativa WPF não recebe CSS.
  Nenhum instalador, pacote de atualização ou manifesto assinado de aplicativo foi gerado.

Verificação final desta etapa: Release com zero avisos/erros; 54 verificações no
harness de temas/pacotes; Storage com 18 grupos/108 verificações; 45 casos visuais
e teste de edição/SSE no Studio aprovados. O pacote local Orbit Modular 1.0.0 tem
5.316 bytes e SHA-256 `ced3dc9dd4615f5e4614f8c36840ca73a6855a9f30dcf06d4a38a1744fa672ee`.
É um exemplo para testes, sem assinatura/publicação de produção; metadados de
artefato estão em `artifacts/themes/orbit-modular-1.0.0.artifact.json`.

### Correções da seleção e importação de temas

- Navegação vertical passa pelas áreas e pelos botões do cabeçalho antes de subir
  às categorias. O cabeçalho continua fora da rolagem da lista de temas.
- Restaurar padrão redefine as quatro áreas do perfil atual e o login do dispositivo
  em uma transação SQLite com revisão dos dois documentos e do perfil. Preserva
  outras configurações, outros perfis e pacotes instalados. A linha Doorpi padrão
  continua sendo a restauração individual da área. O atalho de recuperação usa a
  mesma operação completa, invalidando aplicações pendentes.
- Adicionar pacote usa ShowDoorpiFileBrowserAsync, com filtro .doorpitheme. O menu
  cede os eventos de entrada ao explorador e não recupera foco enquanto ele está aberto.
  Perfil/geração/revisão são revalidados após a seleção e leitura do pacote.
- Studio disponível externamente por `node scripts/theme-sdk.cjs dev <pasta>`;
  ainda não existe prévia integrada na sessão real do Doorpi ou hot reload de pasta
  no aplicativo. Essa distinção está explícita no guia do SDK.
- Verificados: build Release sem avisos/erros; 65 verificações nativas de temas;
  integridade dos bundles, fila de seleção e reset completo, contratos de navegação.
  A validação física do explorador e controle no WebView2 continua necessária.
  Nenhum instalador ou release de aplicativo foi produzido nesta correção.

## Etapa 7 — primeira composição do visual padrão para TV

- Pesquisa anterior à implementação: Sony/PS5, Nintendo/Switch 2, Xbox, Valve/Steam
  Deck, diretrizes de acessibilidade Xbox e conceito independente de designer.
  Fontes, limites da pesquisa e plano completo em [direção visual](console-visual-direction.md).
- Primeiras superfícies revisadas: seleção de perfis e estrutura do painel rápido,
  incluindo a hierarquia básica de títulos/descrições/cards do conteúdo. Fundo
  azul profundo, luz ciano, nomes/ações maiores, foco com anel e perfis vizinhos
  legíveis. Os mesmos destinos, ordem, ações e regras de sessão permanecem.
- Vocabulário interno compartilhado separado em `016-console-surfaces.css`;
  estrutura do painel extraída para `doorpi-quick-panel-shell.css`. São agora
  33 módulos CSS principais, 42 blocos injetados, 137 fontes JS e 20 bundles.
- CSS de blur de tela inteira retirado destas superfícies, luz estática sem novo
  loop de animação. O ambient existente da intro não foi refeito; não há medição
  de FPS/CPU/GPU nem promessa de ganho numérico.
- Capturas e verificação dos controladores reais em quatro resoluções, com host
  falso: centralização/rolagem de perfis, foco e retorno, ações visíveis, avatar
  sem foto, login obrigatório, guardas da intro, PT/EN e movimento reduzido.
  Studio continua atualizando CSS via SSE e recuperando erro de edição nas cinco áreas.
- Restam TV/WebView2/controle físico e a continuação para Home/nav-menu, adição e
  edição, páginas especializadas, PIN e transições do conjunto. Não se considera
  resolvida toda a navegação. Não há instalador ou release de aplicativo nesta etapa.

### Ajuste de escala e handoff após avaliação em 1440p

- Referência do autor: 2560×1440 a 100%, abertura normal. Unidade visual limitada
  no desktop e faixa própria para 4K. O menu passa de 768 para 475,2 CSS px nessa
  referência; rótulos de 34,56 para 24,2 px e nomes de perfis de 42,24 para 25,3 px.
- Superfícies neutras, foco claro e cores variadas nos destinos/avatares. Removida
  a marca repetida sobre os perfis. Retirada a camada diagonal que se sobrepunha
  ao ambient, preservando o fundo e os tempos da intro existente.
- Harness ampliado para cinco resoluções e sequência real Neon → seletor, além
  das guardas estáticas: registra múltiplos frames do handoff, verifica geometria
  estável, ausência de camada adicional e continuidade do ambient após sair o iframe.
  É um teste isolado Chromium; a percepção final no WebView2 do autor permanece a avaliar.

## Etapa 8 — Entrando como passagem para a Home

- Alinhamento: horas e última sessão continuam na Home. Reutilizar Entrando para
  preparar o carrossel por trás; somente depois do crossfade entregar foco à região 0
  e liberar a entrada. Fluxo e auditoria em [Entrando e Home](home-session-entry.md).
- A espera anterior de um segundo podia terminar sem alvo. O novo preparo verifica
  a aba ativa, itens utilizáveis e loading; não recua para a primeira aba do DOM.
  Biblioteca vazia com Adicionar é válida. Falha oferece recuperação com entrada
  protegida. Perfil e versão de transição são revalidados após as esperas.
- Preparação da arte é explícita e não requer foco no conteúdo bloqueado. Input
  permanece bloqueado durante o crossfade. Estado e ações dos outros fluxos não
  foram migrados para um novo armazenamento.
- Home padrão agrupa logo/nome, contexto, horas e última sessão à esquerda e usa
  um destaque de fundo. A moldura horizontal fica disponível para fallback/temas.
  Descrições do painel rápido vão para ajuda contextual, sem cores por categoria.
- São 34 módulos CSS, 42 blocos injetados, 137 fragmentos JS e 20 bundles. Os 78
  tokens públicos continuam ativos; defaults e bindings foram atualizados juntos.
- Harness cobre cinco resoluções, biblioteca atrasada/vazia, falha/retentativa,
  perfil invalidado, token de tipografia, composição com cópias de arte e intro
  real. Temas/escopos/trailer têm 45 casos adicionais de navegador; Studio ao vivo
  continua verificado. Referência histórica de CSS agora é optativa no renderizador,
  porque o redesenho é autorizado; não se afirma igualdade com o padrão antigo.
- Pendentes: validação WebView2/TV/controle físico, atmosfera dos blobs e refinamento
  das demais telas. Nenhum instalador, release ou manifesto de produção nesta etapa.
