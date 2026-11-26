import * as THREE from "three";
export const SHIELD_WINDOW = { halfWidth: 0.22, bottom: 0.38, top: 0.58 };

/** The accepted baked mesh includes an opaque viewport. Clip only its window in canonical shield space. */
export function openShieldViewport(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const localToShield = object.matrixWorld.clone();
    const patch = (original: THREE.Material) => {
      const material = original.clone();
      material.onBeforeCompile = (shader) => {
        shader.uniforms.shieldLocalToCanonical = { value: localToShield };
        shader.uniforms.shieldWindow = { value: new THREE.Vector3(SHIELD_WINDOW.halfWidth, SHIELD_WINDOW.bottom, SHIELD_WINDOW.top) };
        shader.vertexShader = "uniform mat4 shieldLocalToCanonical; varying vec3 vShieldPoint;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvShieldPoint = (shieldLocalToCanonical * vec4(position, 1.0)).xyz;");
        shader.fragmentShader = "uniform vec3 shieldWindow; varying vec3 vShieldPoint;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (abs(vShieldPoint.x) < shieldWindow.x && vShieldPoint.y > shieldWindow.y && vShieldPoint.y < shieldWindow.z) discard;");
      };
      material.customProgramCacheKey = () => "yeet-shield-viewport-v1";
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(patch) : patch(object.material);
  });
}
