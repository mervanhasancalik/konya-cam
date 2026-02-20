import { useState, useEffect, useRef, useCallback } from "react";

const CAMERAS = [
  { id: 36, name: "Hayvan Bakım Evi 1", lat: 37.8746, lng: 32.4932, cat: "park" },
  { id: 37, name: "Hayvan Bakım Evi 2", lat: 37.8748, lng: 32.4928, cat: "park" },
  { id: 38, name: "Hayvan Bakım Evi 3", lat: 37.8750, lng: 32.4935, cat: "park" },
  { id: 39, name: "Hayvan Bakım Evi 4", lat: 37.8752, lng: 32.4930, cat: "park" },
  { id: 43, name: "Millet Bahçesi", lat: 37.8685, lng: 32.4810, cat: "park" },
  { id: 42, name: "Zafer Yürüyüş Yolu", lat: 37.8719, lng: 32.4845, cat: "meydan" },
  { id: 41, name: "Alaeddin Keykubad Camii", lat: 37.8745, lng: 32.4893, cat: "tarihi" },
  { id: 40, name: "Türbe Önü", lat: 37.8710, lng: 32.4978, cat: "tarihi" },
  { id: 2, name: "Kılıçarslan Şehir Meydanı", lat: 37.8733, lng: 32.4950, cat: "meydan" },
  { id: 7, name: "Kayalıpark", lat: 37.8673, lng: 32.4870, cat: "park" },
  { id: 11, name: "Kültürpark", lat: 37.8660, lng: 32.4915, cat: "park" },
  { id: 20, name: "Zafer Meydanı Havuz", lat: 37.8722, lng: 32.4860, cat: "meydan" },
  { id: 26, name: "İstiklal Harbi Şehitleri Abidesi", lat: 37.8695, lng: 32.4960, cat: "tarihi" },
  { id: 27, name: "Mevlana Kültür Merkezi", lat: 37.8705, lng: 32.4958, cat: "tarihi" },
  { id: 31, name: "Şerafettin Camii", lat: 37.8725, lng: 32.4885, cat: "tarihi" },
  { id: 32, name: "Mevlana Meydanı", lat: 37.8708, lng: 32.4942, cat: "tarihi" },
  { id: 35, name: "Konya Büyükşehir Stadyumu", lat: 37.8550, lng: 32.4685, cat: "spor" },
];

const PLAYER_IDS = {
  2: "co8041hpkpqs73c116hg",
  7: "c77i687bb2nj4i0fr7r0",
  11: "c77i6hb84cnrb6mlji3g",
  20: "c77ia4vbb2nj4i0fr85g",
  26: "c77ia8vbb2nj4i0fr86g",
  27: "c77i79j84cnrb6mlji70",
  31: "c77i7dr84cnrb6mlji80",
  32: "cei9bavbb2nv2u3dv3k0",
  35: "c77i9nfbb2nj4i0fr83g",
  36: "cg3k53okj84dao8vt0ug",
  37: "cg3k64gkj84dao8vt10g",
  38: "cg8mckokj84dao9014sg",
  39: "cg8mdd0kj84dao9014v0",
  40: "cei99afmm25sdv36p59g",
  41: "cei99ifmm25sdv36p5ag",
  42: "cei9a1fmm25sdv36p5d0",
  43: "cei99ovmm25sdv36p5c0",
};

const CAT = {
  park:   { label: "Park & Doğa", shape: "circle" },
  tarihi: { label: "Tarihi & Kültürel", shape: "diamond" },
  meydan: { label: "Meydan & Cadde", shape: "square" },
  spor:   { label: "Spor", shape: "triangle" },
};

// Real motion detection via HLS frame differencing
import Hls from "hls.js";

const ANALYSIS_W = 80;
const ANALYSIS_H = 45;
const MOTION_THRESHOLD = 25; // per-pixel brightness change threshold

function useMotionDetection(cameras) {
  const scoresRef = useRef({});
  const [scores, setScores] = useState({});
  const indexRef = useRef(0);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const prevFrameRef = useRef(null);
  const analysisCanvas = useRef(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.style.position = "fixed";
    video.style.top = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);
    videoRef.current = video;

    const canvas = document.createElement("canvas");
    canvas.width = ANALYSIS_W;
    canvas.height = ANALYSIS_H;
    analysisCanvas.current = canvas;

    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
      document.body.removeChild(video);
    };
  }, []);

  useEffect(() => {
    if (!cameras.length) return;
    let frameTimer = null;
    let cycleTimer = null;
    let destroyed = false;

    function captureFrame() {
      const video = videoRef.current;
      const canvas = analysisCanvas.current;
      if (!video || !canvas || video.readyState < 2) return null;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, ANALYSIS_W, ANALYSIS_H);
      return ctx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
    }

    function computeMotion(prev, curr) {
      if (!prev || !curr) return 0;
      const pD = prev.data, cD = curr.data;
      let changed = 0;
      const total = ANALYSIS_W * ANALYSIS_H;
      for (let i = 0; i < pD.length; i += 4) {
        const dR = Math.abs(pD[i] - cD[i]);
        const dG = Math.abs(pD[i + 1] - cD[i + 1]);
        const dB = Math.abs(pD[i + 2] - cD[i + 2]);
        if ((dR + dG + dB) / 3 > MOTION_THRESHOLD) changed++;
      }
      return Math.min(1, (changed / total) * 4);
    }

    function loadCamera(idx) {
      if (destroyed) return;
      const cam = cameras[idx % cameras.length];
      const playerId = PLAYER_IDS[cam.id];
      if (!playerId) { rotateNext(); return; }

      const streamUrl = `/stream/l/${playerId}/master.m3u8`;
      const video = videoRef.current;
      prevFrameRef.current = null;

      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

      if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 2, maxMaxBufferLength: 4, liveSyncDuration: 1, enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, () => { rotateNext(); });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.play().catch(() => {});
      }

      let sampleCount = 0;
      const maxSamples = 3;
      let motionSum = 0;

      frameTimer = setInterval(() => {
        if (destroyed) return;
        const frame = captureFrame();
        if (frame && prevFrameRef.current) {
          const m = computeMotion(prevFrameRef.current, frame);
          motionSum += m;
          sampleCount++;
          if (sampleCount >= maxSamples) {
            scoresRef.current[cam.id] = motionSum / sampleCount;
            setScores({ ...scoresRef.current });
            clearInterval(frameTimer);
            rotateNext();
            return;
          }
        }
        prevFrameRef.current = frame;
      }, 1500);
    }

    function rotateNext() {
      if (destroyed) return;
      indexRef.current++;
      cycleTimer = setTimeout(() => loadCamera(indexRef.current), 500);
    }

    loadCamera(indexRef.current);

    return () => {
      destroyed = true;
      clearInterval(frameTimer);
      clearTimeout(cycleTimer);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [cameras]);

  return scores;
}

const CENTER = { lat: 37.870, lng: 32.488 };
const DEFAULT_ZOOM = 14;

function lngLatToPixel(lng, lat, cLng, cLat, zoom, w, h) {
  const scale = Math.pow(2, zoom) * 256;
  const toMerc = (lt) => Math.log(Math.tan(Math.PI / 4 + (lt * Math.PI) / 360));
  const cx = ((cLng + 180) / 360) * scale;
  const cy = (0.5 - toMerc(cLat) / (2 * Math.PI)) * scale;
  return {
    x: ((lng + 180) / 360) * scale - cx + w / 2,
    y: (0.5 - toMerc(lat) / (2 * Math.PI)) * scale - cy + h / 2,
  };
}

function drawShape(ctx, shape, x, y, r) {
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === "diamond") {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
  } else if (shape === "square") {
    ctx.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  } else if (shape === "triangle") {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.7); ctx.lineTo(x - r, y + r * 0.7); ctx.closePath();
  }
}

function WireframeGlobe({ size = 22 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const s = size * 2;
    c.width = s; c.height = s;
    let angle = 0;
    let frame;
    const r = s * 0.4;
    const cx = s / 2, cy = s / 2;

    function draw() {
      ctx.clearRect(0, 0, s, s);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 0.8;

      // Outer circle
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        const latRad = (lat * Math.PI) / 180;
        const y = cy - Math.sin(latRad) * r;
        const rx = Math.cos(latRad) * r;
        ctx.strokeStyle = `rgba(255,255,255,${lat === 0 ? 0.2 : 0.1})`;
        ctx.beginPath(); ctx.ellipse(cx, y, rx, rx * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
      }

      // Longitude lines (rotating)
      for (let i = 0; i < 6; i++) {
        const lng = angle + (i * Math.PI) / 3;
        const cosLng = Math.cos(lng);
        const sinLng = Math.sin(lng);
        ctx.strokeStyle = `rgba(255,255,255,${sinLng > 0 ? 0.2 : 0.07})`;
        ctx.beginPath();
        for (let j = 0; j <= 40; j++) {
          const latA = (j / 40) * Math.PI - Math.PI / 2;
          const x3d = Math.cos(latA) * cosLng;
          const z3d = Math.cos(latA) * sinLng;
          const y3d = Math.sin(latA);
          const px = cx + x3d * r;
          const py = cy - y3d * r;
          if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      angle += 0.008;
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [size]);

  return <canvas ref={ref} style={{ width: size, height: size, display: "block" }} />;
}

const tileCache = {};
function getTileImage(z, x, y, onLoad) {
  const key = `${z}/${x}/${y}`;
  if (tileCache[key]) return tileCache[key];
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = `https://basemaps.cartocdn.com/dark_nolabels/${z}/${x}/${y}@2x.png`;
  img.onload = onLoad;
  tileCache[key] = img;
  return img;
}

function CanvasMap({ cameras, selected, onSelect, heatmapOn, filters, viewState, setViewState }) {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 600 });
  const hoveredRef = useRef(null);
  const stateRef = useRef({ viewState, selected, heatmapOn, filters });
  const needsResizeRef = useRef(true);
  const heatCanvasRef = useRef(null);

  // Keep refs in sync with props (no re-renders needed for drawing)
  stateRef.current = { viewState, selected, heatmapOn, filters };

  const filtered = cameras.filter(c => filters.includes(c.cat));
  const filteredRef = useRef(filtered);
  filteredRef.current = filtered;

  // ResizeObserver — only updates a ref, no state
  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width), h = Math.floor(height);
      if (w !== dimsRef.current.w || h !== dimsRef.current.h) {
        dimsRef.current = { w, h };
        needsResizeRef.current = true;
      }
    });
    if (canvasRef.current?.parentElement) ro.observe(canvasRef.current.parentElement);
    return () => ro.disconnect();
  }, []);

  // Tile load callback — just request a repaint, no state
  const tileLoadFlag = useRef(false);
  const onTileLoad = useCallback(() => { tileLoadFlag.current = true; }, []);

  // Single rAF render loop — never clears canvas without immediately redrawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let pulse = 0;
    let frame;

    function draw() {
      const { w, h } = dimsRef.current;
      if (w <= 0 || h <= 0) { frame = requestAnimationFrame(draw); return; }

      // Only resize canvas buffer when dimensions actually change
      if (needsResizeRef.current) {
        canvas.width = w * 2;
        canvas.height = h * 2;
        needsResizeRef.current = false;
      }

      const { viewState: vs, selected: sel, heatmapOn: hm } = stateRef.current;
      const filt = filteredRef.current;
      const hovId = hoveredRef.current;
      const { lat: cLat, lng: cLng, zoom } = vs;

      // Reset transform and clear
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = "#080808";
      ctx.fillRect(0, 0, w, h);

      // === MAP TILES ===
      const tileZoom = Math.floor(zoom);
      const scale = Math.pow(2, zoom) * 256;
      const toMerc = (lt) => Math.log(Math.tan(Math.PI / 4 + (lt * Math.PI) / 360));
      const cxWorld = ((cLng + 180) / 360) * scale;
      const cyWorld = (0.5 - toMerc(cLat) / (2 * Math.PI)) * scale;
      const tileScale = Math.pow(2, zoom) / Math.pow(2, tileZoom);
      const tileSize = 256 * tileScale;
      const numTiles = Math.pow(2, tileZoom);

      const startTileX = Math.floor((cxWorld - w / 2) / tileSize);
      const endTileX = Math.ceil((cxWorld + w / 2) / tileSize);
      const startTileY = Math.max(0, Math.floor((cyWorld - h / 2) / tileSize));
      const endTileY = Math.min(numTiles - 1, Math.ceil((cyWorld + h / 2) / tileSize));

      for (let tx = startTileX; tx <= endTileX; tx++) {
        for (let ty = startTileY; ty <= endTileY; ty++) {
          const wrappedTx = ((tx % numTiles) + numTiles) % numTiles;
          const img = getTileImage(tileZoom, wrappedTx, ty, onTileLoad);
          const dx = tx * tileSize - cxWorld + w / 2;
          const dy = ty * tileSize - cyWorld + h / 2;
          if (img.complete && img.naturalWidth) {
            ctx.drawImage(img, dx, dy, tileSize, tileSize);
          }
        }
      }

      // === CONNECTION LINES ===
      ctx.lineWidth = 0.5;
      filt.forEach((c1, i) => {
        filt.forEach((c2, j) => {
          if (j <= i) return;
          const dist = Math.sqrt((c1.lat - c2.lat) ** 2 + (c1.lng - c2.lng) ** 2);
          if (dist < 0.006) {
            const p1 = lngLatToPixel(c1.lng, c1.lat, cLng, cLat, zoom, w, h);
            const p2 = lngLatToPixel(c2.lng, c2.lat, cLng, cLat, zoom, w, h);
            ctx.strokeStyle = "rgba(255,255,255,0.06)";
            ctx.setLineDash([3, 5]);
            ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
            ctx.setLineDash([]);
          }
        });
      });

      // === HEATMAP ===
      if (hm) {
        if (!heatCanvasRef.current) heatCanvasRef.current = document.createElement("canvas");
        const hc = heatCanvasRef.current;
        hc.width = w; hc.height = h;
        const hx = hc.getContext("2d");

        filt.forEach(cam => {
          const p = lngLatToPixel(cam.lng, cam.lat, cLng, cLat, zoom, w, h);
          const radius = 65 + Math.sin(pulse * 1.5) * 8;
          const grad = hx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
          grad.addColorStop(0, "rgba(255,255,255,0.55)");
          grad.addColorStop(0.25, "rgba(255,255,255,0.2)");
          grad.addColorStop(0.6, "rgba(255,255,255,0.06)");
          grad.addColorStop(1, "rgba(255,255,255,0)");
          hx.fillStyle = grad;
          hx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
        });

        const id = hx.getImageData(0, 0, w, h);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const v = d[i + 3] / 255;
          if (v > 0.01) {
            const brightness = Math.floor(v * 255);
            d[i] = brightness;
            d[i + 1] = brightness;
            d[i + 2] = brightness;
            d[i + 3] = Math.floor(v * 140);
          }
        }
        hx.putImageData(id, 0, 0);
        ctx.globalAlpha = 0.45;
        ctx.drawImage(hc, 0, 0);
        ctx.globalAlpha = 1;
      }

      // === MARKERS ===
      filt.forEach(cam => {
        const p = lngLatToPixel(cam.lng, cam.lat, cLng, cLat, zoom, w, h);
        const isSel = sel?.id === cam.id;
        const isHov = hovId === cam.id;
        const shape = CAT[cam.cat]?.shape || "circle";
        const r = isSel ? 8 : isHov ? 7 : 5;

        const pr = r + 14 + Math.sin(pulse) * 5;
        ctx.strokeStyle = `rgba(255,255,255,${isSel ? 0.2 : 0.08})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, Math.PI * 2); ctx.stroke();

        if (isSel) {
          const pr2 = r + 24 + Math.sin(pulse + 1.2) * 7;
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.beginPath(); ctx.arc(p.x, p.y, pr2, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.shadowColor = "#fff";
        ctx.shadowBlur = isSel ? 16 : isHov ? 10 : 4;

        drawShape(ctx, shape, p.x, p.y, r + 2);
        ctx.fillStyle = `rgba(255,255,255,${isSel ? 0.15 : 0.06})`;
        ctx.fill();

        drawShape(ctx, shape, p.x, p.y, r);
        ctx.fillStyle = isSel ? "#ffffff" : isHov ? "#d4d4d4" : "#999999";
        ctx.fill();
        ctx.strokeStyle = isSel ? "#ffffff" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = isSel ? 1.5 : 0.75;
        ctx.stroke();

        ctx.shadowBlur = 0;

        if (shape === "circle") {
          ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = "#080808"; ctx.fill();
        }

        if (isSel || isHov || zoom >= 15.5) {
          ctx.font = `${isSel ? 600 : 400} ${isSel ? 10 : 9}px -apple-system, 'Helvetica Neue', sans-serif`;
          ctx.textAlign = "center";
          const label = cam.name;
          const tw = ctx.measureText(label).width;
          const bx = p.x - tw / 2 - 8;
          const by = p.y - r - 22;
          const bw = tw + 16;
          const bh = 17;

          ctx.fillStyle = "rgba(8,8,8,0.9)";
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 3); ctx.fill();
          ctx.strokeStyle = `rgba(255,255,255,${isSel ? 0.25 : 0.08})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();

          ctx.fillStyle = isSel ? "#ffffff" : "#aaaaaa";
          ctx.fillText(label, p.x, p.y - r - 10);
        }
      });

      // === COMPASS ===
      ctx.save();
      ctx.translate(w - 36, 36);
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.75;
      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-3, -2); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-3, 2); ctx.lineTo(3, 2); ctx.closePath(); ctx.fill();
      ctx.font = "bold 7px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.textAlign = "center";
      ctx.fillText("N", 0, -18);
      ctx.restore();

      // === SCALE BAR ===
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(w - 110, h - 24, 70, 1);
      ctx.fillRect(w - 110, h - 27, 0.5, 5);
      ctx.fillRect(w - 40, h - 27, 0.5, 5);
      ctx.font = "8px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      ctx.fillText("~500m", w - 75, h - 13);

      // === CROSSHAIR ===
      const chSize = 8;
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(w / 2 - chSize, h / 2); ctx.lineTo(w / 2 + chSize, h / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - chSize); ctx.lineTo(w / 2, h / 2 + chSize); ctx.stroke();

      pulse = (pulse + 0.02) % (Math.PI * 2);
      frame = requestAnimationFrame(draw);
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [onTileLoad]);

  const getMousePos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const findCamera = (mx, my) => {
    const { lat: cLat, lng: cLng, zoom } = stateRef.current.viewState;
    const { w, h } = dimsRef.current;
    for (const cam of filteredRef.current) {
      const p = lngLatToPixel(cam.lng, cam.lat, cLng, cLat, zoom, w, h);
      if (Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2) < 18) return cam;
    }
    return null;
  };

  const handleMouseDown = (e) => {
    const { x, y } = getMousePos(e);
    const cam = findCamera(x, y);
    if (cam) { onSelect(cam); return; }
    dragRef.current = { x: e.clientX, y: e.clientY, sLat: viewState.lat, sLng: viewState.lng };
  };

  const handleMouseMove = (e) => {
    const { x, y } = getMousePos(e);
    const cam = findCamera(x, y);
    hoveredRef.current = cam?.id || null;
    if (canvasRef.current) canvasRef.current.style.cursor = cam ? "pointer" : dragRef.current ? "grabbing" : "grab";
    const drag = dragRef.current;
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      const scale = Math.pow(2, stateRef.current.viewState.zoom) * 256;
      setViewState(v => ({ ...v, lng: drag.sLng + (-dx / scale) * 360, lat: drag.sLat + (dy / scale) * 180 }));
    }
  };

  const handleMouseUp = () => { dragRef.current = null; };

  const handleWheel = (e) => {
    e.preventDefault();
    setViewState(v => ({ ...v, zoom: Math.max(12, Math.min(18, v.zoom + (e.deltaY > 0 ? -0.3 : 0.3))) }));
  };

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }}
    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp} onWheel={handleWheel} />;
}

function LivePlayer({ playerId }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playerId) return;

    const streamUrl = `/stream/l/${playerId}/master.m3u8`;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 4, maxMaxBufferLength: 8, liveSyncDuration: 2 });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.play().catch(() => {});
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [playerId]);

  return (
    <video
      ref={videoRef}
      muted
      autoPlay
      playsInline
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
    />
  );
}

function CameraCard({ cam, isSelected, onClick }) {
  const shape = CAT[cam.cat]?.shape;
  return (
    <div onClick={onClick} style={{
      cursor: "pointer", borderRadius: 6, padding: "10px 12px",
      border: isSelected ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.04)",
      background: isSelected ? "rgba(255,255,255,0.06)" : "transparent",
      transition: "all 0.15s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Shape icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
          {shape === "circle" && <circle cx="10" cy="10" r="6" fill="none" stroke={isSelected ? "#fff" : "#777"} strokeWidth="1.5" />}
          {shape === "diamond" && <polygon points="10,3 17,10 10,17 3,10" fill="none" stroke={isSelected ? "#fff" : "#777"} strokeWidth="1.5" />}
          {shape === "square" && <rect x="4" y="4" width="12" height="12" fill="none" stroke={isSelected ? "#fff" : "#777"} strokeWidth="1.5" />}
          {shape === "triangle" && <polygon points="10,3 17,16 3,16" fill="none" stroke={isSelected ? "#fff" : "#777"} strokeWidth="1.5" />}
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? "#fff" : "#bbb",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{cam.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#fff" : "#666" }} />
            <span style={{ fontSize: 9, color: "#777", fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" }}>{CAT[cam.cat].label}</span>
          </div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#fff" : "#555"} strokeWidth="2.5" strokeLinecap="round"><polyline points="9,18 15,12 9,6" /></svg>
      </div>
    </div>
  );
}

export default function KonyaCamMap() {
  const [selected, setSelected] = useState(null);
  const [heatmap, setHeatmap] = useState(true);
  const [filters, setFilters] = useState(["park", "tarihi", "meydan", "spor"]);
  const [showPanel, setShowPanel] = useState(true);
  const [search, setSearch] = useState("");
  const [time, setTime] = useState(new Date());
  const [viewState, setViewState] = useState({ lat: CENTER.lat, lng: CENTER.lng, zoom: DEFAULT_ZOOM });
  const motionScores = useMotionDetection(CAMERAS);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  // Animated favicon — rotating wireframe globe in the browser tab
  useEffect(() => {
    const s = 64, r = s * 0.38, cx = s / 2, cy = s / 2;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const ctx = c.getContext("2d");
    let link = document.querySelector("link[rel='icon']");
    if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
    let angle = 0, frame;
    function draw() {
      ctx.clearRect(0, 0, s, s);
      ctx.fillStyle = "#111317"; ctx.beginPath(); ctx.roundRect(0, 0, s, s, 10); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      for (let lat = -60; lat <= 60; lat += 30) {
        const lr = (lat * Math.PI) / 180, y = cy - Math.sin(lr) * r, rx = Math.cos(lr) * r;
        ctx.strokeStyle = `rgba(255,255,255,${lat === 0 ? 0.4 : 0.2})`;
        ctx.beginPath(); ctx.ellipse(cx, y, rx, rx * 0.15, 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const lng = angle + (i * Math.PI) / 3, cl = Math.cos(lng), sl = Math.sin(lng);
        ctx.strokeStyle = `rgba(255,255,255,${sl > 0 ? 0.4 : 0.12})`;
        ctx.beginPath();
        for (let j = 0; j <= 40; j++) {
          const la = (j / 40) * Math.PI - Math.PI / 2;
          const px = cx + Math.cos(la) * cl * r, py = cy - Math.sin(la) * r;
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      angle += 0.03;
      link.href = c.toDataURL("image/png");
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggleFilter = (cat) => setFilters(f => f.includes(cat) ? f.filter(x => x !== cat) : [...f, cat]);

  const handleSelect = (cam) => {
    setSelected(cam);
    setViewState(v => ({ ...v, lat: cam.lat, lng: cam.lng, zoom: Math.max(v.zoom, 15) }));
  };

  const filtered = CAMERAS.filter(c => filters.includes(c.cat) && (!search || c.name.toLowerCase().includes(search.toLowerCase())));
  const panelW = showPanel ? 280 : 0;

  return (
    <div style={{
      width: "100vw", height: "100vh", position: "relative", overflow: "hidden",
      fontFamily: "-apple-system, 'Helvetica Neue', 'Segoe UI', sans-serif",
      background: "#080808", color: "#ccc",
    }}>
      {/* TOP BAR */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, height: 44,
        background: "rgba(8,8,8,0.92)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 0 80px",
        WebkitAppRegion: "drag",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WireframeGlobe size={22} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: 1.5, textTransform: "uppercase" }}>Konya</span>
            <span style={{ fontSize: 9, color: "#888", marginLeft: 8, fontWeight: 400, letterSpacing: 2 }}>ŞEHİR KAMERALARI</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, WebkitAppRegion: "no-drag" }}>
          <span style={{ fontSize: 10, color: "#777" }}><span style={{ color: "#aaa" }}>{CAMERAS.length}</span> kamera</span>
          <span style={{
            fontSize: 11, color: "#999", fontVariantNumeric: "tabular-nums", letterSpacing: 1,
            padding: "2px 8px", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 4,
          }}>
            {time.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* SIDE PANEL */}
      {showPanel && (
        <div style={{
          position: "absolute", top: 44, left: 0, bottom: 0, width: panelW, zIndex: 20,
          background: "rgba(8,8,8,0.95)", backdropFilter: "blur(16px)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "10px 10px 6px" }}>
            <input type="text" placeholder="Ara..." value={search} onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 4, boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)",
                color: "#ccc", fontSize: 11, outline: "none", fontFamily: "inherit",
              }} />
          </div>

          {/* Filter row */}
          <div style={{ padding: "2px 10px 8px", display: "flex", gap: 3, flexWrap: "wrap" }}>
            {Object.entries(CAT).map(([key, { label, shape }]) => {
              const on = filters.includes(key);
              return (
                <button key={key} onClick={() => toggleFilter(key)} style={{
                  padding: "3px 8px", borderRadius: 3, cursor: "pointer", fontSize: 9, fontWeight: 500,
                  border: on ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(255,255,255,0.04)",
                  background: on ? "rgba(255,255,255,0.08)" : "transparent",
                  color: on ? "#ddd" : "#777", transition: "all 0.15s", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <svg width="8" height="8" viewBox="0 0 20 20">
                    {shape === "circle" && <circle cx="10" cy="10" r="5" fill="none" stroke={on ? "#aaa" : "#666"} strokeWidth="2" />}
                    {shape === "diamond" && <polygon points="10,3 17,10 10,17 3,10" fill="none" stroke={on ? "#aaa" : "#666"} strokeWidth="2" />}
                    {shape === "square" && <rect x="4" y="4" width="12" height="12" fill="none" stroke={on ? "#aaa" : "#666"} strokeWidth="2" />}
                    {shape === "triangle" && <polygon points="10,3 17,16 3,16" fill="none" stroke={on ? "#aaa" : "#666"} strokeWidth="2" />}
                  </svg>
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ height: 1, background: "rgba(255,255,255,0.03)", margin: "0 10px" }} />

          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px", display: "flex", flexDirection: "column", gap: 3 }}>
            {filtered.map(cam => (
              <CameraCard key={cam.id} cam={cam} isSelected={selected?.id === cam.id} onClick={() => handleSelect(cam)} />
            ))}
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#666", fontSize: 11 }}>—</div>}
          </div>
        </div>
      )}

      {/* MAP */}
      <div style={{ position: "absolute", top: 44, left: panelW, right: 0, bottom: 0, zIndex: 10 }}>
        <CanvasMap cameras={CAMERAS} selected={selected} onSelect={handleSelect}
          heatmapOn={heatmap} filters={filters} viewState={viewState} setViewState={setViewState} />
      </div>

      {/* MAP CONTROLS */}
      <div style={{ position: "absolute", top: 56, right: 14, zIndex: 25, display: "flex", flexDirection: "column", gap: 4 }}>
        {[
          { label: "Isı Haritası", active: heatmap, onClick: () => setHeatmap(!heatmap), icon: "◎" },
          { label: "Panel", active: showPanel, onClick: () => setShowPanel(!showPanel), icon: "▐" },
          { label: "Sıfırla", active: false, onClick: () => setViewState({ lat: CENTER.lat, lng: CENTER.lng, zoom: DEFAULT_ZOOM }), icon: "↺" },
        ].map(b => (
          <button key={b.label} onClick={b.onClick} style={{
            padding: "6px 12px", borderRadius: 4, cursor: "pointer",
            border: `1px solid rgba(255,255,255,${b.active ? 0.2 : 0.04})`,
            background: b.active ? "rgba(255,255,255,0.06)" : "rgba(8,8,8,0.85)",
            backdropFilter: "blur(10px)", fontSize: 10, fontWeight: 500,
            color: b.active ? "#ddd" : "#888", display: "flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", transition: "all 0.15s",
          }}>
            <span style={{ fontSize: 13 }}>{b.icon}</span>{b.label}
          </button>
        ))}
        <div style={{
          padding: "4px 12px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.03)",
          background: "rgba(8,8,8,0.85)", fontSize: 9, color: "#777", textAlign: "center",
        }}>
          z {viewState.zoom.toFixed(1)}
        </div>
      </div>

      {/* SELECTED DETAIL */}
      {selected && (
        <div style={{
          position: "absolute", zIndex: 25, overflow: "hidden",
          background: "rgba(8,8,8,0.95)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.1)",
          transition: "all 0.3s ease",
          ...(expanded
            ? { top: 44, left: panelW, right: 0, bottom: 0, borderRadius: 0 }
            : { bottom: 14, right: 14, width: 320, borderRadius: 8 }),
          display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{
            padding: "10px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{selected.name}</div>
              <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{CAT[selected.cat].label}</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setExpanded(e => !e)} style={{
                width: 24, height: 24, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent", color: "#999", cursor: "pointer", fontSize: 11,
                display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {expanded ? (
                    <><polyline points="4,14 10,14 10,20"/><polyline points="20,10 14,10 14,4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>
                  ) : (
                    <><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                  )}
                </svg>
              </button>
              <button onClick={() => { setSelected(null); setExpanded(false); }} style={{
                width: 24, height: 24, borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)",
                background: "transparent", color: "#999", cursor: "pointer", fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
              }}>×</button>
            </div>
          </div>

          {/* Live Feed */}
          <div style={{ position: "relative", width: "100%", flex: expanded ? 1 : "none", aspectRatio: expanded ? undefined : "16/9", background: "#000" }}>
            <LivePlayer key={selected.id} playerId={PLAYER_IDS[selected.id]} />
            <div style={{
              position: "absolute", top: 6, left: 6, display: "flex", alignItems: "center", gap: 4,
              background: "rgba(0,0,0,0.8)", borderRadius: 3, padding: "2px 7px",
              pointerEvents: "none",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
              <span style={{ fontSize: 8, fontWeight: 700, color: "#fff", letterSpacing: 1.5 }}>CANLI</span>
            </div>
          </div>

          <div style={{
            padding: "6px 14px", borderTop: "1px solid rgba(255,255,255,0.04)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 8, color: "#666", fontVariantNumeric: "tabular-nums" }}>
              {selected.lat.toFixed(4)}°N {selected.lng.toFixed(4)}°E
            </span>
            <a href={`https://www.konyabuyuksehir.tv/canliyayin_izle/${selected.id}/`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 9, color: "#888", textDecoration: "none", fontWeight: 500 }}>
              Kaynak ↗
            </a>
          </div>
        </div>
      )}

      {/* ACTIVITY PANEL */}
      {(() => {
        const scanned = filtered.filter(c => motionScores[c.id] !== undefined);
        const activities = filtered.map(cam => ({ cam, activity: motionScores[cam.id] ?? null }));
        const scored = activities.filter(a => a.activity !== null);
        const avg = scored.length ? scored.reduce((s, a) => s + a.activity, 0) / scored.length : null;
        const top3 = [...scored].sort((a, b) => b.activity - a.activity).slice(0, 3);
        const levelLabel = avg === null ? "Taranıyor..." : avg > 0.5 ? "Yüksek" : avg > 0.2 ? "Orta" : "Düşük";
        const levelColor = avg === null ? "#555" : avg > 0.5 ? "#fff" : avg > 0.2 ? "#888" : "#444";
        return (
          <div style={{
            position: "absolute", bottom: 14, left: showPanel ? panelW + 14 : 14, zIndex: 25,
            padding: "8px 12px", borderRadius: 6,
            background: "rgba(8,8,8,0.92)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.06)", minWidth: 180,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 8, color: "#888", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Hareketlilik</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: levelColor, boxShadow: avg > 0.5 ? `0 0 6px ${levelColor}` : "none" }} />
                <span style={{ fontSize: 9, color: levelColor, fontWeight: 600 }}>{levelLabel}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.04)" }}>
                <div style={{
                  height: "100%", borderRadius: 2, width: avg !== null ? `${avg * 100}%` : "0%",
                  background: `linear-gradient(90deg, #333, ${levelColor})`,
                  transition: "width 0.8s ease",
                }} />
              </div>
              <span style={{ fontSize: 8, color: "#777", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>
                {scanned.length}/{filtered.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {top3.map(({ cam, activity }) => (
                <div key={cam.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 36, height: 2, borderRadius: 1, background: "rgba(255,255,255,0.04)", flexShrink: 0,
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 1, width: `${activity * 100}%`,
                      background: activity > 0.5 ? "#aaa" : activity > 0.2 ? "#555" : "#333",
                      transition: "width 0.8s ease",
                    }} />
                  </div>
                  <span style={{
                    fontSize: 8, color: "#888", whiteSpace: "nowrap", overflow: "hidden",
                    textOverflow: "ellipsis", maxWidth: 100,
                  }}>{cam.name}</span>
                  <span style={{ fontSize: 8, color: "#777", marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
                    {Math.round(activity * 100)}
                  </span>
                </div>
              ))}
              {scored.length === 0 && (
                <div style={{ fontSize: 8, color: "#666", textAlign: "center", padding: "2px 0" }}>Kameralar taranıyor...</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* SHAPE LEGEND */}
      <div style={{
        position: "absolute", bottom: 14, left: showPanel ? panelW + 200 : 200, zIndex: 25,
        padding: "6px 12px", borderRadius: 4,
        background: "rgba(8,8,8,0.9)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.04)",
        display: "flex", gap: 10,
      }}>
        {Object.entries(CAT).map(([key, { label, shape }]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="8" height="8" viewBox="0 0 20 20">
              {shape === "circle" && <circle cx="10" cy="10" r="5" fill="#888" />}
              {shape === "diamond" && <polygon points="10,3 17,10 10,17 3,10" fill="#888" />}
              {shape === "square" && <rect x="4" y="4" width="12" height="12" fill="#888" />}
              {shape === "triangle" && <polygon points="10,3 17,16 3,16" fill="#888" />}
            </svg>
            <span style={{ fontSize: 8, color: "#777" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ATTRIBUTION */}
      <div style={{
        position: "absolute", bottom: 4, right: 4, zIndex: 25,
        fontSize: 8, color: "#555", padding: "2px 6px",
      }}>
        <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "none" }}>© CARTO</a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "none" }}>© OpenStreetMap</a>
        {" · "}
        <a href="https://www.konyabuyuksehir.tv" target="_blank" rel="noopener noreferrer" style={{ color: "#555", textDecoration: "none" }}>Konya Büyükşehir Belediyesi</a>
      </div>
    </div>
  );
}
