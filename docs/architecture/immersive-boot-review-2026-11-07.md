# Revisão do boot imersivo — 7 de novembro de 2026

Pesquisa de arquitetura, sem implementação de uma nova estratégia de boot. As
alterações de modularização e recuperação já presentes no workspace são anteriores
a esta pausa. Não foram executados logoff, reboot, troca de shell, encerramento do
Explorer nem binários antigos para produzir este documento.

**Alinhamento posterior com o autor:** o Doorpi deve oferecer uma experiência
própria como alternativa ao Xbox mode. FSE saiu das prioridades; o material abaixo
permanece como pesquisa de possibilidades, não como plano de integração aprovado.
O plano vigente está no [registro de arquitetura](README.md).

## Conclusão atual

O Doorpi pode ser um ambiente de sessão integrado ao Windows. Seu lugar é na sessão
interativa, depois do logon; não precisa tornar-se um subsistema do kernel nem
transformar sua interface em serviço. Não encontrei na documentação consultada uma
exigência geral de abrir outro processo WPF para que a GPU do WebView2 inicialize.
Isso também não prova que o workaround antigo já possa ser retirado com segurança.

Recomendo manter inicialmente o Explorer como compatibilidade para PCs comuns,
investigar o caminho de inicialização real e separar três responsabilidades:

1. Preparar e acompanhar a sessão do Windows e suas dependências.
2. Apresentar a interface e confirmar sua capacidade de responder.
3. Recuperar falhas sem depender do renderer que falhou.

Uma tela inicial nativa simples tem justificativa técnica. Um segundo processo
completo do Doorpi só deve continuar se o isolamento ou a supervisão trouxerem
benefício demonstrável. A necessidade de aguardar o Explorer é uma decisão
diferente da necessidade desse processo adicional.

## Informações fornecidas pelo autor

- O problema original ocorria no primeiro logon em PCs lentos. O aplicativo ficava
  praticamente impossível de navegar no modo imersivo.
- Desativar aceleração de hardware ajudou, mas ela foi reativada após outra correção
  cuja natureza não é mais conhecida. O bootstrap foi mantido por precaução.
- O Explorer também é iniciado para garantir programas de inicialização e recursos
  do Windows, incluindo FxSound. Não serve somente para voltar ao desktop.
- O produto deve funcionar em PCs Windows recentes comuns. Só houve testes
  informados em Pro; Home também é um alvo desejado.
- O propósito é transformar um PC da sala numa central de jogos e multimídia,
  inteiramente operável por controle: abrir YouTube, alternar para um jogo,
  administrar apps/drivers e resolver problemas sem depender de mouse/teclado.
- A referência são consoles e portáteis Windows: conforto, previsibilidade e
  confiabilidade. É aceitável discutir limites de escopo fora dessa experiência;
  nenhuma funcionalidade foi selecionada para remoção nesta revisão.
- Temas da comunidade serão inicialmente apenas de aparência. Extensões
  funcionais não são requisito atual.

Essas respostas priorizam o gerenciamento da sessão e a continuidade do controle.
O critério de sucesso não é somente abrir a home: o usuário deve conseguir voltar,
trocar de aplicativo e se recuperar de falhas usando o controle.

## O que a documentação permite concluir

O WebView2 exige criação em thread STA de interface com processamento de mensagens.
Seu host precisa manter essa thread livre; bloquear callbacks ou criar ciclos
modais reentrantes pode impedir progresso. Isso é diferente de aguardar um suposto
estado global de “Windows pronto”. [Microsoft: threading model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/threading-model).

Há pelo menos três caminhos a observar: interface WPF, processos do Chromium
(browser, renderer, GPU e auxiliares) e composição das janelas pelo DWM. Explorer
não é sinônimo de DWM. O `DwmFlush` usado no bootstrap histórico só espera mudanças
gráficas enfileiradas pelo aplicativo chamador; não valida toda a sessão nem o
processo GPU do Chromium. [Process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model),
[DWM](https://learn.microsoft.com/en-us/windows/win32/dwm/dwm-overview),
[DwmFlush](https://learn.microsoft.com/en-us/windows/win32/api/dwmapi/nf-dwmapi-dwmflush).

A Microsoft recomenda uma interface inicial simples em XAML/Win32 e carregar o
WebView quando houver conteúdo web a apresentar. Também recomenda reduzir carga
inicial e medir criação do controle, conteúdo e recursos. Isso sustenta uma
apresentação nativa discreta; não exige outra aplicação nem uma introdução visual
duplicada. [Performance best practices](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance).

Serviços não devem apresentar diretamente a UI interativa. Se surgir uma tarefa
realmente privilegiada ou que precise existir sem usuário conectado, ela pode
justificar um serviço separado com comunicação delimitada. O frontend permanece
na sessão do usuário. [Interactive services](https://learn.microsoft.com/en-us/windows/win32/services/interactive-services).

## Relatos públicos: indícios, não diagnóstico do Doorpi

- **WebView2Feedback #990, 2021, encerrado:** um host sem Explorer falhava ao iniciar
  WebView2 elevado. O autor confirmou funcionamento com credenciais normais. É
  evidência de que privilégio e contexto de lançamento importam; não estabelece
  uma proibição geral de WebView sem Explorer. [Relato e respostas](https://github.com/MicrosoftEdge/WebView2Feedback/issues/990).
- **WebView2Feedback #5730, setembro de 2026, aberto na consulta:** o autor relata
  pausas de aproximadamente 33 segundos ao mudar foco em WPF/.NET 8 como shell sem
  Explorer, em máquina com touch. A investigação publicada aponta espera de
  COM/UIAutomation/TSF no processo browser; o renderer continuava executando e
  desativar GPU não resolvia. Foram citados runtimes 153/154. Não há confirmação
  publicada nessa discussão de que 157 resolva. Não corresponde necessariamente
  ao defeito histórico do Doorpi. [Relato, traces e comentários](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5730).
- **FxSound, abril de 2025:** um usuário relata perda do ícone de bandeja após
  reiniciar Explorer, reconhecida para investigação. Isso demonstra uma interação
  de UI com a shell, não prova que processamento de áudio exija Explorer.
  [Fórum do projeto](https://forum.fxsound.com/t/tray-doesnt-restart-after-explorer-restarts/5320).

Esses casos mostram por que “parece GPU” não basta para determinar a causa. Uma
pausa de input pode acontecer no host, no browser ou na integração da sessão,
inclusive enquanto a animação JavaScript continua funcionando.

## Comparação estática de binários locais

O inventário com tamanhos e SHA-256 está no
[JSON da comparação](../../artifacts/boot-research-2026-11-07/binary-comparison.json).
Os arquivos foram lidos, sem executar as versões antigas.

| Conjunto | Doorpi.dll, bytes | Distribuição .NET declarada | Literal do argumento bootstrap encontrado |
| --- | ---: | --- | --- |
| `Doorpi/bin/Release/net8.0-windows10.0.19041.0` | 2.642.432 | Framework-dependent 8.0 | Sim |
| `artifacts/test-publish/Doorpi-20260712-223237` | 1.603.584 | Self-contained 8.0.28 | Sim |
| `artifacts/test-publish/doorpi-standalone-test-20260723-191149` | 2.084.864 | Self-contained 8.0.29 | Sim |
| `artifacts/portable/Doorpi-release-test-publish` | 1.549.824 | Self-contained 8.0.28 | Sim |
| `.manual-update-test/Install` | 1.235.968 | Self-contained 8.0.28 | Não |

Todos os cinco declaram `Microsoft.Web.WebView2/1.0.3967.48`. As DLLs gerenciadas
Core e Wpf são idênticas entre os conjuntos:

- Core: 650.080 bytes; SHA-256
  `fcc07f6b8ddb7c90915dbeaa2d959880bc52266dd49d7fab082f9da698f2bf0c`.
- Wpf: 83.808 bytes; SHA-256
  `0ff289bc88a73c69980973912b83ad5bd27dc769aa937552b8cea039024a7443`.

Essas DLLs são integração com o WebView2, não o Chromium. O runtime Evergreen
registrado nesta máquina é `157.0.4341.42`; não foi confirmada uma instância carregada
pelo Doorpi nesta pesquisa. A atualização independente do runtime impede atribuir
o comportamento antigo apenas à versão do SDK. [Distribuição do WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution).

Encontrar ou não um literal é somente uma observação estática, não uma reconstrução
de todo o fluxo de execução. Tamanho de EXE/apphost ou DLL também não mede RAM,
tempo de boot ou qualidade da implementação. Datas nos nomes das pastas não
estabelecem, sozinhas, a sequência das releases.

O histórico registra a introdução do bootstrap no commit `c853075`, de 03/07/2026,
junto de outras mudanças de recuperação/renderização. Não há evidência suficiente
para identificar qual correção eliminou o travamento citado pelo autor.

## Achados no código que merecem medição

| Local | Observação comprovada por leitura | Implicação a investigar |
| --- | --- | --- |
| `MainWindow.xaml.cs`, construtor | Inicializa diretórios, perfis de navegador e usuários antes de `Show()`; inicialização de sessão também inicia loops de controle | Custo anterior à primeira apresentação e competição durante logon |
| `MainWindow.WebViewProfiles.cs:88` | Limpeza recursiva de diretório temporário na inicialização; migração de schema pode limpar a raiz dos perfis | I/O no caminho inicial; migração precisa preservar a intenção original e dados relevantes |
| `MainWindow.WebViewProfiles.cs:140` | Falhas de limpeza provocam até seis tentativas com GC, finalizadores e `Thread.Sleep` | Há até 2,52 s de sleeps explícitos, além de I/O/GC/finalizadores, no caminho síncrono; não é um limite total |
| `MainWindow.xaml.cs:1247` | Home cria ambiente com UDF implícito; mídia tem UDFs explícitos separados | Definir localização gravável e ciclo de vida previsível, sem unificar sessões por conveniência |
| `MainWindow.xaml.cs:1266`, `MainWindow.HomeTrailer.cs:18` | Antes de navegar à primeira página, remove extensões gerenciadas antigas e adiciona a extensão de trailers | Recurso opcional participa do caminho crítico; verificar atualização por versão e momento seguro |
| `Frontend/scripts/app/040-audio-and-focus.js:23` | Player busca e decodifica wake e ambience ao carregar script; só depois suspende AudioContext | `ambience.wav` tem 31.649.636 bytes; suspensão não desfaz custo de leitura/decodificação e buffers |
| `wwwroot/intros/doorpi-neon/index.html` | Intro usa CSS/SVG, blur e RAF e busca fonte Google externa | Medir pintura e composição; fonte local pode tornar a apresentação mais previsível offline |
| `MainWindow.WebApps.cs:3718` | Modo chamado hardware não força adaptador nem confirma backend; apenas deixa de adicionar flags de desativação | Registrar adaptador/backend efetivo e argumentos; nome da configuração não comprova uso de GPU |
| `MainWindow.xaml.cs:1324` | Solicita `timeBeginPeriod(1)`; há encerramento correspondente | Medir necessidade e duração real do pedido para input; não supor ganho gratuito |
| `Boot/WindowsShellEnvironment.cs` | Presença de Explorer e HWND de shell estável libera o próximo passo | Aproximação de disponibilidade da shell; não confirma execução de cada app de startup, TSF ou saúde gráfica |
| `MainWindow.BootLifecycle.cs` | Confirma intro, funções e visibilidade por script | É melhor que somente HWND, mas não comprova todo o caminho de input nem todo tipo de bloqueio do browser |

Nem todo trabalho do aplicativo começa cedo: reconciliação de bibliotecas,
atualizações e tarefas de sessão já têm adiamentos para depois da seleção do
usuário. Os ambientes de mídia possuem cache e criação sob demanda. Isso deve ser
preservado e medido, em vez de declarar que “tudo carrega no boot”.

O processo supervisor atual não cria o frontend WebView2. Portanto, duas instâncias
do EXE não equivalem automaticamente a dois Chromiums completos. Ainda assim,
manter outro processo .NET/WPF tem um custo que precisa ser medido.

## Explorer: dependência técnica e compatibilidade de produto

Wi-Fi do Doorpi já usa `ManagedNativeWifi`; Bluetooth usa APIs WinRT de rádio,
enumeração e pareamento. Essas interfaces oferecem acesso ao sistema separado das
telas do Explorer. Isso sugere que os recursos próprios podem funcionar numa shell
substituta, mas não certifica todos os drivers, permissões, serviços e diálogos de
consentimento sem testes. [Native Wifi](https://learn.microsoft.com/en-us/windows/win32/nativewifi/about-native-wifi),
[Pareamento e consentimento](https://learn.microsoft.com/en-us/windows/apps/develop/devices-sensors/pair-devices).

Programas de terceiros são outra questão: precisam de seus próprios mecanismos de
startup, possíveis bandejas, notificações, COM e UI do Windows. Executar apenas
seus EXEs não é garantia equivalente a uma sessão padrão. Esconder taskbar/desktop
também não elimina o custo do processo Explorer ou dos programas que ele inicia.

Minha recomendação para PCs comuns é preservar a sessão compatível. Não proponho
encerrar Explorer depois do boot, esconder janelas internas dele como otimização,
nem reproduzir indiscriminadamente todas as entradas de startup dentro do Doorpi.
Um modo dedicado sem Explorer deve ter integrações conhecidas, comportamento
declarado e uma matriz de testes própria. Não prometo economia antes de medir.

## Diferenças reais entre edições

| Recurso / abordagem | Home | Pro | Enterprise / Education / IoT Enterprise |
| --- | --- | --- | --- |
| Aplicativo normal com inicialização na sessão | Base recomendada para compatibilidade ampla | Sim | Sim |
| Política oficial Custom User Interface (`CustomShell`) | Não listada como suportada nessa política | Suportada | Suportada |
| Shell Launcher com supervisão e ações por saída | Não | Não | Suportado |
| Override atual em HKCU Winlogon | Não validado pelo projeto | Testado pelo autor | Não validado pelo projeto |

A política CustomShell não é a mesma configuração de registro usada atualmente
pelo Doorpi e não equivale à supervisão do Shell Launcher. Não extrapolar o teste
do override em Pro para uma garantia em todas as edições.
[Política CustomShell](https://learn.microsoft.com/en-us/windows/client-management/mdm/policy-csp-admx-winlogon),
[Edições do Shell Launcher](https://learn.microsoft.com/en-us/windows/configuration/shell-launcher/).

Shell Launcher pode processar Run/RunOnce e supervisionar a shell. Seu processo
registrado deve permanecer vivo: um launcher que apenas abre outro EXE e termina
não atende ao modelo monitorado. Não se pode tornar esse recurso um pré-requisito
de um produto destinado a qualquer PC Home/Pro. [Configuração e saídas](https://learn.microsoft.com/en-us/windows/configuration/shell-launcher/configure).

## Alternativa mais próxima do propósito: Xbox mode / FSE

O Windows 11 possui Xbox mode, anteriormente chamado Full Screen Experience.
A documentação de suporte descreve home de jogos, troca de aplicativos pelo
controle e, em handhelds com entrada automática no logon, política para adiar
programas de startup até o desktop. Aplica-se a Windows 11 24H2/25H2, todas as
edições, com disponibilidade condicionada ao mercado e dispositivo. Isso não
significa que toda forma de entrada automática exista igualmente em desktops.
[Suporte oficial](https://support.microsoft.com/en-us/servicing/os/windows/docs/2025/10/windows-gaming-full-screen-experience).

É uma alternativa mais alinhada ao produto que tratar exclusivamente de kiosk
corporativo. Deve ser avaliada como integração opcional, sem substituir de imediato
o caminho compatível dos PCs em que ela não está disponível.

A documentação GDK apresenta detecção e notificação do estado FSE com
`IsGamingFullScreenExperienceActive` e
`RegisterGamingFullScreenExperienceChangeNotification`. Essas funções não registram
o Doorpi como home. A documentação de configuração OEM permite declarar uma home
de terceiros pelo AUMID, por meio de configuração da imagem.
[GDK: launchers e handhelds](https://learn.microsoft.com/en-us/gaming/gdk/docs/gdk-dev/pc-dev/handheld/handheld-launchers?view=gdk-2604),
[GamingHomeApp OEM](https://learn.microsoft.com/en-us/windows-hardware/customize/desktop/unattend/microsoft-windows-gaming-configuration-gaminghomeapp).

Não encontrei nas páginas oficiais consultadas um roteiro público completo para
um instalador Win32 comum registrar qualquer app como home FSE em qualquer PC.
Isso é uma lacuna desta pesquisa, não uma conclusão de impossibilidade ou uma
afirmação de exclusividade permanente a OEMs.

Há implementações independentes: AnyFSE documenta pacote de identidade e uso de
Developer Mode para declarar `Microsoft.appCategory.gamingHome`; o próprio projeto
explica esses passos. É evidência de viabilidade técnica, não de um contrato de
distribuição universal suportado pela Microsoft.
[README e instalação do AnyFSE](https://github.com/ashpynov/AnyFSE).
O exemplo oficial de custom capabilities distingue implantação em Developer Mode
de distribuição com descriptor assinado, sem certificar especificamente o fluxo
gamingHome. [Exemplo Microsoft](https://learn.microsoft.com/en-us/samples/microsoft/windows-universal-samples/customcapability/).

O Winhanced também publica funcionamento e correções em FSE, inclusive uma correção
de registro associada a certificado. Isso reforça que há soluções reais de terceiros,
mas não documenta automaticamente quais credenciais e autorização o Doorpi teria.
[Notas do projeto](https://www.winhanced.com/support/patch-notes/1-0-beta/),
[Relato do mantenedor sobre registro](https://www.patreon.com/Winhanced/posts/hotfix-0-9-8-4-159978835).

Antes de adotar: esclarecer pacote/identidade/assinatura e elegibilidade, matriz de
Windows e dispositivos, retorno ao desktop, integração com Game Bar e conflitos
de atalhos. Medir também a política de apps essenciais ao logon, como FxSound.
Não habilitar Developer Mode, importar certificados, mascarar um desktop como
handheld nem modificar a configuração de jogos do usuário durante a pesquisa.

## Direção arquitetural recomendada

Primeiro modularizar responsabilidades dentro da solução existente: sessão,
lançamento de jogos/apps, integrações Windows, perfis, atualização, recuperação,
host web e apresentação. Um módulo não precisa virar processo ou serviço.

O host nativo deve controlar encerramento, recuperação, sessão e operações do SO.
O frontend deve consumir contratos pequenos e versionados. Temas podem ter tokens,
assets e layouts; extensões funcionais merecem um contrato distinto. A liberdade
de scripts não é requisito atual: temas devem preservar ações e navegação, sem
expor diretamente um objeto gigante de `MainWindow` à comunidade.

Para este produto, a direção recomendada é um núcleo nativo de sessão com entrada,
foco, janelas/apps, retorno ao Doorpi, teclado e recuperação; frontend web modular
para a apresentação atual; e integrações opcionais de boot detectadas por
capacidade. Isso descreve fronteiras de responsabilidade, não manda criar um
processo para cada módulo. Entrada/teclado/troca de apps essenciais não devem
precisar de uma resposta do renderer para resgatar o usuário de uma falha dele.

O código já possui `MainWindow.Sessions.cs`, `MainWindow.InputBridge.cs`,
`MainWindow.ControllerShortcuts.cs`, `XInputControllerHub.cs` e `DesktopVkbWindow.cs`.
O trabalho é consolidar contratos e ciclo de vida desses recursos, aproveitando
o que existe. Não é necessário substituir XInput, remover helpers privilegiados
ou reimplementar controles apenas para trocar nomes de tecnologia.

Uma ordem de validação coerente com a promessa de produto é: entrar na sessão;
parear controle/configurar rede; abrir mídia; iniciar jogo; alternar entre ambos;
voltar ao Doorpi; lidar com app que falhou; suspender/retomar; atualizar e recuperar.
Diálogos do Windows, consentimento elevado, tela bloqueada e falhas anteriores ao
logon precisam de escopo explícito. Não se deve prometer que uma UI comum controla
automaticamente todos esses contextos só porque injeta mouse/teclado.

WPF já oferece integração nativa. Trocar apenas a janela por WinUI mantendo toda a
home no WebView não elimina browser, renderer e GPU do Chromium. O
`WebView2CompositionControl` resolve uma classe de sobreposição/airspace; não é
uma correção comprovada para este boot. [WPF e composição](https://learn.microsoft.com/en-us/microsoft-edge/webview2/platforms/wpf).

Se o propósito exigir confiabilidade de aparelho e navegação essencial independente
do Chromium, faz sentido prototipar home, seleção e recuperação nativas, deixando
WebView sob demanda para web/mídia. Isso é uma migração de apresentação significativa,
com implicações para temas e preservação do visual. Recomendo um protótipo medido,
não uma reescrita antecipada nem promessa de economia de memória.

Também há manutenção de plataforma: o projeto usa .NET 8, cujo suporte termina em
10/11/2026. Deve-se planejar migração validada para uma LTS suportada, como .NET 10;
isso não substitui o diagnóstico do boot e não foi implementado nesta pesquisa.
[Política de suporte .NET](https://dotnet.microsoft.com/en-us/platform/support/policy/dotnet-core).

## Como decidir sobre o bootstrap com evidência

Usar uma VM com snapshots para falhas de shell e uma máquina lenta real para
gráficos/desempenho. Uma VM não reproduz fielmente todos os problemas de driver.
Comparar a mesma build, runtime, usuário, driver e estado de cache, variando:

1. Processo principal direto, com Explorer.
2. Processo principal via bootstrap, com Explorer.
3. Processo direto sem Explorer, somente no ambiente controlado.
4. Bootstrap sem Explorer, no mesmo ambiente controlado.

Os dois últimos cenários exigiriam um caminho experimental preparado depois do
alinhamento; não são opções atualmente comprovadas no produto. Se só o quarto
funcionar, isso ainda exige explicar a diferença de contexto antes de concluir
que um segundo processo “prepara a GPU”.

Separar reinício real de desligamento com Fast Startup e de simples reabertura.
Alternar ordem dos cenários para reduzir viés de cache, repetir em Intel/AMD/NVIDIA,
com e sem touch quando disponível. Não desativar GPU como solução padrão; usá-la
como variável diagnóstica, junto de testes de composição e conteúdo mínimo.

Registrar linha do tempo desde início do processo: primeira janela nativa,
CreateEnvironment, EnsureCore, extensão, navegação, primeira pintura, intro,
interface utilizável e latência de navegação pelo controle. Medir CPU, I/O,
memória privada/working set e processos auxiliares. Registrar runtime carregado,
argumentos, privilégio, sessão, GPU/driver e mudanças de display.

Quando ocorrer bloqueio, capturar WPR/ETW e stacks do host e processo browser/GPU,
correlacionando com DevTools. Um heartbeat RAF sozinho pode falhar em distinguir
UI do browser bloqueada de renderer saudável. Evitar timeouts agressivos e loops
de reinício como substitutos do diagnóstico.

Não foi encontrada captura ETL/dump de boot nos diretórios `artifacts` e
`.build_check` pesquisados. Esta revisão estabelece hipóteses e um experimento,
não uma medição de boot nem uma identificação definitiva da falha histórica.
