/**
 * wallpapers.js
 * Catalogo de papeis de parede internos do app.
 *
 * Estrutura para manutencao simples:
 * - Adicione novos itens em WALLPAPER_PRESETS.
 * - Nao precisa alterar rotas, HTML ou Service Worker novamente.
 */
(function () {
  "use strict";

  function svgToDataUrl(svg) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function buildWallpaperSvg(spec) {
    var style = String(spec.style || "gradient");
    var bgFill = style === "solid" ? spec.c1 : "url(#bg)";
    var extra = "";

    if (style === "waves") {
      extra =
        '<path d="M-80 520 C 120 430, 360 500, 560 620 C 760 740, 930 780, 1180 700 L1180 960 L-80 960 Z" fill="#ffffff" fill-opacity="0.08"/>' +
        '<path d="M-80 930 C 200 820, 420 900, 640 1020 C 860 1140, 980 1200, 1180 1140 L1180 1400 L-80 1400 Z" fill="' + spec.accent + '" fill-opacity="0.14"/>';
    } else if (style === "3d-rings") {
      extra =
        '<ellipse cx="260" cy="580" rx="290" ry="190" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="34"/>' +
        '<ellipse cx="840" cy="1240" rx="320" ry="220" fill="none" stroke="' + spec.accent + '" stroke-opacity="0.22" stroke-width="40"/>' +
        '<ellipse cx="620" cy="980" rx="430" ry="280" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="26"/>';
    } else if (style === "3d-cubes") {
      extra =
        '<polygon points="250,520 360,460 470,520 360,580" fill="#ffffff" fill-opacity="0.18"/>' +
        '<polygon points="360,580 470,520 470,660 360,720" fill="#ffffff" fill-opacity="0.10"/>' +
        '<polygon points="360,580 250,520 250,660 360,720" fill="#ffffff" fill-opacity="0.06"/>' +
        '<polygon points="680,980 820,900 960,980 820,1060" fill="' + spec.accent + '" fill-opacity="0.24"/>' +
        '<polygon points="820,1060 960,980 960,1160 820,1240" fill="' + spec.accent + '" fill-opacity="0.16"/>' +
        '<polygon points="820,1060 680,980 680,1160 820,1240" fill="' + spec.accent + '" fill-opacity="0.10"/>';
    } else if (style === "photo-mountains") {
      extra =
        '<circle cx="860" cy="340" r="130" fill="#ffffff" fill-opacity="0.18"/>' +
        '<path d="M-80 1180 L180 840 L360 1120 L540 880 L760 1220 L980 930 L1180 1250 L1180 1920 L-80 1920 Z" fill="#0b1726" fill-opacity="0.55"/>' +
        '<path d="M-80 1320 L160 1010 L340 1260 L520 1040 L760 1380 L980 1120 L1180 1420 L1180 1920 L-80 1920 Z" fill="#ffffff" fill-opacity="0.10"/>' +
        '<path d="M-80 1540 C 140 1490, 420 1510, 660 1590 C 900 1670, 1020 1690, 1180 1660 L1180 1920 L-80 1920 Z" fill="#ffffff" fill-opacity="0.09"/>';
    } else if (style === "photo-city") {
      extra =
        '<rect x="80" y="980" width="90" height="420" fill="#ffffff" fill-opacity="0.08"/>' +
        '<rect x="190" y="900" width="120" height="500" fill="#ffffff" fill-opacity="0.10"/>' +
        '<rect x="330" y="1030" width="90" height="370" fill="#ffffff" fill-opacity="0.09"/>' +
        '<rect x="440" y="840" width="160" height="560" fill="#ffffff" fill-opacity="0.12"/>' +
        '<rect x="620" y="920" width="120" height="480" fill="#ffffff" fill-opacity="0.10"/>' +
        '<rect x="760" y="980" width="130" height="420" fill="#ffffff" fill-opacity="0.09"/>' +
        '<rect x="910" y="860" width="130" height="540" fill="#ffffff" fill-opacity="0.11"/>' +
        '<path d="M-80 1480 C 200 1420, 420 1450, 650 1520 C 860 1580, 1020 1600, 1180 1570 L1180 1920 L-80 1920 Z" fill="#000000" fill-opacity="0.24"/>';
    } else {
      extra =
        '<ellipse cx="220" cy="300" rx="420" ry="340" fill="url(#glow1)"/>' +
        '<ellipse cx="860" cy="1360" rx="520" ry="440" fill="url(#glow2)"/>' +
        '<path d="M-80 1560 C 180 1420, 420 1520, 640 1650 C 820 1750, 980 1790, 1180 1730 L1180 1920 L-80 1920 Z" fill="#ffffff" fill-opacity="0.07"/>';
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">' +
        "<defs>" +
          '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="' + spec.c1 + '"/>' +
            '<stop offset="55%" stop-color="' + spec.c2 + '"/>' +
            '<stop offset="100%" stop-color="' + spec.c3 + '"/>' +
          "</linearGradient>" +
          '<radialGradient id="glow1" cx="22%" cy="18%" r="48%">' +
            '<stop offset="0%" stop-color="' + spec.accent + '" stop-opacity="0.42"/>' +
            '<stop offset="100%" stop-color="' + spec.accent + '" stop-opacity="0"/>' +
          "</radialGradient>" +
          '<radialGradient id="glow2" cx="80%" cy="72%" r="55%">' +
            '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.20"/>' +
            '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>' +
          "</radialGradient>" +
        "</defs>" +
        '<rect width="1080" height="1920" fill="' + bgFill + '"/>' +
        extra +
      "</svg>"
    );
  }

  // Para adicionar novos papeis internos, inclua aqui um novo objeto.
  var WALLPAPER_PRESETS = [
    // Solidos
    { id: "solid-night",      name: "Solido Noturno",   style: "solid", c1: "#0b1220", c2: "#0b1220", c3: "#0b1220", accent: "#60a5fa" },
    { id: "solid-ocean",      name: "Solido Oceano",    style: "solid", c1: "#0f3d5e", c2: "#0f3d5e", c3: "#0f3d5e", accent: "#22d3ee" },
    { id: "solid-forest",     name: "Solido Floresta",  style: "solid", c1: "#134e4a", c2: "#134e4a", c3: "#134e4a", accent: "#34d399" },
    { id: "solid-wine",       name: "Solido Vinho",     style: "solid", c1: "#4c1d36", c2: "#4c1d36", c3: "#4c1d36", accent: "#f472b6" },
    { id: "solid-slate",      name: "Solido Grafite",   style: "solid", c1: "#1f2937", c2: "#1f2937", c3: "#1f2937", accent: "#93c5fd" },
    { id: "solid-amber",      name: "Solido Ambar",     style: "solid", c1: "#5b3a07", c2: "#5b3a07", c3: "#5b3a07", accent: "#f59e0b" },
    { id: "solid-carbon",     name: "Solido Carbono",   style: "solid", c1: "#101418", c2: "#101418", c3: "#101418", accent: "#94a3b8" },
    { id: "solid-olive",      name: "Solido Oliva",     style: "solid", c1: "#263015", c2: "#263015", c3: "#263015", accent: "#86efac" },

    // Gradientes
    { id: "aurora-blue",      name: "Aurora Azul",      c1: "#021824", c2: "#0b3a67", c3: "#1d4f91", accent: "#38bdf8" },
    { id: "violet-night",     name: "Noite Violeta",    c1: "#120b2c", c2: "#31206d", c3: "#512d8c", accent: "#c084fc" },
    { id: "emerald-mist",     name: "Bruma Esmeralda",  c1: "#04221d", c2: "#0c4f48", c3: "#166b61", accent: "#34d399" },
    { id: "sunset-orange",    name: "Por do Sol",       c1: "#2a1207", c2: "#7b2f16", c3: "#b45309", accent: "#fb923c" },
    { id: "graphite-cyan",    name: "Grafite Ciano",    c1: "#111827", c2: "#1f2937", c3: "#0b4a6f", accent: "#22d3ee" },
    { id: "rose-dream",       name: "Rosa Dream",       c1: "#2a0d1e", c2: "#5b1f48", c3: "#8a2f6f", accent: "#f9a8d4" },
    { id: "sky-lagoon",       name: "Lagoa Azul",       c1: "#082f49", c2: "#0e7490", c3: "#0ea5e9", accent: "#67e8f9" },
    { id: "mint-breeze",      name: "Brisa Menta",      c1: "#052e2b", c2: "#0f766e", c3: "#14b8a6", accent: "#99f6e4" },
    { id: "plum-neon",        name: "Neon Ameixa",      c1: "#1f1235", c2: "#4c1d95", c3: "#7c3aed", accent: "#c4b5fd" },
    { id: "dawn-cream",       name: "Aurora Creme",     c1: "#302118", c2: "#8b5e3c", c3: "#d4a373", accent: "#fde68a" },
    { id: "aqua-wave",        name: "Ondas Aqua",       style: "waves", c1: "#07243a", c2: "#0f4f75", c3: "#1592c5", accent: "#6ee7ff" },
    { id: "sunset-wave",      name: "Ondas Sunset",     style: "waves", c1: "#2b120b", c2: "#7f2d1c", c3: "#c95d1b", accent: "#fdba74" },

    // Visual 3D/bolhas
    { id: "3d-ice",           name: "3D Gelo",          style: "3d-rings", c1: "#0b1d2c", c2: "#1d3f5a", c3: "#2c6a8e", accent: "#bae6fd" },
    { id: "3d-nebula",        name: "3D Nebulosa",      style: "3d-rings", c1: "#1a1333", c2: "#3b2778", c3: "#5b21b6", accent: "#ddd6fe" },
    { id: "3d-cyan-cubes",    name: "3D Cubos Ciano",   style: "3d-cubes", c1: "#0b1420", c2: "#17304a", c3: "#24526f", accent: "#67e8f9" },
    { id: "3d-purple-cubes",  name: "3D Cubos Roxo",    style: "3d-cubes", c1: "#1a0f2a", c2: "#38215d", c3: "#5b2b94", accent: "#c4b5fd" },

    // Fundos com imagem (SVG interno)
    { id: "img-mountains",    name: "Imagem Montanhas", style: "photo-mountains", c1: "#071522", c2: "#17324f", c3: "#345c87", accent: "#93c5fd" },
    { id: "img-mountains-red",name: "Imagem Montanhas 2", style: "photo-mountains", c1: "#20110b", c2: "#5a2b19", c3: "#8f4c2d", accent: "#fdba74" },
    { id: "img-city-night",   name: "Imagem Cidade",    style: "photo-city", c1: "#0b1726", c2: "#102e4a", c3: "#1b4f7b", accent: "#60a5fa" },
    { id: "img-city-violet",  name: "Imagem Cidade 2",  style: "photo-city", c1: "#140e25", c2: "#2d1e55", c3: "#4f2f8b", accent: "#a78bfa" }
  ];

  var catalog = WALLPAPER_PRESETS.map(function (spec) {
    var dataUrl = svgToDataUrl(buildWallpaperSvg(spec));
    return {
      id: spec.id,
      name: spec.name,
      full: dataUrl,
      thumb: dataUrl
    };
  });
  // Compatibilidade: o app usa APP_WALLPAPERS e alguns fluxos antigos usam WALLPAPER_CATALOG.
  window.APP_WALLPAPERS = catalog;
  window.WALLPAPER_CATALOG = catalog;
})();
