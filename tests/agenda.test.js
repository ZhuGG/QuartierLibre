import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaPool, eventsForPlace } from "../src/agenda.js";
import { places } from "../src/data.js";

const now = Date.parse("2026-11-26T10:00:00Z");
const venue = places.find((p) => p.name === "Les Clameurs");
function event(slug, hours, name = venue.name, address = venue.address) {
  return {
    title: slug, slug, start_datetime: now / 1000 + hours * 3600,
    place: { name, address },
  };
}

test("le ticket trie les dates du lieu même si un autre lieu joue ce soir", () => {
  const saturday = event("concert", 48, "LES CLAMEURS", "23 rue d'Aguesseau\n 69007, LYON");
  const friday = event("rencontre", 24);
  const tonight = event("ailleurs", 9, "Autre salle");
  const events = [saturday, friday, tonight, saturday, event("passe", -1),
    event("trop-loin", 168), event("homonyme", 30, venue.name, "25 rue d'Aguesseau, 69007 Lyon")];
  assert.deepEqual(eventsForPlace(events, venue, now), [friday, saturday]);
  assert.deepEqual(agendaPool(events, now).events, [tonight]);
});

test("un alias du carnet est reconnu uniquement à la bonne adresse", () => {
  const rancy = places.find((place) => place.aliases?.includes("MPT des Rancy"));
  const good = event("scene", 48, "MPT des Rancy", rancy.address);
  assert.deepEqual(eventsForPlace([good, event("autre", 36, "MPT des Rancy")], rancy, now), [good]);
});
