attribute vec2 aVertexPosition;

uniform vec2 uResolution;
uniform vec2 uTranslation;
uniform vec2 uRotation;

void main(void) {

  // TODO: Centralize updates into a single matrix
  // Rotate the position
  vec2 rotatedPosition = vec2(
    aVertexPosition.x * uRotation.y + aVertexPosition.y * uRotation.x,
    aVertexPosition.y * uRotation.y - aVertexPosition.x * uRotation.x
  );

  // Add in the translation
  vec2 position = rotatedPosition + uTranslation;

  // convert the position from pixels to 0.0 to 1.0
  vec2 zeroToOne = position / uResolution;

  // convert from 0->1 to 0->2
  vec2 zeroToTwo = zeroToOne * 2.0;

  // convert from 0->2 to -1->+1 (clipspace)
  vec2 clipSpace = zeroToTwo - 1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}