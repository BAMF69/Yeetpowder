import * as THREE from "three";
import type { OperatorId } from "../../net/profile";
import { makeOperative } from "./operative";
import { enableOperatorArt } from "./operatorArt";

/** A disposable renderer confined to the profile card; gameplay's viewmodel is untouched. */
export function operatorPreview(host: HTMLElement, initial: OperatorId, noart: boolean): { select(id: OperatorId): void; dispose(): void } {
  enableOperatorArt(!noart);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(320, 230, false); renderer.domElement.style.cssText = "width:100%;height:230px;display:block";
  renderer.domElement.setAttribute("aria-label", "Animated preview of selected operator"); host.append(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 320 / 230, 0.1, 30);
  scene.add(new THREE.HemisphereLight(0xd5eeff, 0x343048, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(2, 4, 4); scene.add(light);
  camera.position.set(0, 0.25, 3.8); camera.lookAt(0, -0.1, 0);
  const op = makeOperative("#6286d9"); op.setOperator(initial); scene.add(op.root);
  op.setPose({ weapon: "pistol", speed: 0, onGround: true, aim: 0, pitch: 0, fling: 0, tumbling: false, dead: false, kneel: 0 });
  let frame = 0, previous = performance.now(), disposed = false;
  const draw = (now: number) => {
    if (disposed) return;
    const width = host.clientWidth || 320; renderer.setSize(width, 230, false); camera.aspect = width / 230; camera.updateProjectionMatrix();
    op.root.rotation.y = Math.sin(now / 3500) * 0.4; op.update(Math.min((now - previous) / 1000, 0.05), camera); previous = now;
    renderer.render(scene, camera); frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return { select(id) { op.setOperator(id); }, dispose() { disposed = true; cancelAnimationFrame(frame); op.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
