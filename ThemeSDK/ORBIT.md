# Orbit 2 — tema oficial e showcase do SDK

Orbit é uma composição independente, criada somente com CSS e o contrato visual
v1. Não injeta HTML, não executa JavaScript e não chama serviços do Windows. Sua
fonte está em `examples/orbit-modular`; o nome da pasta foi mantido para preservar
os comandos de desenvolvimento existentes. A identidade `orbit` preserva as
seleções salvas. O desenho anterior foi substituído integralmente.

## Direção visual

Superfícies grafite, branco levemente quente e acento verde discreto. As artes
dos jogos fornecem a maior parte da cor. A tipografia usa Segoe UI, como o tema
padrão, sem baixar fontes. Não há animações decorativas permanentes, canvas do
tema, imagens externas ou filtros adicionais de desfoque.

| Componente | Composição |
| --- | --- |
| Home | Painel do jogo à esquerda, galeria horizontal de capas à direita, abas acima da galeria e comandos na base. Logo, nome, horas e Jogar permanecem agrupados. Arte/trailer ocupa sua própria área abaixo das informações. |
| Biblioteca e menu | Moldura própria, categorias no topo, ferramentas de busca/filtro com nomes sempre visíveis e grade de capas de largura responsiva. Filtros e busca usam as mesmas superfícies. |
| Menus laterais | Painel rápido destacado da borda; editor de biblioteca com navegação e área de trabalho separadas. |
| Popups | Superfícies sólidas, bordas discretas, foco claro e ações consistentes. Cores semânticas de ações perigosas permanecem com o aplicativo. |
| Login | Título assimétrico, retratos quadrados e atmosfera própria; escolha de perfil e ações de energia permanecem disponíveis. |

## Como a Home é composta

`parts/home.json` declara duas colunas e três linhas:

```text
feature | toolbar
feature | library
controls controls
```

Dentro de `feature`, a região `copy` fica acima de `art`. O mesmo player nativo
do frontend ocupa `art` por `layout.trailer = feature-art`; o tema não recria o
player nem controla sua reprodução. Tela cheia depende de ação manual no núcleo.

O CSS ajusta margens, tamanhos e superfícies, incluindo alternativas para telas
baixas e 4:3. As capas da Home continuam em 2:3. O carrossel continua como região
0, independentemente da posição visual, e restaura o item selecionado.

## Biblioteca e navegação

A biblioteca usa `repeat(auto-fill, minmax(...))`. O núcleo calcula a quantidade
real de colunas a partir do CSS, mantendo Cima/Baixo alinhados com as capas. As
ferramentas permanecem à esquerda porque o contrato atual dessa tela estabelece
essa travessia. Seus ícones circulares viram botões retangulares com texto.

Tema não substitui busca, filtros, carregamento gradual, contagem, callbacks ou
rolagem. O número de cards exibidos é uma decisão de composição; o total continua
sendo calculado pelo aplicativo. Testar nomes longos, ausência de capa, listas
grandes, listas vazias, última linha incompleta e retorno das ferramentas.

## Autoria e distribuição

```powershell
node scripts/theme-sdk.cjs dev ThemeSDK/examples/orbit-modular
node scripts/theme-sdk.cjs check ThemeSDK/examples/orbit-modular
node scripts/theme-sdk.cjs pack ThemeSDK/examples/orbit-modular --output artifacts/orbit-2.0.1.doorpitheme
```

O Studio abre uma prévia externa com atualização ao salvar. O comando `pack`
exige um destino novo. O pacote contém os mesmos cinco componentes da opção
oficial embutida; importá-lo permite estudar a distribuição normal da comunidade.

`scripts/Build-BuiltinThemes.cjs` usa o loader do SDK para gerar o payload visual
distribuído em `Doorpi/wwwroot/themes/builtin/orbit.json`. É chamado pelo build
CSS; a ferramenta de build requer Node.js 22 ou superior. Não editar esse JSON
gerado. A aplicação usa o mesmo compilador, escopo e proteção de cards dos pacotes
importados. Não há condições do tipo “se o tema for Orbit” na apresentação.

Em Configurações → Temas → Temas do sistema → Temas, Orbit aplica os quatro
módulos do perfil em uma única gravação. Pacotes parciais aparecem nas respectivas
abas de módulos; cada módulo pode ser personalizado depois, sem alterar os demais.
Tela de Perfis é uma escolha manual separada, pertencente ao dispositivo. Restaurar padrão
reverte todas as áreas. Nenhuma preferência existente é migrada ou regravada pelo
redesenho do tema.

## Limites e validação

O showcase cobre as cinco áreas da API v1. Intro, setup, teclado, aplicativos web,
conteúdo de jogos e janelas WPF não são alcançados por esse contrato. Não há uma
promessa de substituir integralmente todas as telas do Windows ou do Doorpi.

Os renderizadores locais usam os controllers e CSS reais com dados de amostra:

```powershell
node scripts/Test-TrailerPresentation.cjs
node scripts/Test-ThemeSelection.cjs
node scripts/Test-ThemeLayoutNavigation.cjs
node scripts/Render-ThemePreview.cjs
node scripts/Render-ConsoleSurfaces.cjs
```

As capturas e métricas ficam em `artifacts/theme-preview` e
`artifacts/console-surfaces`. Essas verificações não substituem uso real no
WebView2 com controle físico nem certificam FPS em hardware lento.
