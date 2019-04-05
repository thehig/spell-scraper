const request = require("request-promise-native");
const cheerio = require("cheerio");
const fs = require("fs-extra");
const path = require("path");

const jsonfile = path.join(__dirname, "spells.json");

function scrapeCard($, cardDiv) {
  const $cardDiv = $(cardDiv);

  // Extract each of the pieces of the data from the DOM
  return {
    name: $cardDiv.find("#basics").text(),
    id: $cardDiv.attr("data-id"),
    level: $cardDiv.find("#level").text(),
    components: $cardDiv
      .find("#components > span")
      .map(function() {
        return $(this).text();
      })
      .get(),
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
      .get(),
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

      isReaction:
        card.attributes["Casting Time"].toLowerCase().indexOf("reaction") > 0,
      isBonus:
        card.attributes["Casting Time"].toLowerCase().indexOf("bonus") > 0,

      isConcentration:
        card.attributes["Duration"].toLowerCase().indexOf("concentration") > 0,
      // // isRitual - Not in dataset
      isUpcastable:
        desc.indexOf("when you cast this spell using a spell slot of ") > 0,

      hasVerbalComponent: card.components.includes("V"),
      hasSomaticComponent: card.components.includes("S"),
      hasMaterialComponent: card.components.includes("M")
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

getFromWeb()
  .then(spells =>
    spells.map(spell => Object.assign({}, spell, inferMetadata(spell)))
  )
  .then(spells => {
    console.log("spells", spells);
  })
  .catch(function(err) {
    console.log(err);
  });
