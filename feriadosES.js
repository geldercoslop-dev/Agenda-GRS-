/**
 * feriadosES.js
 * Base estruturada de feriados municipais do Espirito Santo (ES).
 *
 * Estrutura pensada para manutencao:
 * - Cada cidade possui slug + nome exibido + lista de feriados.
 * - Hoje o catalogo vem com o aniversario municipal (78 municipios).
 * - Para adicionar novos feriados por cidade, inclua novos itens em holidays.
 */
(function () {
  "use strict";

  // slug, nome, mes, dia
  var BASE = [
    ["afonso-claudio", "Afonso Claudio", 1, 20],
    ["agua-doce-do-norte", "Agua Doce do Norte", 5, 10],
    ["aguia-branca", "Aguia Branca", 5, 11],
    ["alegre", "Alegre", 1, 6],
    ["alfredo-chaves", "Alfredo Chaves", 12, 24],
    ["alto-rio-novo", "Alto Rio Novo", 5, 11],
    ["anchieta", "Anchieta", 8, 12],
    ["apiaca", "Apiaca", 8, 16],
    ["aracruz", "Aracruz", 4, 3],
    ["atilio-vivacqua", "Atilio Vivacqua", 4, 10],
    ["baixo-guandu", "Baixo Guandu", 4, 18],
    ["barra-de-sao-francisco", "Barra de Sao Francisco", 9, 12],
    ["boa-esperanca", "Boa Esperanca", 5, 3],
    ["bom-jesus-do-norte", "Bom Jesus do Norte", 4, 9],
    ["brejetuba", "Brejetuba", 12, 15],
    ["cachoeiro-de-itapemirim", "Cachoeiro de Itapemirim", 3, 25],
    ["cariacica", "Cariacica", 6, 24],
    ["castelo", "Castelo", 1, 2],
    ["colatina", "Colatina", 8, 22],
    ["conceicao-da-barra", "Conceicao da Barra", 10, 6],
    ["conceicao-do-castelo", "Conceicao do Castelo", 5, 9],
    ["divino-de-sao-lourenco", "Divino de Sao Lourenco", 6, 5],
    ["domingos-martins", "Domingos Martins", 6, 12],
    ["dores-do-rio-preto", "Dores do Rio Preto", 4, 7],
    ["ecoporanga", "Ecoporanga", 4, 9],
    ["fundao", "Fundao", 7, 5],
    ["governador-lindenberg", "Governador Lindenberg", 5, 11],
    ["guacui", "Guacui", 12, 25],
    ["guarapari", "Guarapari", 9, 19],
    ["ibatiba", "Ibatiba", 11, 7],
    ["ibitirama", "Ibitirama", 9, 15],
    ["ibiracu", "Ibiracu", 9, 11],
    ["iconha", "Iconha", 11, 11],
    ["irupi", "Irupi", 1, 1],
    ["itaguacu", "Itaguacu", 2, 17],
    ["itapemirim", "Itapemirim", 3, 30],
    ["itarana", "Itarana", 4, 18],
    ["iuna", "Iuna", 11, 11],
    ["jaguare", "Jaguaré", 1, 31],
    ["jeronimo-monteiro", "Jeronimo Monteiro", 11, 28],
    ["joao-neiva", "Joao Neiva", 1, 29],
    ["laranja-da-terra", "Laranja da Terra", 5, 16],
    ["linhares", "Linhares", 8, 22],
    ["mantenopolis", "Mantenopolis", 1, 7],
    ["marataizes", "Marataizes", 10, 16],
    ["marechal-floriano", "Marechal Floriano", 10, 31],
    ["marilandia", "Marilandia", 5, 15],
    ["mimoso-do-sul", "Mimoso do Sul", 7, 8],
    ["montanha", "Montanha", 4, 16],
    ["mucurici", "Mucurici", 12, 11],
    ["muqui", "Muqui", 10, 22],
    ["muniz-freire", "Muniz Freire", 3, 1],
    ["nova-venecia", "Nova Venecia", 1, 26],
    ["pancas", "Pancas", 5, 13],
    ["pedro-canario", "Pedro Canario", 12, 23],
    ["pinheiros", "Pinheiros", 4, 22],
    ["piuma", "Piuma", 12, 24],
    ["ponto-belo", "Ponto Belo", 3, 30],
    ["presidente-kennedy", "Presidente Kennedy", 4, 4],
    ["rio-bananal", "Rio Bananal", 1, 31],
    ["rio-novo-do-sul", "Rio Novo do Sul", 11, 23],
    ["santa-leopoldina", "Santa Leopoldina", 5, 6],
    ["santa-maria-de-jetiba", "Santa Maria de Jetiba", 5, 6],
    ["santa-teresa", "Santa Teresa", 10, 15],
    ["sao-domingos-do-norte", "Sao Domingos do Norte", 3, 30],
    ["sao-gabriel-da-palha", "Sao Gabriel da Palha", 5, 14],
    ["sao-jose-do-calcado", "Sao Jose do Calcado", 11, 5],
    ["sao-mateus", "Sao Mateus", 9, 21],
    ["sao-roque-do-canaa", "Sao Roque do Canaa", 6, 25],
    ["serra", "Serra", 12, 8],
    ["sooretama", "Sooretama", 3, 31],
    ["vargem-alta", "Vargem Alta", 5, 10],
    ["venda-nova-do-imigrante", "Venda Nova do Imigrante", 5, 6],
    ["viana", "Viana", 7, 23],
    ["vila-pavao", "Vila Pavao", 1, 16],
    ["vila-valerio", "Vila Valerio", 3, 23],
    ["vila-velha", "Vila Velha", 5, 23],
    ["vitoria", "Vitoria", 9, 8]
  ];

  window.ES_MUNICIPAL_HOLIDAYS = BASE.map(function (row) {
    var slug = row[0], city = row[1], month = row[2], day = row[3];
    return {
      slug: slug,
      city: city,
      holidays: [
        {
          id: "aniversario",
          name: "Aniversario de " + city,
          month: month,
          day: day,
          emoji: "🎂"
        }
      ]
    };
  });
})();

