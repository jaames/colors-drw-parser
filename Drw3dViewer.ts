import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DrwRenderer } from './DrwRenderer';
import { DrwParser } from './DrwParser';

// src: https://www.colorslive.com/details/4389509
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw' // colorful anime

// src: https://www.colorslive.com/details/4353728
// const url = 'https://s3.amazonaws.com/colorslive/drw/4353728-4feMXuTh7ESaAjXX.drw' // zelda

// src: https://www.colorslive.com/details/4390483
// const url = `https://s3.amazonaws.com/colorslive/drw/4390483-KAeEuqcsTguD1rOH.drw` // fallout

// src: https://www.colorslive.com/details/4390461
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw' // bunny

// src: https://www.colorslive.com/details/4389168
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389168-xHhXcU4tVYKUOK_V.drw' // village

// src: https://www.colorslive.com/details/1631771
const url = `https://s3.amazonaws.com/colorslive/drw/1631771---ydOwTWZn1N2Wgb.drw` // bulbasaur

DrwParser.loadFromUrl(url)
.then(drw => new DrwRenderer(drw))
.then(painter => painter.prepare())
.then(painter => {
  painter.setCanvasWidth(960);

  painter.seekCommand(0);
  painter.playbackState.commandsPerUpdate = 500;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 10000 );
  camera.near = 0.0001;
  camera.position.z = 5;

  const renderer3d = new THREE.WebGLRenderer();
  renderer3d.setClearColor( 0xffffff )
  renderer3d.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer3d.domElement );

  const controls = new OrbitControls( camera, renderer3d.domElement );
  controls.enableKeys = true;
  controls.zoomSpeed = 0.1
  controls.keyPanSpeed = 10;

  const planeWidth = 1.5;
  const planeHeight = planeWidth / painter.drw.header.aspectRatio;

  const layerTextures = painter.layers.map(layer => {
    const tex = new THREE.CanvasTexture(layer.canvas);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  })

  const materials = painter.layers.map((layer, index) => { 
    return new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      map: layerTextures[index],
      transparent: true
    });
  });

  const planes = painter.layers.forEach((layer, index) => {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), materials[index]);
    plane.position.z = (-index * 0.5) + ((painter.layers.length - 1) * 0.25);
    plane.scale.x = 1 + (index * 0.1);
    plane.scale.y = 1 + (index * 0.1);
    scene.add(plane);
    return plane;
  });

  function animate() {
    requestAnimationFrame( animate );
    renderer3d.render( scene, camera );
  }
  animate();

  painter.play();

  painter.onUpdate(() => {
    painter.layers.forEach((layer, layerIndex) => {
      if (layer.hasChanged) {
        layerTextures[layerIndex].image = layer.canvas;
        layerTextures[layerIndex].needsUpdate = true;
      }
      layer.hasChanged = false;
    })
  })

});