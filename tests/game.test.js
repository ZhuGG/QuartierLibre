import { test } from "node:test";
import assert from "node:assert/strict";
import {
  places,
  filterPlaces,
  chooseIndex,
  targetRotation,
  makeWheelPool,
  spinProgress,
  renewWheelPool,
} from "../src/data.js";
test("le lieu choisi termine exactement sous le pointeur pour toutes les tailles de roue", () => {
  const tau = Math.PI * 2;
  for (let n = 1; n <= 30; n++)
    for (let i = 0; i < n; i++)
      for (const start of [0, 8, 123.4, 1000]) {
        const end = targetRotation(start, i, n);
        assert.ok(end > start + 5 * tau);
        const a = (((end + ((i + 0.5) * tau) / n) % tau) + tau) % tau;
        assert.ok(Math.abs(a - Math.PI / 2) < 1e-10);
      }
});

test("renouveler privilégie six autres lieux et conserve les exclusions", () => {
  const list = Array.from({ length: 14 }, (_, i) => ({
    id: `place-${i}`,
    available: i !== 13,
  }));
  const current = list.slice(0, 6);
  const renewed = renewWheelPool(list, ["place-12"], current, () => 0.99);
  assert.equal(renewed.length, 6);
  assert.equal(new Set(renewed.map((p) => p.id)).size, 6);
  assert.ok(renewed.every((p) => !current.some((old) => old.id === p.id)));
  assert.ok(renewed.every((p) => p.id !== "place-12" && p.available !== false));
});
test("une petite sélection reste utilisable sans promettre des lieux inexistants", () => {
  const list = Array.from({ length: 6 }, (_, i) => ({ id: `place-${i}` }));
  const renewed = renewWheelPool(list, [], list, () => 0.999);
  assert.equal(renewed.length, 6);
  assert.notDeepEqual(
    renewed.map((p) => p.id),
    list.map((p) => p.id),
  );
  assert.deepEqual(renewWheelPool([], [], []), []);
  assert.equal(renewWheelPool(list.slice(0, 1), [], []).length, 1);
  assert.ok(!places.some((p) => p.id === "ours"));
});
test("les filtres combinent mode, quartier, recherche accentuée et favoris", () => {
  assert.equal(
    filterPlaces(places, {
      mode: "moon",
      query: "petit bouclard",
      favorites: ["bouclard"],
    })[0].id,
    "bouclard",
  );
  assert.equal(
    filterPlaces(places, { mode: "sun", category: "Danser" }).length,
    0,
  );
  assert.ok(
    filterPlaces(places, { mode: "sun", district: "Gerland" }).every(
      (p) => p.district === "Gerland",
    ),
  );
  assert.equal(
    filterPlaces(places, { mode: "sun", query: "Pré-Gaudry" })[0].id,
    "commune",
  );
});
test("les lieux récents et indisponibles sont exclus, avec reprise si le choix est épuisé", () => {
  const list = places.slice(0, 4);
  const pool = makeWheelPool(list, ["commune", "live"]);
  assert.deepEqual(new Set(pool.map((p) => p.id)), new Set(["fourmi", "mama"]));
  assert.equal(
    makeWheelPool(
      list,
      list.map((p) => p.id),
    ).length,
    4,
  );
  assert.ok(makeWheelPool(places).every((p) => p.available !== false));
  assert.deepEqual(makeWheelPool([]), []);
});
test("le tirage couvre les bornes et traite les ensembles vides", () => {
  assert.equal(
    chooseIndex(8, () => 0),
    0,
  );
  assert.equal(
    chooseIndex(8, () => 0.99999),
    7,
  );
  assert.throws(() => chooseIndex(0));
});
test("la rotation accélère puis ralentit sans retour en arrière", () => {
  assert.equal(spinProgress(0), 0);
  assert.ok(Math.abs(spinProgress(1) - 1) < 1e-12);
  let previous = 0;
  for (let i = 1; i <= 1000; i++) {
    const p = spinProgress(i / 1000);
    assert.ok(p >= previous && p <= 1 + 1e-12);
    previous = p;
  }
  assert.ok(
    spinProgress(0.02) - spinProgress(0.01) <
      spinProgress(0.1) - spinProgress(0.09),
  );
  assert.ok(
    spinProgress(0.99) - spinProgress(0.98) <
      spinProgress(0.5) - spinProgress(0.49),
  );
});
test("le catalogue contient des adresses uniques et sourcées, avec les Rancy comme exception", () => {
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
  for (const p of places) {
    assert.ok(p.address.includes(p.id === "rancy" ? "69003" : "69007"));
    assert.ok(p.source.startsWith("https://"));
  }
  for (const id of [
    "court",
    "super7",
    "kargo",
    "fauves",
    "bouclard",
    "overdrive",
    "basement",
    "rancy",
    "pho-69",
    "fujiyama-55",
    "bouillon-paradis",
    "au-janis",
    "coole",
  ])
    assert.ok(places.some((p) => p.id === id));
});

test("le Court-Circuit participe aux tirages Soleil et Lune et au renouvellement", () => {
  for (const mode of ["sun", "moon"]) {
    const list = filterPlaces(places, { mode, query: "Court-Circuit" });
    assert.deepEqual(makeWheelPool(list).map((p) => p.id), ["court"]);
    assert.deepEqual(renewWheelPool(list).map((p) => p.id), ["court"]);
    assert.deepEqual(makeWheelPool(list, ["court"]).map((p) => p.id), ["court"]);
  }
});

test("les Rancy sont tirables par défaut mais exclus du filtre strict Lyon 7e", () => {
  const query = "MPT des Rancy";
  assert.deepEqual(makeWheelPool(filterPlaces(places, { mode: "sun", query })).map(({ id }) => id), ["rancy"]);
  assert.deepEqual(filterPlaces(places, { mode: "sun", district: "Tout le 7e", query }), []);
  assert.deepEqual(filterPlaces(places, { mode: "sun", query: "Koolé" }).map(({ id }) => id), ["coole"]);
  const bouillon = filterPlaces(places, { mode: "moon", query: "Bouillon Paradis" });
  assert.equal(bouillon.length, 1);
  assert.deepEqual(makeWheelPool(bouillon), []);
});
