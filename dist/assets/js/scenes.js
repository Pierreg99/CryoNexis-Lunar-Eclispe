/* Six procedural scenes. Cached once; visibility and renderer ownership live in cinema. */
(function () {
  'use strict';
  const T = window.THREE, PI = Math.PI, TAU = PI * 2;
  if (!T || !window.cinema) return;
  let seed = 404;
  function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
  const noise = `
    float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise3(p);p=p*2.03+vec3(4.1,1.7,8.2);a*=.5;}return n;}`;
  const surfaceVertex = `
    #ifdef SECTOR_DATA
      attribute float sectorSignal;attribute float sectorStake;varying float vSignal;varying float vStake;
    #endif
    varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorld;
    void main(){vec4 p=vec4(position,1.);vec3 n=normal;
    #ifdef SECTOR_DATA
      vSignal=sectorSignal;vStake=sectorStake;
    #endif
    #ifdef USE_INSTANCING
      mat3 im=mat3(instanceMatrix);n/=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));n=im*n;p=instanceMatrix*p;
    #endif
      vPosition=p.xyz;vNormal=normalize(mat3(modelMatrix)*n);vWorld=(modelMatrix*p).xyz;gl_Position=projectionMatrix*modelViewMatrix*p;}`;
  function iceMaterial(color = 0x7fe8ff, side = T.FrontSide, sectorData = false) {
    return new T.ShaderMaterial({ side, defines: sectorData ? { SECTOR_DATA: 1 } : {}, uniforms: { time: { value: 0 }, pulse: { value: .3 }, frost: { value: .5 }, intensity: { value: 1 }, tint: { value: new T.Color(color) } }, vertexShader: surfaceVertex, fragmentShader: `${noise}
      #ifdef SECTOR_DATA
        varying float vSignal;varying float vStake;
      #endif
      uniform float time;uniform float pulse;uniform float frost;uniform float intensity;uniform vec3 tint;varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorld;
      void main(){vec3 n=normalize(vNormal);vec3 view=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(n,view)),2.5);float veins=pow(1.-abs(sin(fbm(vPosition*2.4)*24.+vPosition.y*2.)),12.);float cloudy=fbm(vPosition*3.+time*.03);float light=max(0.,dot(n,normalize(vec3(-2.,4.,5.))));vec3 c=tint*(.045+light*.2+cloudy*(.055+frost*.11));c+=tint*(rim*(.7+frost*.4)+veins*(.12+frost*.16+pulse*.25));c+=vec3(.24,.3,.45)*pow(cloudy,4.);
      #ifdef SECTOR_DATA
        c*=.4+vSignal*.5+vStake*.2;c+=vec3(.05,.08,.11)*vStake*rim;
      #endif
        gl_FragColor=vec4(c*intensity,1.);}` });
  }
  function lines(geometry, color, opacity = .25) { return new T.LineSegments(new T.WireframeGeometry(geometry), new T.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: T.AdditiveBlending })); }
  function particles(count, radius, color, size, mode = 'sphere') {
    const positions = new Float32Array(count * 3), phases = new Float32Array(count), sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let x, y, z;
      if (mode === 'sphere') { const a = random() * TAU, h = random() * 2 - 1, r = radius * (.3 + random() * .7); x = Math.cos(a) * Math.sqrt(1 - h * h) * r; y = h * r; z = Math.sin(a) * Math.sqrt(1 - h * h) * r; }
      else { x = (random() - .5) * radius * 2; y = (random() - .5) * radius * 1.2; z = (random() - .5) * radius * 1.5; }
      positions.set([x, y, z], i * 3); phases[i] = random() * TAU; sizes[i] = .4 + random() * .9;
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('phase', new T.BufferAttribute(phases, 1)); geometry.setAttribute('scale', new T.BufferAttribute(sizes, 1));
    const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { time: { value: 0 }, tint: { value: new T.Color(color) }, size: { value: size }, opacity: { value: .42 } }, vertexShader: `uniform float time;uniform float size;attribute float phase;attribute float scale;varying float alpha;void main(){vec3 p=position;p.x+=sin(time*.12+phase+p.y)*.12;p.y+=cos(time*.15+phase)*.14;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(7.,size*scale*80./max(1.,-mv.z));alpha=.3+.7*pow(.5+.5*sin(time*.4+phase),2.);}`, fragmentShader: 'uniform vec3 tint;uniform float opacity;varying float alpha;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;float glow=exp(-r*r*18.)*alpha;gl_FragColor=vec4(tint*1.5,glow*opacity);}' });
    return new T.Points(geometry, material);
  }
  function plane(fragment, uniforms, size = 12) { return new T.Mesh(new T.PlaneGeometry(size, size), new T.ShaderMaterial({ uniforms, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: fragment, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); }
  function subjectX(camera) { return camera.aspect < .85 ? 1.5 : 3.3; }
  function chamber(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const shell = new T.Mesh(new T.IcosahedronGeometry(24, 2), iceMaterial(0x4b8ea5, T.BackSide)); shell.material.uniforms.intensity.value = .055; scene.add(shell);
      const latticeGeometry = new T.IcosahedronGeometry(9.5, 1);
      const lattice = lines(latticeGeometry, 0x548ca0, .15); scene.add(lattice);
      const cage = lines(new T.IcosahedronGeometry(12, 0), 0x7fe8ff, .12); scene.add(cage);
      const centerpiece = new T.Group(); scene.add(centerpiece);
      const crystal = new T.Mesh(new T.IcosahedronGeometry(2.7, 1), iceMaterial()); centerpiece.add(crystal);
      const crystalEdges = lines(crystal.geometry, 0x91d7e5, .38); crystal.add(crystalEdges);
      const orbit = lines(new T.TorusGeometry(3.65, .025, 3, 90), 0x7fe8ff, .36); orbit.rotation.x = 1.15; centerpiece.add(orbit);
      const orbit2 = lines(new T.TorusGeometry(4.05, .015, 3, 90), 0x8b7bff, .25); orbit2.rotation.set(.45, .5, .2); centerpiece.add(orbit2);
      const motes = particles(6000, 19, 0x94e0ef, .16); scene.add(motes);
      return { shell, lattice, cage, centerpiece, crystal, crystalEdges, orbit, orbit2, motes, visual: {} };
    }, ({ camera, refs: r, t, audio, simulation: s }) => {
      const frost = Math.max(0, Math.min(1, (-s.temperature - 220) / 70));
      const intensity = (.45 + s.coherence * .8) * (.75 + s.stability * .25);
      r.shell.material.uniforms.time.value = t; r.crystal.material.uniforms.time.value = t; r.crystal.material.uniforms.pulse.value = audio.bass;
      r.shell.material.uniforms.frost.value = frost; r.shell.material.uniforms.intensity.value = .035 + frost * .025;
      r.crystal.material.uniforms.frost.value = frost; r.crystal.material.uniforms.intensity.value = intensity;
      r.crystal.scale.setScalar(.84 + s.coherence * .17); r.crystalEdges.material.opacity = .14 + s.stability * .27;
      r.lattice.material.opacity = .07 + s.coherence * .16; r.cage.material.opacity = .06 + s.stability * .1;
      r.orbit.material.opacity = .12 + s.coherence * .28; r.orbit2.material.opacity = .08 + s.stability * .2;
      r.motes.material.uniforms.opacity.value = .2 + frost * .28; r.motes.material.uniforms.size.value = .12 + frost * .08;
      r.centerpiece.position.set(subjectX(camera), .2, -1); r.crystal.rotation.set(t * .045, t * .065, .15); r.orbit.rotation.z = t * .04; r.orbit2.rotation.y = t * -.035;
      r.lattice.rotation.y = t * .008; r.cage.rotation.z = t * -.012; r.motes.material.uniforms.time.value = t;
      const drift = .16 + (1 - s.stability) * .3;
      camera.position.set(Math.sin(t * .11) * drift, Math.cos(t * .13) * drift * .6, 13); camera.lookAt(0, 0, 0);
      r.visual.coherence = s.coherence; r.visual.stability = s.stability; r.visual.frost = frost; r.visual.crystalIntensity = intensity;
    }, { camPos: [0, 0, 13], fov: 52 });
  }
  function eclipse(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const group = new T.Group(); scene.add(group);
      const moon = new T.Mesh(new T.SphereGeometry(2.45, 56, 40), new T.ShaderMaterial({ uniforms: { time: { value: 0 } }, vertexShader: surfaceVertex, fragmentShader: `${noise}varying vec3 vPosition;varying vec3 vNormal;varying vec3 vWorld;uniform float time;
        void main(){float craters=fbm(normalize(vPosition)*21.);float pits=pow(abs(sin(craters*36.)),8.);vec3 n=normalize(vNormal);float rim=pow(1.-abs(dot(n,normalize(cameraPosition-vWorld))),7.);vec3 c=vec3(.003,.005,.009)+vec3(.012,.017,.021)*craters*(1.-pits*.6);c+=vec3(.16,.25,.32)*rim;gl_FragColor=vec4(c,1.);}` })); group.add(moon);
      const corona = plane(`uniform float time;uniform float bass;uniform float phase;uniform float exposure;uniform float flux;varying vec2 vUv;
        void main(){vec2 p=(vUv-.5)*12.;float r=length(p);float a=atan(p.y,p.x);float rays=pow(abs(sin(a*12.+time*.13)),6.);float halo=exp(-abs(r-2.49)*3.2);float plume=exp(-max(0.,r-2.5)*1.7)*(rays*.45+.1);float mask=smoothstep(2.38,2.51,r);float disc=(1.-smoothstep(2.35,2.5,r))*(phase==2.?0.:.22);vec3 cold=vec3(.5,.78,1.);vec3 warm=vec3(1.8,.4,.08);vec3 c=mix(cold,warm,.18+rays*.4)*(halo*1.2+plume)*mask*(.9+bass*.4)*exposure;c+=warm*disc*(.12+flux*.2);c*=1.-smoothstep(5.,6.,r);gl_FragColor=vec4(c,max(mask,disc));}`, { time: { value: 0 }, bass: { value: .3 }, phase: { value: 0 }, exposure: { value: .45 }, flux: { value: .35 } }); corona.position.z = -.4; group.add(corona);
      const diamond = plane(`uniform float time;uniform float strength;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*12.;float r=length(p);float ring=exp(-abs(r-2.47)*65.);vec2 q=p-vec2(1.73,1.76);float d=length(q);float flare=.014/(d*d+.007);flare+=exp(-abs(q.x)*38.)*exp(-abs(q.y)*1.8)*.25+exp(-abs(q.y)*38.)*exp(-abs(q.x)*1.8)*.25;vec3 spectrum=.55+.45*cos(vec3(0.,2.,4.)+atan(p.y,p.x)*3.+time*.12);gl_FragColor=vec4((spectrum*ring*1.1+vec3(.8,1.,1.4)*flare)*strength,1.);}`, { time: { value: 0 }, strength: { value: .15 } }); diamond.position.z = 2.6; group.add(diamond);
      const prominences = [];
      for (let i = 0; i < 5; i++) {
        const material = new T.MeshBasicMaterial({ color: 0xff6d31, transparent: true, opacity: .7, depthWrite: false, blending: T.AdditiveBlending });
        const arc = new T.Mesh(new T.TorusGeometry(.38 + i * .026, .025, 5, 28, PI * 1.35), material); const a = i * 1.23 + .35;
        arc.position.set(Math.cos(a) * 2.43, Math.sin(a) * 2.43, .3); arc.rotation.z = a - PI / 2; group.add(arc); prominences.push(arc);
      }
      const sparks = particles(900, 4.4, 0xff9d67, .24); sparks.position.z = -.5; group.add(sparks);
      return { group, moon, corona, diamond, prominences, sparks, moonOffsets: [-1.1, -.22, 0, .62, 1.2], diamondStrengths: [.15, 1.3, .06, .8, .15], visual: {} };
    }, ({ camera, refs: r, t, audio, phase, simulation: s }) => {
      const exposure = (.25 + s.corona * .7) * (phase === 2 ? 1 : .55);
      const diamondStrength = r.diamondStrengths[phase] * (.6 + s.flux * .4);
      r.group.position.x = subjectX(camera); r.moon.position.set(r.moonOffsets[phase], -r.moonOffsets[phase] * .12, 0);
      r.corona.material.uniforms.time.value = t; r.corona.material.uniforms.bass.value = audio.bass; r.corona.material.uniforms.phase.value = phase;
      r.corona.material.uniforms.exposure.value = exposure; r.corona.material.uniforms.flux.value = s.flux;
      r.diamond.material.uniforms.time.value = t; r.diamond.material.uniforms.strength.value = diamondStrength;
      r.sparks.material.uniforms.time.value = t; r.sparks.material.uniforms.opacity.value = .12 + s.flux * .35; r.sparks.rotation.z = t * .012;
      r.prominences.forEach((arc, i) => { arc.scale.setScalar(.85 + s.flux * .14 + Math.sin(t * .4 + i) * .06); arc.material.opacity = .25 + s.flux * .45; });
      r.visual.phase = phase; r.visual.moonOffset = r.moon.position.x; r.visual.coronaExposure = exposure; r.visual.diamondStrength = diamondStrength; r.visual.flux = s.flux;
    }, { camPos: [0, 0, 13], fov: 50 });
  }
  function nexus(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const group = new T.Group(); scene.add(group);
      const ring = new T.Mesh(new T.TorusGeometry(3.6, .95, 14, 70), iceMaterial()); ring.rotation.x = .62; ring.rotation.y = -.25; group.add(ring);
      const edges = lines(ring.geometry, 0x9de3ff, .1); ring.add(edges);
      const core = plane(`uniform float time;uniform float bass;uniform float connection;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*9.;float r=length(p);float ripple=.5+.5*sin(r*46.-time*2.6);float a=(exp(-r*r*.6)*(.08+ripple*.08)+exp(-abs(r-1.3)*12.)*.16)*(.35+connection*.85);gl_FragColor=vec4(vec3(.3,.8,1.3)*a*(1.+bass),a);}`, { time: { value: 0 }, bass: { value: .3 }, connection: { value: .2 } }, 9); core.position.z = .4; group.add(core);
      const shards = [], shardMaterial = iceMaterial(0x99daff), geometry = new T.OctahedronGeometry(.28);
      for (let i = 0; i < 46; i++) { const shard = new T.Mesh(geometry, shardMaterial); shard.scale.set(.6 + random(), 1 + random() * 2.4, .6 + random()); const data = { mesh: shard, scale: shard.scale.clone(), sector: i % 6, radius: 4.6 + random() * 1.5, angle: i / 46 * TAU, speed: (.025 + random() * .025) * (i % 2 ? -1 : 1), offset: random() * TAU }; shards.push(data); group.add(shard); }
      const nodes = particles(90, 6.4, 0x8b7bff, .8); group.add(nodes);
      return { group, ring, edges, core, shards, shardMaterial, nodes, visual: {} };
    }, ({ camera, refs: r, t, audio, simulation: s }) => {
      r.group.position.x = subjectX(camera); r.group.scale.setScalar(camera.aspect < .85 ? .77 : .9);
      r.ring.material.uniforms.time.value = t; r.ring.material.uniforms.pulse.value = audio.bass; r.ring.rotation.z = t * .045;
      r.ring.material.uniforms.intensity.value = .55 + s.coherence * .55; r.edges.material.opacity = .04 + s.coherence * .1;
      r.shardMaterial.uniforms.time.value = t; r.shardMaterial.uniforms.pulse.value = audio.hi;
      r.core.material.uniforms.time.value = t; r.core.material.uniforms.bass.value = audio.bass;
      let boundCount = 0;
      r.shards.forEach((shard, index) => {
        const sector = shard.sector, bound = s.bindings[sector];
        if (index < 6 && bound) boundCount++;
        const a = shard.angle + t * shard.speed, radius = shard.radius * (bound ? .82 : 1.12);
        const size = .55 + s.strengths[sector] * .3 + s.holdings[sector] * .2 + (bound ? .2 : 0);
        shard.mesh.scale.copy(shard.scale).multiplyScalar(size);
        shard.mesh.position.set(Math.cos(a) * radius, Math.sin(a) * radius * .72, Math.sin(a + shard.offset) * (bound ? .7 : 1.8)); shard.mesh.rotation.set(t * .09 + shard.offset, a, a * .6);
      });
      const connection = s.coherence * (.2 + boundCount / 6 * .8);
      r.core.material.uniforms.connection.value = connection; r.nodes.material.uniforms.time.value = t; r.nodes.material.uniforms.opacity.value = .16 + connection * .3;
      r.visual.boundCount = boundCount; r.visual.connection = connection; r.visual.bindings = s.bindings; r.visual.holdings = s.holdings;
    }, { camPos: [0, 0, 15], fov: 52 });
  }
  function crystal(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const group = new T.Group(); group.position.y = -2.7; scene.add(group);
      const geometry = new T.ConeGeometry(.17, 1, 5), material = iceMaterial(0x71cbe8, T.FrontSide, true);
      const signals = new T.InstancedBufferAttribute(new Float32Array(130), 1), stakes = new T.InstancedBufferAttribute(new Float32Array(130), 1);
      signals.setUsage(T.DynamicDrawUsage); stakes.setUsage(T.DynamicDrawUsage); geometry.setAttribute('sectorSignal', signals); geometry.setAttribute('sectorStake', stakes);
      const shards = new T.InstancedMesh(geometry, material, 130); group.add(shards);
      const items = Array.from({ length: 130 }, (_, index) => ({ sector: index % 6, x: (index % 6 - 2.5) * 3.5 + (random() - .5) * 2.6, z: (random() - .5) * 13, height: .4 + random() * 3.6, angle: random() * TAU, phase: random() * TAU }));
      const dummy = new T.Object3D();
      const floor = new T.Mesh(new T.PlaneGeometry(32, 24), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 vUv;void main(){vec2 p=(vUv-.5)*vec2(32.,24.);vec2 grid=abs(fract(p)-.5)/fwidth(p);float line=1.-min(min(grid.x,grid.y),1.);float falloff=exp(-length(p)*.16);gl_FragColor=vec4(vec3(.08,.42,.6)*line*falloff,line*falloff*.45);}', extensions: { derivatives: true } })); floor.rotation.x = -PI / 2; floor.position.y = -.5; group.add(floor);
      return { group, shards, items, dummy, material, signals, stakes, visual: { sectorHeights: [0, 0, 0, 0, 0, 0] } };
    }, ({ refs: r, t, audio, simulation: s }) => {
      r.material.uniforms.time.value = t; r.material.uniforms.pulse.value = audio.mid;
      r.material.uniforms.intensity.value = .7 + s.coherence * .35; r.visual.sectorHeights.fill(0);
      r.items.forEach((item, index) => {
        const strength = s.strengths[item.sector], holding = s.holdings[item.sector];
        const height = item.height * (.35 + strength * .9 + holding * .55) * (.9 + audio.mid * .3 + Math.sin(t * .3 + item.phase) * .025);
        const width = .75 + strength * .5 + holding * .6, lean = s.bindings[item.sector] ? .15 : 1;
        r.dummy.position.set(item.x, height / 2 - .5, item.z); r.dummy.rotation.set(.06 * Math.sin(item.phase) * lean, item.angle, .05 * Math.cos(item.phase) * lean); r.dummy.scale.set(width, height, width); r.dummy.updateMatrix(); r.shards.setMatrixAt(index, r.dummy.matrix);
        r.signals.array[index] = strength; r.stakes.array[index] = holding; r.visual.sectorHeights[item.sector] = Math.max(r.visual.sectorHeights[item.sector], height);
      });
      r.shards.instanceMatrix.needsUpdate = true; r.signals.needsUpdate = true; r.stakes.needsUpdate = true;
      r.visual.strengths = s.strengths; r.visual.holdings = s.holdings; r.visual.bindings = s.bindings;
    }, { camPos: [0, 4, 15], lookAt: [0, -1, 0], fov: 55 });
  }
  function vault(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const group = new T.Group(); scene.add(group);
      const boxes = [];
      for (let i = 0; i < 3; i++) { const box = lines(new T.BoxGeometry(3.3 + i * 1.2, 3.3 + i * 1.2, 3.3 + i * 1.2, 3, 3, 3), i === 1 ? 0x8b7bff : 0x7fe8ff, .16 + i * .025); group.add(box); boxes.push(box); }
      const columns = [], columnMaterial = new T.MeshBasicMaterial({ color: 0x78bfe0, transparent: true, opacity: .14, depthWrite: false, blending: T.AdditiveBlending });
      const geometry = new T.BoxGeometry(.025, 1, .025);
      for (let i = 0; i < 70; i++) { const column = new T.Mesh(geometry, columnMaterial); const data = { mesh: column, x: (random() - .5) * 18, z: (random() - .5) * 10, offset: random() * 18, speed: .3 + random() * .7 }; column.scale.y = .3 + random() * 1.4; group.add(column); columns.push(data); }
      const core = new T.Mesh(new T.IcosahedronGeometry(.6, 1), iceMaterial(0xafdfff)); group.add(core);
      const glow = plane('varying vec2 vUv;uniform float bass;uniform float power;void main(){float r=length((vUv-.5)*8.);float light=(exp(-r*r*2.)*(.6+bass)+.01/(r*r+.1))*(.08+power*.9);gl_FragColor=vec4(vec3(.35,.65,1.)*light,light);}', { bass: { value: .3 }, power: { value: .2 } }, 8); glow.position.z = 1; group.add(glow);
      return { group, boxes, columns, columnMaterial, core, glow, visual: {} };
    }, ({ camera, refs: r, t, audio, simulation: s }) => {
      const separation = s.vaultOpen ? .45 + s.vaultPower * .7 : 0;
      const rotationSpeed = s.vaultOpen ? .07 : .012;
      r.group.position.x = subjectX(camera); r.boxes.forEach((box, i) => {
        box.rotation.set(t * rotationSpeed * (i % 2 ? -1 : 1) + i, t * rotationSpeed * .64 + i, t * rotationSpeed * .5 * (i - 1));
        box.position.set((i - 1) * separation, (i - 1) * separation * .3, 0); box.scale.setScalar(1 + (s.vaultOpen ? s.vaultPower * .12 : 0));
        box.material.opacity = .08 + s.vaultPower * .12 + (s.vaultOpen ? .06 : 0);
      });
      r.columns.forEach(c => { c.mesh.position.set(c.x, 8 - ((t * c.speed * (s.vaultOpen ? 1.2 : .12) + c.offset) % 18), c.z); });
      r.columnMaterial.opacity = .05 + s.vaultPower * .14;
      r.core.rotation.set(t * .15, t * .2, 0); r.core.scale.setScalar(.5 + s.vaultPower * .8);
      r.core.material.uniforms.time.value = t; r.core.material.uniforms.intensity.value = .2 + s.vaultPower * .9;
      r.glow.material.uniforms.bass.value = audio.bass; r.glow.material.uniforms.power.value = s.vaultPower;
      r.visual.vaultOpen = s.vaultOpen; r.visual.vaultPower = s.vaultPower; r.visual.gridSeparation = separation; r.visual.coreIntensity = r.core.material.uniforms.intensity.value;
    }, { camPos: [0, 0, 14], fov: 55 });
  }
  function nebula(canvas) {
    return cinema.boot(canvas, ({ scene }) => {
      const sky = new T.Mesh(new T.IcosahedronGeometry(30, 4), new T.ShaderMaterial({ side: T.BackSide, uniforms: { time: { value: 0 }, mid: { value: .3 }, echoes: { value: 0 }, coherence: { value: .8 } }, vertexShader: surfaceVertex, fragmentShader: `${noise}uniform float time;uniform float mid;uniform float echoes;uniform float coherence;varying vec3 vPosition;
        void main(){vec3 d=normalize(vPosition);vec3 p=d*3.+vec3(sin(echoes*.42),cos(echoes*.31),sin(echoes*.27))*.2;float a=.5;for(int i=0;i<3;i++){p+=sin(p.yzx*1.8+time*.025)*a+cos(p.zxy*1.3-time*.018)*a;p*=1.45;a*=.5;}float mist=fbm(p);float clouds=pow(max(0.,mist-.27),2.);vec3 cold=vec3(.035,.07,.14);vec3 violet=vec3(.14,.08,.3);vec3 c=mix(cold,violet,clamp(d.x*.5+.5+(1.-coherence)*.25,0.,1.))*clouds*2.;c+=vec3(.08,.25,.3)*pow(mist,5.)*(.7+coherence*.6+mid*.4);float trace=pow(.5+.5*sin((d.y+d.x*.3)*(8.+echoes*1.8)+time*.03),8.)*min(echoes*.18,1.);c+=vec3(.06,.12,.18)*trace*.3;gl_FragColor=vec4(c,1.);}` })); scene.add(sky);
      const dust = particles(5000, 27, 0xa9c7ee, .22); scene.add(dust); return { sky, dust, visual: {} };
    }, ({ camera, refs: r, t, audio, phase, simulation: s }) => {
      const echoScale = Math.min(12, Math.log1p(s.echoes));
      r.sky.material.uniforms.time.value = t; r.sky.material.uniforms.mid.value = audio.mid; r.sky.material.uniforms.coherence.value = s.coherence; r.sky.material.uniforms.echoes.value = echoScale;
      r.sky.rotation.y = t * .006 + phase * .035 + echoScale * .02;
      r.dust.material.uniforms.time.value = t; r.dust.material.uniforms.opacity.value = .15 + s.coherence * .22 + Math.min(1, echoScale / 4) * .08;
      r.dust.rotation.y = t * -.008 - echoScale * .012; camera.position.x = Math.sin(t * .07) * (.2 + (1 - s.coherence) * .2);
      r.visual.echoes = s.echoes; r.visual.echoScale = echoScale; r.visual.coherence = s.coherence; r.visual.dustOpacity = r.dust.material.uniforms.opacity.value;
    }, { camPos: [0, 0, 7], fov: 60 });
  }
  const factories = { 'cn-chamber': chamber, 'cn-eclipse': eclipse, 'cn-nexus': nexus, 'cn-crystal': crystal, 'cn-vault': vault, 'cn-void': nebula };
  const built = new Set(), failed = new Set(), motion = matchMedia('(prefers-reduced-motion: reduce)');
  function build(canvas) {
    if (built.has(canvas.id) || failed.has(canvas.id) || motion.matches) return;
    try { factories[canvas.id](canvas); built.add(canvas.id); document.dispatchEvent(new CustomEvent('cryonexus:scene', { detail: { id: canvas.id, section: canvas.closest('section').id } })); }
    catch (_) { failed.add(canvas.id); canvas.closest('section').dataset.graphics = 'fallback'; document.dispatchEvent(new CustomEvent('cryonexus:graphics', { detail: 'fallback' })); }
  }
  // Keep observing after construction: engine's separate observer owns pause/resume.
  const lazy = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) build(entry.target.querySelector('canvas')); }); }, { rootMargin: '250px 0px', threshold: 0 });
  Object.keys(factories).forEach(id => lazy.observe(document.getElementById(id).closest('section')));
  function firstViewport() { Object.keys(factories).forEach(id => { const canvas = document.getElementById(id), rect = canvas.closest('section').getBoundingClientRect(); if (rect.bottom > -250 && rect.top < innerHeight + 250) build(canvas); }); }
  firstViewport(); motion.addEventListener('change', () => { if (!motion.matches) firstViewport(); });
  window.CryoScenes = { built: () => Array.from(built), failed: () => Array.from(failed) };
})();
