# Robô Zelador da Mensa Brasil

O Robô Zelador da Mensa Brasil é um script em JavaScript que automatiza a manutenção e gerenciamento de grupos do WhatsApp associados à Mensa Brasil. Ele verifica a atividade dos membros, remove membros inativos e envia mensagens para números que não foram encontrados na planilha de membros.

## Funcionalidades

1. **Verificação de Atividade dos Membros**: O robô verifica a atividade dos membros do grupo e remove aqueles que não estão ativos ou transferidos para outro grupo.

2. **Notificação de Membros Inativos**: Quando um membro é identificado como inativo, o robô envia uma mensagem personalizada para notificar o membro e, em seguida, remove-o do grupo.

3. **Notificação de Números Não Encontrados**: Quando um número de telefone não é encontrado na planilha associada, o robô envia uma mensagem específica para notificar o membro e, em seguida, remove-o do grupo.

4. **Autenticação de Google Sheets**: O robô utiliza as credenciais do Google Sheets para acessar a planilha de membros e verificar as informações.

5. **Conexão com Banco de Dados MongoDB**: O robô mantém um registro de mensagens enviadas e membros removidos usando um banco de dados MongoDB.

## Pré-requisitos

Antes de executar o robô, você precisará das seguintes configurações:

1. Renomeie o arquivo `.env.staging` para `.env` e configure as variáveis de ambiente necessárias, como `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_HOST`, `GROUP_NAMES` e outras conforme necessário.

2. A planilha associada às informações dos membros deve estar acessível no seguinte link: [Planilha de Membros](https://docs.google.com/spreadsheets/d/1Xw3IRGh2liEfUuH6nYB3n2ylwx-N1GAvlk7id9i_HPA/edit?usp=sharing).

## Desenvolvedores

- Thiago Santos, MB 2622
- Maycon Freitas, MB 1897
- Cadu Fonseca, MB 133

## Executando o Robô

1. Instale as dependências do projeto executando `npm install` ou `yarn install`.

2. Inicie o robô executando `node nome-do-arquivo.js`, onde `nome-do-arquivo.js` é o nome do arquivo do script (o código fornecido).

3. O robô irá se conectar ao WhatsApp e começar a realizar as tarefas de zeladoria nos grupos especificados.

## Personalização

O código do robô pode ser personalizado para atender a requisitos específicos. Consulte os comentários no código para entender como cada parte do script funciona e como adaptá-lo conforme necessário.
