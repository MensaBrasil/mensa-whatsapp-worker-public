function getInactiveMessage(phone) {
    return `Olá, mensan! 👋
  
Aqui quem fala é o Zelador, da Mensa Brasil! 🤖

Identifiquei que seu cadastro de associado da Mensa Brasil encontra-se inativo para o telefone ${phoneNumber}.

Diante disso, te removi automaticamente dos grupos oficiais de WhatsApp da Mensa Brasil.

Este não é um "adeus", apenas um "até logo". A boa notícia é que você pode voltar quando quiser, basta renovar sua anuidade com a Mensa Brasil.

Para voltar a fazer parte de nossa associação e nossos grupos oficiais de WhatsApp, renove sua anuidade, por meio do nosso website oficial: https://mensa.org.br/anuidades/ 🖥️👈

Bora se reunir de novo com a gente? Temos muitos papos cabeça, ideias incríveis e eventos exclusivos rolando. 🧠😃

Se precisar de qualquer ajuda, estou aqui para te apoiar, ok? 🆘 

Já estamos com saudade! Até breve!

Abraços mensans,

Zelador 🤖`;
  }
  
  function getNotFoundMessage() {
    return `Olá, mensan! 👋
  
Aqui quem fala é o Zelador, da Mensa Brasil! 🤖

Estou te enviando esta mensagem, pois tive um pequeno contratempo: não encontrei este seu número de telefone nos cadastros de nosso sistema da Mensa Brasil. 😕 Mas não se preocupe, juntos resolveremos isso rapidinho!

Pra corrigir a situação, preciso que você envie um e-mail para secretaria@mensa.org.br com o seu número de membro e o número de telefone que você usa no WhatsApp. 📧👌 

Importante: *seu prazo para enviar o e-mail de regularização cadastral é de 7 dias, contados da data desta mensagem*. ⏰ Se nossa secretaria não receber suas informações neste período, infelizmente terei que remover este número de telefone dos grupos oficiais de WhatsApp da Mensa Brasil. Por isso, tenho certeza de resolveremos a situação rapidinho! 🧠😉

Aguardamos seu e-mail e ficamos à disposição para qualquer dúvida. Lembre-se, estou aqui pra te ajudar! 🆘

Contamos com você!

Abraços mensans,
  
Zelador 🤖`;
  }
  
  module.exports = {
    getInactiveMessage,
    getNotFoundMessage
  };
  