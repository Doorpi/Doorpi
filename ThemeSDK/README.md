# Doorpi Theme SDK — contrato visual 1

O SDK separa **autoria**, **prévia** e **distribuição**. O desenvolvedor trabalha em
uma pasta local com seu editor; o Studio acompanha os arquivos; o usuário recebe
um único `.doorpitheme` e o adiciona em **Configurações → Temas → Adicionar pacote**.
O arquivo é um ZIP de recursos visuais, não uma extensão executável.

Esta é uma implementação local inicial. A loja, publicação, assinaturas de autores,
moderação e atualizações automáticas de temas ainda não estão implementadas.

O [Orbit 2](ORBIT.md) é o tema oficial alternativo e showcase: cinco componentes
editáveis, galeria à direita, informações e trailer à esquerda, biblioteca,
painéis, popups e login próprios. Para estudá-lo, execute
`node scripts/theme-sdk.cjs dev ThemeSDK/examples/orbit-modular`. Exporte para uma
pasta de artefatos, nunca por cima das fontes do exemplo.

## Criar, testar e exportar

Use Node.js 22 ou superior no terminal, a partir da raiz deste repositório:

```powershell
node scripts/theme-sdk.cjs create artifacts/meu-tema --base default
node scripts/theme-sdk.cjs dev artifacts/meu-tema
```

Abra a URL `http://127.0.0.1:<porta>` impressa no terminal. Edite os arquivos da
pasta em VS Code ou outro editor e salve: a prévia atualiza sem reiniciar o Studio.
Erros de CSS são mostrados mantendo a última prévia válida. `Ctrl+C` encerra o servidor.
O Studio abre no navegador externo e usa cenas de referência. Ainda não existe um
botão de visualização dentro do Doorpi nem atualização da sessão real ao salvar
a pasta local. No aplicativo, teste exportando e importando uma nova versão do pacote.
Os payloads de pacotes são compartilhados durante o carregamento de suas áreas e
liberados ao terminar, em vez de manter indefinidamente em memória todo tema testado.

`--base default` cria exemplos mínimos que herdam o visual do Doorpi. `--base empty`
cria os mesmos componentes com CSS vazio, para começar seus arquivos do zero.
O seletor **Sem CSS do Doorpi (inspeção)** retira as folhas de referência da prévia,
mostrando a estrutura. É uma ferramenta de inspeção: **não remove os estados e
estilos funcionais do aplicativo instalado**. Confira e finalize o tema em
**Doorpi padrão + seu CSS**; não há um reset global `all: unset` no runtime.

Antes de distribuir:

```powershell
node scripts/theme-sdk.cjs check artifacts/meu-tema
node scripts/theme-sdk.cjs pack artifacts/meu-tema --output artifacts/meu-tema-1.0.0.doorpitheme
```

`check` verifica estrutura, manifesto, arquivos, caminhos e limites. A validação
efetiva de CSS usa o parser do navegador no Studio e no Doorpi ao aplicar a área.
`pack` não certifica aparência, acessibilidade ou desempenho. O arquivo de saída
deve ficar fora da pasta de autoria e não pode existir, para evitar sobrescrita.
O comando informa tamanho e SHA-256 do arquivo realmente gerado. Isso identifica
seus bytes; não é uma assinatura ou uma publicação na loja.

Para testar no aplicativo, use a build que contém este SDK. Adicione o pacote,
escolha uma área e aplique seu nome na lista. Importar disponibiliza o pacote;
**não substitui automaticamente as seleções de todas as áreas**. O padrão está
sempre listado: selecioná-lo na lista reverte só a área selecionada. O botão
**Restaurar padrão** reverte todas as áreas do perfil atual e a tela de perfis do
dispositivo em uma única transação. Preserva os outros perfis, as configurações
não relacionadas a temas e os pacotes instalados. **Adicionar pacote** abre o
explorador de arquivos do próprio Doorpi, filtrando arquivos `.doorpitheme`.

## Pasta de autoria e pacote

```text
meu-tema/
  theme.json
  parts/
    home.css
    home.json
    nav-menu.css
    side-panels.css
    popups.css
    login.css
  assets/
    fundo.webp
    minha-fonte.woff2
```

Esta pasta contém apenas arquivos distribuíveis. Mantenha referências de design,
documentação, ferramentas de build e arquivos de trabalho fora dela. Não inclua
dados de usuário, cache, dependências, HTML ou JavaScript. Pode remover áreas do
manifesto quando o pacote só oferecer parte da interface.
Arquivos/pastas ocultos e temporários comuns de editor (`.swp`, `.tmp`, `.bak`,
nomes terminados em `~`) são ignorados e não vão para o pacote.

Exemplo de manifesto com duas áreas:

```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "id": "meu-tema",
  "name": "Meu tema",
  "version": "1.0.0",
  "author": "Seu nome",
  "parts": {
    "home": { "css": "parts/home.css", "appearance": "parts/home.json" },
    "nav-menu": { "css": "parts/nav-menu.css" }
  }
}
```

`appearance` é opcional e pertence somente à Home. Usa o contrato já existente de
tokens/layouts; ver [guia de regiões](../Doorpi/Frontend/themes/README.md). Os outros
componentes usam CSS escopado. Versões usam três números, como `1.2.0`.
Os bytes do ZIP definem a identidade instalada (`pkg-<hash>`); importar o mesmo
arquivo é idempotente. Versões anteriores e o arquivo original não são apagados.
Instalação interrompida deixa somente uma pasta de staging ignorada pelo catálogo.

## Áreas e propriedade da escolha

| Área | Raízes v1 | Preferência |
| --- | --- | --- |
| `home` | `#doorpi-app-ui` | Perfil |
| `nav-menu` | `#navMenuOverlay` | Perfil |
| `side-panels` | `#addGameContainer`, `#doorpiQuickPanel` | Perfil |
| `popups` | `.edit-modal-overlay`, `.context-menu`, `#doorpiUpdatePrompt` | Perfil |
| `login` | `#doorpiUserPicker`, `#doorpiUserPinPrompt` | Dispositivo |

Um perfil pode combinar Home de A, menu de B e popups de C. O login é geral porque
a tela aparece antes da escolha de usuário. Preferências internas usam SQLite via
`Doorpi.Storage`; JSON nesta pasta é contrato externo de pacote.
Na seleção por área, tokens e aliases da Home são aplicados à própria Home,
preservando os padrões do documento. A API global antiga permanece para compatibilidade.

A cobertura é explícita: esta versão não abrange todas as telas auxiliares, o setup,
conteúdo de sites/jogos, o iframe da intro ou a UI nativa WPF. Inclusões futuras
precisam de raízes, estados e contratos próprios. Não assuma que classes internas
de qualquer tela são automaticamente uma API de tema estável.

## CSS por componente

O arquivo é relativo à sua área. Use `:scope` para a raiz e seletores planos para
seus descendentes; o compilador aplica o limite da área usando `@scope`:

```css
/* nav-menu.css */
:scope {
    background: #111a30;
    font-family: 'Segoe UI', sans-serif;
}
.nav-settings-home-item {
    border-radius: 18px;
    background: rgba(110, 160, 255, .08);
}
.nav-settings-home-item.nav-focused-el {
    border-color: #b2dcff;
}
```

Tokens públicos `--doorpi-*` estão disponíveis à Home. Demais áreas podem usar suas
próprias variáveis locais (por exemplo `--meu-acento`), sem sobrescrever variáveis
privadas do runtime. Para alterar tokens globais e seus aliases, use `tokens` de
`home.json`; em CSS, variáveis na raiz local seguem a herança normal de CSS e não
alteram propriedades já resolvidas em ancestrais como `body`. Regras legadas ainda usam `!important` em algumas superfícies,
como o fundo do editor; quando necessário, a substituição visual explícita também
pode usar `!important`. Essa dívida de cascata continua na modularização gradual.

Recursos pertencem a `assets/`, sempre relativos à raiz do pacote:

```css
@font-face {
    font-family: MinhaFonte;
    src: url(assets/minha-fonte.woff2) format('woff2');
}
:scope { font-family: MinhaFonte, sans-serif; }
.painel { background-image: url(assets/fundo.webp); }
@keyframes brilho { from { opacity: .8; } to { opacity: 1; } }
.detalhe { animation: brilho 2s ease alternate infinite; }
```

Fontes/animações recebem nomes próprios por pacote/área para evitar colisões.
Aceitos: regras planas, `@media`, `@supports`, `@font-face`, `@keyframes` e imagens
PNG/JPEG/WebP/AVIF e fontes WOFF/WOFF2. Não aceitos nesta API: imports, namespaces,
nesting CSS, escapes CSS, URLs externas/data fornecidas pelo autor, SVG, HTML ou JS.
Os recursos validados são materializados pelo runtime a partir do próprio pacote.

Limites: 128 arquivos, 20 MiB descompactados, 4 MiB por recurso e 128 KiB por CSS
ou arquivo de aparência/manifesto. O importador também limita o ZIP a 24 MiB e rejeita nomes
duplicados no Windows, links, caminhos absolutos e travessia `../`.
Nomes de dispositivo reservados e segmentos terminados em ponto também são rejeitados,
evitando aliases de caminho do Windows.

## Layout, trailer e integridade

Para o trailer acompanhar a arte da Home, use em `parts/home.json`:

```json
{
  "schemaVersion": 1,
  "apiVersion": 1,
  "id": "meu-tema",
  "name": "Meu tema",
  "tokens": {},
  "layout": { "feature": "art-right", "trailer": "feature-art" }
}
```

O núcleo mede a região da arte e apresenta o **mesmo** player ali. Não reinsere
iframes ao mudar o tema. Tela cheia usa a apresentação de cinema existente.
Não anime continuamente a posição/transform da região da arte nesta API: a medição
acompanha resize/layout e aplicação, não faz polling por frame de efeitos do autor.

O carrossel continua como região 0, com restauração do card. Cards têm proteção de
proporção vertical 2:3 no runtime de pacotes. Temas não fornecem HTML, handlers,
ordem semântica, serviços, operações de perfil ou funções do Windows.

Carregamento inicial é limitado: login tem uma janela de 5 segundos; depois da
leitura do perfil, cada área tem até 3 segundos, dentro de um orçamento de 6 segundos
para o conjunto. Uma área lenta recua ao padrão nesta sessão e mantém a escolha
salva para recuperação posterior. A seleção oferece **Tentar novamente**. Esses
limites não acrescentam uma espera fixa quando o pacote carrega normalmente.

CSS escopado não prova boa usabilidade: um layout pode ocultar ou sobrepor controles.
Alguns percursos legados fora da Home continuam especializados; não prometa liberdade
total de reordenação nessas telas sem testar o fluxo. Valide teclado/controle, foco,
scroll, texto longo, ausência de capas, erros, trailer e resoluções diferentes.
O Studio usa fixtures, não uma sessão completa WebView2/controle físico.

Na depuração, `Ctrl+Shift+F12`, com o Doorpi em foco, solicita o padrão em todas as
áreas, incluindo login do dispositivo. Não substitui teste de recuperação no app.
CSS também pode consumir recursos: prefira transform/opacity, respeite redução de
movimento e evite filtros grandes e animações constantes em muitos elementos.
Esta API não certifica FPS nem garante custo zero de um tema de terceiros.

JavaScript visual ficou para uma etapa própria, conforme a decisão de produto:
execução opcional fora da thread da interface, API limitada e interrupção por custo.
Não existe campo `script` nesta versão e o pacote não pode incluir `.js`.

## Referências de arquitetura

- [Segurança de conteúdo no WebView2 — Microsoft](https://learn.microsoft.com/microsoft-edge/webview2/concepts/security): fundamenta manter conteúdo de autores separado da ponte nativa.
- [Sandbox de iframe — MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox): o Studio usa `allow-scripts` para seu código confiável, sem `allow-same-origin` e sem uma ponte para o host.
- [Escopo CSS — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@scope): limita onde as regras de cada componente se aplicam; não representa uma garantia de usabilidade ou desempenho.
- [Nomes e caminhos de arquivo — Microsoft](https://learn.microsoft.com/windows/win32/fileio/naming-a-file): nomes reservados, diferenças de caixa e normalização de caminhos no Windows.
