import { DrwParser } from './DrwParser';
import { DrwRenderer } from './DrwRenderer';

// Test files sampled from Colors Gallery

// src: https://www.colorslive.com/details/4389509
const url = 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw' // colorful anime

// src: https://www.colorslive.com/details/4390105
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390105-xojlQqto9jkauFX3.drw' // girl

// src: https://www.colorslive.com/details/4390483
// const url = `https://s3.amazonaws.com/colorslive/drw/4390483-KAeEuqcsTguD1rOH.drw` // fallout

// src: https://www.colorslive.com/details/4390461
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw' // bunny

// src: https://www.colorslive.com/details/4389168
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389168-xHhXcU4tVYKUOK_V.drw' // village

// Local debugging files

// import url from './demofiles/layers.drw';

DrwParser.loadFromUrl(url)
.then(drw => new DrwRenderer(drw))
.then(renderer => renderer.prepare())
.then(renderer => {
  window['renderer'] = renderer; // make global for easy debugging 

  const canvas = document.getElementById('drwResult') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');

  renderer.setCanvasWidth(640);
  canvas.height = renderer.height;
  canvas.width = renderer.width;

  const mark0 = performance.now();

  // Try to draw the whole thing in one go, yolo
  for (let i = 0; i < renderer.drw.numCommands; i++) {
    renderer.handleCommand(i);
  }

  const mark1 = performance.now();

  console.log('render time:', mark1 - mark0);

  // Draw the result to the main canvas
  renderer.blitTo(ctx);
});