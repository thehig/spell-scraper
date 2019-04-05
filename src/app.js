const request = require("request-promise-native"); // HTTP Request
const cheerio = require("cheerio"); // Headless jQuery
const fs = require("fs-extra"); // Read/Write to file system
const path = require("path"); // Safely join path dirs
const json2csv = require("json-csv"); // Convert array of json to csv format

const jsonfile = path.join(__dirname, "../data/spells.json");
const csvfile = path.join(__dirname, "../data/spells.csv");

/**
 * Extract spell data from DOM card elements
 * 
 * name, id, level, components, attributes, description
 * 
 * components: verbal, somatic, material
 * attributes: Duration, Casting Time, School, Book, Materials
 */
function scrapeCard($, cardDiv) {
  const $cardDiv = $(cardDiv);

  return {
    name: $cardDiv.find("#basics").text(),
    id: $cardDiv.attr("data-id"),
    level: $cardDiv.find("#level").text(),
    components: $cardDiv
      .find("#components")
      .attr("class")
      .trim()
      .split(" "),
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

/**
 * Extract useful 'snippets' of data to facilitate sorting & filtering
 * 
 * Is: Spell Attack, Spell Save, Ranged, Melee, Reaction, Bonus Action, Concentration, Upcastable
 * Uses: Str, Dex, Con, Int, Wis, Cha, Bonus Action
 * Has: Save for half damage, V, S, M, Material Cost
 */
function inferMetadata(card) {
  const desc = card.description.toLowerCase();

  return {
    meta: {
      isSpellAttack: desc.indexOf("spell attack") >= 0,
      isSavingThrow: desc.indexOf("saving throw") >= 0,

      isRanged: desc.indexOf("ranged") >= 0,
      isMelee: desc.indexOf("melee") >= 0,

      usesStr: desc.indexOf("strength") >= 0,
      usesDex: desc.indexOf("dexterity") >= 0,
      usesCon: desc.indexOf("constitution") >= 0,
      usesInt: desc.indexOf("intelligence") >= 0,
      usesWis: desc.indexOf("wisdom") >= 0,
      usesCha: desc.indexOf("charisma") >= 0,

      hasHalfDamage: desc.indexOf("or half as much") >= 0,
      // isRitual - Not in dataset
      isReaction:
        card.attributes["Casting Time"].toLowerCase().indexOf("reaction") >= 0,
      isBonus:
        card.attributes["Casting Time"].toLowerCase().indexOf("bonus") >= 0,
      usesBonus: desc.indexOf("bonus") >= 0,
      isConcentration:
        card.attributes["Duration"].toLowerCase().indexOf("concentration") >= 0,
      isUpcastable:
        desc.indexOf("when you cast this spell using a spell slot of ") >= 0,

      hasVerbalComponent: card.components.includes("verbal"),
      hasSomaticComponent: card.components.includes("somatic"),
      hasMaterialComponent: card.components.includes("material"),
      hasMaterialGPCost:
        card.attributes["Materials"].toLowerCase().indexOf("worth") >= 0
    }
  };
}

/**
 * Scrape raw data from the web, parse, then write to file
 */
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

/**
 * Read spells from JSON file (Written by getFromWeb())
 * 
 * Avoids thrashing the website
 */
const getFromDisk = () => {
  console.log("Reading from file ", jsonfile);
  return fs.readJson(jsonfile);
};

getFromWeb()
// getFromDisk()
  .then(spells =>
    spells.map(spell => Object.assign({}, spell, inferMetadata(spell)))
  )
  .then(spells => {
    console.log("Converting to CSV");

    return new Promise((resolve, reject) => {
      json2csv.csvBuffered(
        spells,
        {
          fields: [
            { name: "name", label: "Name", quoted: true },
            { name: "description", label: "Description", quoted: true },
            { name: "level", label: "Level" },
            { name: "attributes.Book", label: "Book", quoted: true },
            { name: "attributes.School", label: "School", quoted: true },
            { name: "meta.hasVerbalComponent", label: "V" },
            { name: "meta.hasSomaticComponent", label: "S" },
            { name: "meta.hasMaterialComponent", label: "M" },
            { name: "meta.hasMaterialGPCost", label: "$" },
            { name: "attributes.Materials", label: "Materials" },
            {
              name: "attributes.Casting Time",
              label: "Casting Time",
              quoted: true
            },
            { name: "meta.isReaction", label: "R" },
            { name: "meta.isBonus", label: "B" },
            { name: "meta.usesBonus", label: "B?" },
            { name: "attributes.Duration", label: "Duration", quoted: true },
            { name: "meta.isConcentration", label: "C" },
            { name: "meta.isUpcastable", label: "Upcast" },
            { name: "meta.isSpellAttack", label: "Spell Atk" },
            { name: "meta.isRanged", label: "Ranged" },
            { name: "meta.isMelee", label: "Melee" },
            { name: "meta.isSavingThrow", label: "Spell Sav" },
            { name: "meta.hasHalfDamage", label: "1/2 Dmg" },
            { name: "meta.usesStr", label: "Str" },
            { name: "meta.usesDex", label: "Dex" },
            { name: "meta.usesCon", label: "Con" },
            { name: "meta.usesInt", label: "Int" },
            { name: "meta.usesWis", label: "Wis" },
            { name: "meta.usesCha", label: "Cha" }
          ]
        },
        (err, csv) => (err ? reject(err) : resolve(csv))
      );
    });
  })
  .then(csv => {
    console.log("Writing CSV to file", csvfile);
    return fs.outputFile(csvfile, csv);
  })
  .catch(function(err) {
    console.log(err);
  });
