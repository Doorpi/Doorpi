# Temas: aparência e composição por regiões

O objetivo é permitir reorganizar as telas do Doorpi sem substituir seus elementos
ou reimplementar funcionalidades. A comunidade deve poder colocar o carrossel acima
do destaque, reposicionar arte e textos e alterar a disposição de painéis e menus.
Isso exige contratos de regiões e navegação coerente com a geometria, além de cores.

O contrato continua em desenvolvimento. A seleção de temas instalados já está em
**Configurações → Temas**, com **Doorpi padrão**, **Orbit** e **Adicionar pacote**.
O [Theme SDK](../../../ThemeSDK/README.md) documenta criação local, prévia ao salvar,
exportação e importação do contrato `.doorpitheme`. A loja continua futura.

Seleções independentes: Home, menu principal, menus laterais e popups por perfil;
tela de perfis por dispositivo. Um pacote pode oferecer uma ou várias áreas, e
as escolhas podem ser combinadas. Escolher **Doorpi padrão** na lista altera só a
área atual. **Restaurar padrão** reverte todas as áreas do perfil e o login do
dispositivo em uma transação SQLite, sem apagar pacotes ou alterar outros perfis.

Orbit 2 é o tema oficial alternativo e showcase do SDK: galeria à direita,
informações e trailer à esquerda, biblioteca com ferramentas rotuladas e
composição própria para menus, painéis, popups e login. Ver
[guia do Orbit](../../../ThemeSDK/ORBIT.md). As capas permanecem em **2:3**
(SteamGrid vertical); o token de proporção é fixo e valores diferentes são rejeitados.
O tema padrão e a restauração completa continuam acessíveis durante a gravação.
O trailer usa `layout.trailer=feature-art` no Orbit, acompanhando a região da arte.
A camada do player nasce separada do fundo; aplicação não move o iframe/video em uso.

A seleção usa uma lista rolável de nomes, com indicação do tema ativo, sem mockups
ou cards de apresentação. Cima/baixo percorrem a lista; Voltar recupera a opção Temas
no menu. O cabeçalho e Restaurar padrão ficam fora da rolagem. Apresentação visual e
capturas reais dos temas pertencem à futura loja, ainda não implementada.
Cima passa pelas áreas, pelos botões do cabeçalho e só então pelas categorias do
menu. A importação usa o explorador interno, que recebe a navegação enquanto aberto.

O enquadramento do fundo também faz parte do tema: altura, posição, opacidade,
filtro e máscara do hero são tokens públicos. Orbit usa uma atmosfera discreta em tela inteira, preservando contraste
na coluna de informações. O carrossel ocupa uma região independente à direita.

## Fontes e responsabilidades

| Fonte | Responsabilidade |
| --- | --- |
| `styles/foundation/015-theme-tokens.css` | 78 valores padrão de aparência e dimensões |
| `Frontend/themes/contract.json` | Metadados de autoria: tipos, vínculos e regiões; não duplica valores CSS |
| `styles/features/210-editorial-home.css` e `styles/features/home/*` | Nove fragmentos ordenados da home: atmosfera, estrutura, trailer, arte, textos, biblioteca, indicador de execução, hints e responsividade |
| `styles/layout/230-theme-regions.css` | Adaptadores opcionais que posicionam regiões existentes |
| `wwwroot/themes/contract.json` | Contrato distribuído: tokens, validação CSS e regiões suportadas |
| `scripts/themes/010-theme-runtime.js` | Validação e troca transacional da aparência/layout; fonte de `wwwroot/themes.js` |
| `scripts/themes/020-theme-selection.js` | Catálogo, carregamento por perfil, cancelamento e persistência pela bridge |
| `scripts/themes/030-trailer-layout.js` | Apresentação do player na região da arte, sem controlar reprodução |
| `scripts/themes/040-package-styles.js` | Compilação CSS escopada, recursos locais e aplicação por área |
| `Frontend/themes/package-contract.json` | Áreas, raízes, propriedade da seleção, formatos e limites de pacote |
| `scripts/nav-menu/186-theme-settings.js` e `injected-styles/nav-menu/theme-settings.css` | Lista de temas com navegação vertical, rolagem e restauração do padrão |
| `MainWindow.Themes.cs` e `Themes/ThemePreferenceStore.cs` | Validação da sessão/revisões e gravação SQLite |
| `wwwroot/themes/catalog.json` e `wwwroot/themes/builtin/orbit.json` | Catálogo e payload gerado do Orbit, compilado pelo mesmo SDK dos pacotes |
| `ThemeSDK/examples/orbit-modular/parts/*` | Fonte única dos cinco componentes oficiais do Orbit |
| `wwwroot/themes/examples/*.json` | Pacotes de exemplo Aurora e Ember, sem código executável |

`Build-ThemeContract.ps1`, chamado pelo gerador CSS, compõe o contrato distribuído
a partir dos metadados e dos padrões lidos do CSS. Os valores são editados em um
único lugar: `015-theme-tokens.css`. Não editar `wwwroot/themes/contract.json`
manualmente; ele é uma saída gerada e versionada, assim como os bundles.

O bundle continua sendo concatenado na ordem explícita de `styles/bundle.json`.
Os arquivos não são folhas independentes. Os fragmentos de estado do trailer,
sessão, sobreposições e entrada não foram descartados nem antecipados.

O catálogo, contrato e exemplos JSON são contratos de pacote distribuídos com a
aplicação. A preferência pertence a cada perfil Doorpi e usa `Doorpi.Storage`/SQLite,
no documento lógico já existente `Data/users/<id>/display-settings.json`. Nenhum JSON
físico de preferência é criado e não há mudança de schema. Campos anteriores são
preservados. A gravação exige geração da sessão e revisões do documento e do perfil;
respostas e carregamentos antigos são descartados na troca de perfil. Atualizações
de metadados do mesmo usuário não reiniciam o tema.

A home aguarda a preferência antes de aparecer. Pacote ausente ou inválido volta ao
padrão nesta sessão, com aviso na seleção; não apaga a preferência. Dados corrompidos
são preservados, e a restauração continua funcionando visualmente mesmo que não seja
possível gravá-la. Erros de gravação são exibidos, sem fingir persistência bem-sucedida.

O mapa `themeParts` é acrescentado ao documento lógico existente, preservando a
preferência antiga e campos desconhecidos. A leitura antiga de Orbit equivale a
Home + menus laterais; não regrava o estado ao ler. A escolha geral do login usa
o documento lógico `Data/theme-settings.json`, também SQLite, com revisão própria.
Documentos genéricos existentes suportam isso sem migração de schema SQLite.
Pacotes externos versionados ficam em `Data/theme-packages/<sha256>`; staging
interrompido é ignorado. Cópias anteriores e a origem são preservadas.

## Compor regiões

Cada região preserva os elementos, IDs, callbacks e comandos existentes. O tema
define onde ela aparece. Esta etapa não move nós no DOM, não clona botões e não
cria uma segunda implementação do carrossel.

| Grupo já exposto | Regiões | Composição disponível |
| --- | --- | --- |
| `home` | `feature`, `toolbar`, `library`, `controls` | Presets `feature-first`/`library-first` e grade personalizada |
| `feature` | `art`, `copy` | Presets `art-left`/`art-right` e grade personalizada |
| `copy` | `eyebrow`, `logo`, `title`, `meta`, `playtime`, `action` | Presets `title-first`/`meta-first` e grade personalizada |
| `dialog` | Barra lateral e conteúdo da janela de adicionar itens | Presets `left`/`right`; grade livre ainda não exposta |
| `trailer` | Player original | `backdrop` ou `feature-art`; cinema segue o comportamento do núcleo |

Exemplo de estrutura declarada pelo tema, com o carrossel em cima:

```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "id": "meu-tema",
  "name": "Meu tema",
  "tokens": {
    "--doorpi-card-radius": "18px",
    "--doorpi-home-title-color": "#c0fff1"
  },
  "layout": {
    "home": {
      "areas": ["library", "toolbar", "feature", "controls"],
      "rows": "auto auto minmax(0, 1fr) auto",
      "columns": "minmax(0, 1fr)"
    },
    "feature": "art-right",
    "copy": "meta-first",
    "dialog": "right"
  }
}
```

Grades personalizadas admitem até oito linhas/colunas, células vazias `.` e áreas
retangulares. Todas as regiões do grupo devem estar representadas; nomes desconhecidos
ou regiões omitidas são rejeitados. O tema não fica limitado a escolher entre dois
presets: pode declarar outras combinações de linhas/colunas dentro do contrato.

A presença das regiões não garante bom contraste, leitura ou dimensões adequadas:
um pacote ainda precisa ser testado nas resoluções e estados suportados. Os limites
atuais validam estrutura e CSS, sem prometer que qualquer grade arbitrária ficará utilizável.

Sem tema ativo, os atributos de layout não existem e os adaptadores opcionais não
se aplicam. Os valores padrão reconstituem exatamente o CSS anterior à extração.

## Aplicar e reverter durante o desenvolvimento

Na página do Doorpi, com a nova build carregada:

```javascript
const theme = await (await fetch('themes/examples/aurora.json')).json();
await DoorpiThemes.apply(theme);
// Restaura aparência e disposição anteriores:
DoorpiThemes.reset();
```

Essa API direta serve para integração/desenvolvimento e não salva dados de perfil.
Para selecionar e persistir um tema instalado, use a tela ou
`await DoorpiThemeSelection.select('orbit')`. Na próxima sessão, a preferência do
perfil será restaurada. `DoorpiThemeSelection.select('default')` cancela a aplicação
pendente imediatamente e serializa a gravação atrás de qualquer confirmação em curso.

O runtime valida o pacote completo antes de alterar o tema atual; preserva o estado
anterior se a validação falhar; reverte alterações parciais caso ocorra erro no DOM;
descarta pedidos assíncronos ultrapassados; e restaura propriedades/atributos sem
sobrescrever uma alteração posterior feita pela aplicação.

Tokens desconhecidos, código, seletores CSS arbitrários, URLs e funções CSS não
suportadas são rejeitados. Imagens/fontes empacotadas e CSS adicional da comunidade
ainda precisam de um contrato próprio; não foram adicionados implicitamente aqui.

## Navegação acompanha a disposição

A home original continha atalhos que presumiam abas acima dos cards. Em layouts
reorganizados, as direções passam a usar os retângulos reais dos elementos. O menu
continua acessível abaixo da última região interativa. O atalho original é preservado
quando a disposição padrão está ativa.

A entrada é definida pelo núcleo: o carrossel é sempre a região 0. O tema pode
movê-lo, mas não trocar essa âncora. Retorno recupera o card anterior, com memória
separada por perfil/aba. Ver [contrato de navegação](../../../docs/architecture/navigation-regions.md).

A janela de adicionar itens também tinha transições de grupos que presumiam a barra
lateral à esquerda. Com `dialog=right`, a travessia usa a posição dos controles e
preserva foco, scroll, som e sinalização de navegação. Testes usam as funções reais.

Isso não equivale a concluir a navegação de todos os componentes. O menu principal
tem percursos especializados para bibliotecas, filtros, áudio, perfis e atualizações;
não foi declarado compatível com reposicionamento livre sem revisar esses percursos.

## Cobertura e sequência para todo o sistema

| Área | Situação e trabalho restante |
| --- | --- |
| Home | Primeiras regiões, grades, tokens e ajuste de navegação implementados; validar biblioteca real, trailers e transições |
| Adicionar jogos/apps | Superfícies e barra lateral esquerda/direita expostas; separar cabeçalho, filtros, lista e ações como regiões adicionais |
| Menu principal | Mapear categorias, painel, ações de biblioteca e conteúdo; converter pressupostos de posição e percursos especializados antes de expor novos layouts |
| Configurações | Componentizar diretórios, abas, listas e ações por funcionalidade; preservar estados e foco dos dispositivos/atualizações |
| Perfis | Separar hero, identidade, ações, histórico e listas; revisar a navegação específica e operações de perfil |
| Setup, sincronização e consentimentos | Definir regiões sem perder confirmações, recuperação e prioridade de input |
| Teclados, avisos, busca e overlays | Componentes próprios; preservar contexto, foco e retorno, inclusive em sobreposição |
| Arquivos, mídia, lojas e emuladores | Revisar CSS separado, CSS injetado e estilos inline; definir regiões por tela |
| Intro e UI nativa WPF | Adaptadores separados: CSS da home não alcança XAML nem o iframe da intro; preservar apresentação única e recuperação |

O alvo é toda a interface própria do Doorpi. O restante do CSS, incluindo os 42
blocos injetados e templates inline, continua na fila de revisão. Não considerar
esses itens concluídos apenas porque foram inventariados ou separados em arquivos.

## Validação

```powershell
node scripts/Test-FrontendIntegrity.cjs
node scripts/Test-ThemeContract.cjs
node scripts/Test-ThemeSelection.cjs
node scripts/Test-ThemeLayoutNavigation.cjs
node scripts/Test-NavigationRegions.cjs
node scripts/Test-BootIntroLifecycle.cjs
node scripts/Render-ThemePreview.cjs
node scripts/Test-ThemeStudio.cjs
dotnet run --project Doorpi.Themes.Tests -c Release
```

O renderizador usa Chrome headless com perfil exclusivo dentro de `artifacts`, sem
abrir o Doorpi, acessar perfis reais ou alterar o boot. Usa os CSS/runtime reais com
componentes e artes de amostra. Verifica tipos CSS, ordem física das regiões, sidebar,
geometria do foco e cards 2:3. Exercita a entrada real em Configurações → Temas,
direções/Enter/Voltar, seleção e restauração com um host de fixture. Confere a ordem
visual do hub nos dois sentidos e uma lista com 32 temas, incluindo primeiro/último,
cabeçalho fixo e retorno de foco. O hero recebe imagem de amostra para validar o
enquadramento real. Verifica também módulos simultâneos, isolamento CSS, recursos
rejeitados, player na arte e cinema. Produz 48 imagens em 720p, 1080p, 4:3 e 4K
(45 casos, incluindo duas capturas por tela de seleção). O teste do Studio confirma
atualização ao salvar/SSE, recuperação de CSS incompleto, cinco cenas e inspeção sem
CSS, sem ponte nativa. Não equivale a certificar o conteúdo de qualquer pacote.

A prova local da extração pode ser executada com
`node scripts/Test-ThemeContract.cjs --baseline artifacts/theme-foundation-20261109/baseline`.
O baseline é uma evidência histórica da extração, não requisito de um checkout novo
nem a referência do redesenho autorizado da Home. A comparação no renderizador é
optativa por `DOORPI_THEME_BASELINE_CSS`; apontá-la para o CSS antigo detectará as
mudanças visuais intencionais. Os testes comuns continuam verificando os contratos.
As animações são desabilitadas apenas na fixture. Não substitui validação de controle,
WebView2 e fluxos completos no aplicativo.
