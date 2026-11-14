# Direção do visual padrão — revisão de 9 de novembro de 2026

## Objetivo e referências

O Doorpi é um gerenciador de sessão para uso com controle na sala. O visual deve
ajudar a reconhecer onde o usuário está, o que está selecionado e como voltar.
A direção atual usa superfícies neutras em cinza/violeta, cores pontuais nos
destinos e o fundo azul/violeta da intro na seleção. A escala para desktop tem um
limite, com uma faixa própria para 4K. O objetivo continua sendo pouco ruído e
texto legível. A composição ainda precisa ser validada no uso diário e na TV.

Referências consultadas antes da implementação:

| Fonte | Aplicação no Doorpi |
| --- | --- |
| [Sony — PS5 Design Story](https://www.sony.com/en/SonyInfo/design/stories/PS5/) | Continuidade entre telas, funções rápidas e hierarquia que não dependa de decoração. |
| [Nintendo — Switch 2 HOME](https://www.nintendo.com/en-gb/Support/Nintendo-Switch-2/Nintendo-Switch-2-HOME-Menu-Overview-2879084.html) | Destinos do sistema reconhecíveis e acesso previsível pelo controle. |
| [Xbox — novo Home](https://news.xbox.com/en-us/2023/07/26/welcome-to-your-new-xbox-home/) | Dar espaço à arte e personalização sem comprometer o acesso às funções. |
| [Valve — Steam Deck Software](https://www.steamdeck.com/en/software) | A experiência com controle abrange também os ajustes do sistema. |
| [Microsoft — XAG 102](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/102) | Contraste de texto e de elementos importantes precisa ser verificável. |
| [Microsoft — tags de acessibilidade](https://learn.microsoft.com/en-us/gaming/accessibility/accessibility-feature-tags) | Escalar texto para a distância de uso, sem presumir que um tamanho confortável no monitor serve na TV. |
| [Santiago Rodríguez — Mistborn, conceito de UI para console](https://www.santirv.com/work/mistborn) | Papéis consistentes de cor, componentes compartilhados e redução de níveis simultâneos de navegação. É um conceito independente, não uma interface oficial de console. |

Também foram pesquisados conceitos no Behance e publicações no X. O conceito
PlayStation 5 de Behance retornou HTTP 403; a pesquisa no X não forneceu material
direto verificável suficiente. Não foram usados como evidência de decisões oficiais.
Nenhum recurso visual dessas referências foi copiado para o aplicativo.

## Primeira etapa implementada

- Perfis: título central, nomes legíveis, avatares sem foto com cores variadas,
  foco por anel branco e ações de energia secundárias. A
  atenuação por distância foi reduzida: o piso passa de 22% a 82% de opacidade.
- Painel rápido: cabeçalho identificado, ícones em superfícies próprias, nome e
  descrição por destino, foco distinto da seção aberta e energia separada ao pé.
  Descrições disponíveis em português e inglês.
- Conteúdo básico do painel: títulos, descrições e cards seguem a mesma hierarquia,
  materiais e indicação de foco. Telas especializadas de atualização, som,
  Bluetooth, Wi-Fi e armazenamento ainda precisam de uma revisão própria completa.
- Fundo e estrutura das duas superfícies deixam de depender de blur de tela inteira.
  Não foram acrescentados loops de animação ou novas dependências. O ambient da
  intro existente permanece; não foi feita medição de GPU, memória ou FPS nesta etapa.
- Foram preservados destinos, ações do host, seleção obrigatória, centralização do
  carrossel de perfis, retorno ao painel e regras de handoff da intro. A aplicação
  de temas por área continua funcionando. Não houve migração de estado ou mudança
  nos mecanismos de boot.

### Escala e continuidade revisadas em 1440p

A referência informada pelo autor é 2560×1440 a 100%, na abertura normal do app.
As medidas anteriores cresciam demais com `vw`: menu de 768 px, rótulos de 34,56 px
e nomes de 42,24 px. Agora a unidade interna fica entre 0,8 e 1,1 px no desktop;
em 1440p, menu de 475,2 px, rótulos de 24,2 px e nomes de 25,3 px. A faixa 4K usa
1,7 px. Esses valores são CSS pixels, sujeitos ao zoom/DPI efetivo do WebView.

O menu usa seleção clara sobre fundo neutro. Ícones distinguem atualização,
armazenamento, som, conectividade, arquivos e energia por forma, rótulo e cor.
Foi retirada a palavra DOORPI repetida sobre o título dos perfis. A camada
decorativa diagonal do seletor foi removida: durante o handoff, somente o ambient
existente da intro compõe o fundo. A timeline e os tempos do pacote não mudaram.

## Organização dos fontes

| Fonte | Responsabilidade |
| --- | --- |
| `Doorpi/Frontend/styles/foundation/016-console-surfaces.css` | Vocabulário interno compartilhado de cores, materiais, foco e raio. Não amplia a API pública v1 de tokens. |
| `injected-styles/app/doorpi-quick-panel-shell.css` | Estrutura do overlay, menu, cabeçalho, ícones, descrições e foco. |
| `injected-styles/app/doorpi-quick-panel-styles.css` | Conteúdo, páginas internas e ajustes responsivos do painel. |
| `injected-styles/app/doorpi-overlay-styles.css` | Seleção, perfis e gerenciadores existentes; ajustes desta etapa concentrados no seletor e energia. |
| `scripts/app/140-user-picker.js` | Markup e atenuação de apresentação dos perfis; seleção e ações preservadas. |
| `scripts/app/150-quick-panel-state-and-helpers.js` | Markup do menu com descrições; mesmos destinos e ordem. |

Os caminhos de CSS/JS acima são relativos a `Doorpi/Frontend`. A montagem continua
por bundles. O Studio recebeu o cabeçalho correspondente na fixture de login;
fixtures não equivalem a executar uma sessão real do Doorpi.

## Continuação planejada

1. Validar esta composição na TV: distância real, escala do Windows, avatares reais,
   diferentes quantidades de perfis e controle físico. Ajustar antes de expandir.
2. Home e nav-menu: mesma tipografia/foco, continuidade das superfícies e mapa de
   ida/volta. Preservar carrossel como região 0 e card selecionado no retorno.
3. Adicionar jogos, apps, pastas e edição: mesmos cabeçalhos, estados vazios, campos
   e ações primária/secundária; revisar a navegação existente por tela.
4. Páginas especializadas do painel e PIN/recuperação: consolidar componentes e
   eliminar diferenças de escala/contraste com estados reais de carregamento e erro.
5. Continuidade da intro até a Home e transições entre áreas: avaliar o conjunto em
   vídeo e medir custo de composição. Não adicionar uma segunda introdução.

Permanece pendente uma política comum para os percursos especializados das outras
telas. O redesenho desta etapa não declara resolvida toda a navegação do produto.

## Verificação

`node scripts/Render-ConsoleSurfaces.cjs` usa os controladores e CSS reais em uma
fixture isolada, com mensagens do Windows capturadas por um host falso. Produz
capturas e relatório em `artifacts/console-surfaces`, cobrindo cinco resoluções,
foco/retorno/rolagem, ações visíveis, seleção obrigatória, avatar sem foto,
guardas da intro, português/inglês e movimento reduzido. Inclui limites de escala
em 1440p e a sequência real do pacote Neon: mensagens de handoff/completion,
crossfade do iframe, ambient persistente e geometria estável dos avatares. O host
`app.local` é mapeado para um servidor local de teste; os tempos da intro são reais.

Integridade dos bundles e testes dos contratos de temas/navegação/intro acompanham
essa verificação. Headless Chromium não substitui WebView2, controle físico e TV;
não há certificação de acessibilidade ou desempenho decorrente dessas capturas.
Nenhum instalador, atualização ou manifesto de produção é gerado por esta etapa.

Resultado desta revisão: build Release com zero avisos e erros; verificação das
superfícies nas cinco resoluções, sequência real da intro e teste de edição ao vivo
do Studio aprovados.
Integridade dos bundles e contratos de temas, seleção, navegação e ciclo da intro
também aprovados. As capturas usam perfis fictícios e não são capturas da instalação
de uso diário do autor.
