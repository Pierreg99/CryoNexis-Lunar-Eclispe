/* CRYONEXUS cinema engine — pooled contexts, linear HDR post FX, local audio. */
(function () {
  'use strict';
  const T = window.THREE;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const instances = [], slots = [];
  let disabled = !T, selectedPhase = 0;
  const audio = { context: null, analyser: null, gain: null, data: null, enabled: false };
  const quadVertex = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const shaders = {
    bright: 'uniform sampler2D source; varying vec2 vUv; void main(){vec3 c=texture2D(source,vUv).rgb;float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.5,1.25,l),1.);}',
    blur: 'uniform sampler2D source;uniform vec2 direction;varying vec2 vUv;void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=texture2D(source,vUv+direction*1.384615).rgb*.316216;c+=texture2D(source,vUv-direction*1.384615).rgb*.316216;c+=texture2D(source,vUv+direction*3.230769).rgb*.070270;c+=texture2D(source,vUv-direction*3.230769).rgb*.070270;gl_FragColor=vec4(c,1.);}',
    composite: `uniform sampler2D source;uniform sampler2D bloom;uniform float time;uniform float height;varying vec2 vUv;
      vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
      void main(){vec2 d=vUv-.5;vec2 shift=d*dot(d,d)*.008;vec3 c=vec3(texture2D(source,vUv+shift).r,texture2D(source,vUv).g,texture2D(source,vUv-shift).b);c+=texture2D(bloom,vUv).rgb*.68;c=aces(c);c*=1.-smoothstep(.12,.65,length(d))*.5;c=pow(c,vec3(1./2.2));float grain=fract(sin(dot(vUv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;c+=grain*.018;c*=.987+.013*sin(vUv.y*height*3.14159+time*.3);gl_FragColor=vec4(c,1.);}`
  };
  function material(fragment, uniforms) { return new T.ShaderMaterial({ vertexShader: quadVertex, fragmentShader: fragment, uniforms, depthTest: false, depthWrite: false }); }
  function createSlot() {
    // This is the only WebGLRenderer allocation site; slots never exceed two.
    const renderer = new T.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    renderer.toneMapping = T.NoToneMapping;
    renderer.outputEncoding = T.LinearEncoding;
    renderer.setPixelRatio(1);
    const surface = renderer.domElement;
    surface.className = 'render-surface'; surface.setAttribute('aria-hidden', 'true');
    const type = renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float') ? T.HalfFloatType : T.UnsignedByteType;
    const target = () => new T.WebGLRenderTarget(1, 1, { type, depthBuffer: false, stencilBuffer: false });
    const main = target(); main.depthBuffer = true;
    const bright = target(), horizontal = target(), vertical = target();
    const postScene = new T.Scene(), postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const brightMat = material(shaders.bright, { source: { value: main.texture } });
    const blurMat = material(shaders.blur, { source: { value: bright.texture }, direction: { value: new T.Vector2() } });
    const compositeMat = material(shaders.composite, { source: { value: main.texture }, bloom: { value: vertical.texture }, time: { value: 0 }, height: { value: 1 } });
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), brightMat); postScene.add(quad);
    const slot = { renderer, main, bright, horizontal, vertical, postScene, postCamera, quad, brightMat, blurMat, compositeMat, owner: null, width: 0, height: 0, scale: 1, slow: 0 };
    surface.addEventListener('webglcontextlost', event => { event.preventDefault(); disabled = true; reconcile(); document.dispatchEvent(new CustomEvent('cryonexus:graphics', { detail: 'fallback' })); });
    surface.addEventListener('webglcontextrestored', () => { disabled = false; slot.width = 0; reconcile(); });
    slots.push(slot); return slot;
  }
  function bands(t) {
    if (audio.enabled && audio.analyser && audio.context.state === 'running') {
      audio.analyser.getByteFrequencyData(audio.data);
      const mean = (start, end) => { let sum = 0; for (let i = start; i < end; i++) sum += audio.data[i]; return Math.max(.05, Math.min(1, sum / ((end - start) * 255))); };
      const bin = audio.context.sampleRate / audio.analyser.fftSize;
      const lo = Math.max(2, Math.round(250 / bin)), hi = Math.min(audio.data.length - 1, Math.round(2000 / bin));
      return { bass: mean(1, lo), mid: mean(lo, hi), hi: mean(hi, audio.data.length) };
    }
    return { bass: .32 + .22 * Math.sin(t * .7), mid: .38 + .24 * Math.sin(t * .43 + 2), hi: .28 + .2 * Math.sin(t * .91 + 4) };
  }
  function release(instance) {
    cancelAnimationFrame(instance.raf); instance.raf = 0; instance.running = false;
    if (instance.slot) { instance.slot.owner = null; instance.slot.renderer.domElement.remove(); instance.slot = null; }
  }
  function resize(instance, slot) {
    const rect = instance.section.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 1.5) * slot.scale;
    const width = Math.max(1, Math.min(1600, Math.round(rect.width * ratio)));
    const height = Math.max(1, Math.min(1300, Math.round(rect.height * ratio)));
    if (slot.width === width && slot.height === height) return;
    slot.width = width; slot.height = height;
    slot.renderer.setSize(width, height, false); slot.main.setSize(width, height);
    [slot.bright, slot.horizontal, slot.vertical].forEach(target => target.setSize(Math.max(1, width >> 1), Math.max(1, height >> 1)));
    slot.compositeMat.uniforms.height.value = height;
    instance.camera.aspect = rect.width / rect.height; instance.camera.updateProjectionMatrix();
  }
  function draw(instance, now) {
    instance.raf = 0;
    if (!instance.running || !instance.slot) return;
    const slot = instance.slot, renderer = slot.renderer;
    const dt = Math.min(.05, (now - instance.last) / 1000 || 0); instance.last = now; instance.time += dt;
    try {
      resize(instance, slot);
      instance.update({ T, scene: instance.scene, camera: instance.camera, refs: instance.refs, t: instance.time, dt, audio: bands(instance.time), phase: selectedPhase });
      renderer.setClearColor(instance.clear, 1);
      renderer.setRenderTarget(slot.main); renderer.render(instance.scene, instance.camera);
      const pass = (mat, target) => { slot.quad.material = mat; renderer.setRenderTarget(target); renderer.render(slot.postScene, slot.postCamera); };
      pass(slot.brightMat, slot.bright);
      slot.blurMat.uniforms.source.value = slot.bright.texture; slot.blurMat.uniforms.direction.value.set(1 / slot.bright.width, 0); pass(slot.blurMat, slot.horizontal);
      slot.blurMat.uniforms.source.value = slot.horizontal.texture; slot.blurMat.uniforms.direction.value.set(0, 1 / slot.bright.height); pass(slot.blurMat, slot.vertical);
      slot.compositeMat.uniforms.time.value = instance.time; pass(slot.compositeMat, null);
      instance.frames++;
      // Reduce fill rate under sustained pressure without changing simulation counts.
      if (dt > .024) slot.slow++; else slot.slow = Math.max(0, slot.slow - 1);
      if (slot.slow > 45 && slot.scale > .5) { slot.scale *= .8; slot.slow = 0; }
    } catch (_) { instance.failed = true; release(instance); reconcile(); document.dispatchEvent(new CustomEvent('cryonexus:graphics', { detail: 'fallback' })); return; }
    instance.raf = requestAnimationFrame(time => draw(instance, time));
  }
  function reconcile() {
    const candidates = disabled || motion.matches || document.hidden ? [] : instances.filter(i => i.visible && !i.paused && !i.failed).sort((a, b) => b.ratio - a.ratio).slice(0, 2);
    instances.forEach(i => { if (!candidates.includes(i)) release(i); });
    candidates.forEach(i => {
      if (i.running) return;
      try {
        const slot = slots.find(s => !s.owner) || (slots.length < 2 ? createSlot() : null);
        if (!slot) return;
        slot.owner = i; i.slot = slot; i.section.insertBefore(slot.renderer.domElement, i.canvas.nextSibling);
        slot.width = 0; i.running = true; i.last = performance.now(); i.raf = requestAnimationFrame(time => draw(i, time));
      } catch (_) { i.failed = true; document.dispatchEvent(new CustomEvent('cryonexus:graphics', { detail: 'fallback' })); }
    });
  }
  const visibility = new IntersectionObserver(entries => {
    entries.forEach(entry => { const i = instances.find(item => item.section === entry.target); if (i) { i.visible = entry.isIntersecting; i.ratio = entry.intersectionRatio; } }); reconcile();
  }, { threshold: [0, .01, .25, .5, .75, 1] });
  function boot(canvas, onBuild, onUpdate, opts = {}) {
    if (!T) throw new Error('Three.js unavailable');
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(opts.fov || 48, 1, .1, 150);
    camera.position.set(...(opts.camPos || [0, 0, 12])); camera.lookAt(...(opts.lookAt || [0, 0, 0]));
    const instance = { canvas, section: canvas.closest('section'), scene, camera, refs: {}, update: onUpdate, clear: opts.clear || 0x03060d, visible: false, ratio: 0, paused: false, failed: false, running: false, slot: null, raf: 0, last: 0, time: 0, frames: 0 };
    // Renderer access is deferred: building offscreen must not allocate a context.
    const renderer = new Proxy({}, { get: (_, key) => { const active = instance.slot?.renderer; const value = active?.[key]; return typeof value === 'function' ? value.bind(active) : value; } });
    instance.refs = onBuild({ T, scene, camera, renderer }) || {};
    instances.push(instance); visibility.observe(instance.section);
    return { renderer, scene, camera, refs: instance.refs, pause() { instance.paused = true; reconcile(); }, resume() { instance.paused = false; reconcile(); }, isRunning: () => instance.running };
  }
  async function setAudio(enabled) {
    if (!enabled) { audio.enabled = false; if (audio.gain) audio.gain.gain.setTargetAtTime(0, audio.context.currentTime, .12); return false; }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    try {
      if (!audio.context) {
        audio.context = new AudioContext(); audio.analyser = audio.context.createAnalyser(); audio.analyser.fftSize = 1024;
        audio.data = new Uint8Array(audio.analyser.frequencyBinCount); audio.gain = audio.context.createGain(); audio.gain.gain.value = 0;
        audio.analyser.connect(audio.gain); audio.gain.connect(audio.context.destination);
        [55, 82.41, 110.2, 220.5, 3520].forEach((frequency, index) => {
          const oscillator = audio.context.createOscillator(), level = audio.context.createGain();
          oscillator.type = index < 3 ? 'sine' : 'triangle'; oscillator.frequency.value = frequency; level.gain.value = index === 4 ? .005 : .12 / (index + 1);
          oscillator.connect(level); level.connect(audio.analyser); oscillator.start();
        });
      }
      await audio.context.resume(); audio.gain.gain.setTargetAtTime(.38, audio.context.currentTime, .5); audio.enabled = true; return true;
    } catch (_) { return false; }
  }
  document.addEventListener('visibilitychange', () => { reconcile(); if (audio.gain) audio.gain.gain.setTargetAtTime(document.hidden || !audio.enabled ? 0 : .38, audio.context.currentTime, .2); });
  motion.addEventListener('change', reconcile);
  document.addEventListener('cryonexus:phase', event => { selectedPhase = event.detail.index; });
  window.cinema = { boot, setAudio, getStats: () => ({ contexts: slots.length, running: instances.filter(i => i.running).length, scenes: instances.map(i => ({ id: i.canvas.id, running: i.running, frames: i.frames, failed: i.failed })) }) };
})();
