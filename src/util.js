import chroma from 'chroma-js';

const Util = (function() {
  const cmp = function(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  };

  const realBBox = function(chunks, span) {
    const box = span.rect.bbox();
    const chunk = chunks.find(c => c.index === span.chunkId);
    const chunkTranslation = chunk.translation;
    const rowTranslation = chunk.row.translation;
    box.x += chunkTranslation.x + rowTranslation.x;
    box.y += chunkTranslation.y + rowTranslation.y;
    return box;
  };

  const getSpanLabels = function(spanTypes, spanType) {
    const type = spanTypes[spanType];
    return type && type.labels || [];
  };

  const spanDisplayForm = function(spanTypes, spanType) {
    const labels = getSpanLabels(spanTypes, spanType);
    return labels[0] || spanType;
  };

  const getArcLabels = function(spanTypes, spanType, arcType, relationTypesHash) {
    const type = spanTypes[spanType];
    const arcTypes = type && type.arcs || [];
    let arcDesc = null;
    // also consider matches without suffix number, if any
    let noNumArcType;
    if (arcType) {
      const splitType = arcType.match(/^(.*?)(\d*)$/);
      noNumArcType = splitType[1];
    }
    arcTypes.forEach((arcDescI) =>{
      if (arcDescI.type === arcType || arcDescI.type === noNumArcType) {
        arcDesc = arcDescI;
        return false;
      }
    });
    // fall back to relation types for unconfigured or missing def
    if (!arcDesc) {
      arcDesc = Object.assign({}, relationTypesHash[arcType] || relationTypesHash[noNumArcType]);
    }
    return arcDesc && arcDesc.labels || [];
  };

  const arcDisplayForm = function(spanTypes, spanType, arcType, relationTypesHash) {
    const labels = getArcLabels(spanTypes, spanType, arcType, relationTypesHash);
    return labels[0] || arcType;
  };


  const strToRgb = function(color) {
    return chroma(color).rgb();
  };

  const rgbToStr = function(rgb) {
    return chroma(rgb).hex();
  };


  // RGB to HSL color conversion
  const rgbToHsl = function(rgb) {
    const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  const hue2rgb = function(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const hslToRgb = function(hsl) {
    const h = hsl[0], s = hsl[1], l = hsl[2];
    let r, g, b;
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [r * 255, g * 255, b * 255];
  };

  const adjustLightnessCache = {};

  const adjustColorLightness = function(colorsStr, adjust) {
    if (!(colorsStr in adjustLightnessCache)) {
      adjustLightnessCache[colorsStr] = {};
    }
    if (!(adjust in adjustLightnessCache[colorsStr])) {
      const rgb = strToRgb(colorsStr);
      if (rgb === undefined) {
        // failed color string conversion; just return the input
        adjustLightnessCache[colorsStr][adjust] = colorsStr;
      } else {
        const hsl = rgbToHsl(rgb);
        if (adjust > 0.0) {
          hsl[2] = 1.0 - ((1.0 - hsl[2]) * (1.0 - adjust));
        } else {
          hsl[2] = (1.0 + adjust) * hsl[2];
        }
        const lightRgb = hslToRgb(hsl);
        adjustLightnessCache[colorsStr][adjust] = rgbToStr(lightRgb);
      }
    }
    return adjustLightnessCache[colorsStr][adjust];
  };

  return {
    realBBox: realBBox,
    getSpanLabels: getSpanLabels,
    spanDisplayForm: spanDisplayForm,
    getArcLabels: getArcLabels,
    arcDisplayForm: arcDisplayForm,
    cmp: cmp,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    adjustColorLightness: adjustColorLightness,
  };

})();


export default Util;