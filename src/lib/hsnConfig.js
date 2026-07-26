/**
 * hsnConfig.js
 *
 * Maps HSN codes to their applicable GST rate (%).
 * All prices on the website are GST-INCLUSIVE.
 * The invoice generator uses this to back-calculate the taxable value.
 *
 * HOW TO UPDATE IN FUTURE:
 * If a new product category has a different GST rate (e.g. 12%),
 * add its HSN code here: 'XXXXXXXX': 12
 * The invoice generator will automatically use the correct rate.
 *
 * DEFAULT FALLBACK: If an HSN code is not listed here, 5% is assumed.
 */

export const HSN_TAX_RATES = {
  // ── Current Products — All at 5% GST ──────────────────
  '46021990': 5,   // Basketwork, wickerwork & woven articles of vegetable materials
  '57050039': 5,   // Carpets and other textile floor coverings
  '63019090': 5,   // Other blankets and travelling rugs
  '69119010': 5,   // Ceramic tableware (porcelain/china)
  '69120010': 5,   // Ceramic kitchenware
  '69139000': 5,   // Other ornamental/decorative ceramic articles

  // ── ADD FUTURE HSN CODES BELOW THIS LINE ──────────────
  // Example: '44209090': 12,  // Decorative wooden articles at 12%
};

/**
 * Returns the GST rate (%) for a given HSN code.
 * Falls back to 5% if the code is not in the map.
 * @param {string|number} hsnCode
 * @returns {number} GST percentage (e.g. 5, 12, 18)
 */
export function getGstRate(hsnCode) {
  const key = String(hsnCode || '').trim();
  if (!key) return 5; // default
  return HSN_TAX_RATES[key] ?? 5;
}
