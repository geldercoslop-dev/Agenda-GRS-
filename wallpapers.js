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
    } else if (style === "3d-spheres") {
      // Esferas 3D flutuantes com sombra e reflexo
      extra =
        '<defs><radialGradient id="sp1" cx="35%" cy="30%" r="60%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="60%" stop-color="' + spec.accent + '" stop-opacity="0.7"/><stop offset="100%" stop-color="' + spec.c3 + '" stop-opacity="1"/></radialGradient>' +
        '<radialGradient id="sp2" cx="35%" cy="30%" r="60%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/><stop offset="60%" stop-color="' + spec.accent + '" stop-opacity="0.5"/><stop offset="100%" stop-color="' + spec.c2 + '" stop-opacity="1"/></radialGradient>' +
        '<radialGradient id="sp3" cx="35%" cy="30%" r="60%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="50%" stop-color="' + spec.accent + '" stop-opacity="0.4"/><stop offset="100%" stop-color="' + spec.c1 + '" stop-opacity="1"/></radialGradient></defs>' +
        '<ellipse cx="200" cy="740" rx="170" ry="20" fill="#000" fill-opacity="0.18"/>' +
        '<circle cx="200" cy="620" r="160" fill="url(#sp1)"/>' +
        '<ellipse cx="200" cy="560" rx="55" ry="22" fill="#ffffff" fill-opacity="0.35"/>' +
        '<ellipse cx="820" cy="1360" rx="210" ry="25" fill="#000" fill-opacity="0.18"/>' +
        '<circle cx="820" cy="1220" r="200" fill="url(#sp2)"/>' +
        '<ellipse cx="820" cy="1148" rx="68" ry="27" fill="#ffffff" fill-opacity="0.32"/>' +
        '<ellipse cx="560" cy="1060" rx="130" ry="16" fill="#000" fill-opacity="0.15"/>' +
        '<circle cx="560" cy="960" r="122" fill="url(#sp3)"/>' +
        '<ellipse cx="560" cy="912" rx="42" ry="17" fill="#ffffff" fill-opacity="0.28"/>';
    } else if (style === "3d-diamonds") {
      // Diamantes/cristais 3D
      extra =
        '<polygon points="280,360 360,180 440,360 360,480" fill="' + spec.accent + '" fill-opacity="0.55"/>' +
        '<polygon points="280,360 360,480 200,480" fill="' + spec.accent + '" fill-opacity="0.28"/>' +
        '<polygon points="440,360 360,480 480,480" fill="' + spec.accent + '" fill-opacity="0.18"/>' +
        '<line x1="360" y1="180" x2="280" y2="360" stroke="#ffffff" stroke-opacity="0.4" stroke-width="2"/>' +
        '<line x1="360" y1="180" x2="440" y2="360" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>' +
        '<polygon points="680,980 800,700 920,980 800,1160" fill="' + spec.accent + '" fill-opacity="0.45"/>' +
        '<polygon points="680,980 800,1160 560,1160" fill="' + spec.accent + '" fill-opacity="0.22"/>' +
        '<polygon points="920,980 800,1160 1040,1160" fill="' + spec.accent + '" fill-opacity="0.14"/>' +
        '<line x1="800" y1="700" x2="680" y2="980" stroke="#ffffff" stroke-opacity="0.35" stroke-width="2.5"/>' +
        '<line x1="800" y1="700" x2="920" y2="980" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2.5"/>' +
        '<circle cx="280" cy="360" r="6" fill="#ffffff" fill-opacity="0.5"/>' +
        '<circle cx="800" cy="700" r="8" fill="#ffffff" fill-opacity="0.5"/>';
    } else if (style === "3d-bubbles") {
      // Bolhas coloridas com brilho
      extra =
        '<circle cx="160" cy="500" r="90" fill="' + spec.accent + '" fill-opacity="0.22"/>' +
        '<circle cx="160" cy="500" r="90" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="2"/>' +
        '<ellipse cx="135" cy="468" rx="28" ry="18" fill="#ffffff" fill-opacity="0.35"/>' +
        '<circle cx="880" cy="800" r="130" fill="' + spec.accent + '" fill-opacity="0.18"/>' +
        '<circle cx="880" cy="800" r="130" fill="none" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>' +
        '<ellipse cx="848" cy="758" rx="40" ry="26" fill="#ffffff" fill-opacity="0.32"/>' +
        '<circle cx="300" cy="1200" r="70" fill="' + spec.accent + '" fill-opacity="0.20"/>' +
        '<ellipse cx="278" cy="1175" rx="22" ry="14" fill="#ffffff" fill-opacity="0.30"/>' +
        '<circle cx="750" cy="1500" r="110" fill="' + spec.accent + '" fill-opacity="0.16"/>' +
        '<ellipse cx="723" cy="1468" rx="34" ry="22" fill="#ffffff" fill-opacity="0.28"/>' +
        '<circle cx="540" cy="340" r="55" fill="' + spec.accent + '" fill-opacity="0.24"/>' +
        '<ellipse cx="523" cy="320" rx="17" ry="11" fill="#ffffff" fill-opacity="0.38"/>';
    } else if (style === "kids-stars") {
      // Fundo infantil — estrelas e luas coloridas
      extra =
        '<polygon points="180,200 195,250 248,250 206,280 220,330 180,300 140,330 154,280 112,250 165,250" fill="#ffffff" fill-opacity="0.9" transform="scale(0.7) translate(100,100)"/>' +
        '<polygon points="800,400 818,455 876,455 830,488 847,543 800,510 753,543 770,488 724,455 782,455" fill="' + spec.accent + '" fill-opacity="0.85"/>' +
        '<polygon points="250,900 262,938 302,938 270,961 282,999 250,976 218,999 230,961 198,938 238,938" fill="#ffffff" fill-opacity="0.7"/>' +
        '<polygon points="750,1300 765,1345 812,1345 776,1370 790,1415 750,1390 710,1415 724,1370 688,1345 735,1345" fill="' + spec.accent + '" fill-opacity="0.75"/>' +
        '<circle cx="120" cy="700" r="18" fill="#ffffff" fill-opacity="0.5"/>' +
        '<circle cx="920" cy="1100" r="14" fill="#ffffff" fill-opacity="0.45"/>' +
        '<circle cx="450" cy="1600" r="22" fill="' + spec.accent + '" fill-opacity="0.6"/>' +
        '<circle cx="650" cy="500" r="12" fill="#ffffff" fill-opacity="0.55"/>' +
        '<circle cx="350" cy="1400" r="16" fill="#ffffff" fill-opacity="0.4"/>' +
        // Lua crescente
        '<path d="M860 280 A80 80 0 1 1 860 440 A55 55 0 1 0 860 280 Z" fill="#ffffff" fill-opacity="0.85"/>';
    } else if (style === "kids-rainbow") {
      // Arco-íris + nuvens
      extra =
        // Arco-íris
        '<path d="M-100 1200 Q540 200 1180 1200" fill="none" stroke="#ff6b6b" stroke-width="55" stroke-opacity="0.35"/>' +
        '<path d="M-100 1200 Q540 280 1180 1200" fill="none" stroke="#ffa94d" stroke-width="44" stroke-opacity="0.35"/>' +
        '<path d="M-100 1200 Q540 360 1180 1200" fill="none" stroke="#ffe066" stroke-width="33" stroke-opacity="0.35"/>' +
        '<path d="M-100 1200 Q540 440 1180 1200" fill="none" stroke="#69db7c" stroke-width="26" stroke-opacity="0.35"/>' +
        '<path d="M-100 1200 Q540 510 1180 1200" fill="none" stroke="#74c0fc" stroke-width="20" stroke-opacity="0.35"/>' +
        '<path d="M-100 1200 Q540 560 1180 1200" fill="none" stroke="#b197fc" stroke-width="15" stroke-opacity="0.35"/>' +
        // Nuvens
        '<ellipse cx="200" cy="380" rx="140" ry="70" fill="#ffffff" fill-opacity="0.75"/>' +
        '<ellipse cx="140" cy="400" rx="90" ry="55" fill="#ffffff" fill-opacity="0.75"/>' +
        '<ellipse cx="280" cy="395" rx="100" ry="58" fill="#ffffff" fill-opacity="0.75"/>' +
        '<ellipse cx="800" cy="600" rx="160" ry="78" fill="#ffffff" fill-opacity="0.65"/>' +
        '<ellipse cx="730" cy="622" rx="100" ry="60" fill="#ffffff" fill-opacity="0.65"/>' +
        '<ellipse cx="900" cy="618" rx="110" ry="62" fill="#ffffff" fill-opacity="0.65"/>' +
        // Estrelinhas
        '<circle cx="500" cy="200" r="14" fill="#ffe066" fill-opacity="0.85"/>' +
        '<circle cx="650" cy="300" r="10" fill="#ff6b6b" fill-opacity="0.75"/>' +
        '<circle cx="380" cy="160" r="8" fill="#b197fc" fill-opacity="0.8"/>';
    } else if (style === "kids-dinos") {
      // Fundo com dinossauros simplificados e plantas
      extra =
        // Plantas/grama
        '<rect x="0" y="1750" width="1080" height="170" fill="' + spec.accent + '" fill-opacity="0.35"/>' +
        '<path d="M100 1750 Q130 1600 160 1750" fill="' + spec.accent + '" fill-opacity="0.5"/>' +
        '<path d="M300 1750 Q340 1570 380 1750" fill="' + spec.accent + '" fill-opacity="0.45"/>' +
        '<path d="M600 1750 Q640 1620 680 1750" fill="' + spec.accent + '" fill-opacity="0.5"/>' +
        '<path d="M850 1750 Q890 1590 930 1750" fill="' + spec.accent + '" fill-opacity="0.45"/>' +
        // Dino 1 (corpo)
        '<ellipse cx="260" cy="1300" rx="120" ry="80" fill="#ffffff" fill-opacity="0.18"/>' +
        '<circle cx="340" cy="1240" r="55" fill="#ffffff" fill-opacity="0.18"/>' +
        '<path d="M380 1240 Q420 1200 440 1220 Q420 1240 400 1250 Z" fill="#ffffff" fill-opacity="0.15"/>' +
        '<circle cx="360" cy="1228" r="6" fill="#ffffff" fill-opacity="0.6"/>' +
        // Dino 2 (corpo)
        '<ellipse cx="780" cy="900" rx="140" ry="95" fill="' + spec.accent + '" fill-opacity="0.20"/>' +
        '<circle cx="880" cy="830" r="65" fill="' + spec.accent + '" fill-opacity="0.22"/>' +
        '<path d="M930 830 Q980 780 1005 808 Q975 832 948 842 Z" fill="' + spec.accent + '" fill-opacity="0.18"/>' +
        '<circle cx="900" cy="815" r="8" fill="#ffffff" fill-opacity="0.6"/>' +
        // Sol
        '<circle cx="900" cy="220" r="80" fill="#ffe066" fill-opacity="0.45"/>' +
        '<circle cx="900" cy="220" r="60" fill="#ffe066" fill-opacity="0.35"/>';
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
    // ── Sólidos ────────────────────────────────────────────────────
    { id: "solid-night",      name: "Sólido Noturno",    style: "solid", c1: "#0b1220", c2: "#0b1220", c3: "#0b1220", accent: "#60a5fa" },
    { id: "solid-ocean",      name: "Sólido Oceano",     style: "solid", c1: "#0f3d5e", c2: "#0f3d5e", c3: "#0f3d5e", accent: "#22d3ee" },
    { id: "solid-forest",     name: "Sólido Floresta",   style: "solid", c1: "#134e4a", c2: "#134e4a", c3: "#134e4a", accent: "#34d399" },
    { id: "solid-wine",       name: "Sólido Vinho",      style: "solid", c1: "#4c1d36", c2: "#4c1d36", c3: "#4c1d36", accent: "#f472b6" },
    { id: "solid-slate",      name: "Sólido Grafite",    style: "solid", c1: "#1f2937", c2: "#1f2937", c3: "#1f2937", accent: "#93c5fd" },
    { id: "solid-amber",      name: "Sólido Âmbar",      style: "solid", c1: "#5b3a07", c2: "#5b3a07", c3: "#5b3a07", accent: "#f59e0b" },
    { id: "solid-carbon",     name: "Sólido Carbono",    style: "solid", c1: "#101418", c2: "#101418", c3: "#101418", accent: "#94a3b8" },
    { id: "solid-olive",      name: "Sólido Oliva",      style: "solid", c1: "#263015", c2: "#263015", c3: "#263015", accent: "#86efac" },
    // Novos sólidos claros
    { id: "solid-rose",       name: "Sólido Rosa",       style: "solid", c1: "#f9a8d4", c2: "#f9a8d4", c3: "#f9a8d4", accent: "#db2777" },
    { id: "solid-yellow",     name: "Sólido Amarelo",    style: "solid", c1: "#fde68a", c2: "#fde68a", c3: "#fde68a", accent: "#d97706" },
    { id: "solid-green",      name: "Sólido Verde",      style: "solid", c1: "#bbf7d0", c2: "#bbf7d0", c3: "#bbf7d0", accent: "#16a34a" },
    { id: "solid-agua",       name: "Sólido Água",       style: "solid", c1: "#a5f3fc", c2: "#a5f3fc", c3: "#a5f3fc", accent: "#0891b2" },
    { id: "solid-bege",       name: "Sólido Bege",       style: "solid", c1: "#f5efe6", c2: "#f5efe6", c3: "#f5efe6", accent: "#92400e" },
    { id: "solid-kaki",       name: "Sólido Kaki",       style: "solid", c1: "#d4c89a", c2: "#d4c89a", c3: "#d4c89a", accent: "#78350f" },

    // ── Gradientes ─────────────────────────────────────────────────
    { id: "aurora-blue",      name: "Aurora Azul",       c1: "#021824", c2: "#0b3a67", c3: "#1d4f91", accent: "#38bdf8" },
    { id: "violet-night",     name: "Noite Violeta",     c1: "#120b2c", c2: "#31206d", c3: "#512d8c", accent: "#c084fc" },
    { id: "emerald-mist",     name: "Bruma Esmeralda",   c1: "#04221d", c2: "#0c4f48", c3: "#166b61", accent: "#34d399" },
    { id: "sunset-orange",    name: "Pôr do Sol",        c1: "#2a1207", c2: "#7b2f16", c3: "#b45309", accent: "#fb923c" },
    { id: "graphite-cyan",    name: "Grafite Ciano",     c1: "#111827", c2: "#1f2937", c3: "#0b4a6f", accent: "#22d3ee" },
    { id: "rose-dream",       name: "Rosa Dream",        c1: "#2a0d1e", c2: "#5b1f48", c3: "#8a2f6f", accent: "#f9a8d4" },
    { id: "sky-lagoon",       name: "Lagoa Azul",        c1: "#082f49", c2: "#0e7490", c3: "#0ea5e9", accent: "#67e8f9" },
    { id: "mint-breeze",      name: "Brisa Menta",       c1: "#052e2b", c2: "#0f766e", c3: "#14b8a6", accent: "#99f6e4" },
    { id: "plum-neon",        name: "Neon Ameixa",       c1: "#1f1235", c2: "#4c1d95", c3: "#7c3aed", accent: "#c4b5fd" },
    { id: "dawn-cream",       name: "Aurora Creme",      c1: "#302118", c2: "#8b5e3c", c3: "#d4a373", accent: "#fde68a" },
    // Novos gradientes coloridos
    { id: "grad-rosa",        name: "Gradiente Rosa",    c1: "#831843", c2: "#be185d", c3: "#f472b6", accent: "#fce7f3" },
    { id: "grad-amarelo",     name: "Gradiente Amarelo", c1: "#78350f", c2: "#b45309", c3: "#fbbf24", accent: "#fffbeb" },
    { id: "grad-verde",       name: "Gradiente Verde",   c1: "#14532d", c2: "#16a34a", c3: "#4ade80", accent: "#dcfce7" },
    { id: "grad-agua",        name: "Gradiente Água",    c1: "#164e63", c2: "#0891b2", c3: "#22d3ee", accent: "#ecfeff" },
    { id: "grad-bege",        name: "Gradiente Bege",    c1: "#7c6145", c2: "#b8975a", c3: "#e8d5b0", accent: "#fef9f0" },
    { id: "grad-kaki",        name: "Gradiente Kaki",    c1: "#44380a", c2: "#856f2c", c3: "#c9a84c", accent: "#fefce8" },
    { id: "aqua-wave",        name: "Ondas Água",        style: "waves", c1: "#07243a", c2: "#0f4f75", c3: "#1592c5", accent: "#6ee7ff" },
    { id: "sunset-wave",      name: "Ondas Sunset",      style: "waves", c1: "#2b120b", c2: "#7f2d1c", c3: "#c95d1b", accent: "#fdba74" },
    { id: "wave-rosa",        name: "Ondas Rosa",        style: "waves", c1: "#500724", c2: "#9d174d", c3: "#db2777", accent: "#fbcfe8" },
    { id: "wave-verde",       name: "Ondas Verde",       style: "waves", c1: "#052e16", c2: "#15803d", c3: "#22c55e", accent: "#bbf7d0" },

    // ── 3D ────────────────────────────────────────────────────────
    { id: "3d-ice",           name: "3D Gelo",           style: "3d-rings", c1: "#0b1d2c", c2: "#1d3f5a", c3: "#2c6a8e", accent: "#bae6fd" },
    { id: "3d-nebula",        name: "3D Nebulosa",       style: "3d-rings", c1: "#1a1333", c2: "#3b2778", c3: "#5b21b6", accent: "#ddd6fe" },
    { id: "3d-cyan-cubes",    name: "3D Cubos Ciano",    style: "3d-cubes", c1: "#0b1420", c2: "#17304a", c3: "#24526f", accent: "#67e8f9" },
    { id: "3d-purple-cubes",  name: "3D Cubos Roxo",     style: "3d-cubes", c1: "#1a0f2a", c2: "#38215d", c3: "#5b2b94", accent: "#c4b5fd" },
    // Novos 3D
    { id: "3d-rose-cubes",    name: "3D Cubos Rosa",     style: "3d-cubes", c1: "#2d0a1a", c2: "#6b1b3e", c3: "#b02a6e", accent: "#f9a8d4" },
    { id: "3d-green-cubes",   name: "3D Cubos Verde",    style: "3d-cubes", c1: "#051a10", c2: "#0e4f2a", c3: "#1a8048", accent: "#86efac" },
    { id: "3d-sphere-blue",   name: "3D Esferas Azul",   style: "3d-spheres", c1: "#020d1a", c2: "#073460", c3: "#0e5a9a", accent: "#7dd3fc" },
    { id: "3d-sphere-rose",   name: "3D Esferas Rosa",   style: "3d-spheres", c1: "#1c0510", c2: "#5c1436", c3: "#a0255f", accent: "#f9a8d4" },
    { id: "3d-sphere-green",  name: "3D Esferas Verde",  style: "3d-spheres", c1: "#03120a", c2: "#0a3d22", c3: "#136b3c", accent: "#6ee7b7" },
    { id: "3d-sphere-amber",  name: "3D Esferas Âmbar",  style: "3d-spheres", c1: "#1c0e02", c2: "#5c310a", c3: "#9c5a18", accent: "#fcd34d" },
    { id: "3d-diamond-blue",  name: "3D Diamantes Azul", style: "3d-diamonds", c1: "#030d1c", c2: "#0b2d54", c3: "#144f8a", accent: "#93c5fd" },
    { id: "3d-diamond-rose",  name: "3D Diamantes Rosa", style: "3d-diamonds", c1: "#1a0410", c2: "#5b1038", c3: "#9e2068", accent: "#fda4af" },
    { id: "3d-diamond-agua",  name: "3D Diamantes Água", style: "3d-diamonds", c1: "#031418", c2: "#0c3d4a", c3: "#17697a", accent: "#67e8f9" },
    { id: "3d-bubble-violet", name: "3D Bolhas Roxo",    style: "3d-bubbles", c1: "#12072a", c2: "#2e1570", c3: "#5025b8", accent: "#c4b5fd" },
    { id: "3d-bubble-rose",   name: "3D Bolhas Rosa",    style: "3d-bubbles", c1: "#1c0512", c2: "#5c1438", c3: "#a02568", accent: "#fbcfe8" },
    { id: "3d-bubble-agua",   name: "3D Bolhas Água",    style: "3d-bubbles", c1: "#031214", c2: "#0b3840", c3: "#14606c", accent: "#a5f3fc" },

    // ── Imagem ────────────────────────────────────────────────────
    { id: "img-mountains",    name: "Montanhas",         style: "photo-mountains", c1: "#071522", c2: "#17324f", c3: "#345c87", accent: "#93c5fd" },
    { id: "img-mountains-red",name: "Montanhas 2",       style: "photo-mountains", c1: "#20110b", c2: "#5a2b19", c3: "#8f4c2d", accent: "#fdba74" },
    { id: "img-city-night",   name: "Cidade Noturna",    style: "photo-city", c1: "#0b1726", c2: "#102e4a", c3: "#1b4f7b", accent: "#60a5fa" },
    { id: "img-city-violet",  name: "Cidade Violeta",    style: "photo-city", c1: "#140e25", c2: "#2d1e55", c3: "#4f2f8b", accent: "#a78bfa" },

    // ── Infantil ──────────────────────────────────────────────────
    { id: "kids-stars-blue",  name: "Infantil Estrelas", style: "kids-stars",   c1: "#0f1e6e", c2: "#1a3a9f", c3: "#2860c8", accent: "#ffe066" },
    { id: "kids-stars-purple",name: "Infantil Estrelado",style: "kids-stars",   c1: "#2e0f6e", c2: "#561aa0", c3: "#7c2fc0", accent: "#ffd6fa" },
    { id: "kids-rainbow",     name: "Infantil Arco-Íris",style: "kids-rainbow", c1: "#dce9ff", c2: "#c8deff", c3: "#b8d5ff", accent: "#6ee7b7" },
    { id: "kids-rainbow-warm",name: "Infantil Arco Rosa",style: "kids-rainbow", c1: "#ffeef8", c2: "#ffd6ee", c3: "#ffc0e2", accent: "#f9a8d4" },
    { id: "kids-dinos-green", name: "Infantil Dinos",    style: "kids-dinos",   c1: "#0c2e18", c2: "#1a5e30", c3: "#2d9050", accent: "#86efac" },
    { id: "kids-dinos-blue",  name: "Infantil Dinos 2",  style: "kids-dinos",   c1: "#071d3e", c2: "#103870", c3: "#1a60a8", accent: "#7dd3fc" }
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
