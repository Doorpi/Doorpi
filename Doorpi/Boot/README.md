# Inicialização imersiva e recuperação

O padrão continua supervisionado. Há agora uma rota direta experimental para
comparação, mantendo a preparação atual de Explorer como variável de controle.
Sua disponibilidade **não certifica prontidão gráfica**. Ver
[bootstrap-comparison.md](../../docs/architecture/bootstrap-comparison.md) para
objetivos separados de renderização/foco, diferenças, seleção, coleta e limites.

## Fluxo

O modo existente em HKCU/Winlogon foi preservado. Não foi habilitado Shell Launcher,
alterada uma política de grupo, configurado autologon ou executada mudança de shell
durante o desenvolvimento. O fluxo ocorre **depois do logon interativo**.

1. `App` decide se está iniciando a supervisão ou a interface principal. Mutexes
   separados por função/sessão evitam duplicatas sem bloquear a dupla supervisor/UI.
2. `WindowsShellEnvironment` inicia o Explorer se necessário e verifica sua presença
   na sessão atual. O limite de preparação é 35 s, com recuperação explícita ao falhar.
3. `BootSessionSupervisor` cria sinais locais exclusivos por tentativa e inicia o
   processo principal com `--doorpi-main`, sem elevar privilégios.
4. A página carrega scripts e manifesto da intro, mas **não insere o iframe da intro**
   enquanto a ante-sala nativa não tiver cedido a tela.
5. `MainWindow.BootLifecycle` confirma `DoorpiIntro.isPrepared()` e sinaliza
   `Presentation`. O supervisor solicita a transferência de foreground ao filho,
   fecha a ante-sala e sinaliza `Released`.
6. O host libera `doorpi:boot-presentation-released`. A intro existente começa do
   início, com seu áudio, duração, controles e handoff preservados.
7. A janela principal protege o foco durante a apresentação. Quando a intro terminou
   e o seletor/setup/home está visível, com as funções de entrada carregadas, encerra
   essa proteção, sinaliza `Ready` e confirma a saúde da atualização.

São duas prontidões distintas: a primeira permite apresentar a intro sem ocultar seu
começo; a segunda confirma que o aplicativo oferece uma interface utilizável. A
existência de HWND, DOM/body ou processo isoladamente não confirma a segunda etapa.

## Supervisão

- Espera máxima de interface utilizável: 90 s por tentativa, incluindo a intro.
  O tempo de sessão bloqueada é desconsiderado pelo supervisor e pelo observador da UI.
- Até três tentativas automáticas, com intervalos de 1 s e 2 s. Após isso, recuperação
  oferece nova tentativa explícita ou desktop. Uma sessão saudável por dois minutos
  renova o orçamento de falhas.
- Eventos de falha do WebView continuam usando o health probe existente. Em modo
  supervisionado, o pedido de reinício vai ao supervisor, inclusive depois dos três
  minutos iniciais. As guardas de gameplay/mídia/lojas continuam impedindo esse reinício
  enquanto há uma sessão externa ativa.
- O supervisor acompanha a saída do processo. Saída zero após prontidão encerra a
  supervisão; saída anormal ou pedido explícito de recuperação tenta reabrir a UI.
- Não há heartbeat JavaScript permanente nem dependência de animação rodando durante
  gameplay. Isso **não detecta todo tipo de travamento do dispatcher WPF**: processo
  vivo completamente bloqueado depois do boot ainda exige evolução específica.
- Só o processo Doorpi lançado pelo supervisor pode ser encerrado nas tentativas.
  Nunca se encerra sua árvore de processos: jogos e aplicativos têm vida independente.
- A ante-sala normal não oferece atalho de saída para o desktop. Essa ação fica na
  tela de recuperação, que aceita teclado, mouse e XInput (A confirma, B volta
  ao desktop, esquerda/direita selecionam). Ela não grava uma mudança permanente de modo.
- Reentrada após apresentação da intro, recarga da home e reinício após atualização
  não devem reproduzir a intro novamente na mesma retomada.

## Atualizações e configuração

O updater precisa aplicar arquivos sem o supervisor mantendo o executável aberto.
Depois que o updater confirma estar pronto, o cliente envia `Detach` e aguarda a saída
do supervisor antes de encerrar sua própria UI. O updater reabre o aplicativo com
`--doorpi-shell-bootstrap --doorpi-resume-session`: o app valida se o modo imersivo
está configurado; nesse caso, restabelece a supervisão sem repetir a intro.

`BootConfiguration` reconhece o executável Doorpi, não qualquer valor Shell não vazio.
Ao ativar o modo, guarda a shell e o som de inicialização anteriores. Desativação e
desinstalação restauram somente uma configuração ainda pertencente ao Doorpi. Instalações
antigas sem snapshot voltam ao padrão ao remover o override próprio. A desinstalação
compara também o caminho da instalação para preservar outra instalação do Doorpi.
Os snapshots preservam strings expansíveis do registro. Uma mudança posterior do
usuário no som é mantida. Se não for possível restaurar a shell, o uninstaller
interrompe a remoção antes de apagar o executável.

Logs de boot permanecem em Release, com rotação de 512 KiB e um arquivo anterior.
Em Release não se produz o dump detalhado de usuário, registro e linha de comando
existente no diagnóstico Debug. Nenhum erro de log deve impedir a inicialização.

## Visual

`BootIntroWindow` é uma ante-sala WPF silenciosa: fundo compatível com o início da
intro, horizonte de luz, variação suave de opacidade e indicação discreta de atividade.
Não contém logo animado, música, vídeo, duração mínima ou porcentagem inventada.
Respeita `SystemParameters.ClientAreaAnimation`. A intro escolhida nos pacotes continua
sendo a apresentação principal; os assets e manifestos dos pacotes não foram alterados.
O texto e o indicador usam linhas de altura fixa, sem depender de dicas opcionais.
Reabrir o aplicativo com Explorer disponível não cria a ante-sala nativa apenas
porque a preferência do próximo logon continua configurada como imersiva.

O histórico registra a introdução do bootstrap em `c853075` ("modo console corrigido
e mais"), junto a health checks e esperas da renderização. Não comprova sozinho que
o workaround de segundo processo ainda é necessário; supervisão e prontidão não
justificam automaticamente preservar essa separação. A decisão sobre retirá-la do
fluxo padrão deve considerar a comparação do boot com e sem o workaround.

## Verificação

```powershell
dotnet run --project Doorpi.Boot.Tests/Doorpi.Boot.Tests.csproj
node scripts/Test-BootIntroLifecycle.cjs
node scripts/Test-FrontendIntegrity.cjs
powershell.exe -NoProfile -STA -File scripts/Render-BootPreview.ps1
```

O teste C# inicia processos-filhos do próprio harness e usa os sinais reais do Windows.
Não inicia Explorer e não altera registro/shell. Verifica reconhecimento, isolamento,
handoff, saída normal, falhas, timeout, recuperação e desligamento para atualização.
O teste JS executa o controlador real com DOM simulado para verificar que a intro só
começa depois da liberação, começa uma vez e libera setup/perfis quando desabilitada.
O preview renderiza o XAML real fora da tela em 720p, 1080p e 4:3.

Antes de distribuir, validar em VM Windows com snapshots: logon real, logout/reboot,
Explorer lento/ausente, WebView ausente ou falhando, lock/unlock, jogo ativo durante
crash da UI, perda do supervisor, update/rollback, mudança de modo e desinstalação.
Esses cenários completos de sessão e recuperação do registro não são comprovados
pela compilação ou pelos testes isolados.
