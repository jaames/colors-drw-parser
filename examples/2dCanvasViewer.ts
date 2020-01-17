import { DrwParser } from '../src/parser';
import { DrwCanvasRenderer } from '../src/renderer';

// Test files sampled from Colors Gallery

// src: https://www.colorslive.com/details/4389509
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw' //  colorful anime

// src: https://www.colorslive.com/details/4353728
// const url = 'https://s3.amazonaws.com/colorslive/drw/4353728-4feMXuTh7ESaAjXX.drw' // zelda

// src: https://www.colorslive.com/details/4390483
// const url = `https://s3.amazonaws.com/colorslive/drw/4390483-KAeEuqcsTguD1rOH.drw` // fallout

// src: https://www.colorslive.com/details/4390461
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw' // bunny

// src: https://www.colorslive.com/details/4389168
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389168-xHhXcU4tVYKUOK_V.drw' // village

const url = 'https://s3.amazonaws.com/colorslive/drw/4394769-h0CoC5Slq3Y7Qf4r.drw'

// Local debugging files

// import url from './demofiles/layers.drw';
DrwParser.loadFromUrl(url)
.then(drw => new DrwCanvasRenderer(drw))
.then(renderer => renderer.prepare())
.then(renderer => {
  const ctx = document.createElement('canvas').getContext('2d');
  const canvas = ctx.canvas;

  renderer.setCanvasWidth(512);
  canvas.height = renderer.height;
  canvas.width = renderer.width;

  const m1 = performance.now();

  renderer.onUpdate(() => {
    // Draw the result to the main canvas
    renderer.blitTo(ctx);
  });

  renderer.seekEnd();

  const m2 = performance.now();

  console.log('render time:', m2 - m1)

  document.body.appendChild(canvas);
  (<any>window).renderer = renderer; // make global for easy debugging
});

