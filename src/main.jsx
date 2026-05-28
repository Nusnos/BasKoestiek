import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Printer, Save, FolderOpen, Trash2 } from 'lucide-react';
import ReportsPanel from './ReportsPanel.jsx';
import { generateCustomerReport, generateInternalReport, getRealisticArtworkAdvice } from './reportGenerators.js';
import { quickscanTexts } from './content/quickscanTexts.js';
import './styles.css';

const RoomSketcher = React.lazy(() => import('./RoomSketcher.jsx'));

const STORAGE_KEY = 'baskoestiek-projecten-v1';

const materialPresets = [
  { id: 'pet-9', label: '9 mm PET-vilt' },
  { id: 'pet-12', label: '12 mm PET-vilt' },
  { id: 'custom', label: 'Zelf NRC invullen' },
];

const mountingPresets = [
  { id: 'direct', label: 'Direct op wand' },
  { id: 'gap-50', label: '50 mm luchtspouw' },
  { id: 'gap-100', label: '100 mm luchtspouw' },
  { id: 'gap-absorber', label: 'Luchtspouw + absorber' },
];

const panelCombinations = [
  { materialId: 'pet-9', mountingId: 'direct', nrc: 0.30 },
  { materialId: 'pet-9', mountingId: 'gap-50', nrc: 0.65 },
  { materialId: 'pet-9', mountingId: 'gap-100', nrc: 0.80 },
  { materialId: 'pet-9', mountingId: 'gap-absorber', nrc: 1.00 },
  { materialId: 'pet-12', mountingId: 'direct', nrc: 0.40 },
  { materialId: 'pet-12', mountingId: 'gap-50', nrc: 0.70 },
];

const roomUsageOptions = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'woning', label: 'Woning' },
];

const restaurantCurrentRtPresets = [
  { id: 'very-hard', label: 'Zeer harde ruimte: glas, beton, tegels, weinig stoffering', value: 1.8 },
  { id: 'hard-restaurant', label: 'Harde restaurantzaal', value: 1.5 },
  { id: 'average', label: 'Gemiddeld restaurant', value: 1.2 },
  { id: 'partly-dressed', label: 'Al deels aangekleed', value: 1.0 },
  { id: 'comfortable', label: 'Redelijk comfortabel', value: 0.9 },
];

const homeCurrentRtPresets = [
  { id: 'home-very-hard', label: 'Zeer harde woning: veel glas, harde vloer, weinig textiel', value: 1.2 },
  { id: 'home-hard', label: 'Harde woonkamer / open keuken', value: 1.0 },
  { id: 'home-average', label: 'Gemiddelde woning', value: 0.8 },
  { id: 'home-dressed', label: 'Al deels aangekleed met gordijnen of vloerkleed', value: 0.7 },
  { id: 'home-comfortable', label: 'Comfortabel ingerichte woning', value: 0.6 },
];

const restaurantTargetRtPresets = [
  { id: 'basic', label: 'Levendig / basis', value: 1.0 },
  { id: 'comfort', label: 'Comfort', value: 0.9 },
  { id: 'premium', label: 'Premium restaurant', value: 0.8 },
  { id: 'luxury', label: 'Rustig / luxe', value: 0.7 },
];

const homeTargetRtPresets = [
  { id: 'home-basic', label: 'Basis wooncomfort', value: 0.8 },
  { id: 'home-comfort', label: 'Comfortabel wonen', value: 0.7 },
  { id: 'home-quiet', label: 'Rustig wonen', value: 0.6 },
  { id: 'home-luxury', label: 'Zeer rustig / luxe wooncomfort', value: 0.5 },
];

const ceilingPresets = [
  {
    id: 'flat',
    label: 'Vlak hard plafond',
    rtFactor: 1,
    description: 'Geen extra plafondcorrectie',
  },
  {
    id: 'industrial',
    label: 'Industrieel plafond met kokers en leidingen',
    rtFactor: 0.95,
    description: 'Kleine correctie door verstrooiing en obstakels',
  },
];

const solutionModes = [
  { id: 'wall', label: 'Alleen wandpanelen' },
  { id: 'ceiling', label: 'Alleen plafondobjecten' },
  { id: 'combined', label: 'Combinatie wandpanelen + plafondobjecten' },
];

const ceilingObjectTypes = [
  { id: 'none', label: 'Geen plafondobjecten', factor: 0 },
  { id: 'flat-ceiling-panel', label: 'Paneel vlak tegen plafond', factor: 1.0 },
  { id: 'cloud', label: 'Vrijhangende ceiling cloud', factor: 1.6 },
  { id: 'baffle', label: 'Verticale baffle', factor: 1.8 },
  { id: 'object-3d', label: '3D akoestisch object', factor: 2.0 },
  { id: 'custom', label: 'Eigen type', factor: 1.5 },
];

const ceilingCalculationMethods = [
  { id: 'nrc', label: 'NRC + oppervlak' },
  { id: 'sabins', label: 'Sabins per object' },
];

const splitPresets = [
  { id: '70-30', label: '70% wand / 30% plafond', wall: 70 },
  { id: '50-50', label: '50% wand / 50% plafond', wall: 50 },
  { id: '30-70', label: '30% wand / 70% plafond', wall: 30 },
  { id: 'custom', label: 'Eigen verdeling', wall: null },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function clampNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function readSavedProjects() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedProjects(projects) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function getMountingOptions(materialId) {
  if (materialId === 'custom') return [];
  const allowedIds = panelCombinations
    .filter((item) => item.materialId === materialId)
    .map((item) => item.mountingId);
  return mountingPresets.filter((item) => allowedIds.includes(item.id));
}

function getPanelCombination(materialId, mountingId) {
  return panelCombinations.find((item) => item.materialId === materialId && item.mountingId === mountingId);
}

function getPanelLabel(materialId, mountingId) {
  const material = materialPresets.find((item) => item.id === materialId);
  const mounting = mountingPresets.find((item) => item.id === mountingId);
  if (materialId === 'custom') return 'Zelf ingevulde NRC-waarde';
  return [material?.label, mounting?.label].filter(Boolean).join(' · ');
}

function migratePanelSelection(selectedPanelId) {
  const map = {
    'pet-9-direct': { materialId: 'pet-9', mountingId: 'direct' },
    'pet-9-50': { materialId: 'pet-9', mountingId: 'gap-50' },
    'pet-9-100': { materialId: 'pet-9', mountingId: 'gap-100' },
    'pet-9-absorber': { materialId: 'pet-9', mountingId: 'gap-absorber' },
    'pet-12-direct': { materialId: 'pet-12', mountingId: 'direct' },
    'pet-12-gap': { materialId: 'pet-12', mountingId: 'gap-50' },
    custom: { materialId: 'custom', mountingId: 'direct' },
  };
  return map[selectedPanelId] ?? { materialId: 'pet-9', mountingId: 'gap-50' };
}

function getCrowdingLabel(score) {
  if (score >= 40) return 'Zeer comfortabel / ruim';
  if (score >= 25) return 'Goed / premium';
  if (score >= 16) return 'Bruikbaar restaurantniveau';
  if (score >= 10) return 'Druk / risico op rumoer';
  return 'Zeer druk; alleen wandpanelen lossen waarschijnlijk niet alles op';
}

function calculateRoomVolume(length, width, height) {
  return length * width * height;
}

function calculateRequiredAbsorption(volume, reverbTime) {
  // Sabine basis: A = 0,16 x V / T.
  return reverbTime > 0 ? 0.16 * volume / reverbTime : 0;
}

function calculateWallPanelAbsorption(panelWidth, panelHeight, nrc) {
  const panelArea = panelWidth * panelHeight;
  return {
    panelArea,
    absorptionPerPanel: panelArea * nrc,
  };
}

function calculateCeilingObjectAbsorption({
  method,
  width,
  length,
  nrc,
  correctionFactor,
  sabinsPerObject,
  objectCount,
}) {
  const objectArea = width * length;
  const effectiveAbsorptionPerObject = method === 'sabins'
    ? sabinsPerObject
    : objectArea * nrc * correctionFactor;
  const safeAbsorptionPerObject = Math.max(0, effectiveAbsorptionPerObject || 0);

  return {
    objectArea,
    effectiveAbsorptionPerObject: safeAbsorptionPerObject,
    totalAbsorption: safeAbsorptionPerObject * objectCount,
  };
}

function calculateNewReverbTime(volume, totalAbsorption) {
  // Sabine basis omgekeerd: T = 0,16 x V / A.
  return totalAbsorption > 0 ? 0.16 * volume / totalAbsorption : 0;
}

function getComfortLevel(reverbTime) {
  if (!Number.isFinite(reverbTime) || reverbTime <= 0) return { label: 'Nog niet berekend', score: 0 };
  if (reverbTime > 1.05) return { label: 'Harde woning', score: 12 };
  if (reverbTime > 0.9) return { label: 'Levendige woning', score: 32 };
  if (reverbTime > 0.75) return { label: 'Comfortabel wonen', score: 55 };
  if (reverbTime > 0.62) return { label: 'Rustig wooncomfort', score: 78 };
  return { label: 'Luxe wooncomfort', score: 96 };
}

function formatArtworkCombination(combination) {
  const text = combination?.items
    ?.filter((item) => item.count > 0)
    .map((item) => `${item.count}x ${item.name.replace('Akoestisch kunstwerk ', '')}`)
    .join(' + ');
  return text || 'Persoonlijk advies';
}

function getArtworkEffect({ volume, currentRt, combination }) {
  const baseAbsorption = calculateRequiredAbsorption(volume, currentRt);
  const addedAbsorption = combination?.totalSabins ?? 0;
  const reverbTime = calculateNewReverbTime(volume, baseAbsorption + addedAbsorption);
  return {
    reverbTime,
    comfort: getComfortLevel(reverbTime),
  };
}

function calculateCrowdingScore(volume, seats, targetRt) {
  return seats > 0 && targetRt > 0 ? volume / (seats * targetRt) : 0;
}

function calculateNeededCount(absorptionNeeded, absorptionPerItem) {
  return absorptionNeeded > 0 && absorptionPerItem > 0 ? Math.ceil(absorptionNeeded / absorptionPerItem) : 0;
}

function calcAcousticAdvice({
  length,
  width,
  height,
  seats,
  panelWidth,
  panelHeight,
  nrc,
  currentRt,
  targetRt,
  ceiling,
  solutionMode,
  splitWallPercent,
  ceilingObject,
}) {
  const floorArea = length * width;
  const volume = calculateRoomVolume(length, width, height);
  const { panelArea, absorptionPerPanel } = calculateWallPanelAbsorption(panelWidth, panelHeight, nrc);
  const effectiveCurrentRt = currentRt * (ceiling?.rtFactor ?? 1);
  const ceilingAbsorption = calculateCeilingObjectAbsorption(ceilingObject);
  const hasCeilingSolution = solutionMode === 'ceiling' || solutionMode === 'combined';
  const hasWallSolution = solutionMode === 'wall' || solutionMode === 'combined';
  const hasRequiredInput = floorArea > 0 && volume > 0 && effectiveCurrentRt > 0 && targetRt > 0
    && (!hasWallSolution || (panelArea > 0 && nrc > 0))
    && (!hasCeilingSolution || ceilingAbsorption.effectiveAbsorptionPerObject > 0);

  if (!hasRequiredInput) {
    const validationMessage = hasCeilingSolution && ceilingAbsorption.effectiveAbsorptionPerObject <= 0
      ? 'Vul de plafondobjectgegevens in om een advies met plafondobjecten te berekenen.'
      : 'Vul de ruimte- en paneelgegevens in om een advies te berekenen.';
    return {
      hasRequiredInput,
      validationMessage,
      floorArea,
      volume,
      panelArea,
      objectArea: ceilingAbsorption.objectArea,
      effectiveCurrentRt,
      existingAbsorption: 0,
      targetAbsorption: 0,
      extraAbsorptionRaw: 0,
      extraAbsorption: 0,
      wallAbsorptionNeeded: 0,
      ceilingAbsorptionNeeded: 0,
      feltArea: 0,
      panelCount: 0,
      absorptionPerPanel: 0,
      ceilingAbsorptionPerObject: ceilingAbsorption.effectiveAbsorptionPerObject,
      ceilingTotalAbsorptionInput: ceilingAbsorption.totalAbsorption,
      ceilingObjectCount: 0,
      ceilingRecommendedTotalAbsorption: 0,
      addedAbsorption: 0,
      newReverbTime: 0,
      crowdingScore: 0,
      crowdingLabel: 'Vul zitplaatsen en nagalmtijd in',
      quickComfortArea: floorArea * 0.20,
      quickPremiumArea: floorArea * 0.30,
      quickHeavyArea: floorArea * 0.40,
    };
  }

  const existingAbsorption = calculateRequiredAbsorption(volume, effectiveCurrentRt);
  const targetAbsorption = calculateRequiredAbsorption(volume, targetRt);
  const extraAbsorptionRaw = targetAbsorption - existingAbsorption;
  const extraAbsorption = Math.max(0, extraAbsorptionRaw);
  const wallShare = solutionMode === 'wall' ? 100 : solutionMode === 'ceiling' ? 0 : splitWallPercent;
  const wallAbsorptionNeeded = extraAbsorption * (wallShare / 100);
  const ceilingAbsorptionNeeded = extraAbsorption - wallAbsorptionNeeded;
  const feltArea = hasWallSolution && nrc > 0 ? wallAbsorptionNeeded / nrc : 0;
  const panelCount = calculateNeededCount(wallAbsorptionNeeded, absorptionPerPanel);
  const ceilingObjectCount = hasCeilingSolution
    ? calculateNeededCount(ceilingAbsorptionNeeded, ceilingAbsorption.effectiveAbsorptionPerObject)
    : 0;
  const wallAddedAbsorption = panelCount * absorptionPerPanel;
  const ceilingRecommendedTotalAbsorption = ceilingObjectCount * ceilingAbsorption.effectiveAbsorptionPerObject;
  const ceilingAddedAbsorption = hasCeilingSolution ? ceilingRecommendedTotalAbsorption : 0;
  const addedAbsorption = wallAddedAbsorption + ceilingAddedAbsorption;
  const newReverbTime = calculateNewReverbTime(volume, existingAbsorption + addedAbsorption);
  const crowdingScore = calculateCrowdingScore(volume, seats, targetRt);

  return {
    hasRequiredInput,
    validationMessage: '',
    floorArea,
    volume,
    panelArea,
    objectArea: ceilingAbsorption.objectArea,
    effectiveCurrentRt,
    existingAbsorption,
    targetAbsorption,
    extraAbsorptionRaw,
    extraAbsorption,
    wallAbsorptionNeeded,
    ceilingAbsorptionNeeded,
    feltArea,
    panelCount,
    absorptionPerPanel,
    ceilingAbsorptionPerObject: ceilingAbsorption.effectiveAbsorptionPerObject,
    ceilingTotalAbsorptionInput: ceilingAbsorption.totalAbsorption,
    ceilingObjectCount,
    ceilingRecommendedTotalAbsorption,
    addedAbsorption,
    newReverbTime,
    crowdingScore,
    crowdingLabel: getCrowdingLabel(crowdingScore),
    quickComfortArea: floorArea * 0.20,
    quickPremiumArea: floorArea * 0.30,
    quickHeavyArea: floorArea * 0.40,
  };
}

function getPlacementAdvice({ result, tables, seats, height, ceiling, solutionMode, roomUsage }) {
  if (roomUsage === 'woning') {
    const hasManyPanels = result.panelCount >= 4;
    const isHighRoom = height >= 3.1;
    const spreadAdvice = solutionMode === 'ceiling'
      ? 'Plaats plafondobjecten vooral boven de open zit- of leefzone, niet alleen decoratief verdeeld door de ruimte.'
      : solutionMode === 'combined'
        ? 'Een combinatie van wand en plafond kan in een woning goed werken: wandpanelen verbeteren reflecties op oorhoogte, plafondobjecten helpen bij open leefruimtes.'
        : hasManyPanels
          ? 'Verdeel de akoestische kunstwerken over meerdere reflecterende wandvlakken, bijvoorbeeld bij de zithoek, eethoek of lange kale wand.'
          : 'Een groter akoestisch kunstwerk kan goed werken op een duidelijke harde wand, bijvoorbeeld tegenover een zithoek of eettafel.';

    const sourceAdvice = solutionMode !== 'wall'
      ? 'Let bij plafondobjecten in een woning op verlichting, ophanging, zichtlijnen en de rust van het interieur.'
      : 'Plaats akoestische kunstwerken waar stemmen en dagelijkse leefgeluiden direct tegen harde wanden reflecteren.';

    const heightAdvice = isHighRoom
      ? 'Plaats wandoplossingen vooral rond oor- en spraakhoogte: ongeveer 0,80 tot 1,90 meter vanaf de vloer. Bij hoge ruimtes kan een extra hoger vlak helpen.'
      : 'Plaats wandoplossingen bij voorkeur rond oor- en spraakhoogte: ongeveer 0,80 tot 1,80 meter vanaf de vloer.';

    return {
      spreadAdvice,
      sourceAdvice,
      heightAdvice,
      ceilingAdvice: 'Voor woningen gaat deze snelle berekening standaard uit van een glad, vlak plafond zonder extra plafondcorrectie.',
    };
  }

  const seatsPerTable = tables > 0 ? seats / tables : seats;
  const hasManyPanels = result.panelCount >= 6;
  const isBusy = seats >= 60 || seatsPerTable >= 4.5;
  const isHighRoom = height >= 3.4;

  const spreadAdvice = solutionMode === 'ceiling'
    ? 'Plaats plafondobjecten bij voorkeur boven de drukste tafelzones, niet alleen decoratief verdeeld door de ruimte.'
    : solutionMode === 'combined'
      ? 'De combinatie van wandpanelen en plafondobjecten is vaak het sterkst: wandpanelen verminderen reflecties op oorhoogte, terwijl plafondobjecten boven tafels galm aanpakken.'
      : hasManyPanels || tables >= 8
    ? 'Kies bij voorkeur voor meerdere panelen verdeeld over verschillende wandvlakken rond de tafelzones, in plaats van één groot paneel op één plek.'
    : 'Een groter paneelvlak kan werken bij een duidelijke harde wand, maar verdeel waar mogelijk alsnog over minimaal twee wandzones.';

  const sourceAdvice = solutionMode !== 'wall'
    ? 'Vrijhangende clouds of baffles werken goed omdat ze geluid van meerdere zijden kunnen opnemen. Houd rekening met verlichting, ventilatie, sprinklers, schoonmaak, vet/damp, brandklasse en veilige ophanging.'
    : isBusy
    ? 'Behandel vooral de drukste tafelzones en de harde wanden direct naast of tegenover deze zones. Alleen bij één geluidsbron plaatsen is meestal minder effectief.'
    : 'Plaats panelen dicht bij de tafelzones en op wanden waar stemgeluid direct tegenaan kaatst.';

  const heightAdvice = isHighRoom
    ? 'Begin rond zithoogte tot oor-/spraakhoogte: ongeveer 0,75 tot 1,80 meter vanaf de vloer. Bij hoge, harde ruimtes kan een extra hoger wandvlak helpen tegen galm.'
    : 'Plaats panelen vooral rond tafelblad-, oor- en spraakhoogte van zittende gasten: ongeveer 0,75 tot 1,80 meter vanaf de vloer. Vloer-tot-plafond is meestal niet nodig.';

  const ceilingAdvice = ceiling.id === 'industrial'
    ? 'De kokers en leidingen aan het plafond zorgen voor wat verstrooiing en zijn daarom meegenomen als kleine correctie op de geschatte huidige nagalmtijd.'
    : 'Een vlak hard plafond geeft weinig verstrooiing. Als de ruimte hoog of hard blijft klinken, kan aanvullend plafondmateriaal helpen naast de wandpanelen.';

  return {
    spreadAdvice,
    sourceAdvice,
    heightAdvice,
    ceilingAdvice,
  };
}

function TextField({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="fieldInput">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}

function QuickscanTextBlock({ title, text, paragraphs, compact = false }) {
  const lines = paragraphs ?? String(text ?? '').split('\n\n').filter(Boolean);
  return (
    <div className={compact ? 'quickscanTextBlock compact' : 'quickscanTextBlock'}>
      {title && <h3>{title}</h3>}
      {lines.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </div>
  );
}

const startRoomTypeOptions = [
  { id: 'living-room', label: 'Woonkamer' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'office', label: 'Kantoor' },
  { id: 'waiting-room', label: 'Wachtruimte' },
  { id: 'other', label: 'Anders' },
];

const experienceOptions = [
  'Gesprekken klinken hard',
  'Veel galm',
  'Onrustige sfeer',
  'Moeilijk verstaanbaar',
  'Gewoon benieuwd',
];

function getRoomUsageFromStartType(type) {
  return type === 'restaurant' ? 'restaurant' : 'woning';
}

function getSketchTypeFromStartType(type) {
  if (type === 'waiting-room') return 'other';
  return type;
}

function StartScreen({ onStart, onSavedProjects }) {
  return (
    <section className="startScreen">
      <div className="startHeroImage">
        <img src="/baskoestiek-start-hero.png" alt="Gezellig diner met koptelefoons in een levendige ruimte" />
      </div>
      <div className="startHeroContent">
        <img className="startLogo" src="/baskoestiek-logo.png" alt="BasKoestiek" />
        <span>Ontdek in een paar stappen wat akoestische kunstwerken kunnen doen voor jouw ruimte.</span>
        <h1>Gezellig eten, maar toch te veel geluid?</h1>
        <p>
          In veel ruimtes kaatst geluid harder rond dan je denkt. Ontdek wat akoestische kunstwerken voor jouw ruimte kunnen doen.
        </p>
        <div className="startActions">
          <button className="primaryButton large" type="button" onClick={onStart}>
            Herken je dit?
          </button>
          <button className="secondaryButton" type="button" onClick={onSavedProjects}>
            <FolderOpen size={17} />
            Opgeslagen projecten
          </button>
        </div>
      </div>
    </section>
  );
}

function StartProjectModal({
  open,
  projectName,
  onProjectNameChange,
  roomType,
  onRoomTypeChange,
  experience,
  onExperienceChange,
  onContinue,
}) {
  if (!open) return null;

  return (
    <div className="modalBackdrop" role="presentation">
      <section className="flowModal" role="dialog" aria-modal="true" aria-labelledby="start-project-title">
        <div className="modalHeader">
          <span>Stap 1</span>
          <h2 id="start-project-title">Waar wil je meer rust creëren?</h2>
        </div>

        <label className="field">
          <span>Naam project / ruimte</span>
          <div className="fieldInput">
            <input value={projectName} onChange={(event) => onProjectNameChange(event.target.value)} placeholder="Bijvoorbeeld: woonkamer of restaurant voorzijde" />
          </div>
        </label>

        <div className="choiceBlock">
          <span>Type ruimte</span>
          <div className="choiceGrid">
            {startRoomTypeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={roomType === option.id ? 'choiceButton active' : 'choiceButton'}
                onClick={() => onRoomTypeChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="choiceBlock">
          <span>Wat ervaar je vooral?</span>
          <div className="choiceGrid">
            {experienceOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={experience === option ? 'choiceButton active' : 'choiceButton'}
                onClick={() => onExperienceChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="modalActions">
          <button className="primaryButton" type="button" onClick={onContinue}>
            Verder naar ruimte-schets
          </button>
        </div>
      </section>
    </div>
  );
}

function SavedProjectsPanel({
  savedProjects,
  storageMessage,
  onSave,
  onOpenProject,
  onDeleteProject,
  canSave = true,
}) {
  return (
    <div className="storagePanel inlineStorage">
      {canSave && (
        <div className="storageActions">
          <button className="secondaryButton" type="button" onClick={onSave}>
            <Save size={18} />
            Project opslaan
          </button>
          {storageMessage && <p className="storageMessage">{storageMessage}</p>}
        </div>
      )}
      {!canSave && storageMessage && <p className="storageMessage">{storageMessage}</p>}
      {savedProjects.length === 0 ? (
        <p className="emptyState">Nog geen projecten opgeslagen.</p>
      ) : (
        <div className="savedProjectList">
          {savedProjects.map((project) => (
            <div className="savedProject" key={project.id}>
              <div>
                <strong>{project.title}</strong>
                <span>
                  {project.inputs?.customerName || 'Geen klantnaam'} · {project.inputs?.projectCity || 'Geen plaats'} · {new Date(project.savedAt).toLocaleDateString('nl-NL')}
                </span>
                <em>
                  BasKoestiek quickscan · {project.inputs?.sketchData?.objects?.length ?? 0} objecten in de schets
                </em>
              </div>
              <div className="savedProjectActions">
                <button className="iconTextButton" type="button" onClick={() => onOpenProject(project)}>
                  <FolderOpen size={17} />
                  Openen
                </button>
                <button className="iconTextButton danger" type="button" onClick={() => onDeleteProject(project.id)}>
                  <Trash2 size={17} />
                  Verwijderen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, suffix, step = '0.1' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="fieldInput">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? '' : clampNumber(e.target.value))}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

function SpecRow({ label, value }) {
  return (
    <div className="specRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function App() {
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectCity, setProjectCity] = useState('');
  const [projectDate, setProjectDate] = useState(todayISO());
  const [roomUsage, setRoomUsage] = useState('woning');
  const [length, setLength] = useState(10);
  const [width, setWidth] = useState(8);
  const [height, setHeight] = useState(3);
  const [tables, setTables] = useState(12);
  const [seats, setSeats] = useState(48);
  const [panelWidth, setPanelWidth] = useState(2);
  const [panelHeight, setPanelHeight] = useState(3);
  const [selectedMaterialId, setSelectedMaterialId] = useState('pet-9');
  const [selectedMountingId, setSelectedMountingId] = useState('gap-50');
  const [customNrc, setCustomNrc] = useState(0.75);
  const [solutionMode, setSolutionMode] = useState('wall');
  const [ceilingObjectTypeId, setCeilingObjectTypeId] = useState('none');
  const [ceilingMethod, setCeilingMethod] = useState('nrc');
  const [ceilingObjectWidth, setCeilingObjectWidth] = useState(1.2);
  const [ceilingObjectLength, setCeilingObjectLength] = useState(1.2);
  const [ceilingObjectCount, setCeilingObjectCount] = useState(4);
  const [ceilingObjectNrc, setCeilingObjectNrc] = useState(0.85);
  const [ceilingCorrectionFactor, setCeilingCorrectionFactor] = useState(1.6);
  const [ceilingSabinsPerObject, setCeilingSabinsPerObject] = useState(1.8);
  const [splitPresetId, setSplitPresetId] = useState('50-50');
  const [customWallPercent, setCustomWallPercent] = useState(50);
  const [ceiling, setCeiling] = useState(ceilingPresets[0]);
  const [currentRtPreset, setCurrentRtPreset] = useState('home-very-hard');
  const [targetRtPreset, setTargetRtPreset] = useState('home-comfort');
  const [currentRt, setCurrentRt] = useState(1.2);
  const [targetRt, setTargetRt] = useState(0.7);
  const [savedProjects, setSavedProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [storageMessage, setStorageMessage] = useState('');
  const [showSavedProjects, setShowSavedProjects] = useState(false);
  const [showQuickEstimate, setShowQuickEstimate] = useState(false);
  const [showPlacementAdvice, setShowPlacementAdvice] = useState(false);
  const [showCustomerExplanation, setShowCustomerExplanation] = useState(false);
  const [showFullMainAdvice, setShowFullMainAdvice] = useState(false);
  const [calculationMode, setCalculationMode] = useState('sketch');
  const [quickStep, setQuickStep] = useState(1);
  const [sketchData, setSketchData] = useState(null);
  const [hasStartedQuickscan, setHasStartedQuickscan] = useState(false);
  const [showStartProjectModal, setShowStartProjectModal] = useState(false);
  const [startRoomType, setStartRoomType] = useState('living-room');
  const [projectExperience, setProjectExperience] = useState(experienceOptions[0]);
  const [openRoomSketchDetails, setOpenRoomSketchDetails] = useState(false);

  const mountingOptions = getMountingOptions(selectedMaterialId);
  const selectedCombination = getPanelCombination(selectedMaterialId, selectedMountingId);
  const materialLabel = materialPresets.find((item) => item.id === selectedMaterialId)?.label ?? '-';
  const mountingLabel = selectedMaterialId === 'custom'
    ? 'Zelf bepaald'
    : mountingPresets.find((item) => item.id === selectedMountingId)?.label ?? '-';
  const selectedCeilingObjectType = ceilingObjectTypes.find((item) => item.id === ceilingObjectTypeId) ?? ceilingObjectTypes[0];
  const selectedSplit = splitPresets.find((item) => item.id === splitPresetId) ?? splitPresets[1];
  const splitWallPercent = solutionMode === 'combined'
    ? (splitPresetId === 'custom' ? Math.min(100, customWallPercent) : selectedSplit.wall)
    : solutionMode === 'wall' ? 100 : 0;
  const nrc = selectedMaterialId === 'custom' ? customNrc : selectedCombination?.nrc ?? 0;
  const panelLabel = getPanelLabel(selectedMaterialId, selectedMountingId);
  const isHome = roomUsage === 'woning';
  const currentRtPresets = isHome ? homeCurrentRtPresets : restaurantCurrentRtPresets;
  const targetRtPresets = isHome ? homeTargetRtPresets : restaurantTargetRtPresets;
  const effectiveSeats = isHome ? 0 : seats;
  const roomTypeLabel = isHome ? 'woning' : 'restaurant';

  useEffect(() => {
    const options = getMountingOptions(selectedMaterialId);
    if (selectedMaterialId !== 'custom' && options.length > 0 && !options.some((item) => item.id === selectedMountingId)) {
      setSelectedMountingId(options[0].id);
    }
  }, [selectedMaterialId, selectedMountingId]);

  useEffect(() => {
    if (ceilingObjectTypeId !== 'custom') {
      setCeilingCorrectionFactor(selectedCeilingObjectType.factor);
    }
  }, [ceilingObjectTypeId, selectedCeilingObjectType.factor]);

  useEffect(() => {
    if (isHome && ceiling.id !== 'flat') {
      setCeiling(ceilingPresets[0]);
    }

    if (!currentRtPresets.some((item) => item.id === currentRtPreset)) {
      const preset = currentRtPresets[isHome ? 2 : 1];
      setCurrentRtPreset(preset.id);
      setCurrentRt(preset.value);
    }

    if (!targetRtPresets.some((item) => item.id === targetRtPreset)) {
      const preset = targetRtPresets[isHome ? 1 : 1];
      setTargetRtPreset(preset.id);
      setTargetRt(preset.value);
    }
  }, [isHome, ceiling.id, currentRtPreset, currentRtPresets, targetRtPreset, targetRtPresets]);

  const result = useMemo(() => calcAcousticAdvice({
    length,
    width,
    height,
    seats: effectiveSeats,
    panelWidth,
    panelHeight,
    nrc,
    currentRt,
    targetRt,
    ceiling,
    solutionMode,
    splitWallPercent,
    ceilingObject: {
      method: ceilingMethod,
      width: ceilingObjectWidth,
      length: ceilingObjectLength,
      nrc: ceilingObjectNrc,
      correctionFactor: ceilingCorrectionFactor,
      sabinsPerObject: ceilingSabinsPerObject,
      objectCount: ceilingObjectCount,
    },
  }), [length, width, height, effectiveSeats, panelWidth, panelHeight, nrc, currentRt, targetRt, ceiling, solutionMode, splitWallPercent, ceilingMethod, ceilingObjectWidth, ceilingObjectLength, ceilingObjectNrc, ceilingCorrectionFactor, ceilingSabinsPerObject, ceilingObjectCount]);

  const placementAdvice = useMemo(() => getPlacementAdvice({ result, tables, seats: effectiveSeats, height, ceiling, solutionMode, roomUsage }), [result, tables, effectiveSeats, height, ceiling, solutionMode, roomUsage]);
  const hasNoExtraAbsorption = result.hasRequiredInput && result.extraAbsorptionRaw <= 0;
  const solutionLabel = solutionModes.find((item) => item.id === solutionMode)?.label ?? 'Alleen wandpanelen';
  const sketchSteps = [
    { id: 2, label: 'Ruimte tekenen' },
    { id: 3, label: 'Conclusie' },
  ];
  const visibleSteps = sketchSteps;
  const leadData = {
    name: customerName,
    company: companyName,
    email: customerEmail,
    phone: customerPhone,
    projectName,
    city: projectCity,
    date: projectDate,
    roomType: getSketchTypeFromStartType(startRoomType),
    customerNotes: [projectExperience, customerNotes].filter(Boolean).join(' · '),
  };
  const quickCalculationData = {
    lengthMeters: length,
    widthMeters: width,
    heightMeters: height,
    volumeM3: result.volume,
    floorAreaM2: result.floorArea,
    ceilingAreaM2: result.floorArea,
    wallAreaM2: 2 * (length + width) * height,
    glassAreaM2: 0,
    curtainAreaM2: 0,
    doorAreaM2: 0,
    carpetAreaM2: 0,
    currentReverbTime: result.effectiveCurrentRt,
    targetReverbTime: targetRt,
    selectedNRC: nrc,
    roomType: isHome ? 'living-room' : 'restaurant',
    existingAbsorptionEstimate: result.existingAbsorption,
    requiredExtraAbsorption: result.extraAbsorption,
    requiredFeltM2: result.feltArea,
    recommendedFeltM2: result.feltArea,
    availableWallAreaM2: Math.max(0, 2 * (length + width) * height),
    solutionLabel,
    productMatch: panelLabel,
    placementSuggestion: [
      'Plaats BasKoestiek akoestische kunstwerken bij voorkeur op reflecterende wandvlakken rond tafelzones.',
      placementAdvice.spreadAdvice,
      placementAdvice.sourceAdvice,
      placementAdvice.heightAdvice,
    ].join(' '),
  };
  const quickArtworkAdvice = getRealisticArtworkAdvice({
    requiredSabins: result.extraAbsorption,
    availableWallAreaM2: quickCalculationData.availableWallAreaM2,
    roomType: quickCalculationData.roomType,
    roomAreaM2: result.floorArea,
    wallAreaM2: quickCalculationData.wallAreaM2,
  });
  const currentComfort = getComfortLevel(result.effectiveCurrentRt);
  const recommendedArtworkEffect = getArtworkEffect({
    volume: result.volume,
    currentRt: result.effectiveCurrentRt,
    combination: quickArtworkAdvice.tiers.recommended,
  });
  const maximumArtworkEffect = getArtworkEffect({
    volume: result.volume,
    currentRt: result.effectiveCurrentRt,
    combination: quickArtworkAdvice.tiers.maximum,
  });
  const conclusionItems = [
    {
      title: 'Basis',
      value: formatArtworkCombination(quickArtworkAdvice.tiers.basis),
      text: `${formatNumber(getArtworkEffect({ volume: result.volume, currentRt: result.effectiveCurrentRt, combination: quickArtworkAdvice.tiers.basis }).reverbTime, 2)} sec`,
    },
    {
      title: 'Aanbevolen',
      value: formatArtworkCombination(quickArtworkAdvice.tiers.recommended),
      text: `${formatNumber(recommendedArtworkEffect.reverbTime, 2)} sec · ${recommendedArtworkEffect.comfort.label}`,
    },
    {
      title: 'Maximaal realistisch',
      value: formatArtworkCombination(quickArtworkAdvice.tiers.maximum),
      text: `${formatNumber(maximumArtworkEffect.reverbTime, 2)} sec · ${maximumArtworkEffect.comfort.label}`,
    },
  ];
  const summarySentences = result.hasRequiredInput
    ? [
        `Deze ${roomTypeLabel} start akoestisch als ${currentComfort.label.toLowerCase()} met een geschatte nagalmtijd van ${formatNumber(result.effectiveCurrentRt, 2)} seconden.`,
        `Met ${formatArtworkCombination(quickArtworkAdvice.tiers.recommended)} verschuift de ruimte naar ${recommendedArtworkEffect.comfort.label.toLowerCase()} en circa ${formatNumber(recommendedArtworkEffect.reverbTime, 2)} seconden.`,
        `Het advies draait om zichtbare BasKoestiek akoestische kunstwerken: rustig in beeld, merkbaar in comfort.`,
        quickArtworkAdvice.additionalMeasuresNeeded
          ? 'Als de volledige akoestische behoefte groter is dan realistisch met kunstwerken alleen, adviseren we aanvullend persoonlijk advies.'
          : 'Deze combinatie lijkt binnen de realistische kunstwerk-oplossing te passen.',
      ]
    : ['Vul de ruimtegegevens in om een kunstwerkadvies te berekenen.'];
  const summary = summarySentences.join(' ');
  const hasMainAdviceToggle = result.hasRequiredInput && summarySentences.length > 3;
  const mainAdviceSummary = showFullMainAdvice || !hasMainAdviceToggle
    ? summary
    : summarySentences.slice(0, 3).join(' ');
  const quickCustomerReportData = generateCustomerReport(quickCalculationData, sketchData, leadData);
  const quickInternalReportData = generateInternalReport(quickCalculationData, sketchData, leadData);
  const handlePrint = () => window.print();

  useEffect(() => {
    setSavedProjects(readSavedProjects());
  }, []);

  function getInputSnapshot() {
    return {
      customerName,
      companyName,
      customerEmail,
      customerPhone,
      customerNotes,
      projectName,
      projectCity,
      projectDate,
      roomUsage,
      length,
      width,
      height,
      tables,
      seats,
      panelWidth,
      panelHeight,
      selectedMaterialId,
      selectedMountingId,
      customNrc,
      solutionMode,
      ceilingObjectTypeId,
      ceilingMethod,
      ceilingObjectWidth,
      ceilingObjectLength,
      ceilingObjectCount,
      ceilingObjectNrc,
      ceilingCorrectionFactor,
      ceilingSabinsPerObject,
      splitPresetId,
      customWallPercent,
      ceilingId: ceiling.id,
      currentRtPreset,
      targetRtPreset,
      currentRt,
      targetRt,
      calculationMode,
      sketchData,
      startRoomType,
      projectExperience,
    };
  }

  function getResultSnapshot() {
    return {
      ...result,
      panelLabel,
      nrc,
      summary,
    };
  }

  function saveProject() {
    const now = new Date().toISOString();
    const title = projectName || customerName || `Project ${projectDate || todayISO()}`;
    const project = {
      id: activeProjectId || crypto.randomUUID(),
      title,
      savedAt: now,
      inputs: getInputSnapshot(),
      result: getResultSnapshot(),
    };
    const nextProjects = activeProjectId
      ? savedProjects.map((item) => (item.id === activeProjectId ? project : item))
      : [project, ...savedProjects];

    writeSavedProjects(nextProjects);
    setSavedProjects(nextProjects);
    setActiveProjectId(project.id);
    setStorageMessage(`${title} opgeslagen.`);
  }

  function openProject(project) {
    const inputs = project.inputs ?? {};
    setCustomerName(inputs.customerName ?? '');
    setCompanyName(inputs.companyName ?? '');
    setCustomerEmail(inputs.customerEmail ?? '');
    setCustomerPhone(inputs.customerPhone ?? '');
    setCustomerNotes(inputs.customerNotes ?? '');
    setProjectName(inputs.projectName ?? '');
    setProjectCity(inputs.projectCity ?? '');
    setProjectDate(inputs.projectDate ?? todayISO());
    setRoomUsage(inputs.roomUsage ?? 'woning');
    setLength(clampNumber(inputs.length, 0));
    setWidth(clampNumber(inputs.width, 0));
    setHeight(clampNumber(inputs.height, 0));
    setTables(clampNumber(inputs.tables, 0));
    setSeats(clampNumber(inputs.seats, 0));
    setPanelWidth(clampNumber(inputs.panelWidth, 0));
    setPanelHeight(clampNumber(inputs.panelHeight, 0));
    const migratedPanel = migratePanelSelection(inputs.selectedPanelId);
    setSelectedMaterialId(inputs.selectedMaterialId ?? migratedPanel.materialId);
    setSelectedMountingId(inputs.selectedMountingId ?? migratedPanel.mountingId);
    setCustomNrc(clampNumber(inputs.customNrc, 0.75));
    setSolutionMode(inputs.solutionMode ?? 'wall');
    setCeilingObjectTypeId(inputs.ceilingObjectTypeId ?? 'none');
    setCeilingMethod(inputs.ceilingMethod ?? 'nrc');
    setCeilingObjectWidth(clampNumber(inputs.ceilingObjectWidth, 1.2));
    setCeilingObjectLength(clampNumber(inputs.ceilingObjectLength, 1.2));
    setCeilingObjectCount(clampNumber(inputs.ceilingObjectCount, 4));
    setCeilingObjectNrc(clampNumber(inputs.ceilingObjectNrc, 0.85));
    setCeilingCorrectionFactor(clampNumber(inputs.ceilingCorrectionFactor, 1.6));
    setCeilingSabinsPerObject(clampNumber(inputs.ceilingSabinsPerObject, 1.8));
    setSplitPresetId(inputs.splitPresetId ?? '50-50');
    setCustomWallPercent(clampNumber(inputs.customWallPercent, 50));
    setCeiling(ceilingPresets.find((item) => item.id === inputs.ceilingId) ?? ceilingPresets[0]);
    setCurrentRtPreset(inputs.currentRtPreset ?? 'custom');
    setTargetRtPreset(inputs.targetRtPreset ?? 'custom');
    setCurrentRt(clampNumber(inputs.currentRt, 0));
    setTargetRt(clampNumber(inputs.targetRt, 0));
    setCalculationMode('sketch');
    setQuickStep(2);
    setSketchData(inputs.sketchData ?? null);
    setHasStartedQuickscan(true);
    setStartRoomType(inputs.startRoomType ?? inputs.sketchData?.room?.type ?? 'living-room');
    setProjectExperience(inputs.projectExperience ?? experienceOptions[0]);
    setActiveProjectId(project.id);
    setStorageMessage(`${project.title} geopend.`);
  }

  function deleteProject(projectId) {
    const nextProjects = savedProjects.filter((item) => item.id !== projectId);
    writeSavedProjects(nextProjects);
    setSavedProjects(nextProjects);
    if (activeProjectId === projectId) setActiveProjectId(null);
    setStorageMessage('Project verwijderd.');
  }

  function handleCurrentRtPreset(id) {
    const preset = currentRtPresets.find((item) => item.id === id);
    setCurrentRtPreset(id);
    if (preset?.value) setCurrentRt(preset.value);
  }

  function handleTargetRtPreset(id) {
    const preset = targetRtPresets.find((item) => item.id === id);
    setTargetRtPreset(id);
    if (preset?.value) setTargetRt(preset.value);
  }

  function handleStartProjectContinue() {
    setRoomUsage(getRoomUsageFromStartType(startRoomType));
    setCalculationMode('sketch');
    setQuickStep(2);
    setHasStartedQuickscan(true);
    setShowStartProjectModal(false);
    setOpenRoomSketchDetails(true);
  }

  if (!hasStartedQuickscan) {
    return (
      <main className="startMain">
        <StartScreen
          onStart={() => setShowStartProjectModal(true)}
          onSavedProjects={() => setShowSavedProjects((visible) => !visible)}
        />
        {showSavedProjects && (
          <SavedProjectsPanel
            savedProjects={savedProjects}
            storageMessage={storageMessage}
            onSave={saveProject}
            onOpenProject={openProject}
            onDeleteProject={deleteProject}
            canSave={false}
          />
        )}
        <StartProjectModal
          open={showStartProjectModal}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          roomType={startRoomType}
          onRoomTypeChange={setStartRoomType}
          experience={projectExperience}
          onExperienceChange={setProjectExperience}
          onContinue={handleStartProjectContinue}
        />
      </main>
    );
  }

  return (
    <main>
      <header className="toolHeader">
        <img src="/baskoestiek-logo.png" alt="BasKoestiek" />
        <p>Vul kort de basis van je ruimte in. Daarna kun je jouw ruimte tekenen en zien wat er verandert.</p>
        <button className="menuButton" type="button" onClick={() => setShowSavedProjects((visible) => !visible)}>
          <FolderOpen size={17} />
          Opgeslagen projecten
        </button>
      </header>

      {showSavedProjects && (
        <SavedProjectsPanel
          savedProjects={savedProjects}
          storageMessage={storageMessage}
          onSave={saveProject}
          onOpenProject={openProject}
          onDeleteProject={deleteProject}
        />
      )}

      <nav className="stepTabs" aria-label="Stappen">
        {visibleSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={quickStep === step.id ? 'active' : ''}
            onClick={() => setQuickStep(step.id)}
          >
            <span>Stap {step.id}</span>
            {step.label}
          </button>
        ))}
      </nav>

      {(calculationMode === 'quick' || quickStep === 1) && (
        <>
          {quickStep === 1 && (
            <section className="panel stepPanel">
              <div className="panelHeader">
                <div className="panelTitle">
                  <h2>Stap 1 · Gegevens</h2>
                </div>
                <button className="menuButton" type="button" onClick={() => setShowSavedProjects((visible) => !visible)}>
                  <FolderOpen size={17} />
                  Opgeslagen projecten
                </button>
              </div>

              <div className="formRows">
                <div className="formGroup">
                  <div className="formRow four">
                    <TextField label="Klantnaam" value={customerName} onChange={setCustomerName} />
                    <TextField label="Bedrijf" value={companyName} onChange={setCompanyName} />
                    <TextField label="E-mail" value={customerEmail} onChange={setCustomerEmail} type="email" />
                    <TextField label="Telefoon" value={customerPhone} onChange={setCustomerPhone} type="tel" />
                  </div>
                  <div className="formRow four">
                    <TextField label="Projectnaam" value={projectName} onChange={setProjectName} />
                    <TextField label="Plaats" value={projectCity} onChange={setProjectCity} />
                    <TextField label="Datum" value={projectDate} onChange={setProjectDate} type="date" />
                    <TextField label="Opmerkingen" value={customerNotes} onChange={setCustomerNotes} />
                  </div>
                </div>
              </div>

              {showSavedProjects && (
                <div className="storagePanel inlineStorage">
                  <div className="storageActions">
                    <button className="secondaryButton" type="button" onClick={saveProject}>
                      <Save size={18} />
                      {activeProjectId ? 'Project bijwerken' : 'Project opslaan'}
                    </button>
                    {storageMessage && <p className="storageMessage">{storageMessage}</p>}
                  </div>
                  {savedProjects.length === 0 ? (
                    <p className="emptyState">Nog geen projecten opgeslagen.</p>
                  ) : (
                    <div className="savedProjectList">
                      {savedProjects.map((project) => (
                        <div className="savedProject" key={project.id}>
                          <div>
                            <strong>{project.title}</strong>
                            <span>
                              {project.inputs?.customerName || 'Geen klantnaam'} · {project.inputs?.projectCity || 'Geen plaats'} · {new Date(project.savedAt).toLocaleDateString('nl-NL')}
                            </span>
                            <em>
                              BasKoestiek quickscan · {project.inputs?.sketchData?.objects?.length ?? 0} objecten in de schets
                            </em>
                          </div>
                          <div className="savedProjectActions">
                            <button className="iconTextButton" type="button" onClick={() => openProject(project)}>
                              <FolderOpen size={17} />
                              Openen
                            </button>
                            <button className="iconTextButton danger" type="button" onClick={() => deleteProject(project.id)}>
                              <Trash2 size={17} />
                              Verwijderen
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="stepActions">
                <button className="secondaryButton" type="button" onClick={saveProject}>
                  <Save size={18} />
                  Opslaan
                </button>
                <button className="primaryButton" type="button" onClick={() => setQuickStep(2)}>
                  Naar stap 2
                </button>
              </div>
            </section>
          )}

          {calculationMode === 'quick' && quickStep === 2 && (
            <section className="panel stepPanel">
              <div className="panelTitle">
                <h2>Stap 2 · Ruimtegegevens</h2>
              </div>

              <div className="formRows">
                <div className="formGroup">
                  <QuickscanTextBlock
                    compact
                    title={quickscanTexts.roomInput.title}
                    text={quickscanTexts.roomInput.text}
                  />
                  <div className="formRow four">
                    <SelectField label="Type ruimte" value={roomUsage} onChange={setRoomUsage}>
                      {roomUsageOptions.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}</option>
                      ))}
                    </SelectField>
                    <NumberField label="Lengte ruimte" value={length} onChange={setLength} suffix="m" />
                    <NumberField label="Breedte ruimte" value={width} onChange={setWidth} suffix="m" />
                    <NumberField label="Hoogte ruimte" value={height} onChange={setHeight} suffix="m" />
                  </div>
                  <p className="fieldNote">{quickscanTexts.roomInput.heightHelper}</p>
                  {!isHome ? (
                    <div className="formRow three">
                      <NumberField label="Aantal tafels" value={tables} onChange={setTables} suffix="st." step="1" />
                      <NumberField label="Aantal zitplaatsen" value={seats} onChange={setSeats} suffix="pers." step="1" />
                      <SelectField label="Plafondtype" value={ceiling.id} onChange={(id) => setCeiling(ceilingPresets.find((item) => item.id === id))}>
                        {ceilingPresets.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </SelectField>
                    </div>
                  ) : (
                    <p className="fieldNote">Voor woning rekenen we standaard met een glad, vlak plafond. Tafels en zitplaatsen worden niet meegenomen.</p>
                  )}
                </div>

                <div className="formGroup">
                  <div className="formRow two">
                    <SelectField label="Ruimte omschrijving" value={currentRtPreset} onChange={handleCurrentRtPreset}>
                      {currentRtPresets.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}{item.value ? ` — nagalmtijd ${item.value} sec` : ''}</option>
                      ))}
                    </SelectField>
                    <SelectField label="Gewenst comfortniveau" value={targetRtPreset} onChange={handleTargetRtPreset}>
                      {targetRtPresets.map((item) => (
                        <option key={item.id} value={item.id}>{item.label}{item.value ? ` — nagalmtijd ${item.value} sec` : ''}</option>
                      ))}
                    </SelectField>
                  </div>
                  <p className="fieldNote">
                    De conclusie rekent met BasKoestiek akoestische kunstwerken in twee vaste maten: 80 x 120 cm en 120 x 180 cm.
                  </p>
                </div>

                <details className="optionalSettings">
                  <summary>Plafondoplossing als optie meenemen</summary>
                  <div className="formRows">
                    <div className="formRow three">
                      <SelectField label="Gekozen oplossing" value={solutionMode} onChange={setSolutionMode}>
                        {solutionModes.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </SelectField>
                      <SelectField label="Type plafondoplossing" value={ceilingObjectTypeId} onChange={setCeilingObjectTypeId}>
                        {ceilingObjectTypes.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </SelectField>
                      <SelectField label="Rekenmethode" value={ceilingMethod} onChange={setCeilingMethod}>
                        {ceilingCalculationMethods.map((item) => (
                          <option key={item.id} value={item.id}>{item.label}</option>
                        ))}
                      </SelectField>
                    </div>

                    {solutionMode === 'combined' && (
                      <div className="formRow two">
                        <SelectField label="Verdeling wand / plafond" value={splitPresetId} onChange={setSplitPresetId}>
                          {splitPresets.map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </SelectField>
                        {splitPresetId === 'custom' && (
                          <NumberField label="Percentage wand" value={customWallPercent} onChange={setCustomWallPercent} suffix="%" step="1" />
                        )}
                      </div>
                    )}

                    {solutionMode !== 'wall' && ceilingObjectTypeId !== 'none' && ceilingMethod === 'nrc' && (
                      <>
                        <div className="formRow three">
                          <NumberField label="Object breedte" value={ceilingObjectWidth} onChange={setCeilingObjectWidth} suffix="m" />
                          <NumberField label="Object lengte/hoogte" value={ceilingObjectLength} onChange={setCeilingObjectLength} suffix="m" />
                          <NumberField label="Aantal objecten" value={ceilingObjectCount} onChange={setCeilingObjectCount} suffix="st." step="1" />
                        </div>
                        <div className="formRow two">
                          <NumberField label="NRC plafondobject" value={ceilingObjectNrc} onChange={setCeilingObjectNrc} step="0.05" />
                          <NumberField label="Correctiefactor" value={ceilingCorrectionFactor} onChange={setCeilingCorrectionFactor} step="0.1" />
                        </div>
                      </>
                    )}

                    {solutionMode !== 'wall' && ceilingObjectTypeId !== 'none' && ceilingMethod === 'sabins' && (
                      <div className="formRow two">
                        <NumberField label="Aantal objecten" value={ceilingObjectCount} onChange={setCeilingObjectCount} suffix="st." step="1" />
                        <NumberField label="Sabins per object" value={ceilingSabinsPerObject} onChange={setCeilingSabinsPerObject} step="0.1" />
                      </div>
                    )}
                  </div>
                </details>
              </div>

              <div className="stepActions">
                <button className="secondaryButton" type="button" onClick={() => setQuickStep(1)}>
                  Terug
                </button>
                <QuickscanTextBlock
                  compact
                  title={quickscanTexts.calculate.title}
                  text={quickscanTexts.calculate.text}
                />
                <button className="primaryButton" type="button" onClick={() => setQuickStep(3)}>
                  {quickscanTexts.calculate.button}
                </button>
              </div>
              <p className="reportNotice">{quickscanTexts.generalDisclaimer}</p>
            </section>
          )}

          {calculationMode === 'quick' && quickStep === 3 && (
            <>
              <section className="panel conclusionPanel">
                <div className="panelHeader">
                  <div className="panelTitle">
                    <h2>Stap 3 · Conclusie</h2>
                  </div>
                  <button className="menuButton" type="button" onClick={handlePrint}>
                    <Printer size={18} />
                    Rapport uitdraaien
                  </button>
                </div>

                <p className="conclusionText">{mainAdviceSummary}</p>
                {!result.hasRequiredInput && (
                  <p className="calculationNote">{result.validationMessage}</p>
                )}
                {hasNoExtraAbsorption && (
                  <p className="calculationNote">Volgens deze invoer is er akoestisch gezien geen extra absorptie nodig om de gekozen doelwaarde te halen.</p>
                )}

                <div className="conclusionList">
                  {conclusionItems.map((item) => (
                    <div key={item.title}>
                      <span>{item.title}</span>
                      <strong>{item.value}</strong>
                      <em>{item.text}</em>
                    </div>
                  ))}
                </div>

                <div className="comfortPreview">
                  <div>
                    <span>Nu</span>
                    <strong>{currentComfort.label}</strong>
                    <small>{formatNumber(result.effectiveCurrentRt, 2)} sec</small>
                  </div>
                  <div className="comfortTrack" aria-hidden="true">
                    <span style={{ width: `${Math.max(6, recommendedArtworkEffect.comfort.score)}%` }} />
                  </div>
                  <div>
                    <span>Met aanbevolen kunstwerken</span>
                    <strong>{recommendedArtworkEffect.comfort.label}</strong>
                    <small>{formatNumber(recommendedArtworkEffect.reverbTime, 2)} sec</small>
                  </div>
                </div>

                <details className="optionalSettings compact">
                  <summary>Plaatsingsadvies bekijken</summary>
                  <div className="adviceList">
                    <p>{placementAdvice.spreadAdvice}</p>
                    <p>{placementAdvice.sourceAdvice}</p>
                    <p>{placementAdvice.heightAdvice}</p>
                    <p>{placementAdvice.ceilingAdvice}</p>
                  </div>
                </details>

                <div className="stepActions">
                  <button className="secondaryButton" type="button" onClick={() => setQuickStep(2)}>
                    Terug
                  </button>
                  <button className="secondaryButton" type="button" onClick={saveProject}>
                    <Save size={18} />
                    Opslaan
                  </button>
                </div>
              </section>

              <ReportsPanel
                customerReportData={quickCustomerReportData}
                internalReportData={quickInternalReportData}
                onSaveProject={saveProject}
              />
            </>
          )}

          {calculationMode === 'quick' && (
            <>
              <section className="panel reportSpecs">
                <div className="panelTitle">
                  <h2>Rapportgegevens & berekening</h2>
                </div>
                <p className="reportNotice">
                  Dit advies is gebaseerd op maatvoering en situatie. Er is door ons geen geluidsmeting verricht.
                </p>
                <div className="specGrid">
                  <SpecRow label="Klantnaam" value={customerName || '-'} />
                  <SpecRow label="Projectnaam" value={projectName || '-'} />
                  <SpecRow label="Plaats" value={projectCity || '-'} />
                  <SpecRow label="Datum" value={projectDate || '-'} />
                  <SpecRow label="Vloeroppervlak" value={`${formatNumber(result.floorArea)} m²`} />
                  <SpecRow label="Ruimtevolume" value={`${formatNumber(result.volume, 0)} m³`} />
                  <SpecRow label="A bestaand" value={`${formatNumber(result.existingAbsorption)} m²`} />
                  <SpecRow label="A doel" value={`${formatNumber(result.targetAbsorption)} m²`} />
                  <SpecRow label="A extra" value={`${formatNumber(result.extraAbsorption)} m²`} />
                  <SpecRow label="Gekozen oplossing" value={solutionLabel} />
                  <SpecRow label="Verdeling wand/plafond" value={`${formatNumber(splitWallPercent, 0)}% / ${formatNumber(100 - splitWallPercent, 0)}%`} />
                  <SpecRow label="Benodigd vilt" value={`${formatNumber(result.feltArea)} m²`} />
                  <SpecRow label="Aantal panelen" value={`${result.panelCount} st.`} />
                  <SpecRow label="Materiaal" value={materialLabel} />
                  <SpecRow label="Luchtspouw / montage" value={mountingLabel} />
                  <SpecRow label="NRC-waarde" value={formatNumber(nrc, 2)} />
                  <SpecRow label="Paneelmaat" value={`${formatNumber(panelWidth)} × ${formatNumber(panelHeight)} m`} />
                  <SpecRow label="Paneeloppervlak" value={`${formatNumber(result.panelArea)} m²`} />
                  <SpecRow label="Effectieve absorptie per paneel" value={`${formatNumber(result.absorptionPerPanel)} m²`} />
                  <SpecRow label="Type plafondobject" value={selectedCeilingObjectType.label} />
                  <SpecRow label="Rekenmethode plafond" value={ceilingCalculationMethods.find((item) => item.id === ceilingMethod)?.label ?? '-'} />
                  <SpecRow label="Objectoppervlak" value={`${formatNumber(result.objectArea)} m²`} />
                  <SpecRow label="Absorptie per plafondobject" value={`${formatNumber(result.ceilingAbsorptionPerObject)} m²`} />
                  <SpecRow label="Aantal plafondobjecten" value={`${result.ceilingObjectCount} st.`} />
                  <SpecRow label="Totale plafondabsorptie" value={`${formatNumber(result.ceilingRecommendedTotalAbsorption)} m²`} />
                  <SpecRow label="Nieuwe nagalmtijd" value={`${formatNumber(result.newReverbTime, 2)} sec`} />
                  <SpecRow label="Huidige nagalmtijd" value={`${formatNumber(result.effectiveCurrentRt)} sec`} />
                  <SpecRow label="Gewenste nagalmtijd" value={`${formatNumber(targetRt)} sec`} />
                  {!isHome && (
                    <>
                      <SpecRow label="Aantal tafels" value={`${tables} st.`} />
                      <SpecRow label="Aantal zitplaatsen" value={`${seats} pers.`} />
                      <SpecRow label="Hoe druk is de locatie" value={`${formatNumber(result.crowdingScore)} · ${result.crowdingLabel}`} />
                    </>
                  )}
                  <SpecRow label="Plafondtype" value={isHome ? 'Glad, vlak plafond · standaard voor woning' : `${ceiling.label} · ${ceiling.description}`} />
                </div>
              </section>

              <section className="panel explanation">
                <div className="panelHeader">
                  <div className="panelTitle">
                    <h2>Beknopte uitleg</h2>
                  </div>
                  <button className="menuButton" type="button" onClick={() => setShowCustomerExplanation((visible) => !visible)}>
                    {showCustomerExplanation ? 'Verbergen' : 'Tonen'}
                  </button>
                </div>
                <div className={showCustomerExplanation ? 'collapsibleContent' : 'collapsibleContent collapsed'}>
                  <p>{summary}</p>
                  <p className="formula">
                    Formule hoofdadvies: m² vilt = ((0,16 × V / Tdoel) - (0,16 × V / Thuidig)) / NRC.
                  </p>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {calculationMode === 'sketch' && quickStep > 1 && (
        <Suspense fallback={<section className="panel sketchPanel"><p className="emptyState">Schetsmodule laden...</p></section>}>
          <RoomSketcher
            value={sketchData}
            onChange={setSketchData}
            leadData={leadData}
            defaultRoom={{
              lengthMeters: length,
              widthMeters: width,
              heightMeters: height,
              type: getSketchTypeFromStartType(startRoomType),
            }}
            currentReverbTime={result.effectiveCurrentRt}
            targetReverbTime={targetRt}
            selectedNRC={nrc}
            showEditor={quickStep === 2}
            showReports={quickStep === 3}
            openDetailsOnMount={openRoomSketchDetails}
            onDetailsOpened={() => setOpenRoomSketchDetails(false)}
            onShowAdvice={() => setQuickStep(3)}
            onSaveProject={saveProject}
          />
        </Suspense>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
