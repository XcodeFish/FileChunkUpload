/**
 * 跨平台兼容性工具函数集
 */

/**
 * 浏览器环境检测
 * @returns 是否在浏览器环境中
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Node.js环境检测
 * @returns 是否在Node.js环境中
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions && !!process.versions.node;
}

/**
 * Web Worker环境检测
 * @returns 是否在Web Worker环境中
 */
export function isWebWorker(): boolean {
  return (
    typeof self === 'object' &&
    self.constructor &&
    self.constructor.name === 'DedicatedWorkerGlobalScope'
  );
}

/**
 * React Native环境检测
 * @returns 是否在React Native环境中
 */
export function isReactNative(): boolean {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

/**
 * 浏览器类型检测
 * @returns 浏览器类型对象
 */
export function getBrowserInfo(): {
  name: string;
  version: string;
  isChrome: boolean;
  isFirefox: boolean;
  isSafari: boolean;
  isEdge: boolean;
  isIE: boolean;
  isOpera: boolean;
} {
  if (!isBrowser()) {
    return {
      name: 'unknown',
      version: '0',
      isChrome: false,
      isFirefox: false,
      isSafari: false,
      isEdge: false,
      isIE: false,
      isOpera: false,
    };
  }

  const ua = navigator.userAgent;
  let name = 'unknown';
  let version = '0';
  let isChrome = false;
  let isFirefox = false;
  let isSafari = false;
  let isEdge = false;
  let isIE = false;
  let isOpera = false;

  // Edge
  if (ua.indexOf('Edg') > -1) {
    name = 'Edge';
    isEdge = true;
    const edgMatch = ua.match(/Edg\/([0-9.]+)/);
    version = edgMatch ? edgMatch[1] : '0';
  }
  // Chrome
  else if (ua.indexOf('Chrome') > -1) {
    name = 'Chrome';
    isChrome = true;
    const chromeMatch = ua.match(/Chrome\/([0-9.]+)/);
    version = chromeMatch ? chromeMatch[1] : '0';
  }
  // Firefox
  else if (ua.indexOf('Firefox') > -1) {
    name = 'Firefox';
    isFirefox = true;
    const ffMatch = ua.match(/Firefox\/([0-9.]+)/);
    version = ffMatch ? ffMatch[1] : '0';
  }
  // Safari
  else if (ua.indexOf('Safari') > -1) {
    name = 'Safari';
    isSafari = true;
    const safariMatch = ua.match(/Version\/([0-9.]+) Safari/);
    version = safariMatch ? safariMatch[1] : '0';
  }
  // IE
  else if (ua.indexOf('Trident') > -1) {
    name = 'Internet Explorer';
    isIE = true;
    const ieMatch = ua.match(/rv:([0-9.]+)/);
    version = ieMatch ? ieMatch[1] : '0';
  }
  // Opera
  else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
    name = 'Opera';
    isOpera = true;
    const operaMatch = ua.match(/(?:Opera|OPR)\/([0-9.]+)/);
    version = operaMatch ? operaMatch[1] : '0';
  }

  return {
    name,
    version,
    isChrome,
    isFirefox,
    isSafari,
    isEdge,
    isIE,
    isOpera,
  };
}

/**
 * 操作系统检测
 * @returns 操作系统信息
 */
export function getOSInfo(): {
  name: string;
  version: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  isIOS: boolean;
  isAndroid: boolean;
} {
  if (!isBrowser()) {
    return {
      name: 'unknown',
      version: '0',
      isWindows: false,
      isMacOS: false,
      isLinux: false,
      isIOS: false,
      isAndroid: false,
    };
  }

  const ua = navigator.userAgent;
  let name = 'unknown';
  let version = '0';
  let isWindows = false;
  let isMacOS = false;
  let isLinux = false;
  let isIOS = false;
  let isAndroid = false;

  // Windows
  if (ua.indexOf('Windows') > -1) {
    name = 'Windows';
    isWindows = true;
    const winMatch = ua.match(/Windows NT ([0-9.]+)/);
    version = winMatch ? winMatch[1] : '0';
  }
  // macOS
  else if (ua.indexOf('Macintosh') > -1) {
    name = 'macOS';
    isMacOS = true;
    const macMatch = ua.match(/Mac OS X ([0-9_.]+)/);
    version = macMatch ? macMatch[1].replace(/_/g, '.') : '0';
  }
  // iOS
  else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
    name = 'iOS';
    isIOS = true;
    const iosMatch = ua.match(/OS ([0-9_]+)/);
    version = iosMatch ? iosMatch[1].replace(/_/g, '.') : '0';
  }
  // Android
  else if (ua.indexOf('Android') > -1) {
    name = 'Android';
    isAndroid = true;
    const androidMatch = ua.match(/Android ([0-9.]+)/);
    version = androidMatch ? androidMatch[1] : '0';
  }
  // Linux
  else if (ua.indexOf('Linux') > -1) {
    name = 'Linux';
    isLinux = true;
  }

  return {
    name,
    version,
    isWindows,
    isMacOS,
    isLinux,
    isIOS,
    isAndroid,
  };
}

/**
 * 检测浏览器功能支持
 * @returns 浏览器功能支持信息
 */
export function getBrowserFeatures(): {
  webWorker: boolean;
  webSocket: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  webGL: boolean;
  canvas: boolean;
  fileReader: boolean;
  geolocation: boolean;
  history: boolean;
  formData: boolean;
  fetch: boolean;
  promise: boolean;
  serviceWorker: boolean;
  webRTC: boolean;
  webP: boolean;
} {
  if (!isBrowser()) {
    return {
      webWorker: false,
      webSocket: false,
      localStorage: false,
      sessionStorage: false,
      webGL: false,
      canvas: false,
      fileReader: false,
      geolocation: false,
      history: false,
      formData: false,
      fetch: false,
      promise: false,
      serviceWorker: false,
      webRTC: false,
      webP: false,
    };
  }

  return {
    webWorker: typeof Worker !== 'undefined',
    webSocket: typeof WebSocket !== 'undefined',
    localStorage: (() => {
      try {
        return typeof localStorage !== 'undefined';
      } catch (e) {
        return false;
      }
    })(),
    sessionStorage: (() => {
      try {
        return typeof sessionStorage !== 'undefined';
      } catch (e) {
        return false;
      }
    })(),
    webGL: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(
          window.WebGLRenderingContext &&
          (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
        );
      } catch (e) {
        return false;
      }
    })(),
    canvas: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext && canvas.getContext('2d'));
      } catch (e) {
        return false;
      }
    })(),
    fileReader: typeof FileReader !== 'undefined',
    geolocation: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    history: typeof history !== 'undefined',
    formData: typeof FormData !== 'undefined',
    fetch: typeof fetch !== 'undefined',
    promise: typeof Promise !== 'undefined',
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    webRTC: typeof RTCPeerConnection !== 'undefined',
    webP: (() => {
      try {
        if (!isBrowser()) return false;
        const canvas = document.createElement('canvas');
        if (!canvas || !canvas.getContext) return false;
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      } catch (e) {
        return false;
      }
    })(),
  };
}

/**
 * 获取网络连接信息
 * @returns 网络连接信息
 */
export function getNetworkInfo(): {
  online: boolean;
  type: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
} {
  if (!isBrowser() || !navigator) {
    return {
      online: false,
      type: 'unknown',
      effectiveType: 'unknown',
      downlink: 0,
      rtt: 0,
      saveData: false,
    };
  }

  const connection =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;

  return {
    online: typeof navigator.onLine === 'boolean' ? navigator.onLine : false,
    type: connection ? connection.type || 'unknown' : 'unknown',
    effectiveType: connection ? connection.effectiveType || 'unknown' : 'unknown',
    downlink: connection ? connection.downlink || 0 : 0,
    rtt: connection ? connection.rtt || 0 : 0,
    saveData: connection ? !!connection.saveData : false,
  };
}

/**
 * 检测是否支持触摸事件
 * @returns 是否支持触摸事件
 */
export function isTouchDevice(): boolean {
  if (!isBrowser()) {
    return false;
  }

  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

/**
 * 检测设备类型
 * @returns 设备类型信息
 */
export function getDeviceType(): {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
} {
  if (!isBrowser()) {
    return {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
    };
  }

  const ua = navigator.userAgent;

  // 检测平板设备
  const isTablet =
    /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|surface)/i.test(
      ua,
    );

  // 检测移动设备
  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) && !isTablet;

  // 如果既不是移动设备也不是平板，则为桌面设备
  const isDesktop = !isMobile && !isTablet;

  return {
    isMobile,
    isTablet,
    isDesktop,
  };
}

/**
 * 获取屏幕信息
 * @returns 屏幕信息
 */
export function getScreenInfo(): {
  width: number;
  height: number;
  availWidth: number;
  availHeight: number;
  colorDepth: number;
  orientation: string;
  pixelRatio: number;
} {
  if (!isBrowser()) {
    return {
      width: 0,
      height: 0,
      availWidth: 0,
      availHeight: 0,
      colorDepth: 0,
      orientation: 'unknown',
      pixelRatio: 1,
    };
  }

  const screen = window.screen;

  return {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    pixelRatio: window.devicePixelRatio || 1,
  };
}
