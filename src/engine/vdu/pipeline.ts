/**
 * The renderer's single shader program together with the resolved locations of
 * its four bindings. VDU owns one of these for the lifetime of the context.
 */
export interface Pipeline {
  program: WebGLProgram;
  /** Attribute location for `aVertexPosition` (2 floats per vertex). */
  aVertexPosition: number;
  /** Uniform location for `uResolution` (vec2, drawing-buffer pixels). */
  uResolution: WebGLUniformLocation;
  /** Uniform location for `uMatrix` (mat3, model → clip-space transform). */
  uMatrix: WebGLUniformLocation;
  /** Uniform location for `uColor` (vec4 RGBA in the 0–1 range). */
  uColor: WebGLUniformLocation;
}

/**
 * The instanced-draw shader program. Geometry comes from a shared mesh buffer
 * while the transform and color are per-instance vertex attributes (advanced
 * once per instance via `ANGLE_instanced_arrays`), letting a whole run of
 * same-mesh entities draw in one call.
 */
export interface InstancedPipeline {
  program: WebGLProgram;
  /** Attribute location for `aVertexPosition` (2 floats per vertex). */
  aVertexPosition: number;
  /** Per-instance attribute: first output row of the affine matrix (vec3). */
  aMatX: number;
  /** Per-instance attribute: second output row of the affine matrix (vec3). */
  aMatY: number;
  /** Per-instance attribute: `aColor` (vec4 RGBA in the 0–1 range). */
  aColor: number;
  /** Uniform location for `uResolution` (vec2, drawing-buffer pixels). */
  uResolution: WebGLUniformLocation;
}

/**
 * Compiles a single shader stage.
 * @param gl the WebGL1 rendering context
 * @param type `gl.VERTEX_SHADER` or `gl.FRAGMENT_SHADER`
 * @param source GLSL source for the stage
 * @returns the compiled shader
 * @throws if the shader cannot be created or fails to compile
 */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Failed to compile shader: ${log}`);
  }
  return shader;
}

/**
 * Resolves a required uniform location, failing loudly when it is absent (the
 * uniform was renamed or optimised out).
 * @param gl the WebGL1 rendering context
 * @param program the linked program to query
 * @param name the uniform name declared in the shader
 * @returns the uniform's location
 * @throws if the uniform is not active in the program
 */
function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (location === null) {
    throw new Error(`Missing uniform location: ${name}`);
  }
  return location;
}

/**
 * Compiles and links a vertex/fragment pair into a program, binding the given
 * attribute names to fixed locations before linking so the draw loop can rely
 * on stable slot indices.
 * @param gl the WebGL1 rendering context
 * @param vertexSource vertex shader GLSL source
 * @param fragmentSource fragment shader GLSL source
 * @param attributeLocations attribute-name → location bindings applied pre-link
 * @returns the linked program
 * @throws if compilation or linking fails
 */
function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attributeLocations: Record<string, number>
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shader program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  for (const [name, location] of Object.entries(attributeLocations)) {
    gl.bindAttribLocation(program, location, name);
  }
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link shader program: ${log}`);
  }

  return program;
}

/**
 * Compiles, links, and introspects this renderer's one shader pair into a
 * ready-to-use {@link Pipeline}. Locations are resolved once here so the draw
 * loop can issue direct `gl.uniform*` / `gl.vertexAttribPointer` calls.
 * @param gl the WebGL1 rendering context
 * @param vertexSource vertex shader GLSL source
 * @param fragmentSource fragment shader GLSL source
 * @returns the linked pipeline with all four binding locations resolved
 * @throws if compilation, linking, or location lookup fails
 */
export function createPipeline(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): Pipeline {
  const program = createProgram(gl, vertexSource, fragmentSource, {
    aVertexPosition: 0,
  });

  return {
    program,
    aVertexPosition: gl.getAttribLocation(program, "aVertexPosition"),
    uResolution: requireUniform(gl, program, "uResolution"),
    uMatrix: requireUniform(gl, program, "uMatrix"),
    uColor: requireUniform(gl, program, "uColor"),
  };
}

/**
 * Compiles and links the instanced-draw shader pair into an
 * {@link InstancedPipeline}. The per-instance attributes are bound to fixed,
 * contiguous locations so VDU can enable them and set their divisors once.
 * @param gl the WebGL1 rendering context
 * @param vertexSource instanced vertex shader GLSL source
 * @param fragmentSource instanced fragment shader GLSL source
 * @returns the linked instanced pipeline with all binding locations resolved
 * @throws if compilation, linking, or uniform lookup fails
 */
export function createInstancedPipeline(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): InstancedPipeline {
  const locations = { aVertexPosition: 0, aMatX: 1, aMatY: 2, aColor: 3 };
  const program = createProgram(gl, vertexSource, fragmentSource, locations);

  return {
    program,
    aVertexPosition: locations.aVertexPosition,
    aMatX: locations.aMatX,
    aMatY: locations.aMatY,
    aColor: locations.aColor,
    uResolution: requireUniform(gl, program, "uResolution"),
  };
}
