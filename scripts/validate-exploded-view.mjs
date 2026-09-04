#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const FIDELITIES = new Set(["authoritative", "hybrid", "illustrative"]);
const STATUSES = new Set(["normal", "shortage", "substitute", "blocked"]);
const SHAPES = new Set(["path", "ellipse", "rect", "line"]);

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function positive(value) {
  return Number.isFinite(value) && value > 0;
}

export function validateSheet(sheet) {
  const errors = [];

  if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
    return ["sheet must be a JSON object"];
  }

  for (const key of ["sheetId", "revision", "title"]) {
    if (!text(sheet[key])) errors.push(`${key} must be a non-empty string`);
  }

  if (!FIDELITIES.has(sheet.fidelity)) {
    errors.push("fidelity must be authoritative, hybrid, or illustrative");
  }
  if (typeof sheet.manufacturingUse !== "boolean") {
    errors.push("manufacturingUse must be a boolean");
  }
  if (sheet.fidelity !== "authoritative" && sheet.manufacturingUse !== false) {
    errors.push(`${sheet.fidelity ?? "non-authoritative"} geometry requires manufacturingUse=false`);
  }

  if (!sheet.source || typeof sheet.source !== "object") {
    errors.push("source must be an object");
  } else {
    if (!text(sheet.source.kind)) errors.push("source.kind must be a non-empty string");
    if (!text(sheet.source.label)) errors.push("source.label must be a non-empty string");
    if (
      sheet.fidelity === "authoritative" &&
      !text(sheet.source.uri) &&
      !text(sheet.source.documentId)
    ) {
      errors.push("authoritative geometry requires source.uri or source.documentId");
    }
  }

  for (const key of ["width", "height", "centerlineY"]) {
    if (!positive(sheet[key])) errors.push(`${key} must be a positive number`);
  }
  if (positive(sheet.height) && positive(sheet.centerlineY) && sheet.centerlineY >= sheet.height) {
    errors.push("centerlineY must be inside the sheet height");
  }

  if (!Array.isArray(sheet.stations) || sheet.stations.length === 0) {
    errors.push("stations must be a non-empty array");
    return errors;
  }

  const stationNumbers = new Set();
  const partIds = new Set();

  sheet.stations.forEach((station, index) => {
    const prefix = `stations[${index}]`;
    if (!Number.isInteger(station.station) || station.station <= 0) {
      errors.push(`${prefix}.station must be a positive integer`);
    } else if (stationNumbers.has(station.station)) {
      errors.push(`duplicate station ${station.station}`);
    } else {
      stationNumbers.add(station.station);
    }

    if (!text(station.partId)) {
      errors.push(`${prefix}.partId must be a non-empty string`);
    } else if (partIds.has(station.partId)) {
      errors.push(`duplicate partId ${station.partId}`);
    } else {
      partIds.add(station.partId);
    }

    if (!text(station.label)) errors.push(`${prefix}.label must be a non-empty string`);
    if (!Number.isFinite(station.x)) errors.push(`${prefix}.x must be a number`);
    if (!Number.isFinite(station.y)) errors.push(`${prefix}.y must be a number`);
    if (station.status !== undefined && !STATUSES.has(station.status)) {
      errors.push(`${prefix}.status is unsupported`);
    }

    if (!Array.isArray(station.shapes) || station.shapes.length === 0) {
      errors.push(`${prefix}.shapes must be a non-empty array`);
      return;
    }
    station.shapes.forEach((shape, shapeIndex) => {
      const shapePrefix = `${prefix}.shapes[${shapeIndex}]`;
      if (!SHAPES.has(shape.kind)) errors.push(`${shapePrefix}.kind is unsupported`);
      if (shape.kind === "path" && !text(shape.d)) errors.push(`${shapePrefix}.d is required`);
    });
  });

  return errors;
}

async function main(filePath) {
  if (!filePath) {
    console.error("Usage: node validate_exploded_view.mjs path/to/sheet.json");
    process.exitCode = 2;
    return;
  }

  let sheet;
  try {
    sheet = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    console.error(`Could not read JSON: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const errors = validateSheet(sheet);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Valid exploded-view sheet: ${sheet.sheetId} rev ${sheet.revision}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main(process.argv[2]);
}
