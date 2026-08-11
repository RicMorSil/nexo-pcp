# Nexo PCP — Sequenciador Inteligente de Produção

Aplicativo web para transformar uma carteira de ordens em um plano de produção comparável e executável. O sistema avalia métodos clássicos de sequenciamento, recomenda o cenário com menor atraso e apresenta o resultado em um gráfico de Gantt.

## Funcionalidades

- cadastro de máquinas com capacidade diária;
- cadastro de ordens, quantidade, duração, prazo e prioridade;
- sequenciamento independente para cada máquina;
- comparação entre FIFO, SPT, EDD e Razão Crítica;
- recomendação automática pelo menor atraso e fluxo médio;
- identificação de ordens em risco;
- gráfico de Gantt por recurso produtivo;
- exportação das ordens em CSV;
- armazenamento dos dados no próprio navegador;
- layout responsivo para computador e celular.

## Métodos implementados

| Método | Regra de decisão | Uso típico |
| --- | --- | --- |
| FIFO | primeira ordem cadastrada, primeira a produzir | operação simples e previsível |
| SPT | menor tempo de processamento primeiro | redução do tempo médio de fluxo |
| EDD | menor prazo de entrega primeiro | proteção das datas prometidas |
| Razão Crítica | menor relação entre prazo restante e duração | priorização dinâmica de urgências |

## 🧰 Tecnologias utilizadas

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/Responsive_Design-02569B?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Responsive Design">
  <img src="https://img.shields.io/badge/Local_Storage-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Local Storage">
</p>

## Execução local

Requisitos: Node.js 22 ou superior.

```bash
npm install
npm run dev
```

Depois, abra o endereço informado pelo terminal.

## Privacidade

Esta versão não exige cadastro. Ordens e máquinas ficam armazenadas somente no navegador do usuário. Os dados iniciais são fictícios e servem apenas para demonstração.

## 🚀 Demonstração online

Acesse o sistema e teste os diferentes modelos de sequenciamento:

<p>
  <a href="https://nexo-pcp.vercel.app/" target="_blank">
    <img src="https://img.shields.io/badge/TESTAR_O_NEXO_PCP-00A86B?style=for-the-badge&logo=vercel&logoColor=white" alt="Testar o Nexo PCP">
  </a>
</p>

> Os dados utilizados na demonstração são fictícios e ficam armazenados localmente no navegador.

## Limites da versão

O planejamento considera uma operação principal por ordem e uma máquina atribuída. Tempos de preparação, calendários de turno, dependências entre operações e manutenção preventiva podem ser incorporados em versões futuras.
