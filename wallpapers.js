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
        '<rect width="1080" height="1920" fill="url(#bg)"/>' +
        '<ellipse cx="220" cy="300" rx="420" ry="340" fill="url(#glow1)"/>' +
        '<ellipse cx="860" cy="1360" rx="520" ry="440" fill="url(#glow2)"/>' +
        '<path d="M-80 1560 C 180 1420, 420 1520, 640 1650 C 820 1750, 980 1790, 1180 1730 L1180 1920 L-80 1920 Z" fill="#ffffff" fill-opacity="0.07"/>' +
      "</svg>"
    );
  }

  // Para adicionar novos papeis internos, inclua aqui um novo objeto.
  var WALLPAPER_PRESETS = [
    { id: "aurora-blue", name: "Aurora Azul", c1: "#021824", c2: "#0b3a67", c3: "#1d4f91", accent: "#38bdf8" },
    { id: "violet-night", name: "Noite Violeta", c1: "#120b2c", c2: "#31206d", c3: "#512d8c", accent: "#c084fc" },
    { id: "emerald-mist", name: "Bruma Esmeralda", c1: "#04221d", c2: "#0c4f48", c3: "#166b61", accent: "#34d399" },
    { id: "sunset-orange", name: "Por do Sol", c1: "#2a1207", c2: "#7b2f16", c3: "#b45309", accent: "#fb923c" },
    { id: "graphite-cyan", name: "Grafite Ciano", c1: "#111827", c2: "#1f2937", c3: "#0b4a6f", accent: "#22d3ee" },
    { id: "rose-dream", name: "Rosa Dream", c1: "#2a0d1e", c2: "#5b1f48", c3: "#8a2f6f", accent: "#f9a8d4" }
  ];

  window.WALLPAPER_CATALOG = WALLPAPER_PRESETS.map(function (spec) {
    var dataUrl = svgToDataUrl(buildWallpaperSvg(spec));
    return {
      id: spec.id,
      name: spec.name,
      full: dataUrl,
      thumb: dataUrl
    };
  });
})();
