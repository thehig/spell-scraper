var rp = require("request-promise-native");
var cheerio = require("cheerio"); // Basically jQuery for node.js

var options = {
  uri: "http://regalgoblins.com/spells-5e.php",
  transform: function(body) {
    console.log("Transforming");
    return cheerio.load(body);
  }
};

const verbose = false;

function extractCardDetails($, cardDiv) {
  const $cardDiv = $(cardDiv);
  const id = $cardDiv.attr("data-id");
  console.log(`Extract card ${id}`);

  const level = $cardDiv.find("#level").text();
  if(verbose) console.log(`       level: ${level}`);

  const components = $cardDiv.find("#components > span").map(function() {
    return $(this).text();
  });
  if(verbose) console.log(`       components: ${components}`);

  const name = $cardDiv.find("#basics").text();
  if(verbose) console.log(`       name: ${name}`);

  if(verbose) console.log(`       attributes:`);
  const attributes = $cardDiv.find('dt').map(function() {
    const key = $(this).text().trim();
    const value = $(this).next().text().trim();
    if(verbose) console.log(`               ${key}: ${value}`);
    return { [key]: value };
  });

  const description = $cardDiv.find('#description-content').text().trim();
  if(verbose) console.log(`       description: ${description}`);
  
  const card = {
    name, id, level, components, attributes, description
  }

  return card;
}

console.log("Scraping");
rp(options)
  .then(function($) {
    const spells = $(".card").map(function() {
      extractCardDetails($, this);
    });
    return [$, spells];
  })
  .catch(function(err) {
    // Crawling failed or Cheerio choked...
    console.log(err);
  });
