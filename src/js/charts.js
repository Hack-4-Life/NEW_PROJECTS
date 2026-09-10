/* ============================================================================
   Waypoint Budget Studio — Charts
   Zero-dependency SVG renderers. Cockpit-grade, self-animating, theme-aware.
   ========================================================================== */
'use strict';

var Chart = (function () {

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function polar(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function arcPath(cx, cy, rOut, rIn, a0, a1) {
    var large = (a1 - a0) > 180 ? 1 : 0;
    var p0 = polar(cx, cy, rOut, a0), p1 = polar(cx, cy, rOut, a1);
    var p2 = polar(cx, cy, rIn, a1), p3 = polar(cx, cy, rIn, a0);
    return 'M' + p0.x + ' ' + p0.y +
      ' A' + rOut + ' ' + rOut + ' 0 ' + large + ' 1 ' + p1.x + ' ' + p1.y +
      ' L' + p2.x + ' ' + p2.y +
      ' A' + rIn + ' ' + rIn + ' 0 ' + large + ' 0 ' + p3.x + ' ' + p3.y + ' Z';
  }
  function niceMax(v) {
    if (v <= 0) return 100;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }
  function smoothPath(pts, tension) {
    if (pts.length < 2) return pts.length ? 'M' + pts[0].x + ' ' + pts[0].y : '';
    var t = tension === undefined ? 0.22 : tension;
    var d = 'M' + pts[0].x + ' ' + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) * t, c1y = p1.y + (p2.y - p0.y) * t;
      var c2x = p2.x - (p3.x - p1.x) * t, c2y = p2.y - (p3.y - p1.y) * t;
      d += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x.toFixed(1) + ' ' + p2.y.toFixed(1);
    }
    return d;
  }

  /* --------------------------------------------------------------- donut */
  function donut(segments, opts) {
    var o = opts || {};
    var size = o.size || 220, sw = o.stroke || 22;
    var cx = size / 2, cy = size / 2, r = (size - sw) / 2 - 2;
    var total = 0;
    segments.forEach(function (s) { total += Math.max(0, s.value); });
    var gapStart = o.gap === undefined ? 1.6 : o.gap;
    var html = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="chart chart-donut" role="img">';
    html += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + sw + '"/>';
    if (total > 0) {
      var a = 0, i = 0;
      segments.forEach(function (s) {
        var v = Math.max(0, s.value);
        if (v <= 0) return;
        var sweep = (v / total) * 360;
        var a0 = a + gapStart / 2, a1 = a + sweep - gapStart / 2;
        if (a1 <= a0) a1 = a0 + 0.4;
        html += '<path class="seg" data-i="' + i + '" d="' + arcPath(cx, cy, r, r - sw, a0, a1) + '" fill="' + s.color + '" ' +
          'data-label="' + esc(s.label) + '" data-value="' + esc(s.display || s.value) + '">' +
          '<title>' + esc(s.label) + ' — ' + esc(s.display || s.value) + '</title></path>';
        a += sweep; i++;
      });
    } else {
      html += '<text x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle" class="chart-empty">No data yet</text>';
    }
    html += '</svg>';
    return html;
  }

  /* --------------------------------------------------------------- gauge */
  function gauge(opt) {
    var size = opt.size || 250, sw = opt.stroke || 20;
    var cx = size / 2, cy = size / 2, r = (size - sw) / 2 - 6;
    var start = 135, sweepTotal = 270;
    var frac = opt.max > 0 ? Math.max(0, Math.min(1, opt.value / opt.max)) : 0;
    var end = start + sweepTotal * frac;
    var h = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="chart chart-gauge" role="img">';
    h += '<path d="' + arcPath(cx, cy, r, r - sw, start, start + sweepTotal) + '" fill="var(--track)"/>';
    /* tick marks every 10% */
    for (var i = 0; i <= 10; i++) {
      var ang = start + sweepTotal * (i / 10);
      var p1 = polar(cx, cy, r + 2, ang), p2 = polar(cx, cy, r + (i % 5 === 0 ? 9 : 5), ang);
      h += '<line x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '" stroke="var(--tick)" stroke-width="' + (i % 5 === 0 ? 1.6 : 1) + '" stroke-linecap="round"/>';
    }
    var col = opt.color || 'var(--accent)';
    if (opt.value > 0) {
      h += '<path class="gauge-value" d="' + arcPath(cx, cy, r, r - sw, start, Math.max(start + 0.6, end)) + '" fill="' + col + '"/>';
    }
    var knob = polar(cx, cy, r - sw / 2, Math.max(start + 0.6, end));
    h += '<circle class="gauge-knob" cx="' + knob.x.toFixed(1) + '" cy="' + knob.y.toFixed(1) + '" r="' + (sw / 2 + 3) + '" fill="var(--surface)" stroke="' + col + '" stroke-width="3"/>';
    h += '</svg>';
    return h;
  }

  /* ---------------------------------------------------------- line chart */
  function line(points, opts) {
    var o = opts || {};
    var W = 720, H = o.height || 240;
    var padL = o.padL === undefined ? 52 : o.padL, padR = 14, padT = 16, padB = 28;
    var vals = points.map(function (p) { return p.y; });
    var extra = o.extraLines || [];
    extra.forEach(function (l) { vals.push(l.value); });
    if (o.floor !== undefined) vals.push(o.floor);
    var max = Math.max.apply(null, vals.concat([1]));
    var min = Math.min.apply(null, vals.concat([0]));
    if (o.zeroFloor && min > 0) min = 0;
    var span = Math.max(1, max - min);
    max = max + span * 0.08; min = min - span * 0.06;
    var n = points.length;
    var X = function (i) { return padL + (W - padL - padR) * (n <= 1 ? 0 : i / (n - 1)); };
    var Y = function (v) { return padT + (H - padT - padB) * (1 - (v - min) / (max - min)); };

    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart chart-line" preserveAspectRatio="none" role="img">';
    h += '<defs><linearGradient id="lg' + (o.gid || '1') + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + (o.color || 'var(--accent)') + '" stop-opacity=".38"/>' +
      '<stop offset="100%" stop-color="' + (o.color || 'var(--accent)') + '" stop-opacity="0"/></linearGradient></defs>';
    /* horizontal grid */
    var steps = 4;
    for (var g = 0; g <= steps; g++) {
      var v = min + (max - min) * (g / steps);
      h += '<line x1="' + padL + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>';
      h += '<text x="' + (padL - 8) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end" class="chart-axis">' + esc(moneyShort(v)) + '</text>';
    }
    /* zero line */
    if (min < 0 && max > 0) {
      h += '<line x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - padR) + '" y2="' + Y(0) + '" stroke="var(--danger)" stroke-width="1.4" stroke-dasharray="4 4"/>';
    }
    /* extra reference lines (safety buffer, goal) */
    extra.forEach(function (l) {
      h += '<line x1="' + padL + '" y1="' + Y(l.value).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(l.value).toFixed(1) + '" stroke="' + (l.color || 'var(--warn)') + '" stroke-width="1.2" stroke-dasharray="6 5"/>';
      h += '<text x="' + (W - padR) + '" y="' + (Y(l.value) - 5).toFixed(1) + '" text-anchor="end" class="chart-axis warn">' + esc(l.label) + '</text>';
    });

    var pts = points.map(function (p, i) { return { x: X(i), y: Y(p.y) }; });
    var dLine = smoothPath(pts, n > 40 ? 0.16 : 0.2);
    h += '<path d="' + dLine + ' L' + pts[pts.length - 1].x + ' ' + (H - padB) + ' L' + pts[0].x + ' ' + (H - padB) + ' Z" fill="url(#lg' + (o.gid || '1') + ')"/>';
    h += '<path class="line-main" d="' + dLine + '" fill="none" stroke="' + (o.color || 'var(--accent)') + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';

    /* event markers */
    (o.markers || []).forEach(function (m) {
      var x = X(m.i), y = Y(points[m.i].y);
      if (m.kind === 'low') {
        h += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="var(--surface)" stroke="var(--danger)" stroke-width="2.5"/>';
        h += '<text x="' + x.toFixed(1) + '" y="' + (y + 20).toFixed(1) + '" text-anchor="middle" class="chart-axis danger">low ' + esc(moneyShort(points[m.i].y)) + '</text>';
      } else if (m.kind === 'pay') {
        h += '<line x1="' + x.toFixed(1) + '" y1="' + padT + '" x2="' + x.toFixed(1) + '" y2="' + (H - padB) + '" stroke="var(--good)" stroke-width="1" stroke-dasharray="3 4" opacity=".7"/>';
        h += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.6" fill="var(--good)"/>';
      } else if (m.kind === 'bill') {
        h += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.8" fill="' + (m.color || 'var(--accent-2)') + '"/>';
      }
    });

    /* x labels */
    var ticks = o.xTicks === undefined ? 6 : o.xTicks;
    for (var t = 0; t < ticks; t++) {
      var i = Math.round((n - 1) * (t / (ticks - 1)));
      h += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="chart-axis">' + esc(points[i].label || '') + '</text>';
    }
    /* hover layer */
    h += '<g class="hover-layer" opacity="0"></g>';
    h += '<rect class="hit" x="' + padL + '" y="' + padT + '" width="' + (W - padL - padR) + '" height="' + (H - padT - padB) + '" fill="transparent"/>';
    h += '</svg>';
    return h;
  }

  /* --------------------------------------------------------- bars chart */
  function bars(series, opts) {
    var o = opts || {};
    var W = 720, H = o.height || 220, padL = 52, padR = 12, padT = 14, padB = 30;
    var max = 0;
    series.forEach(function (g) { g.values.forEach(function (v) { max = Math.max(max, v); }); });
    max = niceMax(max * 1.08);
    var groups = series[0] ? series[0].values.length : 0;
    var gw = (W - padL - padR) / Math.max(1, groups);
    var bw = Math.min(18, (gw - 10) / series.length);
    var Y = function (v) { return padT + (H - padT - padB) * (1 - v / max); };
    var h = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart chart-bars" preserveAspectRatio="none" role="img">';
    for (var g = 0; g <= 4; g++) {
      var v = max * (g / 4);
      h += '<line x1="' + padL + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--grid)"/>';
      h += '<text x="' + (padL - 8) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end" class="chart-axis">' + esc(moneyShort(v)) + '</text>';
    }
    series.forEach(function (s, si) {
      s.values.forEach(function (v, i) {
        var x = padL + gw * i + (gw - bw * series.length) / 2 + si * bw;
        var y = Y(v), hh = Math.max(1, H - padB - y);
        h += '<rect class="bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 3).toFixed(1) + '" height="' + hh.toFixed(1) +
          '" rx="3" fill="' + s.color + '" data-label="' + esc(s.label + ' · ' + s.labels[i]) + '" data-value="' + esc(money(v)) + '">' +
          '<title>' + esc(s.label + ' · ' + s.labels[i]) + ': ' + esc(money(v)) + '</title></rect>';
      });
    });
    (series[0] ? series[0].labels : []).forEach(function (lb, i) {
      h += '<text x="' + (padL + gw * i + gw / 2).toFixed(1) + '" y="' + (H - 9) + '" text-anchor="middle" class="chart-axis">' + esc(lb) + '</text>';
    });
    h += '</svg>';
    return h;
  }

  /* -------------------------------------------------------------- rings */
  function ring(pctDone, opts) {
    var o = opts || {};
    var size = o.size || 96, sw = o.stroke || 9;
    var cx = size / 2, cy = size / 2, r = (size - sw) / 2 - 1;
    var f = Math.max(0, Math.min(1, pctDone / 100));
    var h = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="chart chart-ring" role="img">';
    h += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + sw + '"/>';
    if (f > 0) {
      h += '<path class="ring-val" d="' + arcPath(cx, cy, r, r - sw, 0, Math.max(1.2, f * 360)) + '" fill="' + (o.color || 'var(--accent)') + '"/>';
    }
    h += '</svg>';
    return h;
  }

  /* ---------------------------------------------------------- sparkline */
  function spark(values, opts) {
    var o = opts || {};
    var W = 160, H = o.height || 40;
    if (!values.length) return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart chart-spark"></svg>';
    var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    var span = Math.max(1, max - min);
    var pts = values.map(function (v, i) {
      return { x: (W - 4) * (i / Math.max(1, values.length - 1)) + 2, y: H - 4 - (H - 8) * ((v - min) / span) };
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart chart-spark" preserveAspectRatio="none">' +
      '<path class="spark-line" d="' + smoothPath(pts, 0.2) + '" fill="none" stroke="' + (o.color || 'var(--accent)') + '" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  /* -------------------------------------------------------- progress bar */
  function progress(pctDone, opts) {
    var o = opts || {};
    var cls = 'bar-track' + (o.thin ? ' thin' : '');
    var fill = Math.max(0, Math.min(100, pctDone));
    var over = pctDone > 100;
    return '<div class="' + cls + '"><span class="bar-fill' + (over ? ' over' : '') + '" style="width:' + fill.toFixed(1) +
      '%;background:' + (o.color || '') + '"></span></div>';
  }

  /* --------------------------------------------------------- heat strip */
  function heatStrip(values, opts) {
    var o = opts || {};
    var max = Math.max.apply(null, values.concat([1]));
    var h = '<div class="heat">';
    values.forEach(function (v, i) {
      var f = Math.min(1, v / max);
      var bg = f <= 0 ? 'var(--track)' :
        'color-mix(in srgb, ' + (o.color || 'var(--accent)') + ' ' + Math.round(18 + f * 82) + '%, transparent)';
      h += '<span class="heat-cell" style="background:' + bg + '" title="' + esc(o.labels ? o.labels[i] : '') + '"></span>';
    });
    h += '</div>';
    return h;
  }

  return { donut: donut, gauge: gauge, line: line, bars: bars, ring: ring, spark: spark, progress: progress, heatStrip: heatStrip, esc: esc };
})();
