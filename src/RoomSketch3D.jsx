import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Download, X } from 'lucide-react';
import { acousticProducts } from './data/acousticProducts.js';

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function getRoomPolygon(room = {}) {
  const length = safeNumber(room.lengthMeters, 8);
  const width = safeNumber(room.widthMeters, 5);
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
    return [[cornerWidth, 0], [length, 0], [length, width], [0, width], [0, cornerDepth], [cornerWidth, cornerDepth]];
  }

  if (position === 'bottom-right') {
    return [[0, 0], [length, 0], [length, width - cornerDepth], [length - cornerWidth, width - cornerDepth], [length - cornerWidth, width], [0, width]];
  }

  if (position === 'bottom-left') {
    return [[0, 0], [length, 0], [length, width], [cornerWidth, width], [cornerWidth, width - cornerDepth], [0, width - cornerDepth]];
  }

  return [[0, 0], [length - cornerWidth, 0], [length - cornerWidth, cornerDepth], [length, cornerDepth], [length, width], [0, width]];
}

function toScenePoint(point, room) {
  return {
    x: point[0] - safeNumber(room.lengthMeters) / 2,
    z: point[1] - safeNumber(room.widthMeters) / 2,
  };
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.55,
    metalness: options.metalness ?? 0.02,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

function createLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(255,255,255,.92)';
  context.roundRect(12, 22, 488, 84, 24);
  context.fill();
  context.fillStyle = '#082d65';
  context.font = '700 38px Roboto, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(text).slice(0, 30), 256, 64);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.3, 0.33, 1);
  return sprite;
}

function addRoom(scene, room) {
  const height = Math.max(2.2, safeNumber(room.heightMeters, 2.7));
  const polygon = getRoomPolygon(room);
  const shape = new THREE.Shape();
  polygon.forEach((point, index) => {
    const scenePoint = toScenePoint(point, room);
    if (index === 0) shape.moveTo(scenePoint.x, scenePoint.z);
    else shape.lineTo(scenePoint.x, scenePoint.z);
  });
  shape.closePath();

  const floor = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    makeMaterial('#d8c6aa', { roughness: 0.72, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMaterial = makeMaterial('#f4f1ec', { transparent: true, opacity: 0.42, side: THREE.DoubleSide });
  const wallTopMaterial = makeMaterial('#d5d9df', { transparent: true, opacity: 0.55 });
  const thickness = 0.08;

  polygon.forEach((point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    const start = toScenePoint(point, room);
    const end = toScenePoint(next, room);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(length, height, thickness), wallMaterial);
    wall.position.set((start.x + end.x) / 2, height / 2, (start.z + end.z) / 2);
    wall.rotation.y = -Math.atan2(dz, dx);
    wall.receiveShadow = true;
    scene.add(wall);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(length, 0.035, thickness + 0.02), wallTopMaterial);
    cap.position.set(wall.position.x, height + 0.02, wall.position.z);
    cap.rotation.y = wall.rotation.y;
    scene.add(cap);
  });
}

function getObjectColor(object) {
  if (object.productId) return '#082d65';
  const colors = {
    table: '#b9915f',
    chair: '#9eb0c0',
    sofa: '#8798aa',
    diningSet: '#b9915f',
    seating: '#8798aa',
    cabinet: '#b89263',
    tv: '#111827',
    'tv-cabinet': '#a98255',
    curtain: '#78a88e',
    window: '#7fc7ec',
    door: '#9d744d',
    rug: '#a86f73',
    plant: '#5f9f68',
  };
  return colors[object.type] ?? '#bfc7d2';
}

function getObjectAnchor(object, room) {
  return {
    x: safeNumber(object.x) - safeNumber(room.lengthMeters) / 2,
    z: safeNumber(object.y) - safeNumber(room.widthMeters) / 2,
  };
}

function createObjectGroup(object, room) {
  const anchor = getObjectAnchor(object, room);
  const group = new THREE.Group();
  group.position.set(anchor.x, 0, anchor.z);
  group.rotation.y = -THREE.MathUtils.degToRad(safeNumber(object.rotation));
  return group;
}

function getTextureUrl(product) {
  if (!product?.imageUrl) return '';
  return product.imageUrl.replace('/artworks/', '/artworks-3d/').replace(/\.webp$/i, '.jpg');
}

function createArtworkFaceMaterial(product) {
  if (!product?.imageUrl) {
    return makeMaterial('#0d3a78', { roughness: 0.46 });
  }

  const texture = new THREE.TextureLoader().load(getTextureUrl(product));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 1;

  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.58,
    metalness: 0.01,
    side: THREE.FrontSide,
  });
}

function addBox(group, {
  x = 0,
  y = 0,
  z = 0,
  width = 0.2,
  height = 0.2,
  depth = 0.2,
  color = '#bfc7d2',
  materialOptions = {},
  castShadow = true,
  receiveShadow = true,
}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.01, width), Math.max(0.01, height), Math.max(0.01, depth)),
    makeMaterial(color, materialOptions),
  );
  mesh.position.set(x + width / 2, y + height / 2, z + depth / 2);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  group.add(mesh);
  return mesh;
}

function addLabelToGroup(group, text, width, height, depth) {
  const label = createLabel(text);
  label.position.set(width / 2, height + 0.32, depth / 2);
  group.add(label);
}

function addSeatingModel(group, object, width, depth) {
  const baseColor = '#8798aa';
  const cushionColor = '#9baab6';
  const shadowColor = '#748592';
  const sofaDepth = Math.min(depth, Math.max(0.65, safeNumber(object.dimensions?.depthCm, 90) / 100));
  const armWidth = Math.min(0.22, Math.max(0.12, width * 0.08));
  const seatHeight = 0.32;
  const backHeight = 0.64;

  if (object.objectVariant === 'cornerSofa') {
    const legDepth = Math.min(width, sofaDepth);
    addBox(group, { width, height: seatHeight, depth: legDepth, color: cushionColor, materialOptions: { roughness: 0.82 } });
    addBox(group, { width: legDepth, height: seatHeight, depth, color: cushionColor, materialOptions: { roughness: 0.82 } });
    addBox(group, { y: seatHeight, width, height: backHeight - seatHeight, depth: 0.18, color: baseColor, materialOptions: { roughness: 0.86 } });
    addBox(group, { y: seatHeight, width: 0.18, height: backHeight - seatHeight, depth, color: baseColor, materialOptions: { roughness: 0.86 } });
    addBox(group, { x: width - 0.2, y: 0.08, width: 0.2, height: 0.48, depth: legDepth, color: shadowColor });
    addBox(group, { x: 0.08, z: depth - 0.2, y: 0.08, width: legDepth, height: 0.48, depth: 0.2, color: shadowColor });
  } else {
    const isArmchair = object.objectVariant === 'armchair';
    addBox(group, { y: 0.05, width, height: seatHeight, depth, color: cushionColor, materialOptions: { roughness: 0.84 } });
    addBox(group, { y: seatHeight, width, height: backHeight - seatHeight, depth: 0.18, color: baseColor, materialOptions: { roughness: 0.88 } });
    addBox(group, { y: 0.12, width: armWidth, height: 0.5, depth, color: shadowColor, materialOptions: { roughness: 0.86 } });
    addBox(group, { x: width - armWidth, y: 0.12, width: armWidth, height: 0.5, depth, color: shadowColor, materialOptions: { roughness: 0.86 } });
    const cushionCount = isArmchair ? 1 : Math.max(2, Math.min(3, Math.round(width / 0.75)));
    for (let index = 1; index < cushionCount; index += 1) {
      addBox(group, {
        x: width * index / cushionCount - 0.01,
        y: seatHeight + 0.01,
        z: depth * 0.22,
        width: 0.02,
        height: 0.03,
        depth: depth * 0.62,
        color: '#eef3f8',
        castShadow: false,
      });
    }
  }

  addLabelToGroup(group, object.label, width, 0.72, depth);
}

function addCabinetModel(group, object, width, depth) {
  const cabinetHeight = Math.max(0.6, safeNumber(object.surfaceHeight, 1.8));
  addBox(group, { width, height: cabinetHeight, depth, color: '#b89263', materialOptions: { roughness: 0.56 } });
  addBox(group, { x: 0.04, y: 0.08, z: depth + 0.006, width: width - 0.08, height: cabinetHeight - 0.16, depth: 0.025, color: '#d3bf9d', materialOptions: { roughness: 0.5 } });

  const doorCount = width > 1.4 ? 3 : 2;
  for (let index = 1; index < doorCount; index += 1) {
    const x = width * index / doorCount;
    addBox(group, { x: x - 0.006, y: 0.09, z: depth + 0.035, width: 0.012, height: cabinetHeight - 0.18, depth: 0.018, color: '#8f7658', castShadow: false });
  }

  for (let index = 0; index < doorCount; index += 1) {
    const doorLeft = width * index / doorCount;
    addBox(group, {
      x: doorLeft + width / doorCount - 0.08,
      y: cabinetHeight * 0.48,
      z: depth + 0.05,
      width: 0.028,
      height: 0.16,
      depth: 0.018,
      color: '#6f5539',
      materialOptions: { metalness: 0.08 },
      castShadow: false,
    });
  }

  addLabelToGroup(group, object.label, width, cabinetHeight, depth);
}

function addCurtainModel(group, object, width, depth) {
  const height = Math.max(0.4, safeNumber(object.surfaceHeight, 2.4));
  const foldCount = Math.max(6, Math.min(26, Math.round(width / 0.16)));
  const foldWidth = width / foldCount;
  const centerZ = Math.max(0.03, depth / 2);

  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, width + 0.08, 16),
    makeMaterial('#4c7f6e', { roughness: 0.5 }),
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(width / 2, height + 0.05, centerZ);
  rail.castShadow = true;
  group.add(rail);

  for (let index = 0; index < foldCount; index += 1) {
    const isForward = index % 2 === 0;
    const foldDepth = isForward ? 0.075 : 0.045;
    const foldColor = isForward ? '#8fb8a8' : '#78a88e';
    const foldX = index * foldWidth;
    const foldOffset = isForward ? 0.012 : -0.018;
    addBox(group, {
      x: foldX,
      y: 0,
      z: centerZ + foldOffset,
      width: foldWidth * 0.78,
      height,
      depth: foldDepth,
      color: foldColor,
      materialOptions: { roughness: 0.92, transparent: true, opacity: 0.9 },
      receiveShadow: false,
    });
    addBox(group, {
      x: foldX,
      y: 0,
      z: centerZ - foldOffset - foldDepth,
      width: foldWidth * 0.78,
      height,
      depth: foldDepth,
      color: foldColor,
      materialOptions: { roughness: 0.92, transparent: true, opacity: 0.9 },
      receiveShadow: false,
    });
  }
}

function addWindowModel(group, object, width, depth) {
  const height = Math.max(0.35, safeNumber(object.surfaceHeight, 1.2));
  const bottom = safeNumber(object.surfaceBottom, 0.9);
  const glassDepth = 0.025;
  const frameDepth = 0.04;
  const centerZ = Math.max(frameDepth / 2, depth / 2);
  addBox(group, { x: 0, y: bottom, z: centerZ - glassDepth / 2, width, height, depth: glassDepth, color: '#d9f0fa', materialOptions: { transparent: true, opacity: 0.48, roughness: 0.08 }, castShadow: false });
  [centerZ - frameDepth / 2, centerZ + frameDepth / 2].forEach((frameZ) => {
    addBox(group, { x: 0, y: bottom, z: frameZ, width, height: 0.045, depth: frameDepth, color: '#4d8caf' });
    addBox(group, { x: 0, y: bottom + height - 0.045, z: frameZ, width, height: 0.045, depth: frameDepth, color: '#4d8caf' });
    addBox(group, { x: 0, y: bottom, z: frameZ, width: 0.045, height, depth: frameDepth, color: '#4d8caf' });
    addBox(group, { x: width - 0.045, y: bottom, z: frameZ, width: 0.045, height, depth: frameDepth, color: '#4d8caf' });
    addBox(group, { x: width / 2 - 0.015, y: bottom + 0.05, z: frameZ, width: 0.03, height: height - 0.1, depth: frameDepth, color: '#4d8caf' });
  });
}

function addDoorModel(group, object, width, depth) {
  const height = Math.max(1.8, safeNumber(object.surfaceHeight, 2.1));
  const panelDepth = 0.055;
  const centerZ = Math.max(panelDepth / 2, depth / 2);
  addBox(group, { z: centerZ - panelDepth / 2, width, height, depth: panelDepth, color: '#9d744d', materialOptions: { roughness: 0.62 } });
  addBox(group, { x: width * 0.12, y: height * 0.12, z: centerZ + panelDepth / 2, width: width * 0.76, height: height * 0.72, depth: 0.018, color: '#b18a61', materialOptions: { roughness: 0.58 }, castShadow: false });
  addBox(group, { x: width * 0.12, y: height * 0.12, z: centerZ - panelDepth / 2 - 0.018, width: width * 0.76, height: height * 0.72, depth: 0.018, color: '#b18a61', materialOptions: { roughness: 0.58 }, castShadow: false });
  const knob = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 12),
    makeMaterial('#d0a85a', { metalness: 0.15, roughness: 0.38 }),
  );
  knob.position.set(width * 0.82, height * 0.48, centerZ + panelDepth / 2 + 0.035);
  group.add(knob);
  const backKnob = knob.clone();
  backKnob.position.set(width * 0.18, height * 0.48, centerZ - panelDepth / 2 - 0.035);
  group.add(backKnob);
}

function addTableTop(group, width, depth, x, z, color = '#b9915f') {
  addBox(group, { x, y: 0.72, z, width, height: 0.08, depth, color, materialOptions: { roughness: 0.48 } });
  const legSize = 0.055;
  [
    [x + 0.08, z + 0.08],
    [x + width - 0.08 - legSize, z + 0.08],
    [x + 0.08, z + depth - 0.08 - legSize],
    [x + width - 0.08 - legSize, z + depth - 0.08 - legSize],
  ].forEach(([legX, legZ]) => {
    addBox(group, { x: legX, y: 0, z: legZ, width: legSize, height: 0.72, depth: legSize, color: '#8b653d' });
  });
}

function addChairModel(group, x, z, width, depth, rotation = 0) {
  const chair = new THREE.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = -THREE.MathUtils.degToRad(rotation);
  addBox(chair, { y: 0.28, width, height: 0.08, depth, color: '#9eb0c0', materialOptions: { roughness: 0.74 } });
  addBox(chair, { y: 0.36, z: 0, width, height: 0.38, depth: 0.055, color: '#7f909d', materialOptions: { roughness: 0.76 } });
  group.add(chair);
}

function addDiningSetModel(group, object, width, depth) {
  const dims = object.dimensions ?? {};
  const chairWidth = Math.max(0.3, safeNumber(dims.chairWidthCm, 45) / 100);
  const chairDepth = Math.max(0.3, safeNumber(dims.chairDepthCm, 50) / 100);

  if (object.tableShape === 'round' || object.objectVariant === 'round4') {
    const diameter = Math.max(0.6, safeNumber(dims.diameterCm, 120) / 100);
    const centerX = width / 2;
    const centerZ = depth / 2;
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(diameter / 2, diameter / 2, 0.08, 40),
      makeMaterial('#b9915f', { roughness: 0.48 }),
    );
    table.position.set(centerX, 0.76, centerZ);
    table.castShadow = true;
    group.add(table);
    addBox(group, { x: centerX - 0.05, y: 0, z: centerZ - 0.05, width: 0.1, height: 0.74, depth: 0.1, color: '#8b653d' });
    addChairModel(group, centerX - chairWidth / 2, centerZ - diameter / 2 - chairDepth - 0.08, chairWidth, chairDepth, 0);
    addChairModel(group, centerX + diameter / 2 + 0.08, centerZ - chairWidth / 2, chairWidth, chairDepth, 90);
    addChairModel(group, centerX - chairWidth / 2, centerZ + diameter / 2 + 0.08, chairWidth, chairDepth, 180);
    addChairModel(group, centerX - diameter / 2 - chairDepth - 0.08, centerZ + chairWidth / 2, chairWidth, chairDepth, -90);
  } else {
    const tableLength = Math.max(0.8, safeNumber(dims.lengthCm, 180) / 100);
    const tableWidth = Math.max(0.55, safeNumber(dims.widthCm, 90) / 100);
    const tableX = (width - tableLength) / 2;
    const tableZ = (depth - tableWidth) / 2;
    addTableTop(group, tableLength, tableWidth, tableX, tableZ);

    const chairCount = Math.max(4, safeNumber(object.chairs, 4));
    const longSideChairs = chairCount >= 8 ? 3 : Math.max(2, Math.floor(chairCount / 2));
    for (let index = 0; index < longSideChairs; index += 1) {
      const x = tableX + tableLength * (index + 0.5) / longSideChairs - chairWidth / 2;
      addChairModel(group, x, tableZ - chairDepth - 0.08, chairWidth, chairDepth, 0);
      addChairModel(group, x + chairWidth, tableZ + tableWidth + chairDepth + 0.08, chairWidth, chairDepth, 180);
    }
    if (chairCount >= 8) {
      addChairModel(group, tableX - chairDepth - 0.08, tableZ + tableWidth / 2 + chairWidth / 2, chairWidth, chairDepth, -90);
      addChairModel(group, tableX + tableLength + chairDepth + 0.08, tableZ + tableWidth / 2 - chairWidth / 2, chairWidth, chairDepth, 90);
    }
  }

  addLabelToGroup(group, object.label, width, 0.82, depth);
}

function addTvModel(group, object, width, depth) {
  const screenHeight = Math.min(0.95, Math.max(0.45, width * 0.55));
  addBox(group, { x: 0, y: 0.7, z: depth * 0.32, width, height: screenHeight, depth: 0.055, color: '#111827', materialOptions: { roughness: 0.28 } });
  addBox(group, { x: width * 0.08, y: 0.76, z: depth * 0.32 + 0.058, width: width * 0.84, height: screenHeight * 0.82, depth: 0.012, color: '#273241', materialOptions: { roughness: 0.18 } });
  addBox(group, { x: width / 2 - 0.035, y: 0.26, z: depth * 0.5, width: 0.07, height: 0.44, depth: 0.05, color: '#1f2937' });
  addBox(group, { x: width * 0.32, y: 0.2, z: depth * 0.35, width: width * 0.36, height: 0.045, depth: depth * 0.3, color: '#1f2937' });
  addLabelToGroup(group, object.label, width, 1.55, depth);
}

function addTvCabinetModel(group, object, width, depth) {
  const height = 0.48;
  addBox(group, { width, height, depth, color: '#a98255', materialOptions: { roughness: 0.54 } });
  addBox(group, { x: 0.04, y: 0.08, z: depth + 0.006, width: width - 0.08, height: height - 0.16, depth: 0.02, color: '#c8ad85' });
  addBox(group, { x: width / 3 - 0.006, y: 0.08, z: depth + 0.035, width: 0.012, height: height - 0.16, depth: 0.018, color: '#866b4c', castShadow: false });
  addBox(group, { x: width * 2 / 3 - 0.006, y: 0.08, z: depth + 0.035, width: 0.012, height: height - 0.16, depth: 0.018, color: '#866b4c', castShadow: false });
  addLabelToGroup(group, object.label, width, height, depth);
}

function addPlantModel(group, object, width, depth) {
  const height = Math.max(0.5, safeNumber(object.surfaceHeight, 1.1));
  const centerX = width / 2;
  const centerZ = depth / 2;
  const potRadius = Math.max(0.12, Math.min(width, depth) * 0.22);
  const potHeight = Math.min(0.42, Math.max(0.2, height * 0.18));
  const leafRadius = Math.max(0.12, Math.min(width, depth) * 0.18);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(potRadius * 0.82, potRadius, potHeight, 24),
    makeMaterial('#b58a55', { roughness: 0.72 }),
  );
  pot.position.set(centerX, potHeight / 2, centerZ);
  pot.castShadow = true;
  pot.receiveShadow = true;
  group.add(pot);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(potRadius * 0.78, potRadius * 0.78, 0.025, 24),
    makeMaterial('#5a3d25', { roughness: 0.9 }),
  );
  soil.position.set(centerX, potHeight + 0.016, centerZ);
  group.add(soil);

  const stemHeight = Math.max(0.2, height - potHeight - leafRadius * 1.3);
  addBox(group, {
    x: centerX - 0.025,
    y: potHeight,
    z: centerZ - 0.025,
    width: 0.05,
    height: stemHeight,
    depth: 0.05,
    color: '#6a5a2f',
    materialOptions: { roughness: 0.82 },
  });

  const leafMaterialA = makeMaterial('#5f9f68', { roughness: 0.9 });
  const leafMaterialB = makeMaterial('#3f7f4a', { roughness: 0.92 });
  const leafCount = height > 1.5 ? 9 : 7;
  for (let index = 0; index < leafCount; index += 1) {
    const angle = index / leafCount * Math.PI * 2;
    const layer = index % 3;
    const radius = leafRadius * (layer === 0 ? 1 : 0.82);
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 12),
      index % 2 === 0 ? leafMaterialA : leafMaterialB,
    );
    leaf.scale.set(1.45, 0.55, 0.78);
    leaf.position.set(
      centerX + Math.cos(angle) * leafRadius * 1.55,
      potHeight + stemHeight * (0.42 + layer * 0.16),
      centerZ + Math.sin(angle) * leafRadius * 1.35,
    );
    leaf.rotation.y = -angle;
    leaf.castShadow = true;
    group.add(leaf);
  }

  addLabelToGroup(group, object.label, width, Math.min(height + 0.1, 2.2), depth);
}

function addArtwork(scene, object, room) {
  const product = acousticProducts.find((item) => item.id === object.productId);
  const width = safeNumber(object.width, product?.widthMeters ?? 1);
  const artworkHeight = safeNumber(object.surfaceHeight, product?.heightMeters ?? 1.2);
  const planDepth = safeNumber(object.height, product?.planDepthMeters ?? 0.04);
  const roomHeight = Math.max(2.2, safeNumber(room.heightMeters, 2.7));
  const frameDepth = 0.055;
  const bottom = Math.max(0.08, (roomHeight - artworkHeight) / 2);
  const group = createObjectGroup(object, room);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.05, artworkHeight + 0.05, frameDepth),
    makeMaterial('#061f47', { roughness: 0.38 }),
  );
  frame.position.set(width / 2, bottom + artworkHeight / 2, planDepth / 2);
  frame.castShadow = true;
  group.add(frame);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(width, artworkHeight),
    createArtworkFaceMaterial(product),
  );
  face.position.set(width / 2, bottom + artworkHeight / 2, planDepth / 2 + frameDepth / 2 + 0.006);
  group.add(face);

  const backFace = new THREE.Mesh(
    new THREE.PlaneGeometry(width, artworkHeight),
    createArtworkFaceMaterial(product),
  );
  backFace.rotation.y = Math.PI;
  backFace.position.set(width / 2, bottom + artworkHeight / 2, planDepth / 2 - frameDepth / 2 - 0.006);
  group.add(backFace);

  if (!product?.imageUrl) {
    const accent = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.82, 0.025, frameDepth + 0.018),
      makeMaterial('#d6b46a', { roughness: 0.35, metalness: 0.05 }),
    );
    accent.position.copy(frame.position);
    accent.position.y += artworkHeight * 0.18;
    accent.translateZ(0.018);
    group.add(accent);
  }

  const label = createLabel(product?.name?.replace('Akoestisch kunstwerk ', '') ?? 'Kunstwerk');
  label.position.set(width / 2, bottom + artworkHeight + 0.34, planDepth / 2);
  group.add(label);
  scene.add(group);
}

function addObject(scene, object, room) {
  if (object.productId) {
    addArtwork(scene, object, room);
    return;
  }

  const width = Math.max(0.08, safeNumber(object.width, 0.3));
  const depth = Math.max(0.04, safeNumber(object.height, 0.3));
  const color = getObjectColor(object);
  const group = createObjectGroup(object, room);

  const heights = {
    table: 0.74,
    chair: 0.45,
    sofa: 0.72,
    diningSet: 0.74,
    seating: 0.72,
    cabinet: safeNumber(object.surfaceHeight, 1.8),
    tv: 1.1,
    'tv-cabinet': 0.48,
    curtain: safeNumber(object.surfaceHeight, 2.4),
    window: safeNumber(object.surfaceHeight, 1.2),
    door: 2.1,
    rug: 0.025,
    plant: safeNumber(object.surfaceHeight, 1.1),
  };

  const objectHeight = heights[object.type] ?? 0.55;
  const surfaceBottom = object.type === 'window' ? safeNumber(object.surfaceBottom, 0.9) : 0;
  const y = object.type === 'rug' ? objectHeight / 2 + 0.006 : surfaceBottom + objectHeight / 2;
  const renderDepth = object.type === 'window' || object.type === 'curtain' || object.type === 'door' ? 0.04 : depth;
  const centerDepth = depth / 2;

  if (object.type === 'seating' || object.type === 'sofa') {
    addSeatingModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'cabinet') {
    addCabinetModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'curtain') {
    addCurtainModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'window') {
    addWindowModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'door') {
    addDoorModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'diningSet' || object.type === 'table') {
    addDiningSetModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'tv') {
    addTvModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'tv-cabinet') {
    addTvCabinetModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  if (object.type === 'plant') {
    addPlantModel(group, object, width, depth);
    scene.add(group);
    return;
  }

  const geometry = new THREE.BoxGeometry(width, objectHeight, renderDepth);
  const material = makeMaterial(color, {
    transparent: object.type === 'window',
    opacity: object.type === 'window' ? 0.52 : 1,
    roughness: object.type === 'window' ? 0.08 : 0.58,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(width / 2, y, centerDepth);
  mesh.castShadow = object.type !== 'rug';
  mesh.receiveShadow = true;
  group.add(mesh);

  if (['table', 'sofa', 'diningSet', 'seating', 'cabinet', 'tv-cabinet'].includes(object.type)) {
    const label = createLabel(object.label);
    label.position.set(width / 2, objectHeight + 0.32, centerDepth);
    group.add(label);
  }

  scene.add(group);
}

function downloadCanvas(renderer) {
  const link = document.createElement('a');
  link.download = 'baskoestiek-3d-preview.png';
  link.href = renderer.domElement.toDataURL('image/png');
  link.click();
}

export default function RoomSketch3D({ sketchData, onClose }) {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    mount.replaceChildren();

    const room = sketchData?.room ?? {};
    const objects = Array.isArray(sketchData?.objects) ? sketchData.objects : [];
    const length = Math.max(1, safeNumber(room.lengthMeters, 8));
    const width = Math.max(1, safeNumber(room.widthMeters, 5));
    const height = Math.max(2.2, safeNumber(room.heightMeters, 2.7));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef3f8');
    scene.fog = new THREE.Fog('#eef3f8', 12, 28);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(length * 0.58, height * 1.5, width * 0.82 + 3);
    camera.lookAt(0, 1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, Math.min(1.4, height / 2), 0);
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance = 2.5;
    controls.maxDistance = Math.max(10, Math.max(length, width) * 2.2);

    scene.add(new THREE.HemisphereLight('#ffffff', '#c9d2dc', 1.8));
    const keyLight = new THREE.DirectionalLight('#ffffff', 2.2);
    keyLight.position.set(-4, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const warmLight = new THREE.PointLight('#ffd7a1', 1.8, 18);
    warmLight.position.set(0, height - 0.35, 0);
    scene.add(warmLight);

    addRoom(scene, room);
    objects.forEach((object) => addObject(scene, object, room));

    function resize() {
      const rect = mount.getBoundingClientRect();
      const nextWidth = Math.max(320, rect.width);
      const nextHeight = Math.max(360, rect.height);
      renderer.setSize(nextWidth, nextHeight, false);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let animationFrame = 0;
    function animate() {
      controls.update();
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) {
          const disposeMaterial = (material) => {
            if (material.map) material.map.dispose();
            material.dispose();
          };
          if (Array.isArray(item.material)) item.material.forEach(disposeMaterial);
          else disposeMaterial(item.material);
        }
      });
      rendererRef.current = null;
    };
  }, [sketchData]);

  return (
    <div className="room3dOverlay" role="dialog" aria-modal="true" aria-label="3D weergave van de ruimte">
      <div className="room3dTopbar">
        <div>
          <span>BasKoestiek 3D preview</span>
          <h2>Ruimte in 3D</h2>
        </div>
        <div className="room3dActions">
          <button type="button" className="secondaryButton" onClick={() => rendererRef.current && downloadCanvas(rendererRef.current)}>
            <Download size={17} />
            Download beeld
          </button>
          <button type="button" className="primaryButton" onClick={onClose}>
            <X size={17} />
            Sluiten
          </button>
        </div>
      </div>
      <div className="room3dCanvas" ref={mountRef} />
      <div className="room3dHint">
        Sleep om te draaien. Scroll of knijp om in te zoomen. Akoestische kunstwerken worden als wandpanelen op kijkhoogte getoond.
      </div>
    </div>
  );
}
