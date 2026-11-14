# Resultados iniciais do PC principal

Análise em 08/11/2026 dos registros de 07/11/2026. Fonte:
`%LOCALAPPDATA%/Doorpi/Data/logs/boot-diagnostics.log` (138 linhas, 137 eventos
reconhecidos). O autor confirmou que testou somente o modo imersivo normal e que
a experiência funcionou normalmente. Não foi executado teste com limitação de
recursos, alterada a seleção experimental ou modificado o aplicativo nesta análise.

## Evidência disponível

Os dois percursos recentes usam executáveis do diretório `bin/x64/Debug` e
reportam runtime WebView2 carregado `157.0.4341.42`. Os registros antigos da manhã
reportam `156.0.4314.58`; não são usados como uma comparação de desempenho da mesma
build/runtime. Não há MVID/hash por execução nos registros disponíveis para
certificar identidade dos binários entre os percursos.

| Medida observada | Abertura comum, PID 6432 | Boot supervisionado, PIDs 6236 → 13120 |
| --- | ---: | ---: |
| Primeiro `app-onstartup` até `boot-ui-interactive` | 8,852 s | 19,056 s, incluindo supervisor |
| Construtor principal, entre seus marcadores | 1,187 s | 1,764 s |
| Criação do ambiente WebView2, duração reportada | 30 ms | 20 ms |
| Criação do controller WebView2, duração reportada | 555 ms | 382 ms |
| Pedido de navegação até conclusão | 2,155 s | 723 ms |

São tempos de parede entre marcadores do aplicativo, não tempo desde ligar o PC,
nem amostras de CPU. O primeiro marcador ocorre depois do início real do processo.
A abertura comum já tinha Explorer; o supervisor começou sem Explorer e seu filho
já o encontrou em execução. **Não são os lados A/B do experimento direct/supervised.**

Detalhamento do boot supervisionado mais recente:

- `app-onstartup` do supervisor: 21:08:09.641, no formato local registrado pelo Debug.
- Primeiro marcador de proteção da ante-sala: 21:08:11.802.
- Explorer disponível: 21:08:13.509.
- Filho solicitado: 21:08:13.538, 3,897 s após o primeiro marcador do supervisor.
- Primeiro `app-onstartup` do filho: 21:08:14.237, 699 ms depois da solicitação.
- Navegação concluída: 21:08:17.522.
- Solicitação de transferência de foreground: 21:08:17.840, `allowed=False`.
- Apresentação liberada pelo supervisor: 21:08:18.132.
- Proteção de foco principal iniciada: 21:08:18.359.
- Gate de usuários liberado: 21:08:19.757, 2,235 s após concluir a navegação.
- Proteção encerrada com `reason=interactive`: 21:08:28.679.
- Interface interativa: 21:08:28.697; confirmação pelo supervisor: 21:08:28.754.

O gate de usuários é liberado após um probe agendado com atraso de 2.200 ms.
Portanto, os 2,235 s não são uma medição de trabalho contínuo da GPU. Entre liberar
a apresentação e marcar a interface interativa passam 10,565 s, que incluem o
fluxo da intro/destino. Não há instrumentação de frames/input suficiente para
atribuir essa janela a renderização ou certificar sua fluidez.

Os probes de saúde recentes retornaram `healthy=True`, com duração reportada de
0–1 ms. Eles executam JavaScript e verificam DOM/origem; não testam apresentação
de frames nem a cadeia completa de GPU. Não há timeout, pedido de reinício ou
falha registrada nesses percursos. O autor também não percebeu falha.

## O que os registros permitem concluir

1. O caminho supervisionado atual completou a apresentação e o handoff neste PC.
2. A criação de ambiente/controller não foi a etapa longa observada neste boot.
3. A API de delegação de foreground pode ser recusada em um boot bem-sucedido;
   não pode ser requisito obrigatório para prosseguir. A proteção terminou no
   ponto aprovado, mas não há trace dos HWNDs/tentativas para reconstruir todo o foco.
4. A execução comum mostra que o host pode iniciar sem um segundo Doorpi quando
   o Windows já está preparado. Não demonstra isso no primeiro logon.

Não é possível calcular economia de memória/CPU do supervisor: não há arquivos
`boot-trace-*.jsonl` na pasta observada. A seleção usada foi `source=default`, que
não habilita o trace experimental. Também não há FPS, latência de controle,
adaptador/backend efetivo, ETW ou dump do defeito antigo.

O modo Debug ainda monta um diagnóstico amplo por evento, consultando processos,
registro e runtime. Os tempos são úteis para localizar fases, mas não devem ser
apresentados como benchmark Release. Não subtrair 8,852 de 19,056 para chamar a
diferença de custo do bootstrap: as condições e a apresentação são distintas.

## Simular um PC lento

É viável reduzir recursos para investigar tolerância a atrasos. Isso testa uma
classe de condições, sem reproduzir automaticamente outro driver, GPU, armazenamento,
cache ou ordem de logon. Uma falha reproduzida é evidência útil; um teste aprovado
não elimina o problema histórico em outras máquinas.

| Abordagem | O que ajuda a testar | Limite para este caso |
| --- | --- | --- |
| Afinidade/CPU rate de um Job Object | Menos paralelismo e orçamento de CPU | Verificar quais hosts/helpers WebView realmente receberam o limite e se houve reutilização de processos; não reduzir só o supervisor |
| Pressão de memória controlada | Paginação e competição por RAM | Um limite de memória comprometida do processo pode provocar falha de alocação em vez de simular um Windows com pouca RAM |
| VM com poucos vCPUs e pouca RAM | Logon, recuperação e ordenação sob recursos limitados | GPU virtual/driver não são o pipeline físico deste PC |
| Atrasos injetados em fases específicas | Corridas de protocolo, timeout e foco | Não simula GPU lenta nem comprova correção gráfica |
| Limites de CPU/RAM na entrada de boot Windows | Restringe também o restante do sistema durante o logon | Muda a configuração de boot; não é necessário como primeiro experimento no PC principal |

A Microsoft documenta CPU rate/afinidade em Job Objects, limites de memória
comprometida e opções BCD para reduzir memória disponível ao Windows. Não são
mecanismos equivalentes. Um Job Object também pode alcançar filhos como Explorer,
jogos ou helpers; uma ferramenta de teste precisa delimitar o conjunto e registrar
os limites efetivos, sem `KILL_ON_JOB_CLOSE` sobre a sessão de uso normal.

Recomendação: primeiro fazer direct/supervised sem pressão artificial, nesta mesma
máquina e em Release, com traces nos dois. Depois repetir sob limitação de CPU,
mantendo o mesmo limite em ambos os caminhos. Pressão de memória e alteração do
momento Explorer/WebView seriam experimentos separados. Não alterar BCD/MSConfig
nem desativar aceleração gráfica para esta primeira comparação.

## Onde está o teste

Não há controle na interface: a seleção é feita por
`scripts/Set-BootStartupExperiment.ps1`, com `-Mode supervised`, `-Mode direct`
ou `-Mode off`. A seleção habilita trace nos dois modos explícitos, é lida na
entrada imersiva e não reinicia o PC. Reabrir pela área de trabalho não substitui
o teste de logon. Os comandos, coleta e reversão estão em
[bootstrap-comparison.md](bootstrap-comparison.md).

## Atualização — execução direta confirmada às 00:39 de 08/11

Após selecionar direct e solicitar a conferência, surgiu um trace com runId
`9aa9ff3e251248239b68585be9d3da42`, PID 11632 e 60 registros válidos. O arquivo
experimental contém `schemaVersion=1`, `path=direct`. A execução efetiva registra
`shellEntry=True path=Direct source=experiment issue=`: a seleção foi realmente
aplicada, apesar de a linha de comando legada ainda conter `--doorpi-shell-bootstrap`.

Todo o protocolo, a janela principal e a prontidão usam o mesmo PID. Não há evento
de criação de filho Doorpi e os snapshots do diagnóstico mostram apenas `11632:s1`.
Os helpers Chromium continuam existindo, como esperado. O primeiro snapshot não
tinha Explorer; ele foi iniciado pela preparação de compatibilidade, antes do WebView.

| Medida da execução direta | Resultado |
| --- | ---: |
| Primeiro `app-onstartup` até `boot-ui-interactive`, mesma referência do teste anterior | 14,745 s |
| Início real do processo até `boot-ui-interactive`, disponível somente no novo trace | 15,343 s |
| Preparação de compatibilidade Explorer, fase medida | 1,161 s |
| Construtor completo, fase medida | 1,410 s |
| Armazenamento de usuários, dentro do construtor | 1,017 s |
| Ambiente WebView2, fase medida | 14 ms |
| Controller WebView2 | 387 ms |
| Instalação da extensão de trailers | 55 ms |
| Pedido de navegação até conclusão | 2,294 s |

O ambiente carregou WebView2 `157.0.4341.42` e .NET `8.0.33`. O MVID registrado
foi `d43ac74f-94bf-4f77-b03b-cc1adccb3a73`. Os marcadores antigos de ambiente
reportam 33 ms porque incluem trabalho de diagnóstico ao redor da fase de 14 ms;
não são a mesma delimitação.

O protocolo registrou prepared, released e ready, sem timeout/falha/reinício no
intervalo coletado. Dois health checks retornaram `healthy=True`. O documento
terminou com `focused=true`, `visibility=visible`, `interactive=true` e paint entries.
Antes do handoff, a ante-sala fez três tentativas de ativação com `accepted=True`.
Depois, o foreground observado era a janela principal do próprio Doorpi e a
proteção terminou com `reason=interactive`. Isso descreve os sinais observados;
não mede FPS, latência de controle ou todos os intervalos entre frames.

A execução levou 4,311 s a menos entre os mesmos marcadores que os 19,056 s do
supervisionado anterior. É uma observação de uma execução por caminho em Debug,
não uma economia garantida nem uma estimativa isolada de custo do segundo processo.
Há interação do usuário: o envio dos dados de perfil começou antes do marcador
final de prontidão, alterando a carga durante a amostragem. Não comparar essa
amostra de memória com uma execução parada no seletor.

Agora há amostras de CPU/memória no direct, mas o supervisionado anterior não tem
as equivalentes. Não é possível calcular a economia de recursos do supervisor.
O resultado demonstra que o segundo processo não foi necessário para este boot
bem-sucedido neste PC, mantendo a preparação de Explorer. Não demonstra ausência
do defeito histórico em todas as máquinas, nem torna a supervisão externa equivalente
ao caminho direto. Nenhuma configuração ou código foi alterado nesta conferência.

## Referências primárias consultadas

- [AllowSetForegroundWindow](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-allowsetforegroundwindow).
- [CPU rate de Job Object](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_cpu_rate_control_information).
- [Afinidade e limites básicos de Job Object](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information).
- [Limites de memória comprometida](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_extended_limit_information).
- [Herança e duração de Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
- [Simular pouca memória por parâmetros de boot](https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/boot-parameters-to-manipulate-memory).
- [Windows Performance Recorder / ETW](https://learn.microsoft.com/en-us/windows-hardware/test/wpt/windows-performance-recorder).
