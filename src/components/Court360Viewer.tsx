"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// True 360° photo-sphere viewer: the equirectangular capture is mapped onto
// the inside of a sphere, and dragging orbits a camera around the center —
// same interaction model as Google Street View / phone "photo sphere"
// viewers, rendered in a square viewport.
export default function Court360Viewer({
  src,
  alt = "360° view of the pickleball court",
}: {
  src: string;
  alt?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    let width = wrap.clientWidth;
    let height = wrap.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(80, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    // A large sphere viewed from inside — scale.x is flipped so the texture
    // reads correctly on the interior face rather than mirrored.
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    const texture = new THREE.TextureLoader().load(src);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Orientation is tracked as longitude/latitude in degrees rather than
    // raw camera rotation, which makes clamping the vertical look angle
    // (so you can't flip past the poles) straightforward.
    let lon = 0;
    let lat = 0;
    let targetLon = 0;
    let targetLat = 0;

    const applyLookAt = () => {
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      camera.lookAt(target);
    };
    applyLookAt();

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLon = 0;
    let startLat = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLon = targetLon;
      startLat = targetLat;
      setHasInteracted(true);
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // Degrees-per-pixel drag speed — tuned so a full-width drag swings
      // roughly a quarter turn, which feels natural for this viewport size.
      targetLon = startLon - dx * 0.18;
      targetLat = Math.max(-85, Math.min(85, startLat + dy * 0.18));
    };
    const endDrag = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // capture may already be released by the browser
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    // Simple scroll-to-zoom via field of view, clamped to a sensible range.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, 40, 100);
      camera.updateProjectionMatrix();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(wrap);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      // Ease toward the drag target for a smooth, slightly damped feel
      // rather than snapping the view directly to the pointer position.
      lon += (targetLon - lon) * 0.12;
      lat += (targetLat - lat) * 0.12;
      applyLookAt();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("wheel", onWheel);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [src]);

  return (
    <div ref={wrapRef} className="court-360-wrap" role="group" aria-label={alt}>
      <canvas ref={canvasRef} className="court-360-canvas" />
      <div className={`court-360-hint ${hasInteracted ? "court-360-hint--hidden" : ""}`} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 7L3 12L8 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 7L21 12L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        DRAG TO LOOK AROUND
      </div>
    </div>
  );
}
