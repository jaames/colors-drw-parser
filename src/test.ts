import Colors from './index';
import { DrwParser, DrwCanvasRenderer, DrwPixelRenderer } from './index';

const TEST_IMAGES = {
  'voyager': '4341327-dhdAP4wQrMzHgbyD',
  'anime': '4389509-GIl9DEC1z9V6g3W7',
  'zelda': '4353728-4feMXuTh7ESaAjXX',
  'fallout': '4390483-KAeEuqcsTguD1rOH',
  'bunny': '4390461-2kkylw9MMz3bBhq5',
  'village': '4389168-xHhXcU4tVYKUOK_V'
};

document.body.style.display = 'flex';

const debugUi = document.createElement('div');
debugUi.innerHTML += 'Load painting: <br/>';
document.body.appendChild(debugUi);

const renderResult = document.createElement('div');
const renderTarget = document.createElement('div');
const outputCtx = document.createElement('canvas').getContext('2d');
outputCtx.canvas.style.display = 'block';
renderResult.innerHTML += 'Render result:</br>';
renderResult.appendChild(outputCtx.canvas);

const outputImg = new Image();
renderTarget.innerHTML += 'Target result:</br>';
renderTarget.appendChild(outputImg);

renderResult.style.flex = '1';
renderTarget.style.flex = '1';
document.body.appendChild(renderResult);
document.body.appendChild(renderTarget);

function loadDrw(key: string) {

  const drwUrl = `https://s3.amazonaws.com/colorslive/drw/${ key }.drw`;
  const pngUrl = `https://s3.amazonaws.com/colorslive/jpg_512x512/${ key }.jpg`;

  status.innerText = 'Loading painting...';

  outputImg.src = pngUrl;

  DrwParser.loadFromUrl(drwUrl)
  .then(drw => new DrwPixelRenderer(drw))
  // .then(renderer => renderer.prepare())
  .then(renderer => {
    renderer.setSize(512);
    outputCtx.canvas.height = renderer.height;
    outputCtx.canvas.width = renderer.width;

    const m1 = performance.now();
    // renderer.brushTest();
    // const m2 = performance.now();
  
  
    renderer.render();
    // Draw the result to the main canvas
    renderer.blitTo(outputCtx);
  
    const m2 = performance.now();
  
    console.log('render time:', m2 - m1);

    status.innerText = 'Render complete';
  
    (window as any).renderer = renderer; // make global for easy debugging
  });
}

(window as any).loadDrw = loadDrw;

const ul = document.createElement('ul');
debugUi.appendChild(ul);

const status = document.createElement('span');
debugUi.appendChild(status);

Object.entries(TEST_IMAGES).forEach(([name, key]) => {
  const li = document.createElement('li');
  const anchor = document.createElement('a');
  anchor.textContent = name;
  anchor.href = `javascript:console.log('----------'); console.log('loading ${ name } as ${ key }'); loadDrw('${ key }');`
  li.appendChild(anchor);
  ul.appendChild(li);
});


export default Colors;