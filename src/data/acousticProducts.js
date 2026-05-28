export const acousticProducts = [
  {
    id: 'woven-art-80x120',
    name: 'Akoestisch kunstwerk 80 x 120 cm',
    widthMeters: 0.8,
    heightMeters: 1.2,
    planDepthMeters: 0.04,
    areaM2: 0.96,
    acousticValuePerM2: 0.5,
    sabins: 0.48,
    placementType: 'wall',
    category: 'woven-acoustic-artwork',
    isActive: true,
  },
  {
    id: 'woven-art-120x180',
    name: 'Akoestisch kunstwerk 120 x 180 cm',
    widthMeters: 1.2,
    heightMeters: 1.8,
    planDepthMeters: 0.04,
    areaM2: 2.16,
    acousticValuePerM2: 0.5,
    sabins: 1.08,
    placementType: 'wall',
    category: 'woven-acoustic-artwork',
    isActive: true,
  },
];

export function getProductSabins(product) {
  return product.sabins ?? product.areaM2 * product.acousticValuePerM2;
}

export function getActiveAcousticProducts() {
  return acousticProducts.filter((product) => product.isActive);
}
