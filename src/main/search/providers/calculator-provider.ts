import { clipboard } from 'electron';
import type { SearchProvider } from '../search-provider';
import type { UnifiedResult, ResultAction } from '../../../shared/types';

// Simple math expression evaluator (no eval, no external deps)
function evaluateExpression(expr: string): number | null {
  try {
    // Sanitize: only allow numbers, operators, parens, dots, spaces
    const sanitized = expr.replace(/\s/g, '');
    if (!/^[0-9+\-*/().,%^e]+$/i.test(sanitized)) return null;
    if (sanitized.length === 0) return null;

    // Replace common math functions and constants
    let processed = sanitized
      .replace(/\^/g, '**')
      .replace(/%/g, '/100');

    // Use Function constructor instead of eval for slight safety improvement
    // Only allows math operations
    const fn = new Function(`"use strict"; return (${processed})`);
    const result = fn();

    if (typeof result !== 'number' || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// Unit conversion definitions
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Length (base: meters)
  km: { m: 1000 }, m: { m: 1 }, cm: { m: 0.01 }, mm: { m: 0.001 },
  mi: { m: 1609.344 }, mile: { m: 1609.344 }, miles: { m: 1609.344 },
  ft: { m: 0.3048 }, feet: { m: 0.3048 }, foot: { m: 0.3048 },
  in: { m: 0.0254 }, inch: { m: 0.0254 }, inches: { m: 0.0254 },
  yd: { m: 0.9144 }, yard: { m: 0.9144 }, yards: { m: 0.9144 },
  // Weight (base: grams)
  kg: { g: 1000 }, g: { g: 1 }, mg: { g: 0.001 },
  lb: { g: 453.592 }, lbs: { g: 453.592 }, pound: { g: 453.592 }, pounds: { g: 453.592 },
  oz: { g: 28.3495 }, ounce: { g: 28.3495 }, ounces: { g: 28.3495 },
  // Temperature handled specially
  // Volume (base: liters)
  l: { l: 1 }, liter: { l: 1 }, liters: { l: 1 }, litre: { l: 1 },
  ml: { l: 0.001 }, gal: { l: 3.78541 }, gallon: { l: 3.78541 }, gallons: { l: 3.78541 },
  cup: { l: 0.236588 }, cups: { l: 0.236588 },
  // Speed (base: m/s)
  mph: { 'km/h': 1.60934 }, 'km/h': { 'km/h': 1 }, kph: { 'km/h': 1 },
  // Data (base: bytes)
  b: { b: 1 }, byte: { b: 1 }, bytes: { b: 1 },
  kb: { b: 1024 }, mb: { b: 1048576 }, gb: { b: 1073741824 }, tb: { b: 1099511627776 },
};

// Group units by their base unit type
function getBaseUnit(unit: string): string | null {
  const u = unit.toLowerCase();
  const conv = UNIT_CONVERSIONS[u];
  if (!conv) return null;
  return Object.keys(conv)[0]; // Returns the base unit type (m, g, l, etc.)
}

function convertUnits(value: number, fromUnit: string, toUnit: string): number | null {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();

  // Temperature special handling
  if ((from === 'c' || from === 'celsius') && (to === 'f' || to === 'fahrenheit')) {
    return (value * 9) / 5 + 32;
  }
  if ((from === 'f' || from === 'fahrenheit') && (to === 'c' || to === 'celsius')) {
    return ((value - 32) * 5) / 9;
  }
  if ((from === 'c' || from === 'celsius') && to === 'k') {
    return value + 273.15;
  }
  if (from === 'k' && (to === 'c' || to === 'celsius')) {
    return value - 273.15;
  }

  const fromConv = UNIT_CONVERSIONS[from];
  const toConv = UNIT_CONVERSIONS[to];

  if (!fromConv || !toConv) return null;

  const fromBase = getBaseUnit(from);
  const toBase = getBaseUnit(to);

  if (!fromBase || !toBase || fromBase !== toBase) return null;

  const fromFactor = fromConv[fromBase];
  const toFactor = toConv[toBase];

  return (value * fromFactor) / toFactor;
}

function formatNumber(num: number): string {
  // Avoid floating point weirdness
  if (Number.isInteger(num)) return num.toLocaleString();
  // Round to 6 significant digits
  const rounded = parseFloat(num.toPrecision(10));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

// Regex to detect math expressions
const MATH_PATTERN = /^[0-9(][0-9+\-*/().,%^ e]*$/i;
// Regex to detect unit conversions
const UNIT_PATTERN = /^([\d.]+)\s*([a-z/]+)\s+(?:to|in|as)\s+([a-z/]+)$/i;

export class CalculatorProvider implements SearchProvider {
  id = 'calculator';
  name = 'Calculator';
  priority = 5; // very high priority - instant answers

  canHandle(query: string): boolean {
    const q = query.trim();
    return MATH_PATTERN.test(q) || UNIT_PATTERN.test(q);
  }

  async search(query: string): Promise<UnifiedResult[]> {
    const q = query.trim();

    // Try unit conversion first
    const unitMatch = q.match(UNIT_PATTERN);
    if (unitMatch) {
      const value = parseFloat(unitMatch[1]);
      const fromUnit = unitMatch[2];
      const toUnit = unitMatch[3];

      if (!isNaN(value)) {
        const converted = convertUnits(value, fromUnit, toUnit);
        if (converted !== null) {
          return [{
            id: 'calc-unit',
            name: `${formatNumber(converted)} ${toUnit}`,
            subtitle: `${formatNumber(value)} ${fromUnit} = ${formatNumber(converted)} ${toUnit}`,
            icon: '📐',
            category: 'calculator',
            score: 2000, // above everything
            actions: this.getDefaultActions(),
            data: {
              _providerId: this.id,
              result: formatNumber(converted),
              expression: q,
            },
          }];
        }
      }
    }

    // Try math expression
    const result = evaluateExpression(q);
    if (result !== null) {
      return [{
        id: 'calc-result',
        name: `= ${formatNumber(result)}`,
        subtitle: q,
        icon: '🧮',
        category: 'calculator',
        score: 2000, // above everything
        actions: this.getDefaultActions(),
        data: {
          _providerId: this.id,
          result: formatNumber(result),
          expression: q,
        },
      }];
    }

    return [];
  }

  private getDefaultActions(): ResultAction[] {
    return [
      { id: 'copy', name: 'Copy Result', shortcut: 'Enter', isDefault: true },
    ];
  }

  getActions(result: UnifiedResult): ResultAction[] {
    if (result.category !== 'calculator') return [];
    return this.getDefaultActions();
  }

  async executeAction(result: UnifiedResult, actionId: string): Promise<void> {
    if (actionId === 'copy') {
      const value = result.data.result as string;
      if (value) {
        clipboard.writeText(value);
      }
    }
  }
}
