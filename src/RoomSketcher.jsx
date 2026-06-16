import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Text, Transformer, Line, Group, Circle } from 'react-konva';
import { Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import ReportsPanel from './ReportsPanel.jsx';
import { generateCustomerReport, generateInternalReport } from './reportGenerators.js';
import { acousticProducts, getProductSabins } from './data/acousticProducts.js';

const RoomSketch3D = React.lazy(() => import('./RoomSketch3D.jsx'));
const SCALE = 60;
const CANVAS_PADDING = 28;
const ROTATION_STEP_DEGREES = 5;
const ROTATION_SNAPS = Array.from({ length: 360 / ROTATION_STEP_DEGREES }, (_, index) => index * ROTATION_STEP_DEGREES);

const roomTypes = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'cafe', label: 'Cafe' },
  { id: 'living-room', label: 'Woonkamer' },
  { id: 'meeting', label: 'Vergaderruimte' },
  { id: 'office', label: 'Kantoor' },
  { id: 'waiting-room', label: 'Wachtruimte' },
  { id: 'other', label: 'Anders' },
];

const roomShapeOptions = [
  { id: 'rectangle', label: 'Rechthoek' },
  { id: 'l-shape', label: 'Ruimte met hoek' },
];

const floorOptions = [
  {
    id: 'carpet',
    label: 'Tapijt',
    absorption: 0.28,
    rtFactor: 0.82,
  },
  {
    id: 'vinyl',
    label: 'Vinyl',
    absorption: 0.06,
    rtFactor: 0.96,
  },
  {
    id: 'wood',
    label: 'Hout',
    absorption: 0.08,
    rtFactor: 1,
  },
  {
    id: 'cast-floor-tiles',
    label: 'Gietvloer / tegels',
    absorption: 0.02,
    rtFactor: 1.12,
  },
  {
    id: 'concrete',
    label: 'Beton',
    absorption: 0.015,
    rtFactor: 1.18,
  },
];

const cornerPositions = [
  { id: 'top-right', label: 'Rechtsboven' },
  { id: 'top-left', label: 'Linksboven' },
  { id: 'bottom-right', label: 'Rechtsonder' },
  { id: 'bottom-left', label: 'Linksonder' },
];

const seatingPresets = {
  twoSeater: {
    label: '2-zits bank',
    widthCm: 160,
    depthCm: 90,
  },
  threeSeater: {
    label: '3-zits bank',
    widthCm: 220,
    depthCm: 95,
  },
  cornerSofa: {
    label: 'Hoekbank',
    longSideCm: 280,
    shortSideCm: 200,
    depthCm: 95,
  },
  armchair: {
    label: 'Fauteuil',
    widthCm: 85,
    depthCm: 85,
  },
};

const diningPresets = {
  round4: {
    label: 'Ronde tafel met 4 stoelen',
    tableShape: 'round',
    diameterCm: 120,
    chairWidthCm: 45,
    chairDepthCm: 50,
    chairs: 4,
  },
  rectangular4: {
    label: 'Rechthoekige tafel met 4 stoelen',
    tableShape: 'rectangular',
    lengthCm: 160,
    widthCm: 90,
    chairWidthCm: 45,
    chairDepthCm: 50,
    chairs: 4,
  },
  rectangular6: {
    label: 'Rechthoekige tafel met 6 stoelen',
    tableShape: 'rectangular',
    lengthCm: 220,
    widthCm: 95,
    chairWidthCm: 45,
    chairDepthCm: 50,
    chairs: 6,
  },
  rectangular8: {
    label: 'Rechthoekige tafel met 8 stoelen',
    tableShape: 'rectangular',
    lengthCm: 280,
    widthCm: 100,
    chairWidthCm: 45,
    chairDepthCm: 50,
    chairs: 8,
  },
};

const plantPresets = {
  smallPlant1: {
    label: 'Kleine kamerplant in pot',
    diameterCm: 45,
    heightCm: 80,
  },
  smallPlant2: {
    label: 'Middelgrote kamerplant in pot',
    diameterCm: 60,
    heightCm: 110,
  },
  smallPlant3: {
    label: 'Brede kamerplant in pot',
    diameterCm: 70,
    heightCm: 120,
  },
  largePlant1: {
    label: 'Grote kamerplant in pot',
    diameterCm: 95,
    heightCm: 170,
  },
  largePlant2: {
    label: 'Hoge kamerplant in pot',
    diameterCm: 110,
    heightCm: 210,
  },
};

const objectChoiceDefinitions = {
  diningSet: {
    title: 'Kies je tafelopstelling',
    toolLabel: 'Tafelopstelling',
    objectType: 'diningSet',
    acousticCategory: 'hardFurniture',
    materialType: 'tafel met stoelen',
    nrc: 0.1,
    variants: diningPresets,
  },
  seating: {
    title: 'Kies je zitmeubel',
    toolLabel: 'Zitmeubel',
    objectType: 'seating',
    acousticCategory: 'softFurniture',
    materialType: 'gestoffeerd zitmeubel',
    nrc: 0.25,
    variants: seatingPresets,
  },
  curtain: {
    title: 'Gordijn toevoegen',
    toolLabel: 'Gordijn',
    objectType: 'curtain',
    acousticCategory: 'softSurface',
    materialType: 'textiel',
    nrc: 0.35,
    variants: {
      pleatedCurtain: {
        label: 'Geplooid gordijn',
        widthCm: 240,
        heightCm: 260,
      },
    },
  },
  window: {
    title: 'Raam toevoegen',
    toolLabel: 'Raam',
    objectType: 'window',
    acousticCategory: 'hardSurface',
    materialType: 'glas',
    nrc: 0.03,
    variants: {
      standardWindow: {
        label: 'Raam',
        widthCm: 160,
        heightCm: 120,
        bottomCm: 90,
      },
    },
  },
  door: {
    title: 'Deur toevoegen',
    toolLabel: 'Deur',
    objectType: 'door',
    acousticCategory: 'hardSurface',
    materialType: 'hout / deur',
    nrc: 0.08,
    variants: {
      standardDoor: {
        label: 'Deur',
        widthCm: 90,
        heightCm: 210,
      },
    },
  },
  rug: {
    title: 'Vloerkleed toevoegen',
    toolLabel: 'Vloerkleed',
    objectType: 'rug',
    acousticCategory: 'softSurface',
    materialType: 'tapijt / textiel',
    nrc: 0.22,
    variants: {
      standardRug: {
        label: 'Vloerkleed',
        widthCm: 240,
        depthCm: 160,
      },
    },
  },
  cabinet: {
    title: 'Kast toevoegen',
    toolLabel: 'Kast',
    objectType: 'cabinet',
    acousticCategory: 'hardFurniture',
    materialType: 'hout / kast',
    nrc: 0.08,
    variants: {
      standardCabinet: {
        label: 'Kast',
        widthCm: 180,
        depthCm: 60,
        heightCm: 180,
      },
    },
  },
  tv: {
    title: 'TV toevoegen',
    toolLabel: 'TV',
    objectType: 'tv',
    acousticCategory: 'hardSurface',
    materialType: 'glas / scherm',
    nrc: 0.03,
    variants: {
      standardTv: {
        label: 'TV',
        widthCm: 140,
        depthCm: 12,
      },
    },
  },
  tvCabinet: {
    title: 'TV-meubel toevoegen',
    toolLabel: 'TV-meubel',
    objectType: 'tv-cabinet',
    acousticCategory: 'hardFurniture',
    materialType: 'hout / tv-meubel',
    nrc: 0.08,
    variants: {
      standardTvCabinet: {
        label: 'TV-meubel',
        widthCm: 180,
        depthCm: 45,
      },
    },
  },
  plant: {
    title: 'Kamerplant toevoegen',
    toolLabel: 'Plant',
    objectType: 'plant',
    acousticCategory: 'visualObject',
    materialType: 'kamerplant in pot',
    nrc: 0,
    variants: plantPresets,
  },
};

const objectToolOrder = ['diningSet', 'seating', 'plant', 'curtain', 'window', 'door', 'rug', 'cabinet', 'tv', 'tvCabinet'];

const objectPresets = [
  { type: 'table', label: 'Tafel', width: 1.2, height: 0.8, materialType: 'hout / hard oppervlak', nrc: 0.05, isAcousticElement: false, fill: '#d8c7a5' },
  { type: 'chair', label: 'Stoel', width: 0.5, height: 0.5, materialType: 'gestoffeerd / persoon', nrc: 0.12, isAcousticElement: false, fill: '#b9c7d6' },
  { type: 'sofa', label: 'Bankstel', width: 2.2, height: 0.9, materialType: 'gestoffeerd', nrc: 0.25, isAcousticElement: false, fill: '#9aa9b5' },
  { type: 'cabinet', label: 'Kast', width: 1.8, height: 0.6, surfaceHeight: 1.8, materialType: 'hout / kast', nrc: 0.08, isAcousticElement: false, fill: '#c8b08a' },
  { type: 'tv', label: 'TV', width: 1.4, height: 0.12, materialType: 'glas / scherm', nrc: 0.03, isAcousticElement: false, fill: '#273241' },
  { type: 'tv-cabinet', label: 'TV-meubel', width: 1.8, height: 0.45, materialType: 'hout / tv-meubel', nrc: 0.08, isAcousticElement: false, fill: '#b99d76' },
  { type: 'plant', label: 'Kamerplant', width: 0.6, height: 0.6, surfaceHeight: 1.1, materialType: 'kamerplant in pot', nrc: 0, isAcousticElement: false, fill: '#6da36f' },
  { type: 'curtain', label: 'Gordijn', width: 2.0, height: 0.18, surfaceHeight: 2.4, surfaceBottom: 0, materialType: 'textiel', nrc: 0.35, isAcousticElement: false, fill: '#8fb8a8' },
  { type: 'window', label: 'Raam', width: 1.6, height: 0.16, surfaceHeight: 1.2, surfaceBottom: 0.9, materialType: 'glas', nrc: 0.03, isAcousticElement: false, fill: '#b8dcf0' },
  { type: 'door', label: 'Deur', width: 0.9, height: 0.18, materialType: 'hout / deur', nrc: 0.08, isAcousticElement: false, fill: '#c9a47d' },
  { type: 'rug', label: 'Vloerkleed', width: 2.4, height: 1.6, materialType: 'tapijt / textiel', nrc: 0.22, isAcousticElement: false, fill: '#b88f8f' },
  ...acousticProducts.map((product) => ({
    type: product.id,
    label: product.name,
    width: product.widthMeters,
    height: product.planDepthMeters ?? 0.04,
    surfaceHeight: product.heightMeters,
    materialType: 'BasKoestiek geweven akoestisch kunstwerk',
    nrc: product.acousticValuePerM2,
    sabins: getProductSabins(product),
    isAcousticElement: true,
    placementType: product.placementType,
    category: product.category,
    productId: product.id,
    articleNumber: product.articleNumber,
    artist: product.artist,
    color: product.color,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    fill: '#082d65',
  })),
];

const barometerLevels = [
  {
    id: 'balanced',
    label: 'Zeer rustig',
    score: 94,
    text: 'De ruimte voelt zeer rustig en gebalanceerd. Geluid wordt mooi verzacht zonder dat de ruimte kil aanvoelt.',
  },
  {
    id: 'quiet-comfort',
    label: 'Rustig',
    score: 74,
    text: 'De ruimte voelt rustiger en zachter aan. Gesprekken worden prettiger en de sfeer wordt warmer.',
  },
  {
    id: 'comfortable',
    label: 'Aangenaam',
    score: 54,
    text: 'De ruimte voelt prettig in balans. Geluid is aanwezig, maar overheerst minder.',
  },
  {
    id: 'more-balance',
    label: 'Meer balans',
    score: 34,
    text: 'De ruimte kan nog wat meer zachtheid gebruiken. Een akoestisch kunstwerk kan hier al een prettige eerste stap zijn.',
  },
  {
    id: 'lively',
    label: 'Levendig',
    score: 14,
    text: 'De ruimte voelt levendig aan. Geluiden blijven wat meer aanwezig, wat in sommige interieurs heel normaal is.',
  },
];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function parseNumberInput(value) {
  if (value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : value;
}

function cmToMeters(value, fallback = 0) {
  return safeNumber(value, fallback) / 100;
}

function objectMetersToCm(value, fallbackCm = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) : fallbackCm;
}

function rounded(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function snapRotation(value) {
  return rounded(Math.round(safeNumber(value) / ROTATION_STEP_DEGREES) * ROTATION_STEP_DEGREES, 0);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRotatedObjectBounds(width, height, rotation = 0) {
  const radians = rotation * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((point) => ({
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  }));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function normalizeRoom(room) {
  const lengthMeters = safeNumber(room.lengthMeters);
  const widthMeters = safeNumber(room.widthMeters);
  const maxCornerWidth = Math.max(0, lengthMeters - 0.1);
  const maxCornerDepth = Math.max(0, widthMeters - 0.1);
  const cornerWidthMeters = clamp(safeNumber(room.cornerWidthMeters, Math.min(1.5, lengthMeters * 0.25)), 0, maxCornerWidth);
  const cornerDepthMeters = clamp(safeNumber(room.cornerDepthMeters, Math.min(1.5, widthMeters * 0.25)), 0, maxCornerDepth);

  return {
    ...room,
    lengthMeters,
    widthMeters,
    heightMeters: safeNumber(room.heightMeters),
    type: room.type || 'restaurant',
    floorType: floorOptions.some((item) => item.id === room.floorType) ? room.floorType : 'wood',
    shape: room.shape === 'l-shape' ? 'l-shape' : 'rectangle',
    cornerPosition: cornerPositions.some((item) => item.id === room.cornerPosition) ? room.cornerPosition : 'top-right',
    cornerWidthMeters,
    cornerDepthMeters,
  };
}

function getFloorProfile(floorType) {
  return floorOptions.find((item) => item.id === floorType) ?? floorOptions.find((item) => item.id === 'wood');
}

function getEffectiveCorner(room) {
  const safeRoom = normalizeRoom(room);
  if (safeRoom.shape !== 'l-shape') {
    return { width: 0, depth: 0, position: safeRoom.cornerPosition };
  }

  return {
    width: clamp(safeRoom.cornerWidthMeters, 0, Math.max(0, safeRoom.lengthMeters - 0.1)),
    depth: clamp(safeRoom.cornerDepthMeters, 0, Math.max(0, safeRoom.widthMeters - 0.1)),
    position: safeRoom.cornerPosition,
  };
}

function getRoomFloorArea(room) {
  const safeRoom = normalizeRoom(room);
  const corner = getEffectiveCorner(safeRoom);
  return Math.max(0, safeRoom.lengthMeters * safeRoom.widthMeters - corner.width * corner.depth);
}

function getRoomPolygonPoints(room) {
  const safeRoom = normalizeRoom(room);
  const length = Math.max(0, safeRoom.lengthMeters);
  const width = Math.max(0, safeRoom.widthMeters);
  const corner = getEffectiveCorner(safeRoom);

  if (safeRoom.shape !== 'l-shape' || corner.width <= 0 || corner.depth <= 0) {
    return [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width },
    ];
  }

  if (corner.position === 'top-left') {
    return [
      { x: corner.width, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width },
      { x: 0, y: corner.depth },
      { x: corner.width, y: corner.depth },
    ];
  }

  if (corner.position === 'bottom-right') {
    return [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width - corner.depth },
      { x: length - corner.width, y: width - corner.depth },
      { x: length - corner.width, y: width },
      { x: 0, y: width },
    ];
  }

  if (corner.position === 'bottom-left') {
    return [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: corner.width, y: width },
      { x: corner.width, y: width - corner.depth },
      { x: 0, y: width - corner.depth },
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: length - corner.width, y: 0 },
    { x: length - corner.width, y: corner.depth },
    { x: length, y: corner.depth },
    { x: length, y: width },
    { x: 0, y: width },
  ];
}

function pointInPolygon(point, polygon) {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = ((yi > point.y) !== (yj > point.y))
      && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1) + xi);
    if (intersects) isInside = !isInside;
  }
  return isInside;
}

function pointInRoom(point, room) {
  const polygon = getRoomPolygonPoints(room);
  return pointInPolygon(point, polygon) || polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return distanceToSegment(point, start, end) <= 0.01;
  });
}

function getObjectPoints(object) {
  const x = safeNumber(object.x);
  const y = safeNumber(object.y);
  const width = safeNumber(object.width);
  const height = safeNumber(object.height);
  const radians = safeNumber(object.rotation) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotate = (pointX, pointY) => ({
    x: x + pointX * cos - pointY * sin,
    y: y + pointX * sin + pointY * cos,
  });

  return [
    rotate(0, 0),
    rotate(width, 0),
    rotate(width, height),
    rotate(0, height),
    rotate(width / 2, height / 2),
  ];
}

function getObjectSnapCandidates(object) {
  const x = safeNumber(object.x);
  const y = safeNumber(object.y);
  const width = safeNumber(object.width);
  const height = safeNumber(object.height);
  const radians = safeNumber(object.rotation) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotate = (pointX, pointY, priority = 1) => ({
    x: x + pointX * cos - pointY * sin,
    y: y + pointX * sin + pointY * cos,
    priority,
  });

  return [
    rotate(width / 2, 0, 0),
    rotate(width / 2, height, 0),
    rotate(0, height / 2, 0),
    rotate(width, height / 2, 0),
    rotate(width / 2, height / 2, 1),
    rotate(0, 0, 2),
    rotate(width, 0, 2),
    rotate(width, height, 2),
    rotate(0, height, 2),
  ];
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function isPointNearRoomWall(point, room, tolerance = 0.25) {
  const polygon = getRoomPolygonPoints(room);
  return polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    return distanceToSegment(point, start, end) <= tolerance;
  });
}

function isVerticalSurfaceObject(type) {
  return ['window', 'curtain', 'door'].includes(type);
}

function isWallMountedSketchObject(object) {
  return Boolean(object?.productId) || isVerticalSurfaceObject(object?.type);
}

function getWallSnapFromMount(wallMount, room, objectWidth = 0) {
  const polygon = getRoomPolygonPoints(room);
  const wallIndex = Number.isInteger(wallMount?.wallIndex) ? wallMount.wallIndex : -1;
  const start = polygon[wallIndex];
  const end = polygon[(wallIndex + 1) % polygon.length];
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const wallLength = Math.hypot(dx, dy);
  if (wallLength <= 0) return null;

  const margin = objectWidth > 0 && wallLength > objectWidth ? objectWidth / (2 * wallLength) : 0;
  const t = clamp(safeNumber(wallMount.t, 0.5), margin, 1 - margin);
  const tangent = { x: dx / wallLength, y: dy / wallLength };
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };

  return {
    wallIndex,
    t,
    distance: 0,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
    x: projected.x - tangent.x * objectWidth / 2,
    y: projected.y - tangent.y * objectWidth / 2,
  };
}

function getNearestWallSnap(object, room, objectWidth = 0, maxDistance = Infinity) {
  const polygon = getRoomPolygonPoints(room);
  const candidates = getObjectSnapCandidates(object);
  let bestSnap = null;

  polygon.forEach((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const wallLength = Math.hypot(dx, dy);
    if (wallLength <= 0) return;

    candidates.forEach((candidate) => {
      const rawT = ((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / (wallLength * wallLength);
      const margin = objectWidth > 0 && wallLength > objectWidth ? objectWidth / (2 * wallLength) : 0;
      const t = clamp(rawT, margin, 1 - margin);
      const projected = {
        x: start.x + dx * t,
        y: start.y + dy * t,
      };
      const distance = Math.hypot(candidate.x - projected.x, candidate.y - projected.y);
      const isBetter = !bestSnap
        || distance < bestSnap.distance - 0.001
        || (Math.abs(distance - bestSnap.distance) <= 0.001 && candidate.priority < bestSnap.candidatePriority);

      if (!isBetter) return;
      const tangent = { x: dx / wallLength, y: dy / wallLength };
      bestSnap = {
        wallIndex: index,
        t,
        distance,
        candidatePriority: candidate.priority,
        angle: Math.atan2(dy, dx) * 180 / Math.PI,
        x: projected.x - tangent.x * objectWidth / 2,
        y: projected.y - tangent.y * objectWidth / 2,
      };
    });
  });

  if (bestSnap && bestSnap.distance > maxDistance) return null;
  return bestSnap;
}

function getSnapOnExistingWall(object, room, objectWidth = 0, maxDistance = Infinity) {
  const wallIndex = Number.isInteger(object?.wallMount?.wallIndex) ? object.wallMount.wallIndex : -1;
  const polygon = getRoomPolygonPoints(room);
  const start = polygon[wallIndex];
  const end = polygon[(wallIndex + 1) % polygon.length];
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const wallLength = Math.hypot(dx, dy);
  if (wallLength <= 0) return null;

  const center = {
    x: safeNumber(object.x) + objectWidth / 2,
    y: safeNumber(object.y) + safeNumber(object.height) / 2,
  };
  const rawT = ((center.x - start.x) * dx + (center.y - start.y) * dy) / (wallLength * wallLength);
  const margin = objectWidth > 0 && wallLength > objectWidth ? objectWidth / (2 * wallLength) : 0;
  const t = clamp(rawT, margin, 1 - margin);
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
  const distance = Math.hypot(center.x - projected.x, center.y - projected.y);
  if (distance > maxDistance) return null;

  const tangent = { x: dx / wallLength, y: dy / wallLength };
  return {
    wallIndex,
    t,
    distance,
    angle: Math.atan2(dy, dx) * 180 / Math.PI,
    x: projected.x - tangent.x * objectWidth / 2,
    y: projected.y - tangent.y * objectWidth / 2,
  };
}

function getPreferredWallSnap(object, room, objectWidth = 0, maxDistance = Infinity) {
  return getSnapOnExistingWall(object, room, objectWidth, maxDistance)
    ?? getNearestWallSnap(object, room, objectWidth, maxDistance);
}

function getDefaultSurfaceHeight(type) {
  if (type === 'window') return 1.2;
  if (type === 'curtain') return 2.4;
  if (type === 'door') return 2.1;
  if (type === 'cabinet') return 1.8;
  if (type === 'plant') return 1.1;
  return 0;
}

function getDefaultSurfaceBottom(type) {
  if (type === 'window') return 0.9;
  return 0;
}

function getFirstVariantKey(definition) {
  return Object.keys(definition?.variants ?? {})[0];
}

function getObjectDefinitionKey(object) {
  if (!object) return '';
  if (object.objectType === 'seating' || object.type === 'seating' || object.type === 'sofa') return 'seating';
  if (object.objectType === 'diningSet' || object.type === 'diningSet' || object.type === 'table') return 'diningSet';
  if (object.type === 'tv-cabinet') return 'tvCabinet';
  if (objectChoiceDefinitions[object.type]) return object.type;
  return '';
}

function getObjectVariantKey(definitionKey, object) {
  const definition = objectChoiceDefinitions[definitionKey];
  if (!definition) return '';
  if (object?.objectVariant && definition.variants[object.objectVariant]) return object.objectVariant;
  if (definitionKey === 'seating' && object?.type === 'sofa') return 'threeSeater';
  if (definitionKey === 'diningSet' && object?.type === 'table') return 'rectangular4';
  return getFirstVariantKey(definition);
}

function getVariantDimensions(definitionKey, variantKey, object = null) {
  const definition = objectChoiceDefinitions[definitionKey];
  const preset = definition?.variants?.[variantKey] ?? {};
  const dimensions = object?.dimensions ?? {};

  if (definitionKey === 'seating') {
    if (variantKey === 'cornerSofa') {
      return {
        longSideCm: dimensions.longSideCm ?? objectMetersToCm(object?.width, preset.longSideCm),
        shortSideCm: dimensions.shortSideCm ?? objectMetersToCm(object?.height, preset.shortSideCm),
        depthCm: dimensions.depthCm ?? preset.depthCm,
      };
    }
    return {
      widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
      depthCm: dimensions.depthCm ?? objectMetersToCm(object?.height, preset.depthCm),
    };
  }

  if (definitionKey === 'diningSet') {
    if (variantKey === 'round4') {
      return {
        diameterCm: dimensions.diameterCm ?? preset.diameterCm,
        chairWidthCm: dimensions.chairWidthCm ?? preset.chairWidthCm,
        chairDepthCm: dimensions.chairDepthCm ?? preset.chairDepthCm,
      };
    }
    return {
      lengthCm: dimensions.lengthCm ?? preset.lengthCm,
      widthCm: dimensions.widthCm ?? preset.widthCm,
      chairWidthCm: dimensions.chairWidthCm ?? preset.chairWidthCm,
      chairDepthCm: dimensions.chairDepthCm ?? preset.chairDepthCm,
    };
  }

  if (definitionKey === 'curtain') {
    return {
      widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
      heightCm: dimensions.heightCm ?? objectMetersToCm(object?.surfaceHeight, preset.heightCm),
    };
  }

  if (definitionKey === 'window') {
    return {
      widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
      heightCm: dimensions.heightCm ?? objectMetersToCm(object?.surfaceHeight, preset.heightCm),
      bottomCm: dimensions.bottomCm ?? objectMetersToCm(object?.surfaceBottom, preset.bottomCm),
    };
  }

  if (definitionKey === 'door') {
    return {
      widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
      heightCm: dimensions.heightCm ?? objectMetersToCm(object?.surfaceHeight, preset.heightCm),
    };
  }

  if (definitionKey === 'cabinet') {
    return {
      widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
      depthCm: dimensions.depthCm ?? objectMetersToCm(object?.height, preset.depthCm),
      heightCm: dimensions.heightCm ?? objectMetersToCm(object?.surfaceHeight, preset.heightCm),
    };
  }

  if (definitionKey === 'plant') {
    return {
      diameterCm: dimensions.diameterCm ?? objectMetersToCm(object?.width, preset.diameterCm),
      heightCm: dimensions.heightCm ?? objectMetersToCm(object?.surfaceHeight, preset.heightCm),
    };
  }

  return {
    widthCm: dimensions.widthCm ?? objectMetersToCm(object?.width, preset.widthCm),
    depthCm: dimensions.depthCm ?? objectMetersToCm(object?.height, preset.depthCm),
  };
}

function getObjectChoiceFields(definitionKey, variantKey) {
  if (definitionKey === 'seating') {
    return variantKey === 'cornerSofa'
      ? [
        { key: 'longSideCm', label: 'Lengte lange zijde' },
        { key: 'shortSideCm', label: 'Lengte korte zijde' },
        { key: 'depthCm', label: 'Diepte van de bank' },
      ]
      : [
        { key: 'widthCm', label: variantKey === 'armchair' ? 'Breedte fauteuil' : 'Breedte van de bank' },
        { key: 'depthCm', label: variantKey === 'armchair' ? 'Diepte fauteuil' : 'Diepte van de bank' },
      ];
  }

  if (definitionKey === 'diningSet') {
    return variantKey === 'round4'
      ? [
        { key: 'diameterCm', label: 'Diameter tafel' },
        { key: 'chairWidthCm', label: 'Breedte stoel' },
        { key: 'chairDepthCm', label: 'Diepte stoel' },
      ]
      : [
        { key: 'lengthCm', label: 'Lengte tafel' },
        { key: 'widthCm', label: 'Breedte tafel' },
        { key: 'chairWidthCm', label: 'Breedte stoel' },
        { key: 'chairDepthCm', label: 'Diepte stoel' },
      ];
  }

  if (definitionKey === 'curtain') {
    return [
      { key: 'widthCm', label: 'Breedte gordijn' },
      { key: 'heightCm', label: 'Hoogte gordijn' },
    ];
  }

  if (definitionKey === 'window') {
    return [
      { key: 'widthCm', label: 'Breedte raam' },
      { key: 'heightCm', label: 'Hoogte raam' },
      { key: 'bottomCm', label: 'Begint boven vloer' },
    ];
  }

  if (definitionKey === 'door') {
    return [
      { key: 'widthCm', label: 'Breedte deur' },
      { key: 'heightCm', label: 'Hoogte deur' },
    ];
  }

  if (definitionKey === 'cabinet') {
    return [
      { key: 'widthCm', label: 'Breedte kast' },
      { key: 'depthCm', label: 'Diepte kast' },
      { key: 'heightCm', label: 'Hoogte kast' },
    ];
  }

  if (definitionKey === 'plant') {
    return [
      { key: 'diameterCm', label: 'Diameter plant' },
      { key: 'heightCm', label: 'Hoogte plant' },
    ];
  }

  return [
    { key: 'widthCm', label: 'Breedte' },
    { key: 'depthCm', label: 'Diepte' },
  ];
}

function getObjectFootprint(definitionKey, variantKey, dimensions) {
  if (definitionKey === 'seating') {
    if (variantKey === 'cornerSofa') {
      return {
        width: cmToMeters(dimensions.longSideCm, seatingPresets.cornerSofa.longSideCm),
        height: cmToMeters(dimensions.shortSideCm, seatingPresets.cornerSofa.shortSideCm),
      };
    }
    return {
      width: cmToMeters(dimensions.widthCm, seatingPresets[variantKey]?.widthCm),
      height: cmToMeters(dimensions.depthCm, seatingPresets[variantKey]?.depthCm),
    };
  }

  if (definitionKey === 'diningSet') {
    const chairDepth = safeNumber(dimensions.chairDepthCm, diningPresets[variantKey]?.chairDepthCm);
    if (variantKey === 'round4') {
      const total = safeNumber(dimensions.diameterCm, diningPresets.round4.diameterCm) + chairDepth * 2;
      return { width: cmToMeters(total), height: cmToMeters(total) };
    }
    return {
      width: cmToMeters(safeNumber(dimensions.lengthCm, diningPresets[variantKey]?.lengthCm) + chairDepth * 2),
      height: cmToMeters(safeNumber(dimensions.widthCm, diningPresets[variantKey]?.widthCm) + chairDepth * 2),
    };
  }

  if (definitionKey === 'curtain') {
    return { width: cmToMeters(dimensions.widthCm, 240), height: 0.18 };
  }

  if (definitionKey === 'window') {
    return { width: cmToMeters(dimensions.widthCm, 160), height: 0.16 };
  }

  if (definitionKey === 'door') {
    return { width: cmToMeters(dimensions.widthCm, 90), height: 0.18 };
  }

  if (definitionKey === 'plant') {
    const diameter = cmToMeters(dimensions.diameterCm, 60);
    return { width: diameter, height: diameter };
  }

  return {
    width: cmToMeters(dimensions.widthCm, 100),
    height: cmToMeters(dimensions.depthCm, 60),
  };
}

function createConfigurableSketchObject({ definitionKey, variantKey, dimensions, room, existingObject = null }) {
  const definition = objectChoiceDefinitions[definitionKey];
  const variant = definition?.variants?.[variantKey];
  const footprint = getObjectFootprint(definitionKey, variantKey, dimensions);
  const baseObject = existingObject ?? {};
  const surfaceHeight = definitionKey === 'curtain' || definitionKey === 'window' || definitionKey === 'door' || definitionKey === 'cabinet' || definitionKey === 'plant'
    ? cmToMeters(dimensions.heightCm, variant?.heightCm)
    : safeNumber(baseObject.surfaceHeight);
  const surfaceBottom = definitionKey === 'window'
    ? cmToMeters(dimensions.bottomCm, variant?.bottomCm)
    : safeNumber(baseObject.surfaceBottom);
  const isNewWallObject = !existingObject && ['curtain', 'window', 'door'].includes(definition.objectType);

  return normalizeObject({
    ...baseObject,
    id: baseObject.id ?? crypto.randomUUID(),
    type: definition.objectType,
    objectType: definition.objectType,
    objectVariant: variantKey,
    label: variant?.label ?? definition.toolLabel,
    dimensions,
    acousticCategory: definition.acousticCategory,
    visualStyle: definitionKey === 'curtain' ? 'pleated' : baseObject.visualStyle,
    tableShape: variant?.tableShape,
    chairs: variant?.chairs,
    x: baseObject.x ?? rounded(Math.max(0.2, room.lengthMeters / 2 - footprint.width / 2)),
    y: baseObject.y ?? (isNewWallObject ? 0 : rounded(Math.max(0.2, room.widthMeters / 2 - footprint.height / 2))),
    width: footprint.width,
    height: footprint.height,
    rotation: safeNumber(baseObject.rotation),
    materialType: definition.materialType,
    absorptionFactor: definition.nrc,
    nrc: definition.nrc,
    surfaceHeight,
    surfaceBottom,
    wallMount: undefined,
    isAcousticElement: false,
  }, room);
}

function normalizeObject(object, room) {
  const safeRoom = normalizeRoom(room);
  const product = object.productId ? acousticProducts.find((item) => item.id === object.productId) : null;
  const width = Math.max(0.15, safeNumber(object.width, 0.15));
  const productDepth = product?.planDepthMeters ?? 0.04;
  const productHeight = Math.abs(safeNumber(object.height) - safeNumber(product?.heightMeters)) < 0.01
    ? productDepth
    : object.height;
  const height = product
    ? Math.max(productDepth, safeNumber(productHeight, productDepth))
    : Math.max(0.15, safeNumber(object.height, 0.15));
  const hasAdjustableSurfaceHeight = isVerticalSurfaceObject(object.type) || object.type === 'cabinet' || object.type === 'plant';
  const surfaceHeight = hasAdjustableSurfaceHeight
    ? Math.max(0.1, safeNumber(object.surfaceHeight, getDefaultSurfaceHeight(object.type)))
    : safeNumber(object.surfaceHeight, product?.heightMeters ?? 0);
  const maxSurfaceBottom = Math.max(0, safeRoom.heightMeters - surfaceHeight);
  const surfaceBottom = isVerticalSurfaceObject(object.type)
    ? clamp(safeNumber(object.surfaceBottom, getDefaultSurfaceBottom(object.type)), 0, maxSurfaceBottom)
    : safeNumber(object.surfaceBottom);
  const rotation = snapRotation(object.rotation);
  const rotatedBounds = getRotatedObjectBounds(width, height, rotation);
  const minX = -rotatedBounds.minX;
  const maxX = safeRoom.lengthMeters - rotatedBounds.maxX;
  const minY = -rotatedBounds.minY;
  const maxY = safeRoom.widthMeters - rotatedBounds.maxY;

  return {
    ...object,
    width: rounded(width),
    height: rounded(height),
    surfaceHeight: rounded(surfaceHeight),
    surfaceBottom: rounded(surfaceBottom),
    x: rounded(clamp(safeNumber(object.x), Math.min(minX, maxX), Math.max(minX, maxX))),
    y: rounded(clamp(safeNumber(object.y), Math.min(minY, maxY), Math.max(minY, maxY))),
    rotation,
    wallMount: undefined,
    nrc: product ? product.acousticValuePerM2 : safeNumber(object.nrc ?? object.absorptionFactor),
    absorptionFactor: product ? product.acousticValuePerM2 : safeNumber(object.absorptionFactor ?? object.nrc),
    sabins: product ? getProductSabins(product) : object.sabins,
  };
}

function isObjectFullyOutside(object, room) {
  return getObjectPoints(object).every((point) => !pointInRoom(point, room));
}

function isWallObjectNearWall(object, room) {
  return getObjectPoints(object).some((point) => isPointNearRoomWall(point, room));
}

function getObjectWarningLabel(object) {
  return object.label || object.type || 'Object';
}

function getObjectWarningLabels(objects) {
  const totals = objects.reduce((counts, object) => {
    const label = getObjectWarningLabel(object);
    return { ...counts, [label]: (counts[label] ?? 0) + 1 };
  }, {});
  const seen = {};

  return objects.map((object) => {
    const label = getObjectWarningLabel(object);
    seen[label] = (seen[label] ?? 0) + 1;
    return totals[label] > 1 ? `${label} ${seen[label]}` : label;
  });
}

function createSketchWarning(id, message, objects = []) {
  const objectLabels = getObjectWarningLabels(objects);
  return {
    id,
    message,
    objectIds: objects.map((object) => object.id),
    objectLabels,
  };
}

function formatWarningObjects(objects) {
  return getObjectWarningLabels(objects).join(', ');
}

function getSketchWarnings(room, objects) {
  const safeRoom = normalizeRoom(room);
  const warnings = [];

  if (safeRoom.lengthMeters <= 0 || safeRoom.widthMeters <= 0 || safeRoom.heightMeters <= 0) {
    warnings.push(createSketchWarning('invalid-room-size', 'Vul lengte, breedte en hoogte groter dan 0 in om de ruimte te tekenen.'));
  }

  if (objects.length === 0) {
    warnings.push(createSketchWarning('empty-sketch', 'De tekening is nog onvolledig: voeg minimaal enkele interieur-objecten of akoestische elementen toe.'));
  }

  const outsideObjects = objects.filter((object) => isObjectFullyOutside(object, safeRoom));
  if (outsideObjects.length > 0) {
    warnings.push(createSketchWarning(
      'outside-objects',
      `Deze objecten staan volledig buiten de ruimte: ${formatWarningObjects(outsideObjects)}. Plaats ze binnen de plattegrond.`,
      outsideObjects,
    ));
  }

  const partiallyOutsideObjects = objects.filter((object) => !isObjectFullyOutside(object, safeRoom)
    && getObjectPoints(object).some((point) => !pointInRoom(point, safeRoom)));
  if (partiallyOutsideObjects.length > 0) {
    warnings.push(createSketchWarning(
      'partial-outside-objects',
      `Deze objecten overlappen de hoekuitsparing: ${formatWarningObjects(partiallyOutsideObjects)}. Versleep of verklein ze zodat ze binnen de ruimte passen.`,
      partiallyOutsideObjects,
    ));
  }

  const detachedWallObjects = objects.filter((object) => ['window', 'door'].includes(object.type) && !isWallObjectNearWall(object, safeRoom));
  if (detachedWallObjects.length > 0) {
    warnings.push(createSketchWarning(
      'detached-wall-objects',
      `Deze ramen of deuren staan niet tegen een wand: ${formatWarningObjects(detachedWallObjects)}. Verplaats ze naar de rand van de ruimte.`,
      detachedWallObjects,
    ));
  }

  return warnings;
}

function createSketchObject(preset, room) {
  const isProduct = Boolean(preset.productId);
  return normalizeObject({
    id: crypto.randomUUID(),
    type: preset.type,
    label: preset.label,
    x: rounded(Math.max(0.2, room.lengthMeters / 2 - preset.width / 2)),
    y: isProduct ? 0 : rounded(Math.max(0.2, room.widthMeters / 2 - preset.height / 2)),
    width: preset.width,
    height: preset.height,
    rotation: 0,
    materialType: preset.materialType,
    absorptionFactor: preset.nrc,
    nrc: preset.nrc,
    sabins: preset.sabins,
    surfaceHeight: preset.surfaceHeight,
    surfaceBottom: preset.surfaceBottom,
    productId: preset.productId,
    placementType: preset.placementType,
    category: preset.category,
    isAcousticElement: preset.isAcousticElement,
    articleNumber: preset.articleNumber,
    artist: preset.artist,
    color: preset.color,
    imageUrl: preset.imageUrl,
    productUrl: preset.productUrl,
    wallMount: undefined,
  }, room);
}

function getObjectColor(type) {
  if (type === 'diningSet') return '#d8c7a5';
  if (type === 'seating') return '#9aa9b5';
  return objectPresets.find((preset) => preset.type === type)?.fill ?? '#d8d8d8';
}

function getObjectArea(object) {
  return safeNumber(object.width) * safeNumber(object.height);
}

function getObjectSurfaceArea(object) {
  if (isVerticalSurfaceObject(object.type)) {
    return safeNumber(object.width) * safeNumber(object.surfaceHeight, getDefaultSurfaceHeight(object.type));
  }
  return getObjectArea(object);
}

function getFriendlyBarometerLevel(reverbTime) {
  if (!Number.isFinite(reverbTime) || reverbTime <= 0) return barometerLevels[2];
  if (reverbTime <= 0.62) return barometerLevels[0];
  if (reverbTime <= 0.75) return barometerLevels[1];
  if (reverbTime <= 0.9) return barometerLevels[2];
  if (reverbTime <= 1.05) return barometerLevels[3];
  return barometerLevels[4];
}

function getBarometerAdviceText(artworkCount, newLevel) {
  if (artworkCount === 1) {
    return 'Met één akoestisch kunstwerk voeg je een eerste zachte zone toe. Vooral bij een kale wand of zithoek kan dit al merkbaar meer comfort geven.';
  }

  if (artworkCount > 1 && newLevel.id !== 'balanced' && newLevel.id !== 'quiet-comfort') {
    return 'Door meerdere kunstwerken goed te verdelen, ontstaat meer rust en balans. Geluid voelt zachter en gesprekken worden prettiger.';
  }

  return '';
}

function getImprovedBarometerLevel(currentLevel, artworkCount) {
  const currentIndex = barometerLevels.findIndex((level) => level.id === currentLevel.id);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 2;
  const improvementSteps = artworkCount >= 6
    ? 4
    : artworkCount >= 4
      ? 3
      : artworkCount >= 2
        ? 2
        : artworkCount >= 1
          ? 1
          : 0;

  return barometerLevels[Math.max(0, safeCurrentIndex - improvementSteps)];
}

function getObjectAbsorptionEstimate(object) {
  if (object.productId) {
    const product = acousticProducts.find((item) => item.id === object.productId);
    return product ? getProductSabins(product) : safeNumber(object.sabins);
  }
  return getObjectSurfaceArea(object) * safeNumber(object.nrc ?? object.absorptionFactor);
}

function getArtworkStats(objects) {
  const artworks = objects.filter((object) => object.productId);
  const counts = artworks.reduce((acc, object) => {
    acc[object.label] = (acc[object.label] || 0) + 1;
    return acc;
  }, {});
  const items = Object.entries(counts).map(([label, count]) => ({
    label: label.replace('Akoestisch kunstwerk ', ''),
    count,
  }));
  return {
    count: artworks.length,
    sabins: artworks.reduce((sum, object) => sum + getObjectAbsorptionEstimate(object), 0),
    items,
    label: items.map((item) => `${item.count}x ${item.label}`).join(' + ') || 'Nog geen kunstwerken geplaatst',
  };
}

function getSoftElementComfortAdjustment(objects) {
  const softArea = objects
    .filter((object) => ['seating', 'sofa', 'curtain', 'rug'].includes(object.type))
    .reduce((sum, object) => sum + getObjectSurfaceArea(object), 0);

  if (softArea >= 10) return 0.2;
  if (softArea >= 5) return 0.14;
  if (softArea >= 2) return 0.08;
  return 0;
}

function getBarometerData({ calculation, objects, currentReverbTime }) {
  const baseRt = safeNumber(calculation.effectiveCurrentReverbTime, safeNumber(currentReverbTime, 1.2));
  const artworkStats = getArtworkStats(objects);
  const adjustedBaseRt = Math.max(0.55, baseRt - getSoftElementComfortAdjustment(objects));
  const currentLevel = getFriendlyBarometerLevel(adjustedBaseRt);
  const newLevel = getImprovedBarometerLevel(currentLevel, artworkStats.count);

  return {
    currentLevel,
    newLevel,
    artworkStats,
    adviceText: getBarometerAdviceText(artworkStats.count, newLevel),
  };
}

export function calculateRoomFromSketch(sketchData, options = {}) {
  const room = sketchData?.room ?? {};
  const objects = Array.isArray(sketchData?.objects) ? sketchData.objects : [];
  const lengthMeters = safeNumber(room.lengthMeters);
  const widthMeters = safeNumber(room.widthMeters);
  const heightMeters = safeNumber(room.heightMeters);
  const floorAreaM2 = getRoomFloorArea(room);
  const volumeM3 = floorAreaM2 * heightMeters;
  const ceilingAreaM2 = floorAreaM2;
  const wallAreaM2 = 2 * (lengthMeters + widthMeters) * heightMeters;

  const areaByType = (type) => objects
    .filter((object) => object.type === type)
    .reduce((sum, object) => sum + getObjectSurfaceArea(object), 0);

  const glassAreaM2 = areaByType('window');
  const curtainAreaM2 = areaByType('curtain');
  const doorAreaM2 = areaByType('door');
  const carpetAreaM2 = areaByType('rug');
  const furnitureAbsorptionEstimate = objects
    .filter((object) => ['table', 'chair', 'sofa', 'seating', 'diningSet', 'cabinet', 'tv-cabinet'].includes(object.type))
    .reduce((sum, object) => sum + getObjectAbsorptionEstimate(object), 0);
  const acousticElementAbsorption = objects
    .filter((object) => object.isAcousticElement)
    .reduce((sum, object) => sum + getObjectAbsorptionEstimate(object), 0);

  const existingAbsorptionEstimate = (
    glassAreaM2 * 0.03
    + curtainAreaM2 * 0.35
    + doorAreaM2 * 0.08
    + carpetAreaM2 * 0.22
    + furnitureAbsorptionEstimate
    + acousticElementAbsorption
  );
  const availableWallAreaM2 = Math.max(0, wallAreaM2 - glassAreaM2 - doorAreaM2 - curtainAreaM2);
  const currentReverbTime = safeNumber(options.currentReverbTime, 1.5);
  const targetReverbTime = safeNumber(options.targetReverbTime, 0.9);
  const selectedNRC = safeNumber(options.selectedNRC, 0.65);
  const floorProfile = getFloorProfile(room.floorType);
  const floorAbsorptionEstimate = floorAreaM2 * safeNumber(floorProfile?.absorption);
  const effectiveCurrentReverbTime = currentReverbTime * safeNumber(floorProfile?.rtFactor, 1);
  // Sabine hoofdformule: extra m2 vilt = ((0,16 x V / Tdoel) - (0,16 x V / Thuidig)) / NRC.
  const requiredFeltM2 = effectiveCurrentReverbTime > 0 && targetReverbTime > 0 && selectedNRC > 0
    ? Math.max(0, ((0.16 * volumeM3 / targetReverbTime) - (0.16 * volumeM3 / effectiveCurrentReverbTime)) / selectedNRC)
    : 0;
  const recommendedFeltM2 = requiredFeltM2;

  return {
    volumeM3,
    floorAreaM2,
    ceilingAreaM2,
    wallAreaM2,
    glassAreaM2,
    curtainAreaM2,
    doorAreaM2,
    carpetAreaM2,
    floorType: floorProfile?.id,
    floorLabel: floorProfile?.label,
    floorAbsorptionEstimate,
    effectiveCurrentReverbTime,
    furnitureAbsorptionEstimate,
    availableWallAreaM2,
    existingAbsorptionEstimate: existingAbsorptionEstimate + floorAbsorptionEstimate,
    recommendedFeltM2,
    requiredFeltM2,
  };
}

function SketchNumberField({ label, value, onChange, suffix, step = '0.1' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="fieldInput">
        <input
          type="number"
          value={value ?? ''}
          step={step}
          onChange={(event) => onChange(parseNumberInput(event.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function RoomSketchModal({ open, room, onUpdateRoom, onClose }) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="flowModal roomSketchModal" role="dialog" aria-modal="true" aria-labelledby="room-sketch-modal-title">
        <div className="modalHeader">
          <span>Stap 2</span>
          <h2 id="room-sketch-modal-title">Uitgebreide ruimte-schets</h2>
          <p>Vul kort de basis van je ruimte in. Daarna kun je jouw ruimte tekenen en zien wat er verandert.</p>
        </div>

        <div className="formRow three">
          <SketchNumberField label="Lengte ruimte" value={room.lengthMeters} onChange={(value) => onUpdateRoom({ lengthMeters: value })} suffix="m" />
          <SketchNumberField label="Breedte ruimte" value={room.widthMeters} onChange={(value) => onUpdateRoom({ widthMeters: value })} suffix="m" />
          <SketchNumberField label="Hoogte ruimte" value={room.heightMeters} onChange={(value) => onUpdateRoom({ heightMeters: value })} suffix="m" />
        </div>

        <div className="formRow three">
          <label className="field">
            <span>Type ruimte</span>
            <select value={room.type} onChange={(event) => onUpdateRoom({ type: event.target.value })}>
              {roomTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Vloer</span>
            <select value={room.floorType} onChange={(event) => onUpdateRoom({ floorType: event.target.value })}>
              {floorOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ruimtevorm</span>
            <select value={room.shape} onChange={(event) => onUpdateRoom({ shape: event.target.value })}>
              {roomShapeOptions.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>

        {room.shape === 'l-shape' && (
          <div className="formRow three">
            <label className="field">
              <span>Hoekpositie</span>
              <select value={room.cornerPosition} onChange={(event) => onUpdateRoom({ cornerPosition: event.target.value })}>
                {cornerPositions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <SketchNumberField label="Hoek breedte" value={room.cornerWidthMeters} onChange={(value) => onUpdateRoom({ cornerWidthMeters: value })} suffix="m" />
            <SketchNumberField label="Hoek diepte" value={room.cornerDepthMeters} onChange={(value) => onUpdateRoom({ cornerDepthMeters: value })} suffix="m" />
          </div>
        )}

        <div className="modalActions">
          <button className="primaryButton" type="button" onClick={onClose}>
            Naar het vloerplan
          </button>
        </div>
      </section>
    </div>
  );
}

function getArtworkSizeLabel(preset) {
  return `${Math.round(safeNumber(preset.width) * 100)} x ${Math.round(safeNumber(preset.surfaceHeight) * 100)} cm`;
}

function groupArtworkPresetsBySize(presets) {
  const groups = presets.reduce((acc, preset) => {
    const sizeLabel = getArtworkSizeLabel(preset);
    if (!acc[sizeLabel]) {
      acc[sizeLabel] = {
        sizeLabel,
        area: safeNumber(preset.width) * safeNumber(preset.surfaceHeight),
        presets: [],
      };
    }
    acc[sizeLabel].presets.push(preset);
    return acc;
  }, {});

  return Object.values(groups).sort((a, b) => b.area - a.area);
}

function ObjectChoiceModal({ context, room, onClose, onSave, onDelete }) {
  const definition = context ? objectChoiceDefinitions[context.definitionKey] : null;
  const editingObject = context?.object ?? null;
  const defaultVariantKey = definition ? getObjectVariantKey(context.definitionKey, editingObject) : '';
  const [variantKey, setVariantKey] = useState(defaultVariantKey);
  const [dimensions, setDimensions] = useState(() => getVariantDimensions(context?.definitionKey, defaultVariantKey, editingObject));
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!context || !definition) return;
    const nextVariant = getObjectVariantKey(context.definitionKey, editingObject);
    setVariantKey(nextVariant);
    setDimensions(getVariantDimensions(context.definitionKey, nextVariant, editingObject));
    setMessage('');
  }, [context, definition, editingObject]);

  if (!context || !definition) return null;

  const variantOptions = Object.entries(definition.variants);
  const fields = getObjectChoiceFields(context.definitionKey, variantKey);
  const primaryLabel = context.mode === 'edit' ? 'Object aanpassen' : 'Plaats in ruimte';

  function changeVariant(nextVariantKey) {
    setVariantKey(nextVariantKey);
    setDimensions(getVariantDimensions(context.definitionKey, nextVariantKey, editingObject));
    setMessage('');
  }

  function updateDimension(key, value) {
    setDimensions((current) => ({ ...current, [key]: parseNumberInput(value) }));
    setMessage('');
  }

  function saveObject() {
    const invalidField = fields.find((field) => safeNumber(dimensions[field.key]) <= 0);
    if (invalidField) {
      setMessage(`Vul een geldige waarde in bij ${invalidField.label.toLowerCase()}.`);
      return;
    }

    const unusuallySmall = fields.some((field) => safeNumber(dimensions[field.key]) < 20 && field.key !== 'bottomCm');
    const unusuallyLarge = fields.some((field) => safeNumber(dimensions[field.key]) > 600);
    if (unusuallySmall) {
      setMessage('Deze maat lijkt erg klein. Controleer even of dit klopt.');
      return;
    }
    if (unusuallyLarge) {
      setMessage('Deze maat lijkt erg groot. Controleer even of dit klopt.');
      return;
    }

    onSave(createConfigurableSketchObject({
      definitionKey: context.definitionKey,
      variantKey,
      dimensions,
      room,
      existingObject: context.mode === 'edit' ? editingObject : null,
    }));
  }

  return (
    <div className="modalBackdrop objectChoiceBackdrop" role="presentation">
      <section className="flowModal objectChoiceModal" role="dialog" aria-modal="true" aria-labelledby="object-choice-title">
        <div className="modalHeader compact">
          <span>{context.mode === 'edit' ? 'Object aanpassen' : 'Object toevoegen'}</span>
          <h2 id="object-choice-title">{definition.title}</h2>
        </div>

        {variantOptions.length > 1 && (
          <div className="objectChoiceOptions">
            {variantOptions.map(([key, option]) => (
              <button
                key={key}
                type="button"
                className={key === variantKey ? 'active' : ''}
                onClick={() => changeVariant(key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="objectChoiceFields">
          {fields.map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <div className="fieldInput">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={dimensions[field.key] ?? ''}
                  onChange={(event) => updateDimension(field.key, event.target.value)}
                />
                <em>cm</em>
              </div>
            </label>
          ))}
        </div>

        {message && <p className="fieldNote warningText">{message}</p>}

        <div className="modalActions">
          {context.mode === 'edit' && (
            <button
              className="iconTextButton danger"
              type="button"
              onClick={() => onDelete?.(editingObject?.id)}
            >
              <Trash2 size={17} />
              Verwijderen
            </button>
          )}
          <button className="secondaryButton" type="button" onClick={onClose}>
            Sluiten
          </button>
          <button className="primaryButton" type="button" onClick={saveObject}>
            {primaryLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function ObjectActionModal({ object, onClose, onDelete, onDuplicate, onRotate }) {
  if (!object) return null;

  return (
    <div className="modalBackdrop objectChoiceBackdrop" role="presentation">
      <section className="flowModal objectChoiceModal" role="dialog" aria-modal="true" aria-labelledby="object-action-title">
        <div className="modalHeader compact">
          <span>Object geselecteerd</span>
          <h2 id="object-action-title">{object.label}</h2>
          <p>Sleep het object in de plattegrond om de plek te wijzigen.</p>
        </div>

        {object.productId && (
          <p className="fieldNote">
            Dit BasKoestiek kunstwerk telt mee in de barometer.
          </p>
        )}

        <div className="modalActions">
          <button className="secondaryButton" type="button" onClick={() => onRotate(object.id, -ROTATION_STEP_DEGREES)}>
            <RotateCcw size={17} />
            Links 5 graden
          </button>
          <button className="secondaryButton" type="button" onClick={() => onRotate(object.id, ROTATION_STEP_DEGREES)}>
            <RotateCw size={17} />
            Rechts 5 graden
          </button>
          <button className="secondaryButton" type="button" onClick={() => onDuplicate(object.id)}>
            <Copy size={17} />
            Dupliceren
          </button>
          <button className="iconTextButton danger" type="button" onClick={() => onDelete(object.id)}>
            <Trash2 size={17} />
            Verwijderen
          </button>
          <button className="primaryButton" type="button" onClick={onClose}>
            Sluiten
          </button>
        </div>
      </section>
    </div>
  );
}

function ObjectToolbar({ onAddObject, onOpenObjectChoice }) {
  const [selectedArtworkGroup, setSelectedArtworkGroup] = useState(null);
  const artworkPresets = objectPresets.filter((preset) => preset.productId && preset.imageUrl);
  const artworkGroups = groupArtworkPresetsBySize(artworkPresets);

  return (
    <div className="objectToolbar">
      {objectToolOrder.map((definitionKey) => (
        <button
          key={definitionKey}
          type="button"
          onClick={() => onOpenObjectChoice(definitionKey)}
        >
          <span>{objectChoiceDefinitions[definitionKey].toolLabel}</span>
        </button>
      ))}
      <details className="artworkPicker">
        <summary>Akoestische kunstwerken</summary>
        <div className="artworkSizeGrid">
          {artworkGroups.map((group) => (
            <button
              key={group.sizeLabel}
              type="button"
              className="artworkSizeButton"
              onClick={() => setSelectedArtworkGroup(group)}
            >
              <strong>{group.sizeLabel}</strong>
              <span>{group.presets.length} kunstwerken</span>
              <div className="artworkSizePreview" aria-hidden="true">
                {group.presets.slice(0, 4).map((preset) => (
                  <img key={preset.type} src={preset.imageUrl} alt="" loading="lazy" />
                ))}
              </div>
            </button>
          ))}
        </div>
      </details>

      {selectedArtworkGroup && (
        <div className="modalBackdrop artworkSelectBackdrop" role="presentation">
          <section className="flowModal artworkSelectModal" role="dialog" aria-modal="true" aria-labelledby="artwork-select-title">
            <div className="modalHeader">
              <span>Akoestisch kunstwerk</span>
              <h2 id="artwork-select-title">Kies een werk van {selectedArtworkGroup.sizeLabel}</h2>
              <p>Selecteer een kunstwerk om het in de plattegrond te plaatsen.</p>
            </div>
            <div className="artworkSelectGrid">
              {selectedArtworkGroup.presets.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  className="artworkSelectCard"
                  onClick={() => {
                    onAddObject(preset);
                    setSelectedArtworkGroup(null);
                  }}
                >
                  <img src={preset.imageUrl} alt="" loading="lazy" />
                  <strong>{preset.label}</strong>
                  {preset.articleNumber && <span>Art.nr. {preset.articleNumber}</span>}
                </button>
              ))}
            </div>
            <div className="modalActions">
              <button type="button" className="secondaryButton" onClick={() => setSelectedArtworkGroup(null)}>
                Sluiten
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function AcousticBarometer({ data, companyName = 'BasKoestiek' }) {
  const baselineScore = 7;
  const afterScore = Math.max(baselineScore, data.newLevel.score);

  return (
    <div className="acousticBarometer">
      <div className="barometerHeader">
        <div>
          <span>Voor / na comfortmeter</span>
          <h3>{data.newLevel.label}</h3>
        </div>
        <strong>{data.artworkStats.count} kunstwerken</strong>
      </div>

      <div className="barometerScale">
        <div className="barometerLabels">
          <span className="balanced">Zeer rustig</span>
          <span className="quietComfort">Rustig</span>
          <span className="comfortable">Aangenaam</span>
          <span className="moreBalance">Meer balans</span>
          <span className="lively">Levendig</span>
        </div>
        <div className="barometerTrack">
          <span className="barometerFill" style={{ height: `${afterScore}%` }} />
          <span className="barometerDot current" style={{ bottom: `${baselineScore}%` }} />
          <span className="barometerDot after" style={{ bottom: `${afterScore}%` }} />
        </div>
        <div className="barometerMarkers">
          <span className="barometerMarker current" style={{ bottom: 0 }}>
            <em>Nu</em>
            <strong>{data.currentLevel.label}</strong>
          </span>
          <span className="barometerMarker after" style={{ bottom: `${afterScore}%` }}>
            <em>Met {companyName}</em>
            <strong>{data.newLevel.label}</strong>
          </span>
        </div>
      </div>

      <div className="barometerStats">
        <div>
          <span>Huidige ruimte</span>
          <strong>{data.currentLevel.label}</strong>
        </div>
        <div>
          <span>Na advies</span>
          <strong>{data.newLevel.label}</strong>
        </div>
        <div>
          <span>BasKoestiek kunstwerken</span>
          {data.artworkStats.items?.length > 0 ? (
            <ul className="barometerArtworkList">
              {data.artworkStats.items.map((item) => (
                <li key={item.label}>
                  <strong>{item.count}x</strong>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <strong>Nog geen kunstwerken geplaatst</strong>
          )}
        </div>
      </div>
      {data.adviceText && <p className="barometerLevelText">{data.adviceText}</p>}
      <p className="barometerNote">
        De barometer laat zien hoe je ruimte nu aanvoelt en hoeveel extra comfort akoestische kunstwerken kunnen toevoegen. Het is geen technische meting, maar een duidelijke indicatie van de verwachte verbetering.
      </p>
    </div>
  );
}

function ObjectLabel({ object, width, height, light = false }) {
  return (
    <Text
      x={6}
      y={Math.max(5, height / 2 - 7)}
      width={Math.max(20, width - 12)}
      align="center"
      text={object.label}
      fontSize={Math.max(9, Math.min(12, height / 4))}
      fontStyle="bold"
      fill={light ? '#ffffff' : '#263241'}
      listening={false}
    />
  );
}

function TopDownObjectShape({ object, width, height, selected }) {
  const fill = getObjectColor(object.type);
  const stroke = selected ? '#111827' : '#ffffff';
  const darkStroke = '#263241';
  const softStroke = 'rgba(38,50,65,.45)';
  const lineWidth = Math.max(1, Math.min(2, width / 60));
  const pxPerMeterX = width / Math.max(0.01, safeNumber(object.width, 1));
  const pxPerMeterY = height / Math.max(0.01, safeNumber(object.height, 1));
  const pxX = (cm) => cmToMeters(cm) * pxPerMeterX;
  const pxY = (cm) => cmToMeters(cm) * pxPerMeterY;

  if (object.type === 'diningSet') {
    const dimensions = object.dimensions ?? {};
    const tableShape = object.tableShape ?? (object.objectVariant === 'round4' ? 'round' : 'rectangular');
    const chairWidth = Math.max(8, pxX(dimensions.chairWidthCm ?? 45));
    const chairDepth = Math.max(8, pxY(dimensions.chairDepthCm ?? 50));
    const chairFill = '#b9c7d6';
    const tableFill = '#d8c7a5';

    if (tableShape === 'round') {
      const diameter = Math.min(width - chairDepth * 2, height - chairDepth * 2, pxX(dimensions.diameterCm ?? 120));
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.max(10, diameter / 2);
      const chairs = [
        { x: cx - chairWidth / 2, y: cy - radius - chairDepth - 2, rotation: 0 },
        { x: cx + radius + 2, y: cy - chairWidth / 2, rotation: 90 },
        { x: cx - chairWidth / 2, y: cy + radius + 2, rotation: 0 },
        { x: cx - radius - chairDepth - 2, y: cy - chairWidth / 2, rotation: 90 },
      ];
      return (
        <>
          {chairs.map((chair, index) => (
            <Rect key={index} x={chair.x} y={chair.y} width={chair.rotation ? chairDepth : chairWidth} height={chair.rotation ? chairWidth : chairDepth} fill={chairFill} stroke={stroke} strokeWidth={1.2} cornerRadius={5} />
          ))}
          <Circle x={cx} y={cy} radius={radius} fill={tableFill} stroke={stroke} strokeWidth={1.5} />
          <Circle x={cx} y={cy} radius={radius * 0.72} stroke={softStroke} strokeWidth={lineWidth} />
          <ObjectLabel object={object} width={width} height={height} />
        </>
      );
    }

    const tableWidth = Math.max(18, pxX(dimensions.lengthCm ?? 160));
    const tableHeight = Math.max(14, pxY(dimensions.widthCm ?? 90));
    const tableX = (width - tableWidth) / 2;
    const tableY = (height - tableHeight) / 2;
    const chairCount = safeNumber(object.chairs, 4);
    const longSideChairs = chairCount >= 8 ? 3 : chairCount >= 6 ? 3 : 2;
    const endChairs = chairCount >= 8 ? 1 : 0;
    const chairs = [];
    for (let index = 0; index < longSideChairs; index += 1) {
      const x = tableX + tableWidth * ((index + 1) / (longSideChairs + 1)) - chairWidth / 2;
      chairs.push({ x, y: tableY - chairDepth - 3, width: chairWidth, height: chairDepth });
      chairs.push({ x, y: tableY + tableHeight + 3, width: chairWidth, height: chairDepth });
    }
    if (chairCount === 4) {
      chairs.splice(2);
      chairs.push({ x: tableX - chairDepth - 3, y: tableY + tableHeight / 2 - chairWidth / 2, width: chairDepth, height: chairWidth });
      chairs.push({ x: tableX + tableWidth + 3, y: tableY + tableHeight / 2 - chairWidth / 2, width: chairDepth, height: chairWidth });
    } else if (endChairs) {
      chairs.push({ x: tableX - chairDepth - 3, y: tableY + tableHeight / 2 - chairWidth / 2, width: chairDepth, height: chairWidth });
      chairs.push({ x: tableX + tableWidth + 3, y: tableY + tableHeight / 2 - chairWidth / 2, width: chairDepth, height: chairWidth });
    }

    return (
      <>
        {chairs.map((chair, index) => (
          <Rect key={index} {...chair} fill={chairFill} stroke={stroke} strokeWidth={1.2} cornerRadius={5} />
        ))}
        <Rect x={tableX} y={tableY} width={tableWidth} height={tableHeight} fill={tableFill} stroke={stroke} strokeWidth={1.5} cornerRadius={8} />
        <Rect x={tableX + tableWidth * 0.06} y={tableY + tableHeight * 0.12} width={tableWidth * 0.88} height={tableHeight * 0.76} stroke={softStroke} strokeWidth={lineWidth} cornerRadius={5} />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'seating') {
    const dimensions = object.dimensions ?? {};
    const cushionFill = '#7f909d';

    if (object.objectVariant === 'cornerSofa') {
      const depthX = Math.max(14, pxX(dimensions.depthCm ?? 95));
      const depthY = Math.max(14, pxY(dimensions.depthCm ?? 95));
      return (
        <>
          <Rect x={0} y={0} width={width} height={depthY} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={12} />
          <Rect x={0} y={0} width={depthX} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={12} />
          <Rect x={width * 0.08} y={depthY * 0.18} width={width * 0.84} height={depthY * 0.42} fill={cushionFill} cornerRadius={8} />
          <Rect x={depthX * 0.18} y={height * 0.08} width={depthX * 0.42} height={height * 0.84} fill={cushionFill} cornerRadius={8} />
          <ObjectLabel object={object} width={width} height={height} />
        </>
      );
    }

    const isArmchair = object.objectVariant === 'armchair';
    const cushionCount = isArmchair ? 1 : object.objectVariant === 'twoSeater' ? 2 : 3;
    return (
      <>
        <Rect x={0} y={height * 0.08} width={width} height={height * 0.84} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={isArmchair ? 14 : 12} />
        <Rect x={width * 0.05} y={height * 0.12} width={width * 0.9} height={height * 0.22} fill={cushionFill} cornerRadius={8} />
        <Rect x={width * 0.04} y={height * 0.28} width={width * 0.14} height={height * 0.54} fill={cushionFill} cornerRadius={8} />
        <Rect x={width * 0.82} y={height * 0.28} width={width * 0.14} height={height * 0.54} fill={cushionFill} cornerRadius={8} />
        {Array.from({ length: Math.max(1, cushionCount - 1) }, (_, index) => {
          const ratio = (index + 1) / cushionCount;
          return <Line key={ratio} points={[width * ratio, height * 0.34, width * ratio, height * 0.82]} stroke="#ffffff" strokeWidth={lineWidth} />;
        })}
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'table') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={8} />
        <Rect x={width * 0.08} y={height * 0.12} width={width * 0.84} height={height * 0.76} stroke={softStroke} strokeWidth={lineWidth} cornerRadius={6} />
        <Line points={[width / 2, height * 0.14, width / 2, height * 0.86]} stroke={softStroke} strokeWidth={lineWidth} />
        {[
          [width * 0.18, height * 0.22],
          [width * 0.82, height * 0.22],
          [width * 0.18, height * 0.78],
          [width * 0.82, height * 0.78],
        ].map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} x={cx} y={cy} radius={Math.max(2, Math.min(width, height) * 0.045)} fill="#8d7858" />
        ))}
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'chair') {
    return (
      <>
        <Rect x={width * 0.14} y={height * 0.22} width={width * 0.72} height={height * 0.62} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={5} />
        <Rect x={width * 0.12} y={height * 0.08} width={width * 0.76} height={height * 0.18} fill="#8798aa" stroke={darkStroke} strokeWidth={lineWidth} cornerRadius={4} />
        <Line points={[width * 0.24, height * 0.86, width * 0.24, height * 0.98]} stroke={darkStroke} strokeWidth={lineWidth} />
        <Line points={[width * 0.76, height * 0.86, width * 0.76, height * 0.98]} stroke={darkStroke} strokeWidth={lineWidth} />
      </>
    );
  }

  if (object.type === 'sofa') {
    return (
      <>
        <Rect x={0} y={height * 0.08} width={width} height={height * 0.84} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={12} />
        <Rect x={width * 0.05} y={height * 0.12} width={width * 0.9} height={height * 0.22} fill="#7f909d" cornerRadius={8} />
        <Rect x={width * 0.04} y={height * 0.28} width={width * 0.14} height={height * 0.54} fill="#7f909d" cornerRadius={8} />
        <Rect x={width * 0.82} y={height * 0.28} width={width * 0.14} height={height * 0.54} fill="#7f909d" cornerRadius={8} />
        <Line points={[width * 0.36, height * 0.34, width * 0.36, height * 0.82]} stroke="#ffffff" strokeWidth={lineWidth} />
        <Line points={[width * 0.64, height * 0.34, width * 0.64, height * 0.82]} stroke="#ffffff" strokeWidth={lineWidth} />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'cabinet') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={5} />
        <Rect x={width * 0.04} y={height * 0.12} width={width * 0.92} height={height * 0.76} fill="#d3bf9d" stroke={softStroke} strokeWidth={lineWidth} cornerRadius={3} />
        <Line points={[width * 0.5, height * 0.13, width * 0.5, height * 0.87]} stroke={softStroke} strokeWidth={lineWidth} />
        <Circle x={width * 0.45} y={height * 0.5} radius={Math.max(2, height * 0.045)} fill="#6f5b3e" />
        <Circle x={width * 0.55} y={height * 0.5} radius={Math.max(2, height * 0.045)} fill="#6f5b3e" />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'tv') {
    return (
      <>
        <Rect x={0} y={height * 0.08} width={width} height={height * 0.84} fill="#182232" stroke={stroke} strokeWidth={1.5} cornerRadius={3} />
        <Rect x={width * 0.04} y={height * 0.18} width={width * 0.92} height={height * 0.64} fill="#273241" stroke="#5d6b7d" strokeWidth={lineWidth} cornerRadius={2} />
        <Line points={[width * 0.22, height * 0.36, width * 0.48, height * 0.18]} stroke="rgba(255,255,255,.28)" strokeWidth={lineWidth} />
        <Line points={[width * 0.52, height * 0.82, width * 0.78, height * 0.64]} stroke="rgba(255,255,255,.18)" strokeWidth={lineWidth} />
      </>
    );
  }

  if (object.type === 'tv-cabinet') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={5} />
        <Rect x={width * 0.05} y={height * 0.16} width={width * 0.9} height={height * 0.68} fill="#c8ad85" stroke={softStroke} strokeWidth={lineWidth} cornerRadius={3} />
        <Line points={[width * 0.33, height * 0.18, width * 0.33, height * 0.84]} stroke={softStroke} strokeWidth={lineWidth} />
        <Line points={[width * 0.66, height * 0.18, width * 0.66, height * 0.84]} stroke={softStroke} strokeWidth={lineWidth} />
        <Circle x={width * 0.28} y={height * 0.5} radius={Math.max(2, height * 0.045)} fill="#6f5b3e" />
        <Circle x={width * 0.72} y={height * 0.5} radius={Math.max(2, height * 0.045)} fill="#6f5b3e" />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'plant') {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.max(8, Math.min(width, height) * 0.26);
    const leafColor = '#5f9f68';
    const leafDark = '#3f7f4a';
    const potRadius = Math.max(5, Math.min(width, height) * 0.16);
    return (
      <>
        {[0, 60, 120, 180, 240, 300].map((angle, index) => {
          const radians = angle * Math.PI / 180;
          const x = centerX + Math.cos(radians) * radius * 0.55;
          const y = centerY + Math.sin(radians) * radius * 0.55;
          return (
            <Circle
              key={angle}
              x={x}
              y={y}
              radius={radius * (index % 2 === 0 ? 0.72 : 0.58)}
              fill={index % 2 === 0 ? leafColor : leafDark}
              opacity={0.9}
            />
          );
        })}
        <Circle x={centerX} y={centerY} radius={potRadius} fill="#b58a55" stroke={stroke} strokeWidth={1.4} />
        <Circle x={centerX} y={centerY} radius={potRadius * 0.58} fill="#6f4e2f" opacity={0.9} />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.type === 'curtain') {
    const pleatCount = Math.max(4, Math.floor(width / 18));
    const railY = Math.max(2, height * 0.16);
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill="rgba(143,184,168,.24)" stroke={stroke} strokeWidth={1.2} cornerRadius={6} />
        <Line points={[0, railY, width, railY]} stroke="#4c7f6e" strokeWidth={Math.max(2, height * 0.12)} lineCap="round" />
        {Array.from({ length: pleatCount }, (_, index) => {
          const x = width * ((index + 0.5) / pleatCount);
          const wave = width / pleatCount * 0.22;
          return (
            <Line
              key={index}
              points={[
                x - wave, height * 0.2,
                x + wave, height * 0.38,
                x - wave, height * 0.58,
                x + wave, height * 0.82,
              ]}
              stroke={index % 2 === 0 ? '#5d9b83' : '#78b29d'}
              strokeWidth={Math.max(2, height * 0.18)}
              tension={0.55}
              lineCap="round"
              opacity={0.9}
            />
          );
        })}
      </>
    );
  }

  if (object.type === 'window') {
    return (
      <>
        <Rect x={0} y={height * 0.12} width={width} height={height * 0.76} fill="#d9f0fa" stroke="#4d8caf" strokeWidth={1.5} cornerRadius={3} />
        <Line points={[width * 0.5, height * 0.15, width * 0.5, height * 0.85]} stroke="#4d8caf" strokeWidth={lineWidth} />
        <Line points={[width * 0.06, height * 0.5, width * 0.94, height * 0.5]} stroke="#4d8caf" strokeWidth={lineWidth} />
      </>
    );
  }

  if (object.type === 'door') {
    return (
      <>
        <Rect x={0} y={height * 0.2} width={width * 0.08} height={height * 0.6} fill="#8b6c4c" />
        <Line points={[width * 0.08, height * 0.78, width * 0.9, height * 0.15]} stroke="#8b6c4c" strokeWidth={Math.max(2, lineWidth)} />
        <Line points={[width * 0.08, height * 0.78, width * 0.9, height * 0.78, width * 0.9, height * 0.15]} stroke="rgba(139,108,76,.35)" strokeWidth={lineWidth} dash={[4, 4]} />
      </>
    );
  }

  if (object.type === 'rug') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={10} />
        <Rect x={width * 0.06} y={height * 0.08} width={width * 0.88} height={height * 0.84} stroke="#7f5d5d" strokeWidth={lineWidth} cornerRadius={8} />
        <Line points={[width * 0.18, height * 0.5, width * 0.82, height * 0.5]} stroke="#7f5d5d" strokeWidth={lineWidth} dash={[5, 4]} />
        <Line points={[width * 0.5, height * 0.18, width * 0.5, height * 0.82]} stroke="#7f5d5d" strokeWidth={lineWidth} dash={[5, 4]} />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  if (object.productId || object.type === 'wall-panel') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={6} />
        <Rect x={width * 0.06} y={height * 0.1} width={width * 0.88} height={height * 0.8} stroke="#ffffff" strokeWidth={lineWidth} cornerRadius={4} />
        {[0.22, 0.38, 0.54, 0.7].map((ratio) => (
          <Line key={ratio} points={[width * ratio, height * 0.16, width * (ratio - 0.14), height * 0.84]} stroke="rgba(255,255,255,.55)" strokeWidth={lineWidth} />
        ))}
        <ObjectLabel object={object} width={width} height={height} light />
      </>
    );
  }

  if (object.type === 'ceiling-object') {
    return (
      <>
        <Rect x={0} y={0} width={width} height={height} fill="#eef3ff" stroke="#4169E1" strokeWidth={1.5} cornerRadius={Math.min(width, height) * 0.18} />
        <Circle x={width * 0.5} y={height * 0.5} radius={Math.max(5, Math.min(width, height) * 0.28)} fill="#4169E1" opacity={0.18} stroke="#4169E1" strokeWidth={lineWidth} />
        <Line points={[width * 0.2, height * 0.5, width * 0.8, height * 0.5]} stroke="#4169E1" strokeWidth={lineWidth} />
        <Line points={[width * 0.5, height * 0.2, width * 0.5, height * 0.8]} stroke="#4169E1" strokeWidth={lineWidth} />
        <ObjectLabel object={object} width={width} height={height} />
      </>
    );
  }

  return (
    <>
      <Rect x={0} y={0} width={width} height={height} fill={fill} stroke={stroke} strokeWidth={1.5} cornerRadius={6} />
      <ObjectLabel object={object} width={width} height={height} />
    </>
  );
}

function SketchObject({ object, scale, isSelected, canTransform, onSelect, onOpenEditor, onChange, onDragObject, onRegisterNode }) {
  const groupRef = React.useRef(null);
  const transformerRef = React.useRef(null);
  const isProduct = Boolean(object.productId);

  useEffect(() => {
    onRegisterNode?.(object.id, groupRef.current);
    return () => onRegisterNode?.(object.id, null);
  }, [object.id, onRegisterNode]);

  useEffect(() => {
    if (isSelected && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const x = CANVAS_PADDING + safeNumber(object.x) * scale;
  const y = CANVAS_PADDING + safeNumber(object.y) * scale;
  const width = Math.max(6, safeNumber(object.width, 0.15) * scale);
  const height = Math.max(6, safeNumber(object.height, 0.15) * scale);

  return (
    <>
      <Group
        ref={groupRef}
        x={x}
        y={y}
        rotation={safeNumber(object.rotation)}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onContextMenu={(event) => {
          event.evt.preventDefault();
          onOpenEditor(event);
        }}
        onDragEnd={(event) => {
          const node = event.currentTarget ?? event.target;
          onDragObject(object, rounded((node.x() - CANVAS_PADDING) / scale), rounded((node.y() - CANVAS_PADDING) / scale));
        }}
        onTransformEnd={(event) => {
          const node = event.currentTarget ?? event.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...object,
            x: rounded((node.x() - CANVAS_PADDING) / scale),
            y: rounded((node.y() - CANVAS_PADDING) / scale),
            width: isProduct ? object.width : rounded(Math.max(0.15, width * scaleX / scale)),
            height: isProduct ? object.height : rounded(Math.max(0.15, height * scaleY / scale)),
            rotation: snapRotation(node.rotation()),
          });
        }}
      >
        <Rect x={0} y={0} width={width} height={height} fill="#ffffff" opacity={0.01} />
        <TopDownObjectShape object={object} width={width} height={height} selected={isSelected} />
        {isSelected && (
          <Rect
            x={-3}
            y={-3}
            width={width + 6}
            height={height + 6}
            stroke="#111827"
            strokeWidth={1}
            dash={[5, 4]}
            cornerRadius={6}
            listening={false}
          />
        )}
      </Group>
      {isSelected && canTransform && (
        <Transformer
          ref={transformerRef}
          rotateEnabled
          rotationSnaps={ROTATION_SNAPS}
          rotationSnapTolerance={ROTATION_STEP_DEGREES / 2}
          enabledAnchors={[]}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

function RoomCanvas({ room, objects, selectedObjectIds, onSelectObject, onOpenObjectEditor, onChangeObject, onDragObject, onRegisterObjectNode }) {
  const safeRoom = normalizeRoom(room);
  const displayLength = Math.max(0.1, safeRoom.lengthMeters);
  const displayWidth = Math.max(0.1, safeRoom.widthMeters);
  const stageWidth = Math.max(360, displayLength * SCALE + CANVAS_PADDING * 2);
  const stageHeight = Math.max(260, displayWidth * SCALE + CANVAS_PADDING * 2);
  const roomPoints = getRoomPolygonPoints(safeRoom).flatMap((point) => [
    CANVAS_PADDING + point.x * SCALE,
    CANVAS_PADDING + point.y * SCALE,
  ]);
  const corner = getEffectiveCorner(safeRoom);
  const shapeLabel = safeRoom.shape === 'l-shape'
    ? `L-vorm · hoek ${corner.width.toFixed(1)} x ${corner.depth.toFixed(1)} m`
    : 'rechthoek';

  return (
    <div className="roomCanvasShell">
      <Stage
        width={stageWidth}
        height={stageHeight}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) onSelectObject(null, event);
        }}
        onTouchStart={(event) => {
          if (event.target === event.target.getStage()) onSelectObject(null, event);
        }}
      >
        <Layer>
          <Line
            points={roomPoints}
            closed
            fill="#fbfbfb"
            stroke="#082d65"
            strokeWidth={2}
            onClick={() => onSelectObject(null)}
            onTap={() => onSelectObject(null)}
          />
          <Text
            x={CANVAS_PADDING}
            y={6}
            text={`${safeRoom.lengthMeters} m x ${safeRoom.widthMeters} m · ${shapeLabel} · schaal 1 m = ${SCALE} px`}
            fontSize={13}
            fill="#555"
          />
          {objects.map((object) => (
            <SketchObject
              key={object.id}
              object={object}
              scale={SCALE}
              isSelected={selectedObjectIds.includes(object.id)}
              canTransform={selectedObjectIds.length === 1}
              onSelect={(event) => onSelectObject(object.id, event)}
              onOpenEditor={(event) => onOpenObjectEditor(object.id, event)}
              onChange={onChangeObject}
              onDragObject={onDragObject}
              onRegisterNode={onRegisterObjectNode}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function buildAdvice(calculation) {
  const practicalWallLimit = calculation.availableWallAreaM2 * 0.65;
  const hasWallWarning = calculation.recommendedFeltM2 > practicalWallLimit && practicalWallLimit > 0;
  const suggestedDistribution = hasWallWarning ? '50% wand / 50% plafond' : '70% wand / 30% plafond';
  const warning = hasWallWarning
    ? 'De akoestische behoefte is groter dan realistisch met wandkunst alleen. Gebruik de barometer om het effect van kunstwerken te tonen en adviseer aanvullend persoonlijk advies.'
    : 'Plaats BasKoestiek kunstwerken in de schets om direct te laten zien hoe de ruimte akoestisch opschuift richting meer wooncomfort.';

  return {
    suggestedDistribution,
    warning,
    text: `Op basis van de schets is de ruimte ongeveer ${calculation.floorAreaM2.toFixed(1)} m² en ${calculation.volumeM3.toFixed(0)} m³. Elk geplaatst object verandert de indicatie; BasKoestiek kunstwerken maken het effect het duidelijkst zichtbaar in de barometer.`,
  };
}

export default function RoomSketcher({
  value,
  onChange,
  leadData,
  defaultRoom,
  currentReverbTime,
  targetReverbTime,
  selectedNRC,
  showEditor = true,
  showReports = true,
  openDetailsOnMount = false,
  onDetailsOpened,
  onShowAdvice,
  onSaveProject,
  customerConfig,
  isEmbed = false,
}) {
  const initialRoom = normalizeRoom(value?.room ?? {
    lengthMeters: defaultRoom?.lengthMeters ?? 8,
    widthMeters: defaultRoom?.widthMeters ?? 5,
    heightMeters: defaultRoom?.heightMeters ?? 3,
    type: defaultRoom?.type ?? 'restaurant',
    floorType: defaultRoom?.floorType ?? 'wood',
    shape: 'rectangle',
    cornerPosition: 'top-right',
    cornerWidthMeters: 1.5,
    cornerDepthMeters: 1.5,
  });
  const [room, setRoom] = useState(initialRoom);
  const [objects, setObjects] = useState(() => (value?.objects ?? []).map((object) => normalizeObject(object, initialRoom)));
  const [selectedObjectIds, setSelectedObjectIds] = useState([]);
  const [objectChoiceContext, setObjectChoiceContext] = useState(null);
  const [objectActionContext, setObjectActionContext] = useState(null);
  const [showRoomDetailsModal, setShowRoomDetailsModal] = useState(false);
  const [show3dPreview, setShow3dPreview] = useState(false);
  const [threeDPreviewData, setThreeDPreviewData] = useState(null);
  const [threeDPreviewRevision, setThreeDPreviewRevision] = useState(0);
  const hasOpenedDetailsRef = useRef(false);
  const lastEmittedSketchJsonRef = useRef('');
  const objectNodeRefs = useRef(new Map());

  const sketchData = useMemo(() => ({ room, objects }), [room, objects]);
  const activeThreeDPreviewSketch = threeDPreviewData ?? sketchData;
  const activeThreeDPreviewKey = useMemo(() => `${threeDPreviewRevision}-${JSON.stringify(activeThreeDPreviewSketch)}`, [activeThreeDPreviewSketch, threeDPreviewRevision]);
  const sketchWarnings = useMemo(() => getSketchWarnings(room, objects), [room, objects]);
  const calculation = useMemo(() => calculateRoomFromSketch(sketchData, {
    currentReverbTime,
    targetReverbTime,
    selectedNRC,
  }), [sketchData, currentReverbTime, targetReverbTime, selectedNRC]);
  const advice = useMemo(() => buildAdvice(calculation), [calculation]);
  const barometerData = useMemo(() => getBarometerData({
    calculation,
    objects,
    currentReverbTime,
    targetReverbTime,
  }), [calculation, objects, currentReverbTime, targetReverbTime]);
  const safeCurrentRt = safeNumber(currentReverbTime);
  const safeTargetRt = safeNumber(targetReverbTime);
  const sketchCalculationData = {
    ...calculation,
    lengthMeters: room.lengthMeters,
    widthMeters: room.widthMeters,
    heightMeters: room.heightMeters,
    currentReverbTime: calculation.effectiveCurrentReverbTime || safeCurrentRt,
    targetReverbTime: safeTargetRt,
    selectedNRC,
    floorType: calculation.floorType,
    floorLabel: calculation.floorLabel,
    floorAbsorptionEstimate: calculation.floorAbsorptionEstimate,
    requiredExtraAbsorption: safeCurrentRt > 0 && safeTargetRt > 0
      ? Math.max(0, 0.16 * calculation.volumeM3 / safeTargetRt - 0.16 * calculation.volumeM3 / (calculation.effectiveCurrentReverbTime || safeCurrentRt))
      : 0,
    solutionLabel: advice.suggestedDistribution,
    productMatch: 'BasKoestiek akoestische kunstwerken op basis van schets',
    placementSuggestion: 'Gebruik de schets om kunstwerken te verdelen over reflecterende wanden en boven drukke tafelzones.',
  };
  const sketchLeadData = {
    ...leadData,
    roomType: room.type,
  };
  const customerReportData = {
    ...generateCustomerReport(sketchCalculationData, sketchData, sketchLeadData),
    barometerData,
  };
  const internalReportData = generateInternalReport(sketchCalculationData, sketchData, sketchLeadData);

  useEffect(() => {
    if (!value?.room) return;
    const incomingSketchJson = JSON.stringify(value);
    if (incomingSketchJson === lastEmittedSketchJsonRef.current) return;

    const nextRoom = normalizeRoom(value.room);
    setRoom(nextRoom);
    setObjects((value.objects ?? []).map((object) => normalizeObject(object, nextRoom)));
    setSelectedObjectIds([]);
  }, [value]);

  useEffect(() => {
    lastEmittedSketchJsonRef.current = JSON.stringify(sketchData);
    onChange?.(sketchData);
  }, [sketchData, onChange]);

  useEffect(() => {
    if (!showEditor || !openDetailsOnMount || hasOpenedDetailsRef.current) return;
    hasOpenedDetailsRef.current = true;
    setShowRoomDetailsModal(true);
    onDetailsOpened?.();
  }, [showEditor, openDetailsOnMount, onDetailsOpened]);

  function updateRoom(patch) {
    const nextRoom = { ...room, ...patch };
    setRoom(nextRoom);
  }

  const registerObjectNode = useCallback((objectId, node) => {
    if (!objectId) return;
    if (node) objectNodeRefs.current.set(objectId, node);
    else objectNodeRefs.current.delete(objectId);
  }, []);

  function getObjectsCommittedFromCanvas() {
    return objects.map((object) => {
      const node = objectNodeRefs.current.get(object.id);
      if (!node) return object;

      const scaleX = Number.isFinite(node.scaleX?.()) ? node.scaleX() : 1;
      const scaleY = Number.isFinite(node.scaleY?.()) ? node.scaleY() : 1;
      const nextObject = {
        ...object,
        x: rounded((node.x() - CANVAS_PADDING) / SCALE),
        y: rounded((node.y() - CANVAS_PADDING) / SCALE),
        rotation: snapRotation(node.rotation()),
        wallMount: undefined,
      };

      if (!object.productId) {
        nextObject.width = rounded(Math.max(0.15, safeNumber(object.width, 0.15) * scaleX));
        nextObject.height = rounded(Math.max(0.15, safeNumber(object.height, 0.15) * scaleY));
      }

      node.scaleX(1);
      node.scaleY(1);
      return normalizeObject(nextObject, room);
    });
  }

  function open3dPreview() {
    const committedObjects = getObjectsCommittedFromCanvas();
    const committedSketchData = { room, objects: committedObjects };
    const committedSketchJson = JSON.stringify(committedSketchData);
    lastEmittedSketchJsonRef.current = committedSketchJson;
    setObjects(committedObjects);
    onChange?.(committedSketchData);
    setThreeDPreviewData(committedSketchData);
    setThreeDPreviewRevision((current) => current + 1);
    setShow3dPreview(true);
  }

  function close3dPreview() {
    setShow3dPreview(false);
    setThreeDPreviewData(null);
  }

  function updateObject(nextObject) {
    setObjects((current) => current.map((object) => (
      object.id === nextObject.id ? normalizeObject(nextObject, room) : object
    )));
  }

  function openObjectChoice(definitionKey) {
    setObjectActionContext(null);
    setObjectChoiceContext({ mode: 'add', definitionKey });
  }

  function saveObjectChoice(nextObject) {
    if (objectChoiceContext?.mode === 'edit') {
      updateObject(nextObject);
      setSelectedObjectIds([nextObject.id]);
    } else {
      setObjects((current) => [...current, nextObject]);
      setSelectedObjectIds([nextObject.id]);
    }
    setObjectChoiceContext(null);
  }

  function deleteObjectById(objectId) {
    if (!objectId) return;
    setObjects((current) => current.filter((object) => object.id !== objectId));
    setSelectedObjectIds((current) => current.filter((id) => id !== objectId));
    setObjectChoiceContext(null);
    setObjectActionContext(null);
  }

  function duplicateObjectById(objectId) {
    const object = objects.find((item) => item.id === objectId);
    if (!object) return;
    const duplicate = {
      ...object,
      id: crypto.randomUUID(),
      label: `${object.label} kopie`,
      x: rounded(safeNumber(object.x) + 0.25),
      y: rounded(safeNumber(object.y) + 0.25),
      wallMount: undefined,
    };
    setObjects((current) => [...current, duplicate]);
    setSelectedObjectIds([duplicate.id]);
    setObjectActionContext({ object: duplicate });
  }

  function rotateObjectById(objectId, degrees) {
    setObjects((current) => current.map((object) => (
      object.id === objectId
        ? normalizeObject({ ...object, rotation: snapRotation(safeNumber(object.rotation) + degrees) }, room)
        : object
    )));
  }

  function openObjectEditor(objectId, event) {
    event?.evt?.preventDefault?.();
    const selected = objects.find((object) => object.id === objectId);
    if (!selected) return;
    setSelectedObjectIds([objectId]);
    const definitionKey = getObjectDefinitionKey(selected);
    if (!selected.productId && definitionKey) {
      setObjectActionContext(null);
      setObjectChoiceContext({ mode: 'edit', definitionKey, object: selected });
    } else {
      setObjectChoiceContext(null);
      setObjectActionContext({ object: selected });
    }
  }

  function selectObject(objectId, event) {
    if (!objectId) {
      setSelectedObjectIds([]);
      setObjectChoiceContext(null);
      setObjectActionContext(null);
      return;
    }

    const nativeEvent = event?.evt ?? event;
    const shouldToggle = Boolean(nativeEvent?.shiftKey || nativeEvent?.metaKey || nativeEvent?.ctrlKey);
    setSelectedObjectIds((current) => {
      if (!shouldToggle) return [objectId];
      return current.includes(objectId)
        ? current.filter((id) => id !== objectId)
        : [...current, objectId];
    });
    setObjectChoiceContext(null);
    setObjectActionContext(null);
  }

  function dragObject(object, nextX, nextY) {
    const movingSelection = selectedObjectIds.includes(object.id) ? selectedObjectIds : [object.id];
    const deltaX = nextX - safeNumber(object.x);
    const deltaY = nextY - safeNumber(object.y);

    setObjects((current) => current.map((item) => {
      if (!movingSelection.includes(item.id)) return item;
      const movedObject = {
        ...item,
        x: rounded(safeNumber(item.x) + deltaX),
        y: rounded(safeNumber(item.y) + deltaY),
        wallMount: undefined,
      };
      return normalizeObject(movedObject, room);
    }));
  }

  function addObject(preset) {
    const object = createSketchObject(preset, room);
    setObjects((current) => [...current, object]);
    setSelectedObjectIds([object.id]);
  }

  return (
    <section className="panel sketchPanel">
      <div className="panelHeader">
        <div className="panelTitle">
          <h2>{showEditor ? 'Uitgebreide ruimte-schets' : 'Stap 3 · Conclusie'}</h2>
        </div>
        <span className="sketchJsonBadge">{objects.length} objecten</span>
      </div>

      {showEditor && (
        <>
          <RoomSketchModal
            open={showRoomDetailsModal}
            room={room}
            onUpdateRoom={updateRoom}
            onClose={() => setShowRoomDetailsModal(false)}
          />
          <ObjectChoiceModal
            context={objectChoiceContext}
            room={room}
            onClose={() => setObjectChoiceContext(null)}
            onSave={saveObjectChoice}
            onDelete={deleteObjectById}
          />
          <ObjectActionModal
            object={objectActionContext?.object}
            onClose={() => setObjectActionContext(null)}
            onDelete={deleteObjectById}
            onDuplicate={duplicateObjectById}
            onRotate={rotateObjectById}
          />

          <div className="sketchIntroBar">
            <div>
              <span>Stap 2</span>
              <h3>Interieur toevoegen</h3>
              <p>Voeg objecten toe die zoals ze in jouw ruimte aanwezig zijn. TIP: plaats de kunstwerken zo dicht mogelijk bij de bron, bijvoorbeeld bij de eettafel, naast het bankstel.</p>
            </div>
            <div className="sketchIntroActions">
              <button className="secondaryButton" type="button" onClick={() => setShowRoomDetailsModal(true)}>
                Ruimtegegevens aanpassen
              </button>
            </div>
          </div>

          <ObjectToolbar onAddObject={addObject} onOpenObjectChoice={openObjectChoice} />

          {sketchWarnings.length > 0 && (
            <div className="warningList">
              {sketchWarnings.map((warning) => (
                <div className="warningCard" key={warning.id}>
                  <p>{warning.message}</p>
                  {warning.objectIds.length > 0 && (
                    <div className="warningObjects">
                      {warning.objectIds.map((objectId, index) => (
                        <button
                          type="button"
                          key={objectId}
                          className="warningObjectButton"
                          onClick={() => setSelectedObjectIds([objectId])}
                        >
                          {warning.objectLabels[index]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="sketchWorkspace">
            <div className="sketchCanvasColumn">
              <RoomCanvas
                room={room}
                objects={objects}
                selectedObjectIds={selectedObjectIds}
                onSelectObject={selectObject}
                onOpenObjectEditor={openObjectEditor}
                onChangeObject={updateObject}
                onDragObject={dragObject}
                onRegisterObjectNode={registerObjectNode}
              />
            </div>
            <aside className="sketchSidePanel">
              <AcousticBarometer data={barometerData} companyName={customerConfig?.companyName} />
              <button className="secondaryButton sideAdviceButton" type="button" onClick={open3dPreview}>
                Opslaan en naar 3D
              </button>
              <button className="primaryButton sideAdviceButton" type="button" onClick={onShowAdvice}>
                Bekijk mijn advies
              </button>
            </aside>
          </div>

          {show3dPreview && (
            <React.Suspense fallback={<div className="room3dOverlay"><p className="emptyState">3D weergave laden...</p></div>}>
              <RoomSketch3D
                key={activeThreeDPreviewKey}
                sketchData={activeThreeDPreviewSketch}
                onClose={close3dPreview}
              />
            </React.Suspense>
          )}
        </>
      )}

      {showReports && (
        <>
          <ReportsPanel
            customerReportData={customerReportData}
            internalReportData={internalReportData}
            onSaveProject={onSaveProject}
            customerConfig={customerConfig}
            isEmbed={isEmbed}
          />
        </>
      )}
    </section>
  );
}
