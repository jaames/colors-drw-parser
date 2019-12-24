# colors-drw-parser
 
An experimental parser and renderer for the .drw image format used by [Colors](http://colorslive.com/); a painting application for Nintendo 3DS, iOS, Android and PlayStation Vita.

The .drw format is quite interesting in that it doesn't store pixel data whatsoever, instead it records all of the user's input (brushstrokes, color changes, canvas flips, etc) which can then be replayed in order to construct the final image. This approach means you can watch the artist's technique as they work, and also that paintings are essentially resolution-independent like a vector image. However, the drawback is that it's extremely difficult to display .drw files in places where Colors' painting engine isn't available.

So of course... I wanted to try :P

## Status

* Fully functional .drw file parser on par with Colors versions 1100-1299. I've only tested it with 3DS and iOS paintings so far but it should(?) support other versions.
* Mostly complete (~95%) .drw renderer using the HTML5 canvas API. It's extremely slow and doesn't quite implement blending properly, but it works well enough for debugging purposes.

## Showcase

| Colors Render (target) | DrwRenderer.ts (result) |
|--|--|
| [Painting by Lynarc](https://www.colorslive.com/details/4353728) |
| ![Zelda painting target](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4353728_target.png) | ![Zelda painting result](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4353728_result.png) |
| [Painting by -renge-](https://www.colorslive.com/details/4389509) |
| ![Anime painting target](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4389509_target.png) | ![Anime painting result](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4389509_result.png) |
| [Painting by M.Collins](https://www.colorslive.com/details/4390483) |
| ![Fallout painting target](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4390483_target.png) | ![Fallout painting result](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4390483_result.png) |
| [Painting by acchan](https://www.colorslive.com/details/4389168) |
| ![Village painting target](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4389168_target.png) | ![Village painting result](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4389168_result.png) |
| [Painting by Greeso](https://www.colorslive.com/details/4390461) |
| ![Bunny painting target](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4390461_target.png) | ![Bunny painting result](https://raw.githubusercontent.com/jaames/colors-drw-parser/master/showcase/4390461_result.png) |




## Todo

* webGL renderer - necessary for perfomance, but tricky since webGL doesnt support some of the features that Colors uses for stroke blending.
* Animated + seekable drawing playback.
* `BRUSHCONTROL_FULL`, `BRUSHCONTROL_VARIABLESIZE`, `BRUSHCONTROL_VARIABLESIZEOPACITY`, `BRUSHCONTROL_DISTANCEOPACITY` brush control types. I don't know exactly what these do or how they work.

## Longer Term Goals

This is mostly just a fun weekend project for me. That said, I think it would be neat to make a 3D painting visualizer where you can view the painting layers in 3D space while the image is replayed... and it would be even neater to hook that up to a pair of VR goggles. :^)

## Credits
* [James Daniel](https://github.com/jaames) - Implementation
* [Jens Andersson](http://collectingsmiles.com/) - Colors dev, was kind enough to provide [documentation](https://www.dropbox.com/s/fmjptpshi93bojp/DRW%20Format%201200.docx?dl=0), as well as the actual brush textures used in the Colors app (thanks again!)
