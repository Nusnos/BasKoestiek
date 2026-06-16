import React from 'react';

const objectColors = {
  table: '#d8c7a5',
  chair: '#b9c7d6',
  sofa: '#9aa9b5',
  diningSet: '#d8c7a5',
  seating: '#9aa9b5',
  cabinet: '#c8b08a',
  tv: '#273241',
  'tv-cabinet': '#b99d76',
  curtain: '#8fb8a8',
  window: '#b8dcf0',
  door: '#c9a47d',
  rug: '#b88f8f',
  'wall-panel': '#082d65',
  'ceiling-object': '#4169E1',
};

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function getRoomPolygon(room = {}) {
  const length = safeNumber(room.lengthMeters);
  const width = safeNumber(room.widthMeters);
  const cornerWidth = Math.min(safeNumber(room.cornerWidthMeters), Math.max(0, length - 0.1));
  const cornerDepth = Math.min(safeNumber(room.cornerDepthMeters), Math.max(0, width - 0.1));
  const position = room.cornerPosition || 'top-right';

  if (room.shape !== 'l-shape' || cornerWidth <= 0 || cornerDepth <= 0) {
    return [
      [0, 0],
      [length, 0],
      [length, width],
      [0, width],
    ];
  }

  if (position === 'top-left') {
    return [
      [cornerWidth, 0],
      [length, 0],
      [length, width],
      [0, width],
      [0, cornerDepth],
      [cornerWidth, cornerDepth],
    ];
  }

  if (position === 'bottom-right') {
    return [
      [0, 0],
      [length, 0],
      [length, width - cornerDepth],
      [length - cornerWidth, width - cornerDepth],
      [length - cornerWidth, width],
      [0, width],
    ];
  }

  if (position === 'bottom-left') {
    return [
      [0, 0],
      [length, 0],
      [length, width],
      [cornerWidth, width],
      [cornerWidth, width - cornerDepth],
      [0, width - cornerDepth],
    ];
  }

  return [
    [0, 0],
    [length - cornerWidth, 0],
    [length - cornerWidth, cornerDepth],
    [length, cornerDepth],
    [length, width],
    [0, width],
  ];
}

function getObjectFill(object = {}) {
  if (object.productId) return '#082d65';
  return objectColors[object.type] ?? '#d8d8d8';
}

function getPreviewFootprint(object = {}) {
  const footprint = Array.isArray(object.previewFootprint) ? object.previewFootprint : [];
  if (footprint.length >= 4) {
    return footprint.map((point) => ({
      x: safeNumber(point.x),
      y: safeNumber(point.y),
    }));
  }

  const objectWidth = Math.max(0.04, safeNumber(object.width, 0.2));
  const objectHeight = Math.max(0.04, safeNumber(object.height, 0.2));
  const x = safeNumber(object.x);
  const y = safeNumber(object.y);
  const radians = safeNumber(object.rotation) * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return [
    { x: 0, y: 0 },
    { x: objectWidth, y: 0 },
    { x: objectWidth, y: objectHeight },
    { x: 0, y: objectHeight },
  ].map((point) => ({
    x: x + point.x * cos - point.y * sin,
    y: y + point.x * sin + point.y * cos,
  }));
}

function pointsToSvg(points = []) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export default function SketchPreview({ sketchData, title = 'Schets van de ruimte' }) {
  const room = sketchData?.room ?? {};
  const objects = Array.isArray(sketchData?.objects) ? sketchData.objects : [];
  const length = safeNumber(room.lengthMeters);
  const width = safeNumber(room.widthMeters);

  if (length <= 0 || width <= 0) return null;

  const padding = 0.35;
  const viewBox = `${-padding} ${-padding} ${length + padding * 2} ${width + padding * 2}`;
  const polygonPoints = getRoomPolygon(room).map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div className="sketchPreview">
      <div className="sketchPreviewHeader">
        <h3>{title}</h3>
        <span>{length.toFixed(1)} x {width.toFixed(1)} m</span>
      </div>
      <svg viewBox={viewBox} role="img" aria-label="Plattegrondschets van de ruimte">
        <polygon points={polygonPoints} fill="#fbfbfb" stroke="#082d65" strokeWidth="0.04" />
        {objects.map((object) => {
          const isArtwork = Boolean(object.productId);
          const points = getPreviewFootprint(object);

          return (
            <polygon
              key={object.id}
              points={pointsToSvg(points)}
              fill={getObjectFill(object)}
              stroke={isArtwork ? '#061f47' : '#ffffff'}
              strokeWidth={isArtwork ? '0.035' : '0.025'}
              opacity={isArtwork ? 0.95 : 0.82}
            />
          );
        })}
      </svg>
    </div>
  );
}
