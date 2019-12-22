import { DrwParser } from './DrwParser';
import { DrwRenderer } from './DrwRenderer';

// Test files sampled from Colors Gallery

// src: https://www.colorslive.com/details/4389509
// const url = 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw' // colorful anime

// src: https://www.colorslive.com/details/4390105
// const url = 'https://s3.amazonaws.com/colorslive/drw/4390105-xojlQqto9jkauFX3.drw' // girl

// src: https://www.colorslive.com/details/4390461
const url = 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw' // bunny

// src: https://www.colorslive.com/details/2185443
// const url = 'https://s3.amazonaws.com/colorslive/drw/2185443-Fg1frBlkOUkRwMxW.drw' // 3d landscape

DrwParser.loadfromUrl(url).then(drw => {

  const canvas = document.getElementById('drwResult') as HTMLCanvasElement;
  const renderer = new DrwRenderer(canvas, drw);

  // Try to draw the whole thing in one go, yolo
  for (let i = 0; i < drw.numCommands; i++) {
    renderer.handleCommand(i);
  }

  renderer.composite();
});