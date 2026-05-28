import { getActiveAcousticProducts, getProductSabins } from './data/acousticProducts.js';
import { quickscanTexts } from './content/quickscanTexts.js';

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '0.0';
}

function hashString(value) {
  return String(value).split('').reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function createAdviceCode(leadData = {}, calculationData = {}) {
  const date = (leadData.date || new Date().toISOString().slice(0, 10)).replaceAll('-', '');
  const seed = `${leadData.name || ''}-${leadData.company || ''}-${calculationData.floorAreaM2 || 0}-${calculationData.volumeM3 || 0}`;
  const suffix = Math.abs(hashString(seed)).toString(36).slice(0, 4).toUpperCase().padEnd(4, '0');
  return `BK-${date}-${suffix}`;
}

function getObjectCounts(sketchData = {}) {
  const safeSketchData = sketchData ?? {};
  const objects = Array.isArray(safeSketchData.objects) ? safeSketchData.objects : [];
  return objects.reduce((counts, object) => {
    counts[object.type] = (counts[object.type] || 0) + 1;
    return counts;
  }, {});
}

function getSketchObjects(sketchData = {}) {
  const safeSketchData = sketchData ?? {};
  return Array.isArray(safeSketchData.objects) ? safeSketchData.objects : [];
}

function getAcousticIndication(calculationData = {}) {
  const floorArea = safeNumber(calculationData.floorAreaM2);
  const requiredFelt = safeNumber(calculationData.requiredFeltM2 ?? calculationData.recommendedFeltM2);
  const ratio = floorArea > 0 ? requiredFelt / floorArea : 0;
  if (ratio >= 0.35) return 'hoog';
  if (ratio >= 0.18) return 'gemiddeld';
  return 'laag';
}

function getAcousticNeedLevel(calculationData = {}) {
  const indication = getAcousticIndication(calculationData);
  if (indication === 'hoog') return 'high';
  if (indication === 'gemiddeld') return 'medium';
  return 'low';
}

function normalizeRoomType(roomType = '') {
  const type = String(roomType).toLowerCase();
  if (type.includes('woon') || type.includes('living')) return 'living_room';
  if (type.includes('restaurant') || type.includes('horeca') || type.includes('cafe') || type.includes('café')) return 'restaurant';
  if (type.includes('office') || type.includes('kantoor')) return 'office';
  if (type.includes('meeting') || type.includes('vergader')) return 'meeting_room';
  return 'other';
}

function getSolutionDirection(calculationData = {}) {
  if (calculationData.solutionLabel) return calculationData.solutionLabel;
  const requiredFelt = safeNumber(calculationData.requiredFeltM2 ?? calculationData.recommendedFeltM2);
  const availableWall = safeNumber(calculationData.availableWallAreaM2);
  if (availableWall > 0 && requiredFelt > availableWall * 0.65) return 'combinatie van wand en plafond';
  return 'wandpanelen, eventueel aangevuld met plafondobjecten';
}

function getRoomArtworkLimit(roomType = '', roomAreaM2 = 0) {
  const type = String(roomType).toLowerCase();

  if (type.includes('woon') || type.includes('living')) {
    if (roomAreaM2 < 25) return { count: 3, category: 'small living room' };
    if (roomAreaM2 <= 45) return { count: 5, category: 'medium living room' };
    return { count: 8, category: 'large living room' };
  }

  if (type.includes('restaurant') || type.includes('horeca') || type.includes('cafe') || type.includes('café')) {
    if (roomAreaM2 < 50) return { count: 8, category: 'small horeca' };
    if (roomAreaM2 <= 120) return { count: 15, category: 'medium horeca' };
    return { count: 25, category: 'large horeca' };
  }

  if (type.includes('kantoor') || type.includes('office') || type.includes('meeting') || type.includes('vergader')) {
    if (roomAreaM2 < 25) return { count: 4, category: 'small meeting room' };
    if (roomAreaM2 <= 60) return { count: 8, category: 'medium meeting room' };
    return { count: 15, category: 'large office/meeting room' };
  }

  if (roomAreaM2 < 25) return { count: 4, category: 'small room' };
  if (roomAreaM2 <= 70) return { count: 8, category: 'medium room' };
  return { count: 15, category: 'large room' };
}

function getUsableArtworkWallArea({ availableWallAreaM2, wallAreaM2 }) {
  const availableWall = safeNumber(availableWallAreaM2);
  if (availableWall > 0) return availableWall * 0.4;
  return safeNumber(wallAreaM2) * 0.25;
}

function getEmptyCombination(products, requiredSabins = 0) {
  return {
    items: products.map((product) => ({
      productId: product.id,
      name: product.name,
      count: 0,
      sabinsPerArtwork: product.sabins,
      areaPerArtwork: product.areaM2,
      totalSabins: 0,
      totalAreaM2: 0,
    })),
    totalSabins: 0,
    totalCount: 0,
    totalAreaM2: 0,
    coveragePercent: requiredSabins > 0 ? 0 : 100,
  };
}

function createCombination(products, counts, requiredSabins = 0) {
  const items = products.map((product) => {
    const count = counts[product.id] || 0;
    return {
      productId: product.id,
      name: product.name,
      count,
      sabinsPerArtwork: product.sabins,
      areaPerArtwork: product.areaM2,
      totalSabins: count * product.sabins,
      totalAreaM2: count * product.areaM2,
    };
  });
  const totalSabins = items.reduce((sum, item) => sum + item.totalSabins, 0);
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const totalAreaM2 = items.reduce((sum, item) => sum + item.totalAreaM2, 0);

  return {
    items,
    totalSabins,
    totalCount,
    totalAreaM2,
    coveragePercent: requiredSabins > 0 ? totalSabins / requiredSabins * 100 : 100,
  };
}

function findBestArtworkCombination(products, {
  countLimit,
  areaLimit = Infinity,
  requiredSabins = 0,
  preferLarge = true,
} = {}) {
  const safeCountLimit = Math.max(0, Math.floor(safeNumber(countLimit)));
  const safeAreaLimit = Number.isFinite(areaLimit) ? Math.max(0, areaLimit) : Infinity;
  const candidates = [];

  function walk(index, counts, totalCount, totalAreaM2) {
    if (index >= products.length) {
      candidates.push(createCombination(products, counts, requiredSabins));
      return;
    }

    const product = products[index];
    const maxByCount = safeCountLimit - totalCount;
    const maxByArea = product.areaM2 > 0 && Number.isFinite(safeAreaLimit)
      ? Math.floor((safeAreaLimit - totalAreaM2) / product.areaM2)
      : maxByCount;
    const maxForProduct = Math.max(0, Math.min(maxByCount, maxByArea));

    for (let count = 0; count <= maxForProduct; count += 1) {
      walk(
        index + 1,
        { ...counts, [product.id]: count },
        totalCount + count,
        totalAreaM2 + count * product.areaM2,
      );
    }
  }

  walk(0, {}, 0, 0);

  const nonZeroCandidates = candidates.filter((candidate) => candidate.totalCount > 0);
  if (nonZeroCandidates.length === 0) return getEmptyCombination(products, requiredSabins);

  const largestProduct = products[0];
  const largeCandidates = largestProduct && preferLarge
    ? nonZeroCandidates.filter((candidate) => candidate.items.some((item) => item.productId === largestProduct.id && item.count > 0))
    : [];
  const practicalCandidates = largeCandidates.length > 0 ? largeCandidates : nonZeroCandidates;
  const sufficientCandidates = requiredSabins > 0
    ? practicalCandidates.filter((candidate) => candidate.totalSabins >= requiredSabins)
    : [];
  const pool = sufficientCandidates.length > 0 ? sufficientCandidates : practicalCandidates;

  return [...pool].sort((a, b) => {
    if (sufficientCandidates.length > 0) {
      const overageA = a.totalSabins - requiredSabins;
      const overageB = b.totalSabins - requiredSabins;
      if (overageA !== overageB) return overageA - overageB;
      if (a.totalCount !== b.totalCount) return a.totalCount - b.totalCount;
    } else {
      if (a.totalSabins !== b.totalSabins) return b.totalSabins - a.totalSabins;
    }

    const largeCountA = largestProduct ? a.items.find((item) => item.productId === largestProduct.id)?.count || 0 : 0;
    const largeCountB = largestProduct ? b.items.find((item) => item.productId === largestProduct.id)?.count || 0 : 0;
    if (largeCountA !== largeCountB) return largeCountB - largeCountA;
    return b.totalAreaM2 - a.totalAreaM2;
  })[0];
}

function getArtworkStatus(coveragePercent) {
  if (coveragePercent >= 95) return 'artworks_sufficient';
  if (coveragePercent >= 40) return 'artworks_partly_sufficient';
  return 'artworks_not_realistic';
}

function getStatusAdvice(status) {
  if (status === 'artworks_sufficient') return 'alleen kunstwerken';
  if (status === 'artworks_partly_sufficient') return 'combinatie nodig';
  return 'projectmatige oplossing nodig';
}

function getTierCombination(products, maxRealisticCount, usableArtworkWallAreaM2, requiredSabins, multiplier) {
  const roundedTarget = multiplier >= 0.7
    ? Math.ceil(maxRealisticCount * multiplier)
    : Math.round(maxRealisticCount * multiplier);
  const targetCount = maxRealisticCount > 0 ? Math.max(1, roundedTarget) : 0;
  return findBestArtworkCombination(products, {
    countLimit: targetCount,
    areaLimit: usableArtworkWallAreaM2,
    requiredSabins,
    preferLarge: true,
  });
}

export function getRealisticArtworkAdvice({
  requiredSabins,
  availableWallAreaM2,
  roomType,
  roomAreaM2,
  wallAreaM2,
} = {}) {
  const products = getActiveAcousticProducts()
    .map((product) => ({ ...product, sabins: getProductSabins(product) }))
    .sort((a, b) => b.sabins - a.sabins);
  const safeRequiredSabins = safeNumber(requiredSabins);
  const safeRoomAreaM2 = safeNumber(roomAreaM2);
  const roomLimit = getRoomArtworkLimit(roomType, safeRoomAreaM2);
  const usableArtworkWallAreaM2 = getUsableArtworkWallArea({ availableWallAreaM2, wallAreaM2 });
  const smallestArtworkArea = Math.min(...products.map((product) => product.areaM2).filter((area) => area > 0));
  const wallLimitedCount = Number.isFinite(smallestArtworkArea) && smallestArtworkArea > 0
    ? Math.floor(usableArtworkWallAreaM2 / smallestArtworkArea)
    : 0;
  const maxRealisticCount = Math.max(0, Math.min(roomLimit.count, wallLimitedCount));
  const largestProduct = products[0];
  const theoreticalLargeOnlyCount = safeRequiredSabins > 0 && largestProduct?.sabins > 0
    ? Math.ceil(safeRequiredSabins / largestProduct.sabins)
    : 0;
  const theoreticalCombination = findBestArtworkCombination(products, {
    countLimit: Math.max(theoreticalLargeOnlyCount + 2, 0),
    areaLimit: Infinity,
    requiredSabins: safeRequiredSabins,
    preferLarge: true,
  });
  const maxRealisticCombination = findBestArtworkCombination(products, {
    countLimit: maxRealisticCount,
    areaLimit: usableArtworkWallAreaM2,
    requiredSabins: safeRequiredSabins,
    preferLarge: true,
  });
  const status = getArtworkStatus(maxRealisticCombination.coveragePercent);
  const remainingSabins = Math.max(0, safeRequiredSabins - maxRealisticCombination.totalSabins);
  const additionalMeasures = [
    'akoestische plafondobjecten',
    'zware gordijnen',
    'vloerkleden',
    'zachte meubelstoffen',
    'maatwerk akoestische panelen',
    'persoonlijk advies',
  ];

  return {
    requiredSabins: safeRequiredSabins,
    roomLimit,
    usableArtworkWallAreaM2,
    wallLimitedCount,
    maxRealisticCount,
    theoreticalNeededCount: theoreticalCombination.totalCount,
    theoreticalCombination,
    tiers: {
      basis: getTierCombination(products, maxRealisticCount, usableArtworkWallAreaM2, safeRequiredSabins, 0.5),
      recommended: getTierCombination(products, maxRealisticCount, usableArtworkWallAreaM2, safeRequiredSabins, 0.8),
      maximum: maxRealisticCombination,
    },
    maxRealisticCombination,
    realisticDeliveredSabins: maxRealisticCombination.totalSabins,
    solvedPercent: maxRealisticCombination.coveragePercent,
    remainingSabins,
    artworksAloneSufficient: status === 'artworks_sufficient',
    additionalMeasuresNeeded: status !== 'artworks_sufficient',
    additionalMeasures,
    status,
    internalAdvice: getStatusAdvice(status),
  };
}

function getIndicativeArtworks(realisticAdvice = {}) {
  const basisCount = realisticAdvice.tiers?.basis?.totalCount || 0;
  const recommendedCount = realisticAdvice.tiers?.recommended?.totalCount || 0;
  const maxCount = realisticAdvice.maxRealisticCombination?.totalCount || realisticAdvice.maxRealisticCount || 0;

  if (maxCount <= 0) {
    return 'persoonlijk advies nodig voor een realistische productindicatie';
  }

  const low = Math.max(1, Math.min(basisCount || 1, maxCount));
  const high = Math.max(low, Math.min(recommendedCount || maxCount, maxCount));
  if (low === high) return `circa ${low} BasKoestiek akoestische kunstwerken`;
  return `circa ${low} tot ${high} BasKoestiek akoestische kunstwerken`;
}

function getArtworkRange(realisticAdvice = {}) {
  const basisCount = realisticAdvice.tiers?.basis?.totalCount || 0;
  const recommendedCount = realisticAdvice.tiers?.recommended?.totalCount || 0;
  const maxCount = realisticAdvice.maxRealisticCombination?.totalCount || realisticAdvice.maxRealisticCount || 0;
  if (maxCount <= 0) return { minArtworks: 0, maxArtworks: 0 };

  const minArtworks = Math.max(1, Math.min(basisCount || 1, maxCount));
  const maxArtworks = Math.max(minArtworks, Math.min(recommendedCount || maxCount, maxCount));
  return { minArtworks, maxArtworks };
}

function getMeasurementRecommendation(calculationData = {}, acousticNeedLevel = 'medium') {
  const floorArea = safeNumber(calculationData.floorAreaM2);
  const height = safeNumber(calculationData.heightMeters);
  const glassArea = safeNumber(calculationData.glassAreaM2);
  const requiredSabins = safeNumber(calculationData.requiredExtraAbsorption ?? calculationData.requiredSabins);
  const measurementNeeded = acousticNeedLevel === 'high'
    || floorArea >= 90
    || height >= 3.4
    || glassArea >= 12
    || requiredSabins >= 35;

  return {
    measurementNeeded,
    text: measurementNeeded ? quickscanTexts.measurementRecommended : '',
  };
}

function getCustomerEffectScore(realisticAdvice = {}, roomType = '', productRecommendation = {}) {
  const normalizedRoomType = normalizeRoomType(roomType);
  const coverage = safeNumber(realisticAdvice.solvedPercent);
  const recommendedCount = safeNumber(realisticAdvice.tiers?.recommended?.totalCount);
  const largeArtwork = productRecommendation.products?.find((product) => product.id === 'woven-art-120x180');
  const largeCountNeeded = productRecommendation.exactCounts?.find((item) => item.productId === largeArtwork?.id)?.countNeeded || 0;
  const livingRoomTooLarge = normalizedRoomType === 'living_room' && largeCountNeeded > 6;
  const horecaTooLarge = normalizedRoomType === 'restaurant' && largeCountNeeded > 10;

  if (realisticAdvice.status === 'artworks_not_realistic' || livingRoomTooLarge || horecaTooLarge) {
    return {
      id: 'custom',
      label: quickscanTexts.effectScores.custom.label,
      description: quickscanTexts.effectScores.custom.description,
      warning: livingRoomTooLarge
        ? 'Alleen akoestische kunstwerken zijn voor deze ruimte waarschijnlijk niet de meest logische totaaloplossing. Een combinatie met andere zachte materialen of persoonlijk akoestisch advies is verstandiger. Denk aan gordijnen, vloerkleden, gestoffeerde meubels, plafondobjecten of groter maatwerk.'
        : horecaTooLarge
          ? 'Voor deze ruimte is waarschijnlijk aanvullend akoestisch maatwerk nodig. BasKoestiek kunstwerken kunnen een waardevolle bijdrage leveren aan sfeer en geluidsverzachting, maar voor het beste resultaat is een breder plan verstandiger.'
          : quickscanTexts.artworkStatus.artworks_not_realistic,
    };
  }

  if (coverage >= 75 && recommendedCount >= 3) {
    return {
      id: 'strong',
      label: quickscanTexts.effectScores.strong.label,
      description: quickscanTexts.effectScores.strong.description,
      warning: '',
    };
  }

  if (coverage >= 40 || recommendedCount >= 2) {
    return {
      id: 'noticeable',
      label: quickscanTexts.effectScores.noticeable.label,
      description: quickscanTexts.effectScores.noticeable.description,
      warning: '',
    };
  }

  return {
    id: 'light',
    label: quickscanTexts.effectScores.light.label,
    description: quickscanTexts.effectScores.light.description,
    warning: '',
  };
}

function getCustomerAdviceLevel(effectScore = {}) {
  if (effectScore.id === 'custom') return { id: 'custom', ...quickscanTexts.adviceLevels.custom };
  if (effectScore.id === 'strong') return { id: 'stronger', ...quickscanTexts.adviceLevels.stronger };
  if (effectScore.id === 'noticeable') return { id: 'calm', ...quickscanTexts.adviceLevels.calm };
  return { id: 'first', ...quickscanTexts.adviceLevels.first };
}

function getCustomerProductAdviceLevel(effectScore = {}) {
  if (effectScore.id === 'custom' || effectScore.id === 'strong') {
    return { id: 'premium', ...quickscanTexts.productAdviceLevels.premium };
  }
  if (effectScore.id === 'noticeable') {
    return { id: 'recommended', ...quickscanTexts.productAdviceLevels.recommended };
  }
  return { id: 'basis', ...quickscanTexts.productAdviceLevels.basis };
}

function getCustomerConclusion(effectScore = {}) {
  const isComplex = effectScore.id === 'custom';
  return {
    ...quickscanTexts.customerFinalConclusion,
    closing: isComplex
      ? quickscanTexts.customerFinalConclusion.complex
      : quickscanTexts.customerFinalConclusion.normal,
  };
}

function getCustomerImpression(acousticNeedLevel = 'medium', effectScore = {}) {
  const currentKey = acousticNeedLevel === 'high'
    ? 'hard'
    : acousticNeedLevel === 'medium'
      ? 'restless'
      : 'light';
  const afterKey = effectScore.id === 'custom'
    ? 'custom'
    : effectScore.id === 'strong'
      ? 'strong'
      : effectScore.id === 'noticeable'
        ? 'noticeable'
        : 'light';

  return {
    current: quickscanTexts.currentImpression[currentKey],
    currentText: 'De ruimte klinkt waarschijnlijk harder of onrustiger dan gewenst, vooral wanneer er meerdere geluiden tegelijk zijn.',
    after: quickscanTexts.afterImpression[afterKey],
    afterText: 'Met slimme plaatsing van BasKoestiek kunstwerken wordt de ruimte naar verwachting zachter, warmer en prettiger in gebruik.',
  };
}

function getFriendlyProductCombination(combination = {}, effectScore = {}) {
  if (effectScore.id === 'custom') {
    return 'Geadviseerd: een persoonlijk samengesteld voorstel met kunstwerken en aanvullende zachte oplossingen.';
  }

  const items = Array.isArray(combination.items) ? combination.items : [];
  const visibleItems = items
    .filter((item) => item.count > 0)
    .map((item) => {
      const isLarge = item.productId === 'woven-art-120x180';
      const label = isLarge
        ? 'groot formaat kunstwerk van 120 × 180 cm'
        : 'kleiner kunstwerk van 80 × 120 cm';
      return `${item.count} ${label}`;
    });

  if (visibleItems.length === 0) {
    return 'Geadviseerd: een eerste kunstwerk op een strategische plek als zachte start.';
  }

  return `Geadviseerd: ${visibleItems.join(' en ')}.`;
}

function getConsumerAdviceLevels(roomType = '') {
  const normalizedRoomType = normalizeRoomType(roomType);
  const isRestaurant = normalizedRoomType === 'restaurant';

  return [
    {
      title: 'Basisverbetering',
      label: isRestaurant ? 'Advies: 2 tot 4 akoestische kunstwerken.' : 'Advies: 1 akoestisch kunstwerk.',
      text: 'Een eerste stap naar meer rust. Ideaal als je vooral één harde wand of een kale plek wilt verzachten.',
    },
    {
      title: 'Aanbevolen aanpak',
      label: isRestaurant ? 'Advies: 4 tot 8 akoestische kunstwerken.' : 'Advies: 2 tot 3 akoestische kunstwerken.',
      text: 'De beste balans tussen uitstraling en akoestisch comfort. Door meerdere kunstwerken slim te verdelen, wordt het geluid merkbaar rustiger.',
    },
    {
      title: 'Meest rustige resultaat',
      label: isRestaurant
        ? 'Advies: meerdere kunstwerken met eventueel maatwerkadvies.'
        : 'Advies: 3 tot 5 akoestische kunstwerken of aanvullend persoonlijk advies.',
      text: 'Voor ruimtes met veel harde materialen of duidelijke galm. Hierbij combineren we meerdere kunstwerken op strategische plekken.',
    },
  ];
}

function getConsumerProductCards(combination = {}, effectScore = {}) {
  const countsByProduct = (combination.items ?? []).reduce((acc, item) => {
    acc[item.productId] = item.count;
    return acc;
  }, {});
  const customCount = effectScore.id === 'custom';
  const countLabel = (productId) => {
    if (customCount) return 'op maat te bepalen';
    const count = countsByProduct[productId] || 0;
    return count > 0 ? `${count} aanbevolen` : 'optioneel';
  };

  return [
    {
      productId: 'woven-art-120x180',
      name: 'BasKoestiek kunstwerk 120 × 180 cm',
      format: '120 × 180 cm',
      description: 'Groot formaat — sterker aanwezig in beeld en geschikt voor grotere kale wanden.',
      recommendedCount: countLabel('woven-art-120x180'),
    },
    {
      productId: 'woven-art-80x120',
      name: 'BasKoestiek kunstwerk 80 × 120 cm',
      format: '80 × 120 cm',
      description: 'Klein formaat — mooi als akoestisch accent of voor smallere wanddelen.',
      recommendedCount: countLabel('woven-art-80x120'),
    },
  ];
}

function getProductRecommendation(calculationData = {}, context = {}) {
  const requiredSabins = safeNumber(calculationData.requiredExtraAbsorption ?? calculationData.requiredSabins);
  const products = getActiveAcousticProducts()
    .map((product) => ({ ...product, sabins: getProductSabins(product) }))
    .sort((a, b) => b.sabins - a.sabins);

  const exactCounts = products.map((product) => ({
    productId: product.id,
    name: product.name,
    sabinsPerArtwork: product.sabins,
    countNeeded: requiredSabins > 0 && product.sabins > 0 ? Math.ceil(requiredSabins / product.sabins) : 0,
    totalSabins: requiredSabins > 0 && product.sabins > 0 ? Math.ceil(requiredSabins / product.sabins) * product.sabins : 0,
  }));

  const large = products[0];
  const small = products[1] ?? products[0];
  const maxLarge = requiredSabins > 0 && large?.sabins > 0 ? Math.ceil(requiredSabins / large.sabins) : 0;
  let best = {
    counts: products.reduce((acc, product) => ({ ...acc, [product.id]: 0 }), {}),
    totalSabins: 0,
    totalCount: 0,
    coveragePercent: requiredSabins > 0 ? 0 : 100,
  };

  for (let largeCount = 0; largeCount <= maxLarge; largeCount += 1) {
    const remaining = Math.max(0, requiredSabins - largeCount * large.sabins);
    const smallCount = remaining > 0 && small?.sabins > 0 ? Math.ceil(remaining / small.sabins) : 0;
    const totalSabins = largeCount * large.sabins + smallCount * small.sabins;
    const totalCount = largeCount + smallCount;
    const overage = totalSabins - requiredSabins;
    const bestOverage = best.totalSabins - requiredSabins;
    const isBetter = totalSabins >= requiredSabins
      && (best.totalSabins === 0 || overage < bestOverage || (overage === bestOverage && totalCount < best.totalCount));

    if (isBetter) {
      best = {
        counts: {
          [large.id]: largeCount,
          [small.id]: smallCount,
        },
        totalSabins,
        totalCount,
        coveragePercent: requiredSabins > 0 ? totalSabins / requiredSabins * 100 : 100,
      };
    }
  }

  const logicalCombination = {
    items: products.map((product) => ({
      productId: product.id,
      name: product.name,
      count: best.counts[product.id] || 0,
      sabinsPerArtwork: product.sabins,
      totalSabins: (best.counts[product.id] || 0) * product.sabins,
    })),
    totalSabins: best.totalSabins,
    totalCount: best.totalCount,
    coveragePercent: best.coveragePercent,
  };

  return {
    requiredSabins,
    products,
    exactCounts,
    logicalCombination,
    realisticAdvice: getRealisticArtworkAdvice({
      requiredSabins,
      availableWallAreaM2: calculationData.availableWallAreaM2,
      roomType: context.roomType ?? calculationData.roomType,
      roomAreaM2: calculationData.floorAreaM2 ?? calculationData.roomAreaM2,
      wallAreaM2: calculationData.wallAreaM2,
    }),
  };
}

function getSurfaceAnalysis(calculationData = {}, sketchData = {}) {
  const objectCounts = getObjectCounts(sketchData);
  const signals = [];
  if (safeNumber(calculationData.glassAreaM2) > 0 || objectCounts.window) signals.push('glas');
  if (safeNumber(calculationData.curtainAreaM2) <= 0 && !objectCounts.curtain) signals.push('weinig zachte materialen');
  if (safeNumber(calculationData.carpetAreaM2) <= 0 && !objectCounts.rug) signals.push('harde vloerzones');
  if (safeNumber(calculationData.floorAreaM2) >= 70) signals.push('open ruimte');
  if (signals.length === 0) signals.push('een mix van harde en zachte oppervlakken');
  return `De indicatie wijst vooral op ${signals.join(', ')}. Daardoor kunnen stemmen langer blijven hangen en kan rumoer zich sneller door de ruimte verspreiden.`;
}

function getCustomerProblemText(indication) {
  if (indication === 'hoog') {
    return 'De ruimte lijkt gevoelig voor galm en oplopend rumoer, vooral wanneer meerdere tafels tegelijk bezet zijn.';
  }
  if (indication === 'gemiddeld') {
    return 'De ruimte heeft waarschijnlijk baat bij gerichte akoestische verbetering rond tafelzones en reflecterende vlakken.';
  }
  return 'De ruimte lijkt akoestisch redelijk beheersbaar, maar gerichte absorptie kan comfort en verstaanbaarheid verbeteren.';
}

export function generateCustomerReport(calculationData, sketchData, leadData = {}) {
  const adviceCode = createAdviceCode(leadData, calculationData);
  const indication = getAcousticIndication(calculationData);
  const acousticNeedLevel = getAcousticNeedLevel(calculationData);
  const solutionDirection = getSolutionDirection(calculationData);
  const roomType = leadData.roomType || sketchData?.room?.type || 'restaurant';
  const normalizedRoomType = normalizeRoomType(roomType);
  const productRecommendation = getProductRecommendation(calculationData, { roomType });
  const realisticAdvice = productRecommendation.realisticAdvice;
  const artworkRange = getArtworkRange(realisticAdvice);
  const measurementRecommendation = getMeasurementRecommendation(calculationData, acousticNeedLevel);
  const effectScore = getCustomerEffectScore(realisticAdvice, roomType, productRecommendation);
  const adviceLevel = getCustomerAdviceLevel(effectScore);
  const productAdviceLevel = getCustomerProductAdviceLevel(effectScore);
  const customerFinalConclusion = getCustomerConclusion(effectScore);
  const customerImpression = getCustomerImpression(acousticNeedLevel, effectScore);
  const productCombinationText = getFriendlyProductCombination(realisticAdvice.tiers?.recommended, effectScore);
  const consumerAdviceLevels = getConsumerAdviceLevels(roomType);
  const consumerProductCards = getConsumerProductCards(realisticAdvice.tiers?.recommended, effectScore);
  const needsCombination = realisticAdvice.status !== 'artworks_sufficient';
  const realismMessage = needsCombination
    ? 'Met alleen akoestische kunstwerken is de volledige akoestische behoefte waarschijnlijk niet realistisch op te lossen. Wij adviseren een combinatie van kunstwerken en aanvullende akoestische maatregelen.'
    : 'Met een gerichte plaatsing van BasKoestiek akoestische kunstwerken lijkt de akoestische behoefte binnen deze ruimte realistisch te verbeteren.';
  const placementRoomText = normalizedRoomType === 'meeting_room'
    ? quickscanTexts.placement.office
    : quickscanTexts.placement[normalizedRoomType] ?? '';

  return {
    adviceCode,
    roomType,
    normalizedRoomType,
    acousticNeedLevel,
    acousticIndication: indication,
    problemSummary: getCustomerProblemText(indication),
    customerIntro: quickscanTexts.customerIntro,
    simpleConclusion: quickscanTexts.simpleConclusion,
    whatYouNotice: quickscanTexts.whatYouNotice,
    oneArtwork: quickscanTexts.oneArtwork,
    multipleArtworks: quickscanTexts.multipleArtworks,
    beforeAfter: quickscanTexts.beforeAfter,
    customerImpression,
    effectScore,
    adviceLevel,
    productAdviceLevel,
    productIntro: quickscanTexts.productIntro,
    productCombinationText,
    consumerAdviceLevels,
    consumerProductCards,
    whyItWorks: quickscanTexts.whyItWorks,
    customerFinalConclusion,
    sketchPreviewData: sketchData,
    surfaceAnalysis: getSurfaceAnalysis(calculationData, sketchData),
    solutionDirection,
    indicativeArtworks: getIndicativeArtworks(realisticAdvice),
    indicativeArtworkText: artworkRange.maxArtworks > 0
      ? quickscanTexts.artworkCount({ ...artworkRange, adviceLevelId: adviceLevel.id })
      : 'Voor deze ruimte is persoonlijk advies nodig om een realistische indicatie voor akoestische kunstwerken te maken.',
    artworkRange,
    artworkAdviceStatus: realisticAdvice.status,
    artworkStatusText: quickscanTexts.artworkStatus[realisticAdvice.status],
    placementAdvice: {
      title: quickscanTexts.placement.title,
      suggestions: quickscanTexts.placement.suggestions,
      room: placementRoomText,
    },
    measurementRecommendation,
    realismMessage,
    additionalMeasures: needsCombination ? realisticAdvice.additionalMeasures : [],
    customerExplanation: `Voor deze ruimte adviseren we om akoestiek niet als losse technische ingreep te zien, maar als onderdeel van de interieurbeleving. BasKoestiek kan harde reflecties verzachten met geweven akoestische kunstwerken die passen bij de uitstraling van de zaak. ${realismMessage}`,
    productCategory: productRecommendation.products[0]?.category || 'woven-acoustic-artwork',
    callsToAction: quickscanTexts.cta.buttons,
    reportIntro: quickscanTexts.customerIntro,
    cta: quickscanTexts.cta,
    disclaimer: quickscanTexts.generalDisclaimer,
    productDisclaimer: quickscanTexts.productDisclaimer,
  };
}

export function generateInternalReport(calculationData, sketchData, leadData = {}) {
  const adviceCode = createAdviceCode(leadData, calculationData);
  const objectCounts = getObjectCounts(sketchData);
  const sketchObjects = getSketchObjects(sketchData);
  const roomType = leadData.roomType || sketchData?.room?.type || 'restaurant';
  const availableWallAreaM2 = safeNumber(calculationData.availableWallAreaM2 ?? calculationData.wallAreaM2);
  const requiredFeltM2 = safeNumber(calculationData.requiredFeltM2 ?? calculationData.recommendedFeltM2);
  const insufficientWallArea = availableWallAreaM2 > 0 && requiredFeltM2 > availableWallAreaM2 * 0.65;
  const productRecommendation = getProductRecommendation(calculationData, { roomType });
  const realisticAdvice = productRecommendation.realisticAdvice;
  const acousticNeedLevel = getAcousticNeedLevel(calculationData);
  const measurementRecommendation = getMeasurementRecommendation(calculationData, acousticNeedLevel);
  const productMatch = realisticAdvice.tiers.recommended.items
    .filter((item) => item.count > 0)
    .map((item) => `${item.count}x ${item.name}`)
    .join(' + ') || 'Geen productaantal nodig volgens huidige invoer';
  const needsCombination = realisticAdvice.status !== 'artworks_sufficient';

  return {
    adviceCode,
    generatedAt: new Date().toISOString(),
    intro: quickscanTexts.internalIntro,
    warning: realisticAdvice.status === 'artworks_not_realistic' ? quickscanTexts.internalNotRealisticWarning : '',
    measurementRecommendation,
    leadData: {
      name: leadData.name || '',
      company: leadData.company || '',
      email: leadData.email || '',
      phone: leadData.phone || '',
      projectName: leadData.projectName || '',
      city: leadData.city || '',
      roomType,
      customerNotes: leadData.customerNotes || '',
    },
    roomData: {
      length: calculationData.lengthMeters,
      width: calculationData.widthMeters,
      height: calculationData.heightMeters,
      volumeM3: calculationData.volumeM3,
      floorAreaM2: calculationData.floorAreaM2,
      floorType: calculationData.floorType,
      floorLabel: calculationData.floorLabel,
      floorAbsorptionEstimate: calculationData.floorAbsorptionEstimate,
      ceilingAreaM2: calculationData.ceilingAreaM2,
      wallAreaM2: calculationData.wallAreaM2,
    },
    sketchbookData: {
      sketchData,
      objectCounts,
      windows: objectCounts.window || 0,
      doors: objectCounts.door || 0,
      curtains: objectCounts.curtain || 0,
      tables: objectCounts.table || 0,
      chairs: objectCounts.chair || 0,
      sofas: objectCounts.sofa || 0,
      rugs: objectCounts.rug || 0,
      acousticObjects: sketchObjects.filter((object) => object.isAcousticElement).length,
    },
    acousticCalculation: {
      currentReverbTime: calculationData.currentReverbTime,
      targetReverbTime: calculationData.targetReverbTime,
      selectedNRC: calculationData.selectedNRC,
      existingAbsorptionEstimate: calculationData.existingAbsorptionEstimate,
      requiredExtraAbsorption: calculationData.requiredExtraAbsorption,
      requiredFeltM2,
      requiredSabins: calculationData.requiredExtraAbsorption,
      formula: 'requiredFeltM2 = ((0.16 * volumeM3 / targetReverbTime) - (0.16 * volumeM3 / currentReverbTime)) / selectedNRC',
    },
    productRecommendation,
    adviceData: {
      recommendedDirection: getSolutionDirection(calculationData),
      solutionType: calculationData.solutionLabel || getSolutionDirection(calculationData),
      availableWallAreaM2,
      insufficientWallArea,
      productMatch,
      placementSuggestion: calculationData.placementSuggestion || 'Plaats de BasKoestiek akoestische kunstwerken op reflecterende wandvlakken rondom tafelzones, bij voorkeur verdeeld over meerdere zichtlijnen op oor- en spraakhoogte.',
      quoteInput: `${formatNumber(productRecommendation.requiredSabins)} sabins nodig. Realistisch voorstel: ${productMatch}. Realistisch maximaal: ${formatNumber(realisticAdvice.realisticDeliveredSabins)} sabins. Resttekort: ${formatNumber(realisticAdvice.remainingSabins)} sabins.`,
      followUpNotes: needsCombination
        ? 'Alleen kunstwerken lossen de volledige behoefte waarschijnlijk niet op. Aanvullende plafondobjecten, textiel, vloerkleden of maatwerkpanelen meenemen.'
        : insufficientWallArea
        ? 'Wandruimte lijkt beperkt. Plafondoplossing of combinatie meenemen in offerte.'
        : 'Wandoplossing met BasKoestiek akoestische kunstwerken lijkt praktisch haalbaar; verdeling per wandvlak uitwerken.',
    },
  };
}
