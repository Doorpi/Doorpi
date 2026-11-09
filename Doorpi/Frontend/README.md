# Organização incremental do front-end

Esta migração separa responsabilidades sem redesenhar a interface, alterar comandos,
trocar frameworks ou eliminar regras consideradas antigas. O aplicativo continua
carregando os mesmos arquivos em `wwwroot`, na mesma ordem.

## Fontes CSS e arquivo entregue ao aplicativo

`styles/bundle.json` define a ordem explícita dos módulos que produzem
`wwwroot/style.css`. Edite os módulos, e não esse arquivo de saída. O bundle continua
versionado para que abrir a interface diretamente não dependa de um build prévio.

```powershell
# Recompõe o bundle; não regrava se já estiver idêntico.
powershell.exe -NoProfile -File scripts/Build-FrontendStyles.ps1

# Apenas verifica; retorna erro se o bundle estiver desatualizado.
powershell.exe -NoProfile -File scripts/Build-FrontendStyles.ps1 -Check

# Atualiza o inventário de candidatos a extração/revisão.
powershell.exe -NoProfile -File scripts/Get-FrontendStyleInventory.ps1 -OutputPath Doorpi/Frontend/style-inventory.json
```

Execute esses comandos na raiz do repositório. O projeto também recompõe o bundle
automaticamente antes do build, usando Windows PowerShell, sem Node/npm adicionais.

`style-inventory.json` é um relatório local regenerável e está no `.gitignore`.
Os módulos CSS/JS, mapas e manifestos de bundles são fontes e devem ser versionados.

O gerador concatena bytes: não adiciona cabeçalhos, separadores ou normalização,
não ordena seletores e não minifica. Assim, a cascata, comentários, duplicações,
`!important`, keyframes e media queries são preservados. URLs continuam relativas a
`wwwroot/style.css`; por exemplo, as fontes mantêm `fonts/...`.

Os módulos são **fragmentos para concatenação**, não folhas a carregar individualmente.
A pasta `cascade` mantém ajustes posteriores exatamente em sua posição original.
Os prefixos numéricos ajudam a consultar a sequência; quem determina a ordem é o
manifesto. Nenhum reset foi antecipado e nenhuma regra duplicada foi descartada.

Para adicionar um módulo, inclua-o no manifesto na posição correta. O gerador falha
se encontrar um CSS não listado, um arquivo ausente ou uma entrada duplicada.

`originalStartLine`/`originalEndLine` e `baselineSha256` registram a extração inicial,
não são atualizados a cada edição. O hash corresponde aos bytes do arquivo de trabalho
original; o Git pode armazenar finais de linha diferentes. Eles servem como proveniência,
não como bloqueio a futuras mudanças autorizadas.

## Mapa atual

| Pasta | Conteúdo |
| --- | --- |
| `styles/foundation` | Fontes e escala de exibição |
| `styles/components` | Loading, tokens existentes, hints, cards, teclado e tabs |
| `styles/shell` | Documento, fundo/home, reset existente e visibilidade de sessão |
| `styles/features` | Adição, pastas, carregamento, mídia, abertura, emuladores e home editorial |
| `styles/cascade` | Ajustes transversais posteriores, preservando sua precedência |

Os nomes descrevem os blocos contíguos existentes. Alguns ainda misturam componentes;
separá-los mais exige análise das dependências e da cascata, não reordenação automática.

## Registro de continuidade

- [x] Inventário inicial em `style-inventory.json`, com arquivo, linha e categoria.
- [x] Extrair todo o `style.css` em 22 módulos, sem alterar os bytes do bundle.
- [x] Integrar a montagem ao build e disponibilizar verificação sem escrita.
- [x] Extrair os blocos CSS literais atribuídos a `textContent` de `app.js`.
- [x] Extrair os blocos CSS literais atribuídos a `textContent` de `nav-menu.js`.
- [x] Extrair esses blocos de `renderer.js` e `grid-controller.js`.
- [x] Extrair esses blocos de `controls.js`, preservando as integrações de menus.
- [x] Extrair esses blocos de Bluetooth, Wi-Fi, áudio, mídia e lojas.
- [x] Extrair esses blocos de setup, seleção de foto e sincronização de perfis.
- [x] Extrair o bloco CSS literal do sistema de intro (handoff dinâmico preservado).
- [x] Subdividir o controlador `intro-system.js` em oito fontes, preservando escopo, ordem e bundle.
- [ ] Organizar internamente os pacotes de intro, preservando handoff e isolamento atual.
- [ ] Organizar estilos inline de `index.html` e `file-browser-host.html`.
- [ ] Revisar `file-browser.css`, templates de `file-browser.js` e seus valores dinâmicos.
- [ ] Revisar `TrailerExtension` e os estilos/scripts injetados pelo host C#.
- [ ] Revisar apresentação nativa XAML/C# sem misturar estilos web e nativos.
- [ ] Classificar cada escrita `.style`, `cssText` e CSSOM: apresentação estática ou estado/geometria calculados.
- [x] Primeira separação das fontes dos 19 scripts em 123 partes, por responsabilidade e ordem original.
- [ ] Refinar partes ainda grandes e separar markup/estilos inline, sem alterar escopos ou callbacks.
- [ ] Avaliar encapsulamento e contratos entre módulos (decisão arquitetural, não realizada nesta etapa).
- [ ] Validar visualmente telas e transições no aplicativo, com mouse/teclado/controle e escalas de tela.

O inventário é uma varredura por padrões, não um parser de CSS/JavaScript/C#. Ele aponta
candidatos; não identifica automaticamente todas as interpolações ou construções
dinâmicas. Uma linha pode ter mais de uma categoria. Regerar após cada extração e
revisar também os arquivos completos antes de marcá-los como concluídos.

## Regras para as próximas etapas

1. Inventariar o arquivo e identificar o ponto em que cada estilo passa a existir.
2. Distinguir CSS literal, templates interpolados e valores calculados em runtime.
3. Preservar seletores, valores, especificidade e ordem, incluindo estilos de overlays.
4. Preservar IDs de elementos style que possam ser consultados ou removidos por código.
5. Não antecipar CSS condicional para o head sem demonstrar equivalência da cascata e do ciclo de vida.
6. Manter cálculos de posição/estado em JavaScript quando necessário; extrair sua parte estática.
7. Verificar caminhos de assets, cópia no build/publicação, tela inicial, retorno e reabertura.
8. Registrar exatamente o que foi concluído e o que ainda depende de revisão.

Na primeira etapa, nenhuma extração de CSS do JavaScript foi realizada: isso exige
preservar também o momento de injeção. A organização das fontes CSS está concluída
somente para o bundle principal; a reorganização completa do front-end continua pendente.

Na segunda etapa, os 39 blocos literais de CSS do JavaScript foram separados em
`injected-styles/<funcionalidade>/*.css`. Declarações `style="..."` em templates,
`cssText`, propriedades `.style` e CSS fornecido dinamicamente continuam pendentes
de classificação/extração. As caixas marcadas acima se referem aos blocos literais
de `textContent`, não à totalidade dos estilos de cada funcionalidade.

## Fontes JavaScript e CSS injetado

O usuário escolheu manter bundles gerados e preservar o runtime. Não foi adotado
carregamento por módulos ES, nem introduzido framework, npm ou API global nova.

`scripts/bundles.json` lista a ordem das fontes para cada arquivo JavaScript de
`wwwroot`. O [mapa dos módulos](module-map.md) permite localizar cada responsabilidade.
Os arquivos de saída continuam versionados e carregados pelos mesmos HTMLs.

Edite `Frontend/scripts/<funcionalidade>/*.js`, e não os bundles em `wwwroot`.
Cada bundle concatena seus fragmentos **sem separadores ou wrappers adicionais**.
Alguns compartilham o mesmo escopo global ou IIFE existente: eles são módulos de
fonte ordenados, não componentes autônomos ou módulos ES. Não os carregue como
scripts separados. Essa primeira separação física não elimina o acoplamento existente.

Exemplos de responsabilidades separadas:

- `app`: estado, tutorial, filas da biblioteca, áudio/foco, sessões, conflitos,
  recuperação de foco, notificações, atualizações, bridge, perfis, painel rápido,
  seleção de apps, artwork, contexto, edição, teclado e transições.
- `nav-menu`: biblioteca/filtros, lazy grid, configurações por área, perfis,
  histórico, compartilhamento, extensões, foco/scroll, abertura/fechamento e input.
- `controls`: traduções, definições, modelos, ícones, bindings, criação do overlay,
  ciclo de vida, mensagens, renderização, captura, diálogos, foco e integrações.
- `renderer`: apresentação do destaque, interação dos cards, ciclo de artwork,
  renderização e transições de abas.
- `navigation`: alvos, candidatos espaciais, transições entre grupos, foco, scroll,
  teclado, estado de controle, quarentena, ação de voltar, snapshots nativos e loop de despacho.
- `setup`: markup, formulário, escala, accordion, fundo, autenticação/sincronização,
  abertura/fechamento, validação, eventos e seleção de pastas/foto.
- Funcionalidades menores mantêm inicialmente seu módulo existente, agora como fonte.

`__doorpiCss("injected-styles/.../arquivo.css")` é uma **macro de build**. O gerador
reinsere o conteúdo no literal original, nos mesmos pontos em que o código já
atribuía `textContent`. A macro não existe e não é chamada em runtime. O CSS é
editado em arquivos próprios; os bundles gerados ainda contêm o texto CSS necessário
para a injeção original. Assim, não há fetch assíncrono, novas tags link ou estilos
antecipados no head que possam mudar a cascata ou introduzir um flash visual.

Esses CSSs são corpos de literais estáticos: interpolações, backticks e barras
invertidas exigem revisão explícita de escaping, e são rejeitados pelo gerador.
IDs de style, inserção/remoção, condicionais e guardas de inicialização permanecem
nos scripts. Os fragmentos CSS não devem ser importados pelo bundle `style.css`.

```powershell
powershell.exe -NoProfile -File scripts/Build-FrontendScripts.ps1
powershell.exe -NoProfile -File scripts/Build-FrontendScripts.ps1 -Check
node scripts/Test-FrontendIntegrity.cjs

# Apenas para verificar a preservação do runtime durante esta migração:
node scripts/Test-FrontendIntegrity.cjs --baseline
```

Node é usado somente na verificação independente, não no build do aplicativo.
O build normal executa ambos os geradores PowerShell. O gerador de scripts valida
todas as fontes antes de escrever: caminhos, presença, duplicações, manifesto,
referências CSS, macros e arquivos esquecidos. Não usa concatenação por ordem
alfabética. Novas fontes devem ser declaradas no manifesto.

`baselineSha256` de cada script registra o conteúdo inicial com CRLF normalizado
para LF. O modo `--baseline` é uma prova desta reorganização, não deve ser usado
como impedimento a futuras mudanças funcionais autorizadas. A verificação normal
continua conferindo a geração e a sintaxe.

O inventário agora inclui fontes e saídas. O campo `role` distingue `authored-source`,
`runtime-generated` e `not-yet-migrated`: não some fontes e bundles como se fossem
problemas diferentes. As linhas da saída foram preservadas, e as linhas das novas
fontes indicam os locais onde editar.

## Validação da segunda etapa

- 19 bundles recompostos a partir de 123 arquivos-fonte e 39 fragmentos CSS.
- Conteúdo de todos os bundles idêntico ao anterior à separação, incluindo os
  pontos originais de injeção CSS, funções repetidas e escopos compartilhados.
- Comparação independente com SHA-256 de baseline normalizado e análise sintática
  dos 19 bundles por `vm.Script` passaram.
- Os 27 arquivos CSS/JS/HTML versionados em `wwwroot` e `TrailerExtension` continuam
  com o conteúdo original.
- Gerador verificado em diretório isolado: geração exata, divergência e reparo,
  duplicação, CSS não declarado, interpolação não autorizada, caminhos inválidos,
  fonte ausente e fonte não listada.
- Build completo serial (`--no-restore -m:1`) passou com zero erros e zero avisos.
  Nesta sessão foi necessário direcionar `DOTNET_CLI_HOME` para
  `artifacts/dotnet-cli-home`, pois o SDK tentou gravar um sentinel fora da área
  permitida. Isso foi aplicado somente ao comando, sem mudar configurações do projeto.
- Após refinar as partes de navegação, setup e painel rápido, a verificação
  independente de baseline e `Build-FrontendScripts.ps1 -Check` passaram novamente.
- Não houve validação visual interativa. Nenhum asset de runtime foi alterado.

## Decisões preservadas para revisão futura

- Não remover as duas declarações de `setupIntroCompleteHook`, atribuições globais
  repetidas, renderizações legadas ou caminhos antigos de storage/sharing/perfis.
  A ordem pode decidir qual implementação é usada; retirar código exige revisar
  comportamento e discutir a decisão com o usuário.
- Não isolar trechos em novas closures, alterar o proprietário do estado, unificar
  listeners, trocar assincronismo ou migrar para módulos ES nesta organização.
- Próxima extração: estilos inline em templates e `cssText`, distinguindo declarações
  fixas de estado e geometria. Depois, revisar markup e responsabilidades ainda grandes.
- CSS recebido dinamicamente pelo handoff da intro permanece na integração existente.
  Alterar seu contrato ou isolamento é uma decisão funcional separada.

## Evolução posterior: inicialização imersiva

Após a organização inicial, o controlador do sistema de intro recebeu
uma mudança funcional autorizada: aguardar a liberação da ante-sala nativa antes de
iniciar o iframe e liberar corretamente os destinos quando a intro é desativada ou
omitida em recuperação. A macro CSS e as fontes continuam seguindo o mesmo build.

Por isso, `Test-FrontendIntegrity.cjs --baseline` deixa de ser a validação do estado
atual: o hash inicial da intro registra a organização original. Use a verificação
normal e `Test-BootIntroLifecycle.cjs` para as mudanças de boot. Os pacotes de intro
(assets, animações, áudio e manifestos) foram preservados. Veja `../Boot/README.md`.

## Refinamento da introdução e inventário arquitetural

O controlador da intro agora tem oito fragmentos: estado/configuração,
apresentação/conclusão, assets/ambiente de handoff, prontidão/input,
ciclo de vida do ambiente, mensagens, startup e API pública/bootstrap.
Continuam dentro da mesma IIFE, na mesma ordem e sem wrappers novos. A soma atual
é de **130 fontes JavaScript**, mantendo 19 bundles e 39 blocos CSS extraídos.

A divisão preservou exatamente os bytes do controlador anterior. Nenhum dos
27 arquivos CSS/JS/HTML de runtime inventariados foi alterado nesta rodada.
Os metadados `extractedFrom`, `sourceStartLine` e `sourceEndLine` das novas partes
apontam para o fragmento anterior à subdivisão, já com as mudanças de boot;
não representam linhas da baseline inicial de `wwwroot`.

O [mapa arquitetural](../../docs/architecture/current-architecture.md) relaciona
frontend, host, serviços existentes e helpers. O inventário automatizado distingue
fontes e saídas e mantém os pontos ainda não revisados explícitos.

## Permissões web — mudança funcional aprovada

Foi adicionada a fonte `nav-menu/185-web-permissions.js` com CSS próprio e uma tela
de configurações para remover decisões de câmera/microfone do perfil ativo. Também
foram adicionadas traduções PT/EN. A implementação nativa e a política aprovada estão
em [web-permissions.md](../../docs/architecture/web-permissions.md).

O total passa a 131 fragmentos JS e 40 blocos CSS injetados, ainda com 19 bundles.
Nesta mudança funcional, somente `wwwroot/nav-menu.js` e `wwwroot/strings.js`
mudaram entre os 27 arquivos de runtime acompanhados. Não se aplica a afirmação de
igualdade de todos os bundles desta nova etapa; a extração anterior permanece
registrada separadamente. Validar com `Test-FrontendIntegrity.cjs`,
`Test-WebPermissionSettings.cjs` e o harness C# de permissões.

## Validação da primeira etapa

- Bundle recomposto idêntico aos 170.827 bytes do CSS de trabalho inicial.
- Conteúdo dos 27 arquivos CSS/JS/HTML já versionados em `wwwroot` e
  `TrailerExtension` preservado (considerando a conversão de finais de linha do Git).
- Gerador verificado em cópia isolada: geração, verificação, detecção e reparo de
  divergência, rejeição de módulo duplicado e de CSS não listado.
- `dotnet msbuild Doorpi/Doorpi.csproj -t:BuildFrontendStyles` passou.
- `dotnet build Doorpi/Doorpi.csproj --no-restore -m:1` passou sem erros ou avisos.
  A tentativa com paralelismo padrão falhou na resolução de referências sem
  diagnóstico de erro; a execução serial concluiu o build completo.
- Não foi feita validação visual interativa. A evidência de preservação nesta etapa
  é a igualdade do conteúdo entregue em runtime, incluindo ordem e caminhos de assets.
