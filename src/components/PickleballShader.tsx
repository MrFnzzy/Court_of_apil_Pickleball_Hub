"use client";

import { useEffect, useRef } from "react";

export default function PickleballShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
    if (!gl) return;

    const vertexSource = `attribute vec2 position; void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;
    const fragmentSource = `precision mediump float;
      uniform vec2 resolution; uniform float time; uniform vec2 pointer;
      float line(float value, float width){ return 1.0 - smoothstep(width, width + 0.006, abs(value)); }
      void main(){
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = uv * 2.0 - 1.0; p.x *= resolution.x / resolution.y;
        float drift = time * 0.035;
        float glow = 0.0;
        glow += 0.16 / (1.0 + 7.0 * length(p - vec2(sin(drift) * 0.55, 0.18)));
        glow += 0.12 / (1.0 + 8.0 * length(p - vec2(-0.55, cos(drift * 1.4) * 0.4)));
        float court = line(p.x, 0.28) * 0.22 + line(p.y, 0.54) * 0.22;
        court += line(abs(p.x) - 0.42, 0.18) * 0.18;
        court += line(abs(p.y) - 0.1, 0.2) * 0.14;
        float ball = smoothstep(0.08, 0.0, length(p - vec2(sin(time * 0.45) * 0.32 + pointer.x * 0.08, 0.28 + cos(time * 0.55) * 0.12)));
        vec3 base = vec3(0.035, 0.12, 0.15);
        vec3 cyan = vec3(0.12, 0.65, 0.78);
        vec3 orange = vec3(0.95, 0.26, 0.12);
        vec3 color = base + cyan * (glow + court * 0.42) + orange * ball * 0.75;
        float vignette = smoothstep(1.25, 0.15, length(p));
        gl_FragColor = vec4(color * vignette, 0.28 * vignette);
      }`;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const timeLocation = gl.getUniformLocation(program, "time");
    const resolutionLocation = gl.getUniformLocation(program, "resolution");
    const pointerLocation = gl.getUniformLocation(program, "pointer");
    let frame = 0; let pointerX = 0; let pointerY = 0;
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; gl.viewport(0, 0, canvas.width, canvas.height); };
    const move = (event: PointerEvent) => { pointerX = event.clientX / window.innerWidth * 2 - 1; pointerY = 1 - event.clientY / window.innerHeight * 2; };
    const render = (now: number) => { gl.uniform1f(timeLocation, now * 0.001); gl.uniform2f(resolutionLocation, canvas.width, canvas.height); gl.uniform2f(pointerLocation, pointerX, pointerY); gl.drawArrays(gl.TRIANGLES, 0, 6); if (!reduceMotion) frame = requestAnimationFrame(render); };
    resize(); window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); render(0);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); };
  }, []);

  return <canvas ref={canvasRef} className="pickleball-shader" aria-hidden="true" />;
}
