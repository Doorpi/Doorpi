# Arquitetura e continuidade do Doorpi

## Propósito alinhado com o autor

Transformar um PC da sala em uma central de jogos e multimídia, com a experiência
inteiramente operável por controle. Mouse e teclado são opcionais. Abrir mídia,
jogar, alternar aplicativos, gerenciar o ambiente e recuperar falhas fazem parte
do produto. Conforto, previsibilidade e continuidade da sessão são critérios de
qualidade, além da aparência.

O Doorpi é uma alternativa própria a experiências como Big Picture e Xbox mode.
A integração com Xbox mode/FSE foi retirada das prioridades após esse alinhamento.
O estudo anterior permanece como pesquisa, não como plano de implementação.

## Decisões vigentes

- Preservar funcionalidades, lógica visual, dados e ordem de execução durante
  extrações. Discutir mudanças de comportamento separadamente.
- Manter WPF e WebView2 enquanto organização e medições orientam a arquitetura.
- Manter bundles gerados; as fontes de JS/CSS são editadas em `Doorpi/Frontend`.
- Desenvolver fronteiras de sessão, entrada/foco, aplicativos, integrações Windows
  e apresentação. Um módulo não implica um processo ou serviço.
- Preservar Explorer e bootstrap até comparação controlada. Supervisão e workaround
  gráfico têm justificativas diferentes e serão avaliados separadamente.
- Temas da comunidade inicialmente alteram aparência; extensões funcionais não
  são requisito desta etapa.
- Preservar a introdução existente como apresentação principal.
- Perguntar ao autor quando a intenção de um recurso ou workaround afetar uma
  decisão. A falta de memória histórica não equivale a autorização para removê-lo.

## Documentos

- [Mapa atual e fronteiras propostas](current-architecture.md): responsabilidades,
  dependências, comunicação, riscos de extração e cobertura ainda pendente.
- Inventário local gerado (`current-inventory.json`): arquivos visíveis, hashes, bundles,
  candidatos literais de mensagens, imports nativos e dependências diretas.
- [Registro incremental](organization-progress.md): o que mudou, evidências de
  preservação e próximos trabalhos.
- [Política de permissões implementada](web-permissions.md): contexto por perfil/app/site,
  confirmação, persistência, revogação e limites da validação.
- [Pesquisa de boot](immersive-boot-review-2026-11-07.md): documentação Microsoft,
  relatos, comparação de binários e hipóteses. Não identifica definitivamente a
  causa histórica do travamento.
- [Comparação do bootstrap](bootstrap-comparison.md): renderização, proteção
  temporária de foco, rota direta experimental e procedimento para o PC lento.
- [Fontes do frontend](../../Doorpi/Frontend/README.md) e
  [mapa dos fragmentos JS](../../Doorpi/Frontend/module-map.md).

## Atualização do inventário

```powershell
node scripts/Get-ArchitectureInventory.cjs
node scripts/Get-ArchitectureInventory.cjs --output docs/architecture/current-inventory.json
```

Sem `--output`, o script apenas apresenta contagens. Ele usa `rg` e não executa o
aplicativo nem consulta registro, processos ou dados pessoais. Arquivos ignorados
pelo Git, bin/obj, dados de usuário e credenciais ficam fora do escopo. Recursos
binários têm índice de caminho/tamanho e contagem por extensão; código e
configurações têm índice e hash.

`current-inventory.json` é regenerável e está no `.gitignore`; o script e esta
documentação permanecem versionados.

Os candidatos de mensagens são encontrados por padrões, não por análise semântica.
Comentários, exemplos e switches sem relação com a bridge podem aparecer. Nomes
calculados dinamicamente podem não aparecer. O inventário auxilia a revisão manual;
não certifica um contrato completo nem comportamento testado.
