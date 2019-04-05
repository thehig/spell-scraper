const request = require("request-promise-native");
const cheerio = require("cheerio");
const fs = require("fs-extra");
const path = require("path");
const converter = require("json-2-csv");

const jsonfile = path.join(__dirname, "spells.json");
const csvfile = path.join(__dirname, "spells.csv");

function scrapeCard($, cardDiv) {
  const $cardDiv = $(cardDiv);

  // Extract each of the pieces of the data from the DOM
  return {
    name: $cardDiv.find("#basics").text(),
    id: $cardDiv.attr("data-id"),
    level: $cardDiv.find("#level").text(),
    components: $cardDiv
      .find("#components")
      .attr('class')
      .trim()
      .split(' '),
    attributes: $cardDiv
      .find("dt")
      .map(function() {
        const key = $(this)
          .text()
          .trim();
        const value = $(this)
          .next()
          .text()
          .trim();
        return { [key]: value };
      })
      .get()
      .reduce((prev, next) => {
        return Object.assign({}, prev, next);
      }, {}),
    description: $cardDiv
      .find("#description-content")
      .text()
      .trim()
  };
}

function inferMetadata(card) {
  const desc = card.description.toLowerCase();

  return {
    meta: {
      isSpellAttack: desc.indexOf("spell attack") > 0,

      isSavingThrow: desc.indexOf("saving throw") > 0,
      hasHalfDamage: desc.indexOf("or half as much") > 0,
      // isRitual - Not in dataset
      isReaction:
        card.attributes["Casting Time"].toLowerCase().indexOf("reaction") > 0,
      isBonus:
        card.attributes["Casting Time"].toLowerCase().indexOf("bonus") > 0,
      usesBonus: desc.indexOf("bonus") > 0,
      isConcentration:
        card.attributes["Duration"].toLowerCase().indexOf("concentration") > 0,
      isUpcastable:
        desc.indexOf("when you cast this spell using a spell slot of ") > 0,

      hasVerbalComponent: card.components.includes("verbal"),
      hasSomaticComponent: card.components.includes("somatic"),
      hasMaterialComponent: card.components.includes("material"),
      hasMaterialGPCost:
        card.attributes["Materials"].toLowerCase().indexOf("worth") > 0
    }
  };
}

function getFromWeb() {
  console.log("Scraping");
  return request({
    uri: "http://regalgoblins.com/spells-5e.php",
    transform: function(body) {
      console.log("Transforming");
      return cheerio.load(body);
    }
  })
    .then(function($) {
      console.log("Parsing");
      return $(".card")
        .map(function() {
          return scrapeCard($, this);
        })
        .get();
    })
    .then(function writeSpellsToFile(spells) {
      console.log("Writing to file ", jsonfile);
      return fs.outputJson(jsonfile, spells).then(() => spells);
    })
    .then(function(spells) {
      console.log("done");
      return spells;
    });
}

const getFromDisk = () => {
  console.log("Reading from file ", jsonfile);
  return fs.readJson(jsonfile);
};

// getFromWeb()
getFromDisk()
  .then(spells =>
    spells.map(spell => Object.assign({}, spell, inferMetadata(spell)))
  )
  .then(spells => {
    console.log("Converting to CSV");
    return converter.json2csvAsync(spells);
  })
  .then(csv => {
    console.log('Writing CSV to file', csvfile);
    return fs.outputFile(csvfile, csv);
  })
  .catch(function(err) {
    console.log(err);
  });
