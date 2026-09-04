import assert from "node:assert/strict";
import test from "node:test";

import { validateSheet } from "./validate-exploded-view.mjs";

const validSheet = {
  sheetId: "MF-8S-PTO-4418",
  revision: "D",
  title: "Exploded view",
  fidelity: "illustrative",
  manufacturingUse: false,
  source: { kind: "illustration", label: "Concept geometry for demo" },
  width: 1440,
  height: 320,
  centerlineY: 190,
  stations: [
    {
      station: 1,
      partId: "P-001",
      label: "Drive plate",
      x: 180,
      y: 190,
      shapes: [{ kind: "ellipse", cx: 0, cy: 0, rx: 18, ry: 62 }],
    },
  ],
};

test("accepts an illustrative sheet that is explicitly non-manufacturing", () => {
  assert.deepEqual(validateSheet(validSheet), []);
});

test("rejects duplicate part identities and stations", () => {
  const duplicate = {
    ...validSheet,
    stations: [validSheet.stations[0], { ...validSheet.stations[0] }],
  };
  const errors = validateSheet(duplicate);
  assert(errors.some((error) => error.includes("duplicate station")));
  assert(errors.some((error) => error.includes("duplicate partId")));
});

test("rejects authoritative geometry without traceable source metadata", () => {
  const authoritative = {
    ...validSheet,
    fidelity: "authoritative",
    manufacturingUse: true,
    source: { kind: "cad", label: "CAD export" },
  };
  const errors = validateSheet(authoritative);
  assert(errors.some((error) => error.includes("source.uri or source.documentId")));
});

test("rejects manufacturing claims on illustrative geometry", () => {
  const unsafe = { ...validSheet, manufacturingUse: true };
  const errors = validateSheet(unsafe);
  assert(errors.some((error) => error.includes("manufacturingUse=false")));
});
