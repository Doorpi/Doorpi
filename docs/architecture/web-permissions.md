# Política de permissões web alinhada

## Decisão de produto

O autor confirmou que o bloqueio atual foi intencional para evitar interrupções.
Também aprovou permitir usos específicos de câmera e microfone nos apps cadastrados
e no navegador genérico, mediante pergunta ao utilizar o recurso.

| Contexto | Câmera e microfone | Localização e notificações |
| --- | --- | --- |
| Home, introdução e trailers | Bloqueados | Bloqueadas |
| Streamings integrados ao Doorpi | Bloqueados | Bloqueadas |
| Aplicativos web cadastrados pelo usuário | Perguntar ao usar | Bloqueadas |
| Navegador genérico do Doorpi | Perguntar ao usar | Bloqueadas |
| Popup de um app ou navegador | Seguir o contexto de origem e identificar o site solicitante | Bloqueadas |

Essa política foi implementada após o autor escolher persistência e confirmar
autorizações independentes entre perfis, inclusive em apps compartilhados. Tipos
de permissão além dessas quatro continuam negados; não são automaticamente liberados.

## Situação atual no código

O antigo handler em `MainWindow.Modules.cs` negava todos os tipos, apesar do
comentário sobre aprovação de DRM. Ele foi substituído pelo adaptador específico
`MainWindow.WebPermissions.cs`; permissões não abrangidas pela política nova
continuam negadas. Nenhuma mudança de DRM foi inferida desse comentário.

O handler é conectado na home, recuperação da home, WebView de mídia/navegador e
popup, incluindo as views auxiliares de extensões do navegador. Cada WebView tem um
contexto próprio com perfil Doorpi ativo, app, janela e versão de navegação.
Popups herdam a identidade do contexto que os abriu; o site solicitante é identificado
separadamente. Campos globais do app em primeiro plano não substituem essa identidade.

O catálogo `_nativeApps` também contém o navegador genérico. Portanto, “está na
lista de apps integrados” não equivale a “é streaming”: aplicar essa condição
genericamente bloquearia o navegador contra a decisão aprovada.

## Implementação e invariantes

1. `BrowserPermissionPolicy` distingue home/utilitários, streamings, apps cadastrados
   e navegador. Aparecer no catálogo de mídia não habilita um streaming integrado.
2. `BrowserPermissionDialog` apresenta app, origem e recurso numa janela WPF
   assíncrona. Mouse, teclado, D-pad/analógico e A/B podem decidir. Começa em bloquear
   e aguarda neutralidade do controle para não aceitar o botão que abriu o pedido.
3. `BrowserPermissionStore` grava decisões explícitas em `DataFolder/web-permissions.json`,
   por perfil Doorpi ativo, app, origem e câmera/microfone. Permissões do proprietário
   de um app compartilhado não são herdadas por outro perfil. Origem considera esquema,
   host e porta; caminhos não criam permissões diferentes. HTTPS e HTTP loopback são
   aceitos; origens inválidas e outros esquemas são negados.
4. `SavesInProfile=false` mantém o Doorpi como autoridade. Ao abrir mídia/popups, estados
   Chromium antigos de câmera, microfone, localização e notificações são restaurados
   a Default para não contornar o handler por cache. A home continua sem leitura do
   novo store e sem essa inspeção extra no caminho de boot.
5. `BrowserPermissionService` serializa solicitações e verifica novamente a validade
   do contexto. Navegação/fechamento cancelam pedidos; troca de usuário invalida a
   resposta. Uma decisão salva evita perguntas repetidas, inclusive pedidos duplicados.
6. O adaptador usa deferral e trabalho de persistência fora da thread WPF. Não abre
   loop modal reentrante no callback do browser. Um pedido novo em app ao fundo não
   rouba foco: é negado nessa tentativa sem gravar uma decisão permanente.
7. Durante a confirmação, consumidores de input do host ficam pausados; o botão de
   confirmação precisa ser liberado antes de retornar ao app. Não aceita decisões
   do controle na sessão bloqueada. O retorno de foco respeita a janela de origem.
8. Configurações → Permissões dos apps lista somente decisões do perfil atual.
   Permitir e bloquear são persistidos; cancelar a pergunta não grava decisão.
   Revogar uma concessão fecha as janelas abertas daquele app para interromper uso
   ativo, como o botão informa. Remover um bloqueio permite uma nova pergunta.
9. Escrita usa `DurableFileStore`; arquivo corrompido/schema desconhecido não é apagado
   nem convertido silenciosamente em store vazio. Falhas não concedem acesso.
10. Autorizações são locais; não foi acrescentada sincronização delas entre máquinas.
    Restrições/consentimentos do Windows continuam valendo sobre o acesso real ao dispositivo.

O contrato WebView2 fornece origem solicitante, tipo, estado, persistência e
deferral. Isso permite implementar a política, mas não fornece automaticamente
a experiência de confirmação do Doorpi.
[Referência Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2permissionrequestedeventargs?view=webview2-winrt-1.0.1901.177).

## Validação e limites

Passaram 57 verificações no harness `Doorpi.Browser.Tests`, que usa store/serviço/
política reais sem acessar dispositivos ou dados do usuário. Cobrem identidade,
persistência entre instâncias, revogação, negativas, cancelamento, concorrência,
contexto invalidado e falhas de dados/escrita. O teste JS cobre solicitações, remoção,
textos não interpretados como HTML e respostas atrasadas entre perfis.

XAML da confirmação foi renderizado fora da tela em 600 e 420 DIPs. Isso verifica
composição do layout, não foco/entrada no aplicativo real.

Ainda validar com WebView e dispositivos reais: câmera e microfone juntos, popup,
troca de perfil, permissões Chromium antigas, bloqueio/desbloqueio do Windows,
retomada de foco, revogação durante captura e integração com consentimentos do SO.
Não foram acessados câmera/microfone reais nem alterados perfis/registro da máquina.

```powershell
dotnet run --project Doorpi.Browser.Tests/Doorpi.Browser.Tests.csproj -- artifacts/browser-permission-tests
node scripts/Test-WebPermissionSettings.cjs
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File scripts/Render-WebPermissionPreview.ps1
```
