# Tarkov Tracker

Aplicacao web local para acompanhar itens necessarios no Escape from Tarkov, com foco em quests, hideout, Kappa/Collector e itens Find in Raid.

## O que o projeto faz

O tracker agrupa os itens reais do jogo por ID, soma a quantidade total necessaria e mostra onde cada item e usado. O progresso fica salvo apenas no navegador com `localStorage`.

## Funcionalidades

- Lista de itens necessarios para quests
- Lista de itens necessarios para hideout
- Identificacao de itens exigidos para Kappa
- Identificacao de itens Find in Raid
- Agrupamento automatico de itens repetidos
- Contador com botoes de `+` e `-`
- `Shift + clique` para completar ou zerar rapidamente
- Filtros combinaveis com `Ctrl + clique`
- Busca por item, quest, trader ou estacao
- Barra de progresso geral
- Resumo de totais no topo
- Pop-up com detalhes de uso, trader, hideout e requisitos
- Aba de quests com busca, filtros, trader, Kappa e itens exigidos
- Marcacao de quest completa com aplicacao automatica dos itens entregues
- Exportacao e importacao de progresso em JSON
- Atualizacao da base via API GraphQL publica do tarkov.dev
- Fallback offline com `items.generated.js`

## Como usar

Abra o arquivo `index.html` no navegador ou acesse a versao publicada via GitHub Pages.

O app nao precisa de login, backend, banco de dados ou autenticacao.

## Atualizacao da base

O botao **Atualizar base Tarkov** consulta a API publica do tarkov.dev e recria a lista de itens. O progresso ja salvo nao e perdido, porque ele fica ligado ao ID do item.

Se a API estiver indisponivel, o app usa:

1. A ultima base salva no navegador
2. O fallback local `items.generated.js`

## Estrutura

- `index.html`: estrutura da pagina
- `style.css`: visual e responsividade
- `script.js`: interface, progresso, filtros e modal
- `items.js`: ponte para a base local
- `items.generated.js`: fallback offline gerado
- `tarkovApi.js`: query GraphQL do tarkov.dev
- `dataMapper.js`: transformacao dos dados da API em lista agrupada

## Privacidade

Todo o progresso fica somente no `localStorage` do navegador. O projeto nao cria conta de usuario, nao sincroniza dados online e nao usa banco de dados.

O progresso e salvo separando coleta manual de progresso vindo de quests completas:

```js
{
  manualProgress: {
    [itemId]: number
  },
  questProgress: {
    [questId]: {
      completed: true,
      appliedItems: {
        [itemId]: quantity
      }
    }
  }
}
```

## Fonte dos dados

Os dados sao obtidos da API publica GraphQL do tarkov.dev:

https://tarkov.dev/api/
