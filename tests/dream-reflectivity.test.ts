import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { attachDreamEmission, createDreamEmissionProfile, detachDreamEmission } from "../app/dreamEmission";

for (const time of ["dawn", "day", "dusk", "night"] as const) {
  test(`glow preserves reflective material parameters and maps at ${time}`, () => {
    const map = new THREE.Texture();
    const normalMap = new THREE.Texture();
    const envMap = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial({color:0x83aaa3, roughness:0.58, metalness:0.18, map, normalMap, envMap, envMapIntensity:1.7});
    const emissive = material.emissive.clone();
    const emissiveIntensity = material.emissiveIntensity;
    const geometry = new THREE.BoxGeometry(2,0.4,1);
    const mesh = new THREE.Mesh(geometry, material); const group = new THREE.Group(); group.add(mesh);
    attachDreamEmission(group, createDreamEmissionProfile(41,time,"ship"));
    assert.ok(mesh.material instanceof THREE.MeshStandardMaterial);
    assert.equal(mesh.material, material, "glow registration replaced the lit production material");
    assert.equal(mesh.material.roughness, material.roughness);
    assert.equal(mesh.material.metalness, material.metalness);
    assert.equal(mesh.material.envMapIntensity, material.envMapIntensity);
    assert.equal(mesh.material.map,map); assert.equal(mesh.material.normalMap,normalMap); assert.equal(mesh.material.envMap,envMap);
    assert.ok(mesh.material.color.equals(material.color));
    assert.ok(mesh.material.emissive.equals(emissive));
    assert.equal(mesh.material.emissiveIntensity, emissiveIntensity);
    assert.equal(mesh.geometry,geometry);
    detachDreamEmission(group); assert.equal(mesh.material,material);
    geometry.dispose(); material.dispose(); map.dispose(); normalMap.dispose(); envMap.dispose();
  });
}
