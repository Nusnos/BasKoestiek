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
    cabinet: '#b89263',
    tv: '#111827',
    'tv-cabinet': '#a98255',
    curtain: '#78a88e',
    window: '#7fc7ec',
    door: '#9d744d',
    rug: '#a86f73',
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

function isWallMountedObject(object) {
  return ['window', 'curtain', 'door', 'tv'].includes(object.type);
}

function addArtwork(scene, object, room) {
  const product = acousticProducts.find((item) => item.id === object.productId);
  const width = safeNumber(object.width, product?.widthMeters ?? 1);
  const artworkHeight = safeNumber(object.surfaceHeight, product?.heightMeters ?? 1.2);
  const planDepth = safeNumber(object.height, product?.planDepthMeters ?? 0.04);
  const frameDepth = 0.055;
  const bottom = 0.78;
  const group = createObjectGroup(object, room);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.05, artworkHeight + 0.05, frameDepth),
    makeMaterial('#061f47', { roughness: 0.38 }),
  );
  frame.position.set(width / 2, bottom + artworkHeight / 2, planDepth / 2);
  frame.castShadow = true;
  group.add(frame);

  const face = new THREE.Mesh(
    new THREE.BoxGeometry(width, artworkHeight, frameDepth + 0.01),
    makeMaterial('#0d3a78', { roughness: 0.46 }),
  );
  face.position.copy(frame.position);
  face.translateZ(0.008);
  group.add(face);

  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.82, 0.025, frameDepth + 0.018),
    makeMaterial('#d6b46a', { roughness: 0.35, metalness: 0.05 }),
  );
  accent.position.copy(face.position);
  accent.position.y += artworkHeight * 0.18;
  accent.translateZ(0.018);
  group.add(accent);

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
    cabinet: 1.45,
    tv: 1.1,
    'tv-cabinet': 0.48,
    curtain: safeNumber(object.surfaceHeight, 2.4),
    window: safeNumber(object.surfaceHeight, 1.2),
    door: 2.1,
    rug: 0.025,
  };

  const objectHeight = heights[object.type] ?? 0.55;
  const y = object.type === 'rug' ? objectHeight / 2 + 0.006 : objectHeight / 2;
  const renderDepth = object.type === 'window' || object.type === 'curtain' || object.type === 'door' ? 0.04 : depth;
  const centerDepth = isWallMountedObject(object) ? renderDepth / 2 : depth / 2;
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

  if (['table', 'sofa', 'cabinet', 'tv-cabinet'].includes(object.type)) {
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
          if (Array.isArray(item.material)) item.material.forEach((material) => material.dispose());
          else item.material.dispose();
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
