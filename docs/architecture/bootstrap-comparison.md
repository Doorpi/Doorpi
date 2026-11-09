# Bootstrap: renderização, foco e comparação controlada

Resultados do PC principal: [leitura dos logs em 08/11/2026](bootstrap-local-results-2026-11-08.md).
A primeira coleta foi supervisionada, sem falha percebida pelo autor. A atualização
do relatório confirma uma execução direta posterior com prontidão e foco do documento.

## Objetivos e limites de cada responsabilidade

O autor esclareceu que o bootstrap nasceu para evitar o frontend travado no primeiro
logon de PCs lentos e para impedir que programas de inicialização roubassem o foco.
A disponibilidade do Explorer não deve ser usada como certificado de GPU pronta.

| Responsabilidade | Sinal observado | O que não comprova |
| --- | --- | --- |
| Sessão interativa Windows | Sessão de usuário e desktop disponíveis | Conclusão de todos os programas do logon |
| Compatibilidade Explorer | Processo na mesma sessão e superfície de shell | Estado do processo GPU do Chromium ou conclusão do FxSound |
| Criação do WebView | Ambiente e controller inicializados | Fluidez de renderização, primeira imagem no monitor ou latência de input |
| Conteúdo web | DOM, paint entries, prontidão da intro e destino inicial | Correção de todo o pipeline gráfico/GPU |
| Foco | HWND foreground observado e resultado das tentativas de ativação | Prontidão gráfica |
| Recuperação | Supervisão de processo, sinais e orçamento de tentativas | Correção da causa histórica do travamento |

O bootstrap atual não cria uma instância WebView2 antes do processo principal.
Ele cria uma janela WPF, inicia/aguarda Explorer e abre o Doorpi principal. Portanto,
não contém uma inicialização explícita da GPU do Chromium. Espera, aquecimento de
caches/driver por WPF e diferença de contexto de processo podem influenciar o resultado;
a leitura de código não decide qual desses fatores importava no defeito antigo.

`EnsureCoreWebView2Async` é uma etapa de inicialização do controle.
`CapturePreviewAsync` é uma captura de conteúdo e não foi transformada em uma
barreira de GPU nem adicionada ao boot. Não se criou WebGL/Canvas extra para forçar
uma inicialização gráfica que pudesse mascarar o problema.
[Inicialização WebView2](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.wpf.webview2.ensurecorewebview2async),
[Captura WebView2](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.capturepreviewasync).

## O que está implementado

O padrão permanece **supervised**. Sem seleção experimental, o argumento de shell
existente continua abrindo supervisor e processo principal. Nenhuma configuração
Winlogon, logoff, reboot ou instalação foi alterada durante o desenvolvimento.

O caminho **direct** é experimental. No boot saudável, a mesma instância do Doorpi:

1. Mostra a ante-sala nativa discreta.
2. Executa a mesma preparação de Explorer usada pelo supervisor.
3. Constrói a janela principal e inicializa o WebView no próprio processo.
4. Aguarda a preparação do controlador da intro.
5. Fecha a ante-sala, libera a apresentação existente e protege o foco.
6. Encerra a proteção quando a primeira tela de perfis/setup/home fica interativa.

A sessão local implementa o mesmo protocolo prepared → released → ready, mas não
é uma supervisão externa. Em falha com dispatcher ainda responsivo há recuperação
nativa. Um dispatcher/processo completamente travado não recebe a mesma proteção
que o supervisor oferece. Não promover direct a padrão a partir de um único teste.

### O que o primeiro A/B responde

Variável: segunda instância do Doorpi. Explorer, flags de renderização, fonte da
intro e os cuidados de foco são mantidos nos dois caminhos. Isso permite perguntar:
“O segundo processo continua necessário com o preparo atual?”

**O A/B não responde se a espera por Explorer é necessária.** Sua preparação foi
mantida como variável de controle, não elevada a requisito gráfico novo. O caminho
legado de preparação interna ainda tem suas próprias esperas e fallback; ele não
foi equiparado silenciosamente a uma política nova de dependências obrigatórias.

Se direct funcionar, o próximo experimento deve variar o momento de criação do
WebView em relação à inicialização do Explorer, mantendo o restante constante.
Depois, se necessário, investigar payload, composição/driver e runtime. Alterar
processo, Explorer e aceleração de uma só vez impediria atribuir o resultado.

## Robustez e foco

- A geração do health check era incrementada sem descartar probes antigos. Agora
  uma verificação atrasada ou já em voo não toma decisões sobre uma geração posterior.
  A validade é conferida também ao executar a ação na thread WPF.
- As decisões de reinício são tomadas na thread da janela e preservam as guardas
  de jogo, mídia e loja. Sessão bloqueada não dispara esse reinício por timeout do probe.
- O relançamento não supervisionado agora espera a saída do processo antigo antes
  de adquirir o mutex principal. Evita que o processo novo encerre por encontrar
  o mutex ainda ocupado pelo que o iniciou.
- A proteção de foco depende da apresentação inicial, não de `RequiresConsoleShellStartupGate`.
  Esse gate era falso no filho normal do bootstrap, que não executava parte dos
  antigos caminhos de restauração de foco internos.
- A ante-sala recupera foco enquanto prepara, com limite de segurança de 125 s de
  sessão disponível (35 s de Explorer e 90 s de apresentação). Interrompe as
  tentativas antes do fade/handoff e ao entrar em recuperação. Depois, uma proteção temporária
  da janela principal cobre a intro até a primeira tela interativa, conforme a
  escolha do autor. Ela é liberada também ao ceder a sessão externa, recuperação
  ou encerramento, com limite de segurança de 90 s de sessão disponível.
- Uma apresentação já gerenciada, inclusive a sessão local direta, não inicia uma
  segunda ante-sala legada caso o Explorer desapareça entre a preparação e o construtor.
- No handoff entre processos, o supervisor solicita `AllowSetForegroundWindow`
  somente para o PID do filho. O resultado é registrado. Não altera políticas de
  foreground, não usa ASFW_ANY e não bloqueia globalmente o Windows.

O Windows pode rejeitar solicitações de foreground. Janela topmost e foco de
entrada são propriedades diferentes. Os registros distinguem o que foi observado
do que foi aceito pela API; o teste real ainda é necessário.
[AllowSetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-allowsetforegroundwindow),
[SetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow).

## Diagnósticos experimentais

A seleção experimental habilita trace por processo em
`DataFolder/logs/boot-trace-<runId>-<pid>.jsonl`. Supervisor e filho compartilham runId.
Também é possível usar `--doorpi-boot-trace` para observar uma execução normal.

O trace inclui:

- módulo da build (MVID), .NET carregado, início do processo, sequência e UTC;
- rota efetiva e fonte da seleção;
- tempos de construtor, perfis Chromium, usuários, ambiente/controller web e extensão;
- versão do runtime realmente criada no ambiente WebView2;
- prontidão da página, paint entries, visibilidade e foco do documento;
- observação de foreground, transferência e tentativas de recuperar foco;
- CPU acumulada, working set e memória privada do host e processos WebView ao chegar
  à primeira tela interativa, incluindo o supervisor quando presente;
- marcador adicional de envio dos dados de perfil para distinguir boot inicial de
  carga posterior da biblioteca.

As escritas do trace são enfileiradas, sem append de arquivo na thread da interface.
Cada arquivo tem limite de 512 KiB. Não há heartbeat permanente de frames nem dump
explícito de HTML, imagens, cookies ou conteúdo da tela. Os detalhes reaproveitados
dos diagnósticos existentes podem incluir caminhos, argumentos e identificadores;
revisar os arquivos antes de compartilhá-los. Os logs existentes continuam existindo.
Nada é enviado automaticamente.

O resumo usa os processos da primeira prontidão observada e a primeira amostra do
supervisor correspondente, sem somar processos de tentativas posteriores como se
estivessem vivos simultaneamente. Memória privada é compromisso privado, não RAM
física total nem memória de GPU. Fases assíncronas podem se sobrepor; não somá-las
como se fossem todas sequenciais.

## Procedimento no PC lento

O autor confirmou que o PC lento já tem Doorpi instalado em modo imersivo. Não é
necessário reconfigurar o shell para este experimento.

Usar a mesma build de teste e os mesmos arquivos nos dois casos. Manter driver,
runtime, modo de energia, intro e configurações. A build precisa estar no caminho
que o modo imersivo realmente inicia: trocar apenas a seleção não atualiza um
Doorpi antigo, que desconhece o experimento.

Antes de substituir a instalação de teste, registrar seu caminho real e guardar
uma cópia integral da versão instalada, fora dessa pasta. Encerrar o Doorpi pelo
fluxo normal antes de substituir os arquivos. Preservar a pasta de dados do usuário;
não misturar DLLs de builds diferentes. Se a instalação usa publicação self-contained,
preparar uma publicação equivalente: a saída comum de `dotnet build` não garante que
o outro PC tenha o .NET Desktop Runtime necessário. Os scripts de seleção/coleta
não instalam nem atualizam os binários.

Para voltar à versão anterior, desativar o experimento, encerrar a build de teste
e restaurar a cópia integral no mesmo caminho. Essa reversão de binários é diferente
de `-Mode off`, que apenas volta ao caminho supervisionado na build de teste.

Os comandos abaixo selecionam somente o arquivo experimental do usuário. Não
habilitam modo imersivo e não reiniciam o PC automaticamente. Executar no PC de
teste, com a build nova instalada/preparada e o modo imersivo já alinhado.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Set-BootStartupExperiment.ps1 -Mode supervised
```

Reiniciar manualmente, observar desde o primeiro logon e aguardar cerca de dez
segundos após a primeira tela interativa. Registrar tempo percebido, fluidez da
intro, resposta ao controle, flashes/roubo de foco e qual programa apareceu.
Se escolher um perfil, observar também se o problema começa somente ao carregar a home.

Coletar para uma pasta nova, substituindo os caminhos pelos do PC de teste:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Collect-BootStartupDiagnostics.ps1 -InstallFolder 'C:\Apps\Doorpi' -OutputDirectory 'C:\DoorpiTests\supervised-1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Set-BootStartupExperiment.ps1 -Mode direct
```

Reiniciar e repetir a observação/coleta para outra pasta. Fazer pelo menos três
execuções de cada caso, alternando a ordem. Identificar separadamente testes de
Reiniciar e Desligar/Ligar; não confundir reabertura da aplicação com primeiro logon.
Não atualizar binários, runtime ou driver entre os casos.

Ao terminar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Set-BootStartupExperiment.ps1 -Mode off
```

Off desativa a seleção experimental preservando o arquivo anterior como backup;
o padrão supervisionado volta a ser usado. Os traces não são apagados.
`-DataFolder` permite apontar explicitamente a pasta de dados quando há override
`DOORPI_APPDATA_ROOT`. Os scripts não precisam ser executados como administrador
para acessar os dados do próprio usuário em uma instalação normal.

O coletor inclui build do Windows, edição, CPU, drivers GPU, runtime registrado,
hashes dos binários e traces. O runtime registrado e os drivers inventariados são
distintos do runtime carregado e do adaptador gráfico realmente escolhido.

## Verificação executável e pendências

```powershell
dotnet run --project Doorpi.Boot.Tests/Doorpi.Boot.Tests.csproj --no-restore
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/Test-BootStartupTools.ps1
node scripts/Test-BootIntroLifecycle.cjs
node scripts/Test-FrontendIntegrity.cjs
```

O harness testa processos próprios, sinais, sessão local, orçamento, seleção,
probes obsoletos, handoff de reinício e trace. O teste de ferramentas usa fixtures
na workspace; a consulta de hardware/registro é somente leitura. Nenhum teste
substitui boot real ou comprova seleção/saúde da GPU. ETW/WPR e dumps continuam
sendo a próxima ferramenta se o PC lento reproduzir o travamento.

Não houve teste de logon/reboot nem ativação de experimento na máquina atual.
Permanecem pendentes a validação de foco no Windows real, comparação de recursos,
reabertura, bloqueio/desbloqueio e recuperação/update nos dois caminhos.
