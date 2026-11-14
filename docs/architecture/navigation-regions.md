# Navegação por regiões: contrato inicial

Regra de produto aprovada: ao entrar na home de um perfil, o foco começa no
carrossel, que é sempre a região de navegação **0**, independentemente do tema.
Ao voltar de menu, jogo ou aplicativo, recuperar o card selecionado anteriormente.

## Identidade, posição e foco são coisas distintas

O ID de navegação identifica uma responsabilidade, não uma coordenada nem uma
posição no DOM. A região 0 continua sendo o carrossel se o tema o colocar acima,
abaixo ou ao lado de outra região. As setas acompanham a posição visual; o índice
0 não significa que a tecla Cima deva mover o foco para um elemento abaixo dele.

O tema posiciona regiões e estiliza componentes. Ele não define a âncora de entrada,
não renumera regiões e não altera comandos A/B, confirmação, lançamento ou retorno.

| ID da home | Região | Papel |
| --- | --- | --- |
| 0 | `carousel` | Entrada e retorno à home; corresponde à região visual `library` |
| 1 | `tabs` | Jogos, mídia e lojas; corresponde à região visual `toolbar` |
| 2 | `system` | Ações de perfil/notificações no cabeçalho |

Esses IDs são locais à tela. As próximas telas devem declarar sua própria região
principal 0, regiões auxiliares, subcontextos e política de retorno. Não atribuir
automaticamente o mesmo significado a todos os números sem revisar a funcionalidade.

## Regras implementadas na home

1. Entrada chama `DoorpiNavigation.enter('home')`, que resolve a região 0 da aba ativa.
2. Retorno procura o card lembrado para o perfil/aba atual.
3. Se o card saiu da biblioteca, usa um card destacado disponível, outro card real
   ou o botão de adicionar quando a biblioteca estiver vazia. Skeletons e itens
   desabilitados/sem dimensões não são alvos de entrada.
4. A memória é volátil e separada por perfil e aba, com limite de 48 contextos.
   Nenhuma preferência ou estado persistente foi criado fora do SQLite.
   Eventos de foco durante a troca de perfil não substituem essa memória.
5. Modal, setup, menu de contexto, teclado, menu principal, loading global e seletor
   de perfis têm prioridade; a âncora 0 não deve roubar o foco desses contextos.
6. Layouts reorganizados usam geometria na travessia de regiões. Os percursos
   originais da home padrão foram preservados; o menu permanece acessível.
7. A interface de compatibilidade `window.focusFeaturedCard()` delega ao contrato.
   As chamadas existentes do host C# e dos componentes continuam funcionando.

O `GridController` também atribuía `focusFeaturedCard` durante a inicialização,
substituindo silenciosamente a função da navegação. Ele agora mantém a política
registrada e conserva apenas um fallback para uso sem o bundle de navegação.

As transições de entrada e recuperação de foco da home consultam a mesma política.
Os diagnósticos `home-interactive-ready` incluem a região ativa quando disponível.
O seletor de perfis e o setup são contextos anteriores à home e não recebem região
0 da home antes de suas confirmações.

## Interface do núcleo

```javascript
DoorpiNavigation.getScreen('home'); // contrato congelado, entryRegion = 0
DoorpiNavigation.enter('home');
DoorpiNavigation.focusRegion('home', 0);
DoorpiNavigation.getRegionId(); // região do elemento ativo, ou null
```

O foco usa o DOM existente e respeita sua disponibilidade. Não depende de recriar
cards nem da ordem de carregamento de pacotes de tema. Não há persistência nova
ou operação assíncrona de perfil nesta política de foco.

## Aplicação nas próximas telas

Cada migração deve registrar antes de alterar a navegação:

- contexto de entrada e região principal;
- regiões auxiliares e componentes que capturam direções internamente;
- movimentos dentro de uma região e travessia entre regiões;
- alvo lembrado por identidade estável e fallback após remoção;
- retorno de overlays, subpáginas e sessões externas;
- prioridade de consentimentos, edição, teclado e recuperação;
- posições fixas presumidas no JS e geometria obtida do CSS.

O menu principal ainda tem percursos especializados, incluindo bibliotecas virtuais,
filtros, dispositivos e atualizações. O contrato da home não substitui esses fluxos
automaticamente. A revisão desses percursos é a próxima aplicação do modelo.
Não foi criada uma regra global de B que feche qualquer contexto e force a home.

## Evidências e limites

`scripts/Test-NavigationRegions.cjs` executa o módulo real: entrada na região 0,
restauração de card, isolamento por perfil/aba, remoção, loading/itens ocultos,
prioridade de overlays e preservação do proprietário da política na inicialização
do GridController. `Test-ThemeLayoutNavigation.cjs` usa as funções reais para
travessia com carrossel acima e barra lateral à direita.

`Render-ThemePreview.cjs` também verifica foco e restauração da região 0 em DOM
real no navegador, nas resoluções de preview. Isso não substitui validação do
controle físico, mudança real de perfil, retorno de jogos e transições WebView2.
