import type { GlAuditResult } from "../shared/types";

const byteLengthOf = (value: number | AllowSharedBufferSource | null) => {
  if (typeof value === "number") {
    return value;
  }
  return value?.byteLength ?? 0;
};

/**
 * Audits one render by temporarily wrapping GL entry points. This is kept
 * separate from timed runs so wrapper overhead cannot bias renderer timings.
 */
export const auditWebGlFrame = async (
  canvas: HTMLCanvasElement,
  render: () => void
): Promise<GlAuditResult> => {
  const gl = canvas.getContext("webgl");
  if (!gl) {
    throw new Error("Benchmark canvas has no WebGL context");
  }
  const instanced = gl.getExtension("ANGLE_instanced_arrays");
  const counters: GlAuditResult = {
    totalDrawCalls: 0,
    drawArrays: 0,
    drawArraysInstanced: 0,
    totalInstancesSubmitted: 0,
    instanceCounts: [],
    averageBatchSize: 0,
    maxBatchSize: 0,
    uniformMatrix3fv: 0,
    uniform4fv: 0,
    uniform2f: 0,
    bindBuffer: 0,
    vertexAttribPointer: 0,
    bufferData: 0,
    bufferDataBytes: 0,
    bufferSubData: 0,
    bufferSubDataBytes: 0,
    useProgram: 0,
    clear: 0,
  };

  const drawArrays = gl.drawArrays.bind(gl);
  const uniformMatrix3fv = gl.uniformMatrix3fv.bind(gl);
  const uniform4fv = gl.uniform4fv.bind(gl);
  const uniform2f = gl.uniform2f.bind(gl);
  const bindBuffer = gl.bindBuffer.bind(gl);
  const vertexAttribPointer = gl.vertexAttribPointer.bind(gl);
  const bufferData = gl.bufferData.bind(gl);
  const bufferSubData = gl.bufferSubData.bind(gl);
  const useProgram = gl.useProgram.bind(gl);
  const clear = gl.clear.bind(gl);
  const drawArraysInstanced =
    instanced?.drawArraysInstancedANGLE.bind(instanced);

  gl.drawArrays = (mode, first, count) => {
    counters.drawArrays++;
    counters.totalDrawCalls++;
    drawArrays(mode, first, count);
  };
  gl.uniformMatrix3fv = (location, transpose, value) => {
    counters.uniformMatrix3fv++;
    uniformMatrix3fv(location, transpose, value);
  };
  gl.uniform4fv = (location, value) => {
    counters.uniform4fv++;
    uniform4fv(location, value);
  };
  gl.uniform2f = (location, x, y) => {
    counters.uniform2f++;
    uniform2f(location, x, y);
  };
  gl.bindBuffer = (target, buffer) => {
    counters.bindBuffer++;
    bindBuffer(target, buffer);
  };
  gl.vertexAttribPointer = (index, size, type, normalized, stride, offset) => {
    counters.vertexAttribPointer++;
    vertexAttribPointer(index, size, type, normalized, stride, offset);
  };
  gl.bufferData = (target, data, usage) => {
    counters.bufferData++;
    counters.bufferDataBytes += byteLengthOf(data);
    if (typeof data === "number") {
      bufferData(target, data, usage);
    } else {
      bufferData(target, data, usage);
    }
  };
  gl.bufferSubData = (target, offset, data) => {
    counters.bufferSubData++;
    counters.bufferSubDataBytes += data.byteLength;
    bufferSubData(target, offset, data);
  };
  gl.useProgram = (program) => {
    counters.useProgram++;
    useProgram(program);
  };
  gl.clear = (mask) => {
    counters.clear++;
    clear(mask);
  };
  if (instanced && drawArraysInstanced) {
    instanced.drawArraysInstancedANGLE = (mode, first, count, instances) => {
      counters.drawArraysInstanced++;
      counters.totalDrawCalls++;
      counters.totalInstancesSubmitted += instances;
      counters.instanceCounts.push(instances);
      drawArraysInstanced(mode, first, count, instances);
    };
  }

  try {
    // Keep an async boundary in the API so the runner can treat all audits alike.
    render();
    await Promise.resolve();
  } finally {
    gl.drawArrays = drawArrays;
    gl.uniformMatrix3fv = uniformMatrix3fv;
    gl.uniform4fv = uniform4fv;
    gl.uniform2f = uniform2f;
    gl.bindBuffer = bindBuffer;
    gl.vertexAttribPointer = vertexAttribPointer;
    gl.bufferData = bufferData;
    gl.bufferSubData = bufferSubData;
    gl.useProgram = useProgram;
    gl.clear = clear;
    if (instanced && drawArraysInstanced) {
      instanced.drawArraysInstancedANGLE = drawArraysInstanced;
    }
  }

  counters.averageBatchSize = counters.drawArraysInstanced
    ? counters.totalInstancesSubmitted / counters.drawArraysInstanced
    : 0;
  counters.maxBatchSize = counters.instanceCounts.length
    ? Math.max(...counters.instanceCounts)
    : 0;
  return counters;
};
