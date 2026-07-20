/*
 * Functions altered from the original source:
 * Source: https://webglfundamentals.org/webgl/resources/webgl-utils.js
 *
 * The original source is licensed under the following terms:
 *
 * Copyright 2021 GFXFundamentals.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of GFXFundamentals. nor the names of his
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

export type Attribute = {
  attributeType: "buffer";

  buffer: WebGLBuffer;
  size: number;
  type?: number;
  normalize?: boolean;
  stride?: number;
  offset?: number;
};

export type AttributeSetters = Record<string, (b: Attribute) => void>;

export type Uniform = Float32Array | number[];

export type UniformSetters = Record<string, (v: Uniform) => void>;

export type ProgramInfo = {
  program: WebGLProgram;
  attributeSetters: AttributeSetters;
  uniformSetters: UniformSetters;
};

export type BufferInfo = {
  numElements: number;
  attributes: Record<string, Attribute>;
};

/**
 * Initialize a shader program
 * @param gl a WebGLRenderingContext
 * @param vsSource a vertex shader source
 * @param fsSource a fragment shader source
 * @returns a WebGLProgram
 */
export function initShaderProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    throw new Error("Failed to load shaders");
  }

  const shaderProgram = gl.createProgram();
  if (!shaderProgram) {
    throw new Error("Failed to create shader program");
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      `Unable to initialize the shader program: ${gl.getProgramInfoLog(
        shaderProgram
      )}`
    );
    return null;
  }

  return shaderProgram;
}

/**
 * Load a shader
 * @param gl a WebGLRenderingContext
 * @param type a type of shader
 * @param source a shader source
 * @returns a WebGLShader
 */
function loadShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(
      `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * Create a set of attribute setters for a program
 * @param gl a WebGLRenderingContext
 * @param program a WebGLProgram
 */
export function createAttributeSetters(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): AttributeSetters {
  /**
   * Create a setter for an attribute
   * @param index index of the attribute
   * @returns a function that sets the attribute
   */
  const createAttribSetter = (index: number) => {
    return (b: Attribute) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
      gl.enableVertexAttribArray(index);
      gl.vertexAttribPointer(
        index,
        b.size,
        b.type || gl.FLOAT,
        b.normalize || false,
        b.stride || 0,
        b.offset || 0
      );
    };
  };

  const attribSetters: Record<string, (b: Attribute) => void> = {};

  const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < numAttribs; i++) {
    const attribInfo = gl.getActiveAttrib(program, i);
    if (!attribInfo) {
      break;
    }
    const index = gl.getAttribLocation(program, attribInfo.name);
    attribSetters[attribInfo.name] = createAttribSetter(index);
  }

  return attribSetters;
}

// TODO: Verify the type of UniformInfo
type UniformInfo = {
  name: string;
  size: number;
  type: number;
};

/**
 * Create a set of uniform setters for a program
 * @param gl a WebGLRenderingContext
 * @param program a WebGLProgram
 */
export function createUniformSetters(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): UniformSetters {
  const createUniformSetter = (
    program: WebGLProgram,
    uniformInfo: UniformInfo
  ) => {
    const location = gl.getUniformLocation(program, uniformInfo.name);
    const type = uniformInfo.type;

    if (type === gl.FLOAT) {
      return (v: GLfloat) => {
        gl.uniform1f(location, v);
      };
    }
    if (type === gl.FLOAT_VEC2) {
      return (v: [GLfloat, GLfloat]) => {
        gl.uniform2fv(location, v);
      };
    }
    if (type === gl.FLOAT_VEC3) {
      return (v: [GLfloat, GLfloat, GLfloat]) => {
        gl.uniform3fv(location, v);
      };
    }
    if (type === gl.FLOAT_VEC4) {
      return (v: [GLfloat, GLfloat, GLfloat, GLfloat]) => {
        gl.uniform4fv(location, v);
      };
    }
    if (type === gl.FLOAT_MAT3) {
      return (
        v: [
          GLfloat,
          GLfloat,
          GLfloat,
          GLfloat,
          GLfloat,
          GLfloat,
          GLfloat,
          GLfloat,
        ]
      ) => {
        gl.uniformMatrix3fv(location, false, v);
      };
    }
    throw "unknown type: 0x" + type.toString(16); // we should never get here.
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniformSetters: Record<string, (v: any) => void> = {};
  const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

  for (let i = 0; i < numUniforms; i++) {
    const uniformInfo = gl.getActiveUniform(program, i);
    if (!uniformInfo) {
      break;
    }
    let name = uniformInfo.name;

    // remove the array suffix.
    if (name.slice(-3) === "[0]") {
      name = name.slice(0, name.length - 3);
    }
    const setter = createUniformSetter(program, uniformInfo);
    uniformSetters[name] = setter;
  }

  return uniformSetters;
}

/**
 * Set Attributes for a program
 * @param setters a set of attribute setters
 * @param attributes a set of attributes
 */
export function setAttributes(
  setters: AttributeSetters,
  attributes: Record<string, Attribute>
) {
  Object.keys(attributes).forEach((name) => {
    const setter = setters[name];
    if (setter) {
      setter(attributes[name]);
    }
  });
}

/**
 * Set Uniforms for a program
 * @param setters a set of uniform setters
 * @param uniforms a set of uniforms
 */
export function setUniforms(
  setters: UniformSetters,
  uniforms: Record<string, Uniform>
) {
  Object.keys(uniforms).forEach((name) => {
    const setter = setters[name];
    if (setter) {
      setter(uniforms[name]);
    }
  });
}

/**
 * Resize a canvas to match the size it is displayed
 * @param canvas an HTML5 canvas element
 * @param multiplier amount to multiply by
 * @returns true if the canvas was resized, false otherwise
 */
export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  multiplier = 1
) {
  const width = Math.round(canvas.clientWidth * multiplier);
  const height = Math.round(canvas.clientHeight * multiplier);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    return true;
  }
  return false;
}
