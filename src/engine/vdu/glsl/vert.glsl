attribute vec2 aVertexPosition;

uniform vec2 uResolution;
uniform mat3 uMatrix;

void main(void) {
  // Multiply the position by the matrix.
  vec2 position = (uMatrix * vec3(aVertexPosition, 1)).xy;

  // convert the position from pixels to 0.0 to 1.0
  vec2 zeroToOne = position / uResolution;

  // convert from 0->1 to 0->2
  vec2 zeroToTwo = zeroToOne * 2.0;

  // convert from 0->2 to -1->+1 (clipspace)
  vec2 clipSpace = zeroToTwo - 1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
}