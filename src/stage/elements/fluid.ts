/**
 * Fluid: the Living Canvas (stable fluids + sparks + aura, its material from the
 * character engine) as a stage element. It renders on its own offscreen canvas
 * (its own context and post) on music time, and its finished frame is uploaded
 * into the stage as a texture (sRGB values, linearized when composited), composited as a full-screen layer after the
 * feedback (it has its own trails; feeding it back again would only smear it).
 *
 * In silence (musicDt = 0) it is not rendered at all and the last upload stays:
 * the Living Canvas would still crawl a little (its dt has a floor) and its grain
 * changes every render. Pointer painting is the exception: it runs on wall time.
 */
import { LivingCanvas } from '../../visual/living/living';
import { clamp01, fin } from '../gl';
import { defineWidget } from '../kit';
import type { CastMember, StageElement, StageFrame, StageShared } from '../types';

export const widget = defineWidget({
  type: 'fluid',
  styles: [{ name: 'living', doc: 'the Living Canvas' }],
  knobs: [],
  follows: 'the overall character: the Living Canvas (fluid, sparks, aura), its material set by the mood',
  use: 'atmosphere, turbulence, a full-screen bed; heavy and stormy music',
  layer: 80,
  create: (): StageElement => new Fluid(),
});

export class Fluid implements StageElement {
  readonly type = 'fluid' as const;
  private gl!: WebGL2RenderingContext;
  private shared!: StageShared;
  private living: LivingCanvas | null = null;
  private tex: WebGLTexture | null = null;
  private uploaded = false;

  init(gl: WebGL2RenderingContext, shared: StageShared) {
    this.gl = gl;
    this.shared = shared;
    try {
      this.living = new LivingCanvas(document.createElement('canvas'), {
        level: shared.fluidLevel, seed: Math.floor(shared.rand() * 1e6),
      });
    } catch (e) {
      console.warn('[stage] fluid unavailable:', e);
      this.living = null;
    }
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  draw(fr: StageFrame, member: CastMember) {
    const living = this.living;
    if (!living || !this.tex) return;
    const painting = !!fr.pointer?.down;
    const dt = fr.musicDt > 0 ? fr.musicDt : painting ? fin(fr.dt) : 0;
    if (dt > 0) {
      living.render({
        dt, time: fr.clock.time, features: fr.f, descriptors: fr.d, character: fr.character, material: fr.material,
        gesture: fr.gesture, events: this.shared.ink.length ? fr.events.concat(this.shared.ink) : fr.events, pointer: fr.pointer,
      });
      // Upload in the same task: the Living Canvas doesn't preserve its drawing buffer. Plain RGBA keeps
      // Chrome's GPU-to-GPU copy; an SRGB8_ALPHA8 target falls back to a CPU readback (~23 ms at 1080p).
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, living.canvas);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      this.uploaded = true;
    }
    // Default intensity (0.7) is the canvas as designed; more cannot brighten a finished image.
    const gain = member.presence * clamp01(member.spec.params.intensity / 0.7);
    if (this.uploaded && gain > 0.002) this.shared.layers.push({ tex: this.tex, gain });
  }

  dispose() {
    if (this.living) {
      const gl = this.living.gl;
      this.living.dispose();
      // Free the second context now: browsers cap live contexts and evict the oldest (maybe the stage's).
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      this.living = null;
    }
    if (this.tex) this.gl.deleteTexture(this.tex);
    this.tex = null;
  }
}
