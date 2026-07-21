interface DisjointTimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly QUERY_RESULT_EXT: number;
  readonly QUERY_RESULT_AVAILABLE_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
  createQueryEXT(): WebGLQuery | null;
  deleteQueryEXT(query: WebGLQuery | null): void;
  beginQueryEXT(target: number, query: WebGLQuery): void;
  endQueryEXT(target: number): void;
  getQueryObjectEXT(query: WebGLQuery, pname: number): number | boolean;
}

const nextAnimationFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Asynchronous WebGL1 GPU timing. It never forces GPU/CPU synchronization. */
export class GpuTimer {
  private readonly extension: DisjointTimerQueryExtension | null;
  private readonly pending: WebGLQuery[] = [];
  private active = false;
  readonly durationsMs: number[] = [];
  discardedQueries = 0;

  constructor(private readonly gl: WebGLRenderingContext) {
    this.extension = gl.getExtension(
      "EXT_disjoint_timer_query"
    ) as unknown as DisjointTimerQueryExtension | null;
  }

  get supported() {
    return this.extension !== null;
  }

  begin() {
    const extension = this.extension;
    if (!extension || this.active) {
      return;
    }
    const query = extension.createQueryEXT();
    if (!query) {
      return;
    }
    extension.beginQueryEXT(extension.TIME_ELAPSED_EXT, query);
    this.pending.push(query);
    this.active = true;
  }

  end() {
    const extension = this.extension;
    if (!extension || !this.active) {
      return;
    }
    extension.endQueryEXT(extension.TIME_ELAPSED_EXT);
    this.active = false;
  }

  poll() {
    const extension = this.extension;
    if (!extension || this.pending.length === 0) {
      return;
    }
    if (this.gl.getParameter(extension.GPU_DISJOINT_EXT) === true) {
      this.discardedQueries += this.pending.length;
      for (const query of this.pending) {
        extension.deleteQueryEXT(query);
      }
      this.pending.length = 0;
      return;
    }

    while (this.pending.length > 0) {
      const query = this.pending[0];
      const available = extension.getQueryObjectEXT(
        query,
        extension.QUERY_RESULT_AVAILABLE_EXT
      );
      if (!available) {
        break;
      }
      const nanoseconds = Number(
        extension.getQueryObjectEXT(query, extension.QUERY_RESULT_EXT)
      );
      this.durationsMs.push(nanoseconds / 1_000_000);
      extension.deleteQueryEXT(query);
      this.pending.shift();
    }
  }

  async drain(maxFrames = 120) {
    this.end();
    for (let frame = 0; frame < maxFrames && this.pending.length > 0; frame++) {
      this.poll();
      if (this.pending.length > 0) {
        await nextAnimationFrame();
      }
    }
    this.poll();
  }

  get pendingQueries() {
    return this.pending.length;
  }
}

export const supportsGpuTimer = (gl: WebGLRenderingContext) =>
  gl.getExtension("EXT_disjoint_timer_query") !== null;
