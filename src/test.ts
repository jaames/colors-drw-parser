import Colors from './index';
import { DrwParser, DrwCanvasRenderer } from './index';

const TEST_URLS = {
  'anime': 'https://s3.amazonaws.com/colorslive/drw/4389509-GIl9DEC1z9V6g3W7.drw',
  'zelda': 'https://s3.amazonaws.com/colorslive/drw/4353728-4feMXuTh7ESaAjXX.drw',
  'fallout': 'https://s3.amazonaws.com/colorslive/drw/4390483-KAeEuqcsTguD1rOH.drw',
  'bunny': 'https://s3.amazonaws.com/colorslive/drw/4390461-2kkylw9MMz3bBhq5.drw',
  'village': 'https://s3.amazonaws.com/colorslive/drw/4389168-xHhXcU4tVYKUOK_V.drw'
};

const outputCtx = document.createElement('canvas').getContext('2d');
document.body.appendChild(outputCtx.canvas);

function loadDrw(url: string) {

  status.innerText = 'Loading painting...';

  DrwParser.loadFromUrl(url)
  .then(drw => new DrwCanvasRenderer(drw))
  .then(renderer => renderer.prepare())
  .then(renderer => {
    renderer.setCanvasWidth(512);
    outputCtx.canvas.height = renderer.height;
    outputCtx.canvas.width = renderer.width;
  
    const m1 = performance.now();
  
    renderer.onUpdate(() => {
      // Draw the result to the main canvas
      renderer.blitTo(outputCtx);
    });
  
    renderer.seekEnd();
  
    const m2 = performance.now();
  
    console.log('render time:', m2 - m1);

    status.innerText = 'Render complete';
  
    (window as any).renderer = renderer; // make global for easy debugging
  });
}

(window as any).loadDrw = loadDrw;

const debugUi = document.createElement('div');
debugUi.innerHTML += 'Load painting: <br/>';
document.body.appendChild(debugUi);

const ul = document.createElement('ul');
debugUi.appendChild(ul);

const status = document.createElement('span');
debugUi.appendChild(status);

Object.entries(TEST_URLS).forEach(([name, url]) => {
  const li = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.textContent = name;
  anchor.href = `javascript:console.log('----------'); console.log('loading ${ name } from ${ url }'); loadDrw('${ url }');`
  li.appendChild(anchor);
  ul.appendChild(li);
});


export default Colors;