attribute vec2 aVertexPosition;
// Per-instance model->clip transform, packed as the two output rows of the
// affine mat3 (the third row is always [0, 0, 1] and is not needed).
attribute vec3 aMatX;
attribute vec3 aMatY;
attribute vec4 aColor;

uniform vec2 uResolution;

varying vec4 vColor;

void main(void) {
  // Apply the per-instance matrix to the shared mesh vertex.
  vec3 p = vec3(aVertexPosition, 1.0);
  vec2 position = vec2(dot(aMatX, p), dot(aMatY, p));

  // convert the position from pixels to clipspace
  vec2 zeroToOne = position / uResolution;
  vec2 clipSpace = zeroToOne * 2.0 - 1.0;

  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  vColor = aColor;
}
