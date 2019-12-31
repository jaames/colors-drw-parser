import { DrwParser, CommandType, Color } from '../src/DrwParser';

function hsvToRgb(hsv: [number, number, number]) {
  const h = hsv[0] / 60;
  const s = hsv[1] / 100;
  const v = hsv[2] / 100;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, t, v][mod];
  const g = [t, v, v, q, p, p][mod];
  const b = [p, p, t, v, v, q][mod];
  return [
    r * 255, 
    g * 255, 
    b * 255
  ];
}

function rgbToHsv(rgb: [number, number, number]) {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue;
  let value = max;
  let saturation = max === 0 ? 0 : delta / max;
  switch (max) {
    case min: 
      hue = 0; // achromatic
      break;
    case r: 
      hue = (g - b) / delta + (g < b ? 6 : 0);
      break;
    case g: 
      hue = (b - r) / delta + 2;
      break;
    case b:
      hue = (r - g) / delta + 4;
      break;
  }
  return [
    hue * 60,
    saturation * 100,
    value * 100
  ]
}

function roundToNearest(n: number, p: number) {
  return Math.round(n / p) * p;
}

interface ToolState {
  color: Color;
  isDrawing: boolean;
  lastX: number;
  lastY: number;
  lastLastX: number;
  lastLastY: number;
  strokeDist: number;
  totalDist: number;
}

export class DrwStats {

  public drw: DrwParser;
  public canvasWidth = 320;
  public canvasHeight = 240;

  public colorDists: Map<string, number> = new Map();

  private state: ToolState = {
    color: [0, 0, 0],
    isDrawing: false,
    lastX: 0,
    lastY : 0,
    lastLastX: 0,
    lastLastY: 0,
    strokeDist: 0,
    totalDist: 0
  };

  constructor(drw: DrwParser) {
    this.drw = drw;
    for (let i = 0; i < this.drw.header.numCommands - 1; i++) {
      this.handleCommand(i);
    }
    console.log(this.colorDists);
  }

  static async loadFromUrl(url: string) {
    return DrwParser.loadFromUrl(url).then(drw => new DrwStats(drw));
  }

  private handleCommand(i: number) {
    const state = this.state;
    const cmd = this.drw.getCommand(i);
    switch (cmd.type) {
      case CommandType.TYPE_DRAW:
        const x = cmd.x * this.canvasWidth;
        const y = cmd.y * this.canvasHeight;
        if (state.isDrawing) {
          const segmentDist = Math.hypot(state.lastX - x, state.lastY - y);
          state.strokeDist += segmentDist;
          state.totalDist += segmentDist;
        } 
        state.isDrawing = true;
        state.lastLastX = state.lastX;
        state.lastLastY = state.lastY;
        state.lastX = x;
        state.lastY = y;
        break;
      case CommandType.TYPE_DRAWEND:
        if (cmd.layer === null) {
          state.isDrawing = false;
        }
        break;
      case CommandType.TYPE_COLORCHANGE:
        if (cmd.color !== null) {
          const [h, s, v] = rgbToHsv(state.color);
          const hsvString = `hsv(${roundToNearest(h, 1)}, ${roundToNearest(s, 1)}%, ${roundToNearest(v, 1)}%)`;
          const prevDist = this.colorDists.has(hsvString) ? this.colorDists.get(hsvString) : 0;
          this.colorDists.set(hsvString, prevDist + state.strokeDist);
          state.strokeDist = 0;
          state.color = cmd.color;
        }
        break;
    }
  }

  public plotColorGraph(graphWidth: number, graphHeight: number, graphDepth: number, bubbleMinRadius = 1, bubbleMaxRadius = 50) {
    const values = Array.from(this.colorDists.values());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const ret: any[] = [];
    this.colorDists.forEach((dist, hsvString) => {
      const m = hsvString.match(/hsv\((\d*), (\d*)%, (\d*)%\)/);
      const h = parseInt(m[1]);
      const s = parseInt(m[2]);
      const v = parseInt(m[3]);
      const r = bubbleMinRadius + ((dist - min) / range) * (bubbleMaxRadius - bubbleMinRadius);
      ret.push({
        color: [h, s, v],
        x: (h / 360) * graphWidth,
        y: (s / 100) * graphHeight,
        z: (v / 100) * graphDepth,
        r,
        dist
      });
    });
    return ret;
  }

}

// const url = `https://s3.amazonaws.com/colorslive/drw/1631771---ydOwTWZn1N2Wgb.drw` // bulbasaur

// src: https://www.colorslive.com/details/4389509
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw' //  colorful anime

// src: https://www.colorslive.com/details/4353728
const url = 'https://s3.amazonaws.com/colorslive/drw/4353728-4feMXuTh7ESaAjXX.drw' // zelda

// src: https://www.colorslive.com/details/4390483
// const url = `https://s3.amazonaws.com/colorslive/drw/4390483-KAeEuqcsTguD1rOH.drw` // fallout

// src: https://www.colorslive.com/details/4390461
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw' // bunny

// // src: https://www.colorslive.com/details/4389168
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389168-xHhXcU4tVYKUOK_V.drw' // village

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

DrwStats.loadFromUrl(url).then(stats => {
  (window as any).stats = stats;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 30, (window.innerWidth / 2) / window.innerHeight, 1, 10000 );
  // camera.near = 0.0001;
  camera.position.z = 5;

  const renderer3d = new THREE.WebGLRenderer();
  renderer3d.setClearColor( 0x8C97A5 )
  renderer3d.setSize( window.innerWidth / 2, window.innerHeight );
  document.body.appendChild( renderer3d.domElement );

  const controls = new OrbitControls( camera, renderer3d.domElement );

  const points = stats.plotColorGraph(1, 1, 1, 15, 40);

  const geometry = new THREE.BufferGeometry();
  const numPoints = points.length;
  const positions = new Float32Array( numPoints * 3 );
  const colors = new Float32Array( numPoints * 3 );
  const sizes = new Float32Array( numPoints );

  let offset = 0;
  points.forEach((point, index) => {
    positions[offset] = point.x - 0.5;
    positions[offset + 1] = point.y - 0.5;
    positions[offset + 2] = point.z - 0.5;
    const [r, g, b] = hsvToRgb(point.color);
    colors[offset] = r / 255;
    colors[offset + 1] = g / 255;
    colors[offset + 2] = b / 255;
    sizes[index] = point.r;
    offset += 3;
  })

  geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  geometry.setAttribute( 'vertColor', new THREE.BufferAttribute( colors, 3 ) );
  geometry.setAttribute( 'vertSize', new THREE.BufferAttribute( sizes, 1 ) );
  geometry.computeBoundingBox();

  const material = new THREE.ShaderMaterial( {
    vertexShader: `
      attribute vec3 vertColor;
      attribute float vertSize;
      varying vec3 vCol;

      void main() {
        vCol = vertColor;
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = vertSize * ( 3.0 / -modelViewPosition.z );
        gl_Position = projectionMatrix * modelViewPosition; 
      }
    `,
    fragmentShader: `
      varying vec3 vCol;
      void main() {
        if(distance(gl_PointCoord.xy, vec2(.5, .5)) > 0.5) discard;
        gl_FragColor = vec4(vCol, 1.0);
      }
    `,
    // blending: THREE.AdditiveBlending,
    transparent: true,
    depthTest: true,
    depthWrite: true
  } );
  // 
	const cloud = new THREE.Points( geometry, material );

  scene.add(cloud);

  function animate() {
    requestAnimationFrame( animate );
    renderer3d.render( scene, camera );
  }
  animate();
  
  const img = document.createElement('img');
  img.src = 'https://s3.amazonaws.com/colorslive/jpg_512x512/4389168-xHhXcU4tVYKUOK_V.jpg';
  document.body.appendChild(img);
  img.style += 'position: fixed; top: 320px; right: 120px;'

});