import html2canvas from 'html2canvas';

// Mathematical OKLCH to RGB conversion
export function oklchToRgb(lStr: string, cStr: string, hStr: string, aStr = '1'): string {
  try {
    let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let c = cStr.endsWith('%') ? (parseFloat(cStr) / 100) * 0.4 : parseFloat(cStr);
    let h = parseFloat(hStr);
    let a = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);

    if (isNaN(l) || !isFinite(l)) l = 0;
    if (isNaN(c) || !isFinite(c)) c = 0;
    if (isNaN(h) || !isFinite(h)) h = 0;
    if (isNaN(a) || !isFinite(a)) a = 1;

    let radH = (h * Math.PI) / 180;
    let cosH = Math.cos(radH);
    let sinH = Math.sin(radH);

    let compA = c * cosH;
    let compB = c * sinH;

    let l_ = l + 0.3963377774 * compA + 0.2158037573 * compB;
    let m_ = l - 0.1055613458 * compA - 0.0638541728 * compB;
    let s_ = l - 0.0894841775 * compA - 1.2914855480 * compB;

    let l_3 = l_ * l_ * l_;
    let m_3 = m_ * m_ * m_;
    let s_3 = s_ * s_ * s_;

    let r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
    let g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
    let b_val = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

    const gamma = (x: number) => {
      return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    };

    let R = Math.round(Math.max(0, Math.min(1, gamma(r))) * 255);
    let G = Math.round(Math.max(0, Math.min(1, gamma(g))) * 255);
    let B = Math.round(Math.max(0, Math.min(1, gamma(b_val))) * 255);

    return a === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${a})`;
  } catch (e) {
    return 'rgb(124, 58, 237)'; // fallback brand purple
  }
}

export function replaceOklchWithRgb(str: string): string {
  if (!str || typeof str !== 'string') return str;
  let res = str;
  if (res.includes('oklch')) {
    res = res.replace(/oklch\(([^)]+)\)/g, (match, content) => {
      const parts = content.trim().split(/[\s,/]+/);
      if (parts.length < 3) return match;
      return oklchToRgb(parts[0], parts[1], parts[2], parts[3]);
    });
  }
  if (res.includes('oklab')) {
    res = res.replace(/oklab\(([^)]+)\)/g, (match, content) => {
      const parts = content.trim().split(/[\s,/]+/);
      if (parts.length < 3) return match;
      return oklabToRgb(parts[0], parts[1], parts[2], parts[3]);
    });
  }
  return res;
}

export function oklabToRgb(lStr: string, aStr: string, bStr: string, alphaStr = '1'): string {
  try {
    let l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
    let compA = aStr.endsWith('%') ? (parseFloat(aStr) / 100) * 0.4 : parseFloat(aStr);
    let compB = bStr.endsWith('%') ? (parseFloat(bStr) / 100) * 0.4 : parseFloat(bStr);
    let a = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);

    if (isNaN(l) || !isFinite(l)) l = 0;
    if (isNaN(compA) || !isFinite(compA)) compA = 0;
    if (isNaN(compB) || !isFinite(compB)) compB = 0;
    if (isNaN(a) || !isFinite(a)) a = 1;

    let l_ = l + 0.3963377774 * compA + 0.2158037573 * compB;
    let m_ = l - 0.1055613458 * compA - 0.0638541728 * compB;
    let s_ = l - 0.0894841775 * compA - 1.2914855480 * compB;

    let l_3 = l_ * l_ * l_;
    let m_3 = m_ * m_ * m_;
    let s_3 = s_ * s_ * s_;

    let r = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
    let g = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
    let b_val = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

    const gamma = (x: number) => {
      return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    };

    let R = Math.round(Math.max(0, Math.min(1, gamma(r))) * 255);
    let G = Math.round(Math.max(0, Math.min(1, gamma(g))) * 255);
    let B = Math.round(Math.max(0, Math.min(1, gamma(b_val))) * 255);

    return a === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${a})`;
  } catch (e) {
    return 'rgb(124, 58, 237)'; // fallback brand purple
  }
}

// Safer wrapper for html2canvas
export default async function html2canvasSafe(element: HTMLElement, options?: any): Promise<HTMLCanvasElement> {
  const originalGetComputedStyle = window.getComputedStyle.bind(window);
  const originalStyleSheets = document.styleSheets;

  // 1. Monkeypatch window.getComputedStyle
  window.getComputedStyle = function (elt: Element, pseudoElt?: string | null): CSSStyleDeclaration {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            return replaceOklchWithRgb(val);
          };
        }
        // Do not pass receiver to Reflect.get to avoid illegal invocation on DOM getter properties
        const val = Reflect.get(target, prop);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
          return replaceOklchWithRgb(val);
        }
        return val;
      }
    });
  };

  // 2. Monkeypatch document.styleSheets
  let proxiedStyleSheets: any[] = [];
  try {
    proxiedStyleSheets = Array.from(originalStyleSheets).map((sheet) => {
      return new Proxy(sheet, {
        get(target, prop, receiver) {
          if (prop === 'cssRules') {
            try {
              const rules = target.cssRules;
              if (!rules) return rules;
              
              const proxiedRules = Array.from(rules).map((rule) => {
                if (rule.cssText && (rule.cssText.includes('oklch') || rule.cssText.includes('oklab'))) {
                  return new Proxy(rule, {
                    get(ruleTarget, ruleProp) {
                      if (ruleProp === 'cssText') {
                        return replaceOklchWithRgb(ruleTarget.cssText);
                      }
                      if (ruleProp === 'style') {
                        const style = (ruleTarget as any).style;
                        if (!style) return undefined;
                        return new Proxy(style, {
                          get(styleTarget, styleProp) {
                            if (styleProp === 'cssText') {
                              return replaceOklchWithRgb(styleTarget.cssText);
                            }
                            const val = Reflect.get(styleTarget, styleProp);
                            if (typeof val === 'function') {
                              return val.bind(styleTarget);
                            }
                            if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                              return replaceOklchWithRgb(val);
                            }
                            return val;
                          }
                        });
                      }
                      const val = Reflect.get(ruleTarget, ruleProp);
                      if (typeof val === 'function') {
                        return val.bind(ruleTarget);
                      }
                      return val;
                    }
                  });
                }
                return rule;
              });

              return new Proxy(rules, {
                get(rulesTarget, rulesProp) {
                  if (rulesProp === 'length') {
                    return proxiedRules.length;
                  }
                  if (typeof rulesProp === 'string' && !isNaN(Number(rulesProp))) {
                    return proxiedRules[Number(rulesProp)];
                  }
                  if (rulesProp === 'item') {
                    return (index: number) => proxiedRules[index];
                  }
                  const val = Reflect.get(rulesTarget, rulesProp);
                  if (typeof val === 'function') {
                    return val.bind(rulesTarget);
                  }
                  return val;
                },
                getOwnPropertyDescriptor(rulesTarget, rulesProp) {
                  return Reflect.getOwnPropertyDescriptor(proxiedRules, rulesProp);
                },
                ownKeys() {
                  return Reflect.ownKeys(proxiedRules);
                }
              });
            } catch (e) {
              return [];
            }
          }
          const val = Reflect.get(target, prop);
          if (typeof val === 'function') {
            return val.bind(target);
          }
          return val;
        }
      });
    });
  } catch (e) {
    console.error('Failed to prepare proxied stylesheets', e);
  }

  try {
    Object.defineProperty(document, 'styleSheets', {
      get() {
        return proxiedStyleSheets.length > 0 ? proxiedStyleSheets : originalStyleSheets;
      },
      configurable: true
    });
  } catch (e) {
    console.error('Failed to patch document.styleSheets', e);
  }

  try {
    const canvas = await html2canvas(element, options);
    return canvas;
  } finally {
    // Restore original globals
    window.getComputedStyle = originalGetComputedStyle;
    try {
      Object.defineProperty(document, 'styleSheets', {
        get() {
          return originalStyleSheets;
        },
        configurable: true
      });
    } catch (e) {
      console.error('Failed to restore document.styleSheets', e);
    }
  }
}
