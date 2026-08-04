(function () {
  'use strict';

  var COLOR = {
    line: '#2a78d6',
    fill: 'rgba(42, 120, 214, 0.10)',
    ciFill: 'rgba(42, 120, 214, 0.22)',
    mean: '#0b0b0b',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    muted: '#898781'
  };

  var root = document.getElementById('deglaciation-app');
  if (!root) return;

  var form = root.querySelector('#deglaciation-form');
  var latInput = root.querySelector('#deglaciation-lat');
  var lonInput = root.querySelector('#deglaciation-lon');
  var statusEl = root.querySelector('#deglaciation-status');
  var resultEl = root.querySelector('#deglaciation-result');
  var chartHost = root.querySelector('#deglaciation-chart');
  var mapCanvas = root.querySelector('#deglaciation-map');
  var mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null;

  var state = null; // { meta, mean, median, std, p05, p16, p84, p95, mask, histogram }
  var maskOffscreen = null; // pre-rendered ice-sheet-extent image, built once from state.mask

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function loadData() {
    var jsonUrl = root.getAttribute('data-json');
    var binUrl = root.getAttribute('data-bin');
    setStatus('Loading grid data…');
    return Promise.all([
      fetch(jsonUrl).then(function (r) { return r.json(); }),
      fetch(binUrl).then(function (r) { return r.arrayBuffer(); })
    ]).then(function (results) {
      var meta = results[0];
      var buf = results[1];
      var arrays = {};
      Object.keys(meta.arrays).forEach(function (name) {
        var spec = meta.arrays[name];
        var Ctor = spec.dtype === 'float32' ? Float32Array
          : spec.dtype === 'uint16' ? Uint16Array
          : Uint8Array;
        arrays[name] = new Ctor(buf, spec.offset, spec.length);
      });
      state = {
        meta: meta,
        mean: arrays.mean,
        median: arrays.median,
        std: arrays.std,
        p05: arrays.p05,
        p16: arrays.p16,
        p84: arrays.p84,
        p95: arrays.p95,
        bin_min: arrays.bin_min,
        bin_max: arrays.bin_max,
        mask: arrays.mask,
        histogram: arrays.histogram
      };
      buildMaskOffscreen();
      renderMap(null, null);
      setStatus('');
    }).catch(function (err) {
      setStatus('Could not load the grid data (' + err.message + ').');
      throw err;
    });
  }

  // Renders the inside_mask grid (already loaded for interpolation, no extra
  // fetch) as a small filled shape showing the model's ice-sheet extent, once,
  // into an offscreen canvas at native grid resolution -- renderMap() then just
  // scales that onto the visible canvas plus an optional location marker.
  function buildMaskOffscreen() {
    if (!mapCtx || !state) return;
    var nx = state.meta.grid.nx, ny = state.meta.grid.ny;
    var off = document.createElement('canvas');
    off.width = nx;
    off.height = ny;
    var octx = off.getContext('2d');
    var imgData = octx.createImageData(nx, ny);
    for (var iy = 0; iy < ny; iy++) {
      var canvasRow = ny - 1 - iy; // flip: higher latitude (iy) draws nearer the top
      for (var ix = 0; ix < nx; ix++) {
        var g = iy * nx + ix;
        var px = (canvasRow * nx + ix) * 4;
        var inside = state.mask[g] === 1;
        imgData.data[px] = 42;
        imgData.data[px + 1] = 120;
        imgData.data[px + 2] = 214;
        imgData.data[px + 3] = inside ? 70 : 0;
      }
    }
    octx.putImageData(imgData, 0, 0);
    maskOffscreen = off;
  }

  function renderMap(fx, fy) {
    if (!mapCtx || !maskOffscreen) return;
    var nx = state.meta.grid.nx, ny = state.meta.grid.ny;
    var w = mapCanvas.width, h = mapCanvas.height;

    mapCtx.clearRect(0, 0, w, h);
    mapCtx.fillStyle = '#fcfcfb';
    mapCtx.fillRect(0, 0, w, h);
    mapCtx.imageSmoothingEnabled = true;
    mapCtx.drawImage(maskOffscreen, 0, 0, w, h);
    mapCtx.strokeStyle = COLOR.axis;
    mapCtx.lineWidth = 1;
    mapCtx.strokeRect(0.5, 0.5, w - 1, h - 1);

    if (fx !== null && fy !== null && fx !== undefined && fy !== undefined) {
      var mx = (fx / (nx - 1)) * w;
      var my = (1 - fy / (ny - 1)) * h;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, 5, 0, Math.PI * 2);
      mapCtx.fillStyle = COLOR.line;
      mapCtx.strokeStyle = '#fcfcfb';
      mapCtx.lineWidth = 2;
      mapCtx.fill();
      mapCtx.stroke();
    }
  }

  function toGridLon(lon) {
    return lon < 0 ? lon + 360 : lon;
  }

  // Returns null if fully outside the grid extent, otherwise
  // { corners: [{g, w}], anyInside, allInside }
  function locate(lat, lonInput360) {
    var lat0 = state.meta.lat[0], latN = state.meta.lat[state.meta.lat.length - 1];
    var lon0 = state.meta.lon[0], lonN = state.meta.lon[state.meta.lon.length - 1];
    var ny = state.meta.grid.ny, nx = state.meta.grid.nx;
    var dlat = (latN - lat0) / (ny - 1);
    var dlon = (lonN - lon0) / (nx - 1);

    var fy = (lat - lat0) / dlat;
    var fx = (lonInput360 - lon0) / dlon;

    if (fy < 0 || fy > ny - 1 || fx < 0 || fx > nx - 1) return null;

    var iy0 = Math.min(Math.floor(fy), ny - 2);
    var ix0 = Math.min(Math.floor(fx), nx - 2);
    var iy1 = iy0 + 1, ix1 = ix0 + 1;
    var wy = fy - iy0, wx = fx - ix0;

    var corners = [
      { iy: iy0, ix: ix0, w: (1 - wy) * (1 - wx) },
      { iy: iy0, ix: ix1, w: (1 - wy) * wx },
      { iy: iy1, ix: ix0, w: wy * (1 - wx) },
      { iy: iy1, ix: ix1, w: wy * wx }
    ];

    var anyInside = false, allInside = true;
    corners.forEach(function (c) {
      c.g = c.iy * nx + c.ix;
      c.inside = state.mask[c.g] === 1;
      if (c.inside) anyInside = true; else allInside = false;
    });

    return { corners: corners, anyInside: anyInside, allInside: allInside, fx: fx, fy: fy };
  }

  function bilinear(arr, corners) {
    var insideCorners = corners.filter(function (c) { return c.inside; });
    var wsum = insideCorners.reduce(function (s, c) { return s + c.w; }, 0);
    if (wsum <= 0) return null;
    return insideCorners.reduce(function (s, c) {
      return s + (c.w / wsum) * arr[c.g];
    }, 0);
  }

  // Each grid cell's histogram spans ITS OWN [bin_min, bin_max] -- narrow,
  // well-constrained cells get the same bin budget as wide ones, so a fixed
  // global range would waste almost all the bins on cells that don't need
  // them. To combine neighbors we can't blend raw bin arrays index-by-index
  // (index i means a different age in different cells) -- instead treat each
  // corner's histogram as a density *function* of x (0 outside its own
  // range), sample that function, and blend the sampled values.
  function sampleCornerDensity(c, x) {
    var lo = state.bin_min[c.g], hi = state.bin_max[c.g];
    if (hi <= lo || x < lo || x > hi) return 0;
    var nbins = state.meta.histogram.nbins;
    var binWidth = (hi - lo) / nbins;
    var f = (x - lo) / binWidth - 0.5; // position in bin-center index space
    var i0 = Math.floor(f);
    var i1 = i0 + 1;
    var t = f - i0;
    var base = c.g * nbins;
    var v0 = (i0 >= 0 && i0 < nbins) ? state.histogram[base + i0] : 0;
    var v1 = (i1 >= 0 && i1 < nbins) ? state.histogram[base + i1] : 0;
    return v0 + (v1 - v0) * t;
  }

  var NDISPLAY = 80;

  function buildDensityCurve(corners) {
    var insideCorners = corners.filter(function (c) { return c.inside; });
    var wsum = insideCorners.reduce(function (s, c) { return s + c.w; }, 0);
    if (wsum <= 0) return null;

    var domainLo = Math.min.apply(null, insideCorners.map(function (c) { return state.bin_min[c.g]; }));
    var domainHi = Math.max.apply(null, insideCorners.map(function (c) { return state.bin_max[c.g]; }));
    if (!(domainHi > domainLo)) return null;

    var xs = [];
    var ys = [];
    for (var i = 0; i < NDISPLAY; i++) {
      var x = domainLo + (domainHi - domainLo) * (i / (NDISPLAY - 1));
      var y = insideCorners.reduce(function (s, c) {
        return s + (c.w / wsum) * sampleCornerDensity(c, x);
      }, 0);
      xs.push(x);
      ys.push(y);
    }

    // renormalize (blending independently-normalized densities over
    // different supports won't integrate to exactly 1 on its own)
    var integral = 0;
    for (var j = 1; j < xs.length; j++) integral += (ys[j] + ys[j - 1]) / 2 * (xs[j] - xs[j - 1]);
    if (integral > 0) {
      for (var k = 0; k < ys.length; k++) ys[k] /= integral;
    }

    return { xs: xs, ys: ys };
  }

  function clearChart() {
    chartHost.innerHTML = '';
  }

  // Picks a "nice" tick step (in ka) so a chart's x-axis gets ~4-8 ticks
  // regardless of whether the plotted domain is ~1.5ka wide (a tightly
  // constrained cell) or ~20ka wide (a poorly constrained one).
  function niceTickStep(domainWidth) {
    var candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10];
    for (var i = 0; i < candidates.length; i++) {
      if (domainWidth / candidates[i] <= 8) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  function renderChart(curve, mean, p05, p95) {
    var xs = curve.xs, ys = curve.ys;

    var W = 640, H = 260;
    var marginLeft = 12, marginRight = 12, marginTop = 16, marginBottom = 34;
    var plotW = W - marginLeft - marginRight;
    var plotH = H - marginTop - marginBottom;
    var baselineY = marginTop + plotH;

    var xMin = xs[0], xMax = xs[xs.length - 1];
    var yMax = Math.max.apply(null, ys) * 1.15 || 1;

    function xScale(v) { return marginLeft + ((v - xMin) / (xMax - xMin)) * plotW; }
    function yScale(v) { return baselineY - (v / yMax) * plotH; }

    var pts = xs.map(function (x, i) { return [xScale(x), yScale(ys[i])]; });

    function pathFor(points) {
      var d = 'M ' + points[0][0].toFixed(2) + ' ' + baselineY.toFixed(2);
      points.forEach(function (p) { d += ' L ' + p[0].toFixed(2) + ' ' + p[1].toFixed(2); });
      d += ' L ' + points[points.length - 1][0].toFixed(2) + ' ' + baselineY.toFixed(2) + ' Z';
      return d;
    }

    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', 'auto');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label',
      'Probability distribution of deglaciation age. Mean ' + mean.toFixed(1) +
      ' thousand years ago. 95 percent credible interval ' + p05.toFixed(1) +
      ' to ' + p95.toFixed(1) + ' thousand years ago.');

    // baseline
    var baseline = document.createElementNS(svgNS, 'line');
    baseline.setAttribute('x1', marginLeft);
    baseline.setAttribute('x2', W - marginRight);
    baseline.setAttribute('y1', baselineY);
    baseline.setAttribute('y2', baselineY);
    baseline.setAttribute('stroke', COLOR.axis);
    baseline.setAttribute('stroke-width', '1');
    svg.appendChild(baseline);

    // full density area (base wash)
    var areaPath = document.createElementNS(svgNS, 'path');
    areaPath.setAttribute('d', pathFor(pts));
    areaPath.setAttribute('fill', COLOR.fill);
    areaPath.setAttribute('stroke', 'none');
    svg.appendChild(areaPath);

    // 95% CI band (p05-p95), higher-opacity overlay on the same curve
    var ciPts = pts.filter(function (_, i) { return xs[i] >= p05 && xs[i] <= p95; });
    if (ciPts.length > 1) {
      var ciPath = document.createElementNS(svgNS, 'path');
      ciPath.setAttribute('d', pathFor(ciPts));
      ciPath.setAttribute('fill', COLOR.ciFill);
      ciPath.setAttribute('stroke', 'none');
      svg.appendChild(ciPath);
    }

    // density curve line
    var linePath = document.createElementNS(svgNS, 'path');
    var lineD = 'M ' + pts.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join(' L ');
    linePath.setAttribute('d', lineD);
    linePath.setAttribute('fill', 'none');
    linePath.setAttribute('stroke', COLOR.line);
    linePath.setAttribute('stroke-width', '2');
    linePath.setAttribute('stroke-linejoin', 'round');
    linePath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(linePath);

    // mean marker
    var meanX = xScale(mean);
    var meanBinIdx = Math.min(xs.length - 1, Math.max(0, Math.round((mean - xMin) / (xMax - xMin) * (xs.length - 1))));
    var meanY = yScale(ys[meanBinIdx] || 0);
    var meanLine = document.createElementNS(svgNS, 'line');
    meanLine.setAttribute('x1', meanX);
    meanLine.setAttribute('x2', meanX);
    meanLine.setAttribute('y1', baselineY);
    meanLine.setAttribute('y2', meanY);
    meanLine.setAttribute('stroke', COLOR.mean);
    meanLine.setAttribute('stroke-width', '2');
    svg.appendChild(meanLine);

    var meanDot = document.createElementNS(svgNS, 'circle');
    meanDot.setAttribute('cx', meanX);
    meanDot.setAttribute('cy', meanY);
    meanDot.setAttribute('r', 4);
    meanDot.setAttribute('fill', COLOR.line);
    meanDot.setAttribute('stroke', '#fcfcfb');
    meanDot.setAttribute('stroke-width', '2');
    svg.appendChild(meanDot);

    var meanLabel = document.createElementNS(svgNS, 'text');
    meanLabel.setAttribute('x', meanX);
    meanLabel.setAttribute('y', Math.max(marginTop, meanY - 8));
    meanLabel.setAttribute('text-anchor', 'middle');
    meanLabel.setAttribute('font-size', '11');
    meanLabel.setAttribute('fill', '#52514e');
    meanLabel.textContent = 'Mean ' + mean.toFixed(1) + ' ka';
    svg.appendChild(meanLabel);

    // x-axis ticks (step adapts to how wide this location's domain is)
    var tickStep = niceTickStep(xMax - xMin);
    var tickDecimals = tickStep < 1 ? 2 : 0;
    for (var t = Math.ceil(xMin / tickStep) * tickStep; t <= xMax + 1e-9; t += tickStep) {
      var tx = xScale(t);
      var tick = document.createElementNS(svgNS, 'line');
      tick.setAttribute('x1', tx);
      tick.setAttribute('x2', tx);
      tick.setAttribute('y1', baselineY);
      tick.setAttribute('y2', baselineY + 5);
      tick.setAttribute('stroke', COLOR.axis);
      tick.setAttribute('stroke-width', '1');
      svg.appendChild(tick);

      var label = document.createElementNS(svgNS, 'text');
      label.setAttribute('x', tx);
      label.setAttribute('y', baselineY + 18);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('fill', COLOR.muted);
      label.textContent = t.toFixed(tickDecimals);
      svg.appendChild(label);
    }

    var axisTitle = document.createElementNS(svgNS, 'text');
    axisTitle.setAttribute('x', W / 2);
    axisTitle.setAttribute('y', H - 2);
    axisTitle.setAttribute('text-anchor', 'middle');
    axisTitle.setAttribute('font-size', '11');
    axisTitle.setAttribute('fill', COLOR.muted);
    axisTitle.textContent = 'Age (thousand years before present)';
    svg.appendChild(axisTitle);

    clearChart();
    chartHost.appendChild(svg);
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    resultEl.innerHTML = '';
    clearChart();

    if (!state) {
      setStatus('Grid data is still loading, please try again in a moment.');
      return;
    }

    var lat = parseFloat(latInput.value);
    var lon = parseFloat(lonInput.value);
    if (isNaN(lat) || isNaN(lon)) {
      setStatus('Enter both a latitude and a longitude.');
      return;
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setStatus('Latitude must be between -90 and 90, longitude between -180 and 180.');
      return;
    }

    var loc = locate(lat, toGridLon(lon));
    if (!loc) {
      setStatus('This location is outside the model domain (former Laurentide Ice Sheet extent, roughly 35–90°N, 145–40°W).');
      renderMap(null, null);
      return;
    }
    if (!loc.anyInside) {
      setStatus('No data at this location — it was likely never glaciated, or falls outside the study area.');
      renderMap(loc.fx, loc.fy);
      return;
    }

    var mean = bilinear(state.mean, loc.corners);
    var p05 = bilinear(state.p05, loc.corners);
    var p95 = bilinear(state.p95, loc.corners);
    var curve = buildDensityCurve(loc.corners);
    renderMap(loc.fx, loc.fy);

    setStatus(loc.allInside ? '' :
      'Note: this location is near the edge of the model domain — the interpolation may be less reliable here.');

    var summary = document.createElement('p');
    summary.innerHTML = '<strong>Mean deglaciation age: ' + mean.toFixed(1) +
      ' ka</strong> (95% CI: ' + p05.toFixed(1) + '–' + p95.toFixed(1) + ' ka)';
    resultEl.appendChild(summary);

    renderChart(curve, mean, p05, p95);
  }

  form.addEventListener('submit', handleSubmit);
  loadData();
})();
