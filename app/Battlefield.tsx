"use client";

import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  BATTLEFIELD_PALETTES,
  buildSceneContents,
  createCelestialWaterReflection,
  createLowPolyMoon,
  createLowPolySun,
  listedUnits,
  ROTORCRAFT,
  updateAtmosphere,
  viewLayerSupportsFallingPrecipitation,
} from "./battlefieldScene";
import { triggerWildlifeAvatarReaction, updateWildlifeAvatars } from "./wildlifeAvatar";
import CelestialHud from "./CelestialHud";
import { getCelestialState, horizontalVector } from "./celestial";
import {
  createAuroraPlan,
  createAtmospherePlan,
  createSubsurfaceOpticsPlan,
  createWaveFieldPlan,
  fogDensityAtView,
  refractSkyDirection,
  sampleWaveField,
  sampleWaveSlope,
} from "./environmentVisuals";
import { cloudCoverPhrase } from "./weatherPresentation";
import { createWildlifePlan, describeWildlifeForView, wildlifeForView, wildlifeReactionMessage, type VisibleWildlife } from "./wildlife";
import { DREAM_EMISSION_LIMITS, updateDreamEmission } from "./dreamEmission";
import {
  createStarfieldPlan,
  describeStarfield,
  STARFIELD_LIMITS,
  updateStarfield,
  visibleStarfieldPlan,
  type StarfieldStar,
} from "./starfield";
import { updateAuroraEngine } from "./auroraEngine";
import {
  contactDomainForView,
  contactsForView,
  createContactVisualizationPlan,
  type ContactDomain,
  type ContactVisibility,
} from "./contactVisualization";
import {
  createStarPlacements,
  getCelestialProminence,
  getSkyVisibility,
  getSubsurfaceLifeProfile,
  headingToCompass,
  nextViewLayer,
  stableSeed,
  VIEW_CONFIG,
  VIEW_LAYERS,
  viewTelemetryFromDirection,
  type ViewLayer,
} from "./viewModel";

type Props = {
  climate: "ocean" | "arctic" | "antarctic";
  time: "dawn" | "day" | "dusk" | "night";
  clouds: "clear" | "scattered" | "broken" | "overcast";
  precipitation: "none" | "rain" | "snow";
  seaState: number;
  visibility: number;
  season: string;
  scenarioDate: string;
  observerLatitude: number;
  observerLongitude: number;
  storming: boolean;
  lightningCapable: boolean;
  windHeading: number;
  windSpeed: number;
  currentHeading: number;
  currentSpeed: number;
  waveHeading: number;
  region: string;
  regionId: string;
  fleet: Record<string, number>;
  airWing: Record<string, number>;
  lowSignatureFleet: number;
  lowSignatureAircraft: number;
  exerciseId: number;
  result: boolean | null;
  theme: "light" | "dark";
  contactVisibility: ContactVisibility;
  currentPhaseContentActive?: boolean;
};

type ViewPose = {
  position: [number, number, number];
  target: [number, number, number];
};

type HudDisclosure = "plot" | "celestial" | "environment" | "contacts";
type HudDisclosureState = { identity: string; disclosure: HudDisclosure | null };

function describeContactState(domain: ContactDomain | null, count: number) {
  if (!domain) return "No contact markers are shown in this view.";
  if (!count) return `Selected force has no credited ${domain}-detection capability; no unknown markers are shown.`;
  return `${count} unidentified ${domain} contact marker${count === 1 ? " is" : "s are"} shown because the selected force has credited ${domain}-detection capability. Markers communicate uncertainty, not exact identity or opposing composition.`;
}

function useDebouncedRecord(value: Record<string, number>, delay = 500) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function useBoundedVisualRecord(value: Record<string, number>, eachLimit: number, totalLimit: number) {
  const serialized = JSON.stringify(listedUnits(value, eachLimit, totalLimit).reduce<Record<string, number>>((counts, id) => {
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {}));
  return useMemo(() => JSON.parse(serialized) as Record<string, number>, [serialized]);
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ));
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);
  return reducedMotion;
}

function sampleFallbackStars(stars: readonly StarfieldStar[], maximum = 960) {
  if (stars.length <= maximum) return stars;
  const stride = stars.length / maximum;
  return Array.from({ length: maximum }, (_, index) => stars[Math.floor(index * stride)]);
}

function fallbackStarPosition(star: StarfieldStar) {
  const radius = Math.hypot(star.x, star.y, star.z) || 1;
  const azimuth = Math.atan2(star.x, -star.z);
  const elevation = Math.asin(Math.max(-1, Math.min(1, star.y / radius)));
  return {
    left: Math.max(1, Math.min(99, 50 + azimuth / (Math.PI * 2) * 100)),
    top: Math.max(1, Math.min(99, 50 - elevation / Math.PI * 100)),
  };
}

function unitIntervalFromIndex(index: number) {
  const value = Math.sin((index + 1) * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function Battlefield({ climate, time, clouds, precipitation, seaState, visibility, season, scenarioDate, observerLatitude, observerLongitude, storming, lightningCapable, windHeading, windSpeed, currentHeading, currentSpeed, waveHeading, region, regionId, fleet, airWing, lowSignatureFleet, lowSignatureAircraft, exerciseId, result, theme, contactVisibility, currentPhaseContentActive = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const wildlifeReactRef = useRef<(memberId: string) => void>(() => {});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rendererUnavailable = useRef(false);
  const viewPoses = useRef<Partial<Record<ViewLayer, ViewPose>>>({});
  const [viewLayer, setViewLayer] = useState<ViewLayer>("surface");
  const [viewTelemetry, setViewTelemetry] = useState({ heading: 0, elevation: 0, direction: "N", distance: 0 });
  const [keyboardTelemetry, setKeyboardTelemetry] = useState("");
  const [hudDisclosureState, setHudDisclosureState] = useState<HudDisclosureState>({ identity: "", disclosure: null });
  const [wildlifeReaction, setWildlifeReaction] = useState({ memberId: "", message: "", nonce: 0 });
  const [starfieldSeed] = useState(() => {
    const entropy = new Uint32Array(1);
    if (typeof globalThis.crypto?.getRandomValues === "function") globalThis.crypto.getRandomValues(entropy);
    else entropy[0] = Math.floor(Math.random() * 0xffffffff);
    return stableSeed(exerciseId, region, climate, entropy[0]);
  });
  const reducedMotion = usePrefersReducedMotion();
  const displayedFleet = useDebouncedRecord(fleet);
  const displayedAirWing = useDebouncedRecord(airWing);
  const visualFleet = useBoundedVisualRecord(displayedFleet, 8, 22);
  const visualAirWing = useBoundedVisualRecord(displayedAirWing, 5, 20);
  const fallbackFleet = useMemo(() => listedUnits(visualFleet, 8, 16), [visualFleet]);
  const fallbackAircraft = useMemo(() => listedUnits(visualAirWing, 4, 12), [visualAirWing]);
  const vesselCount = useMemo(() => Object.values(displayedFleet).reduce((sum, count) => sum + count, 0), [displayedFleet]);
  const aircraftCount = useMemo(() => Object.values(displayedAirWing).reduce((sum, count) => sum + count, 0), [displayedAirWing]);
  const celestial = useMemo(() => getCelestialState(scenarioDate, time, observerLatitude, observerLongitude), [scenarioDate, time, observerLatitude, observerLongitude]);
  const activeBodyKind = time === "night" ? "moon" : "sun";
  const activeBody = celestial[activeBodyKind];
  const subsurfaceOptics = useMemo(() => createSubsurfaceOpticsPlan({
    body: activeBodyKind,
    bodyAboveHorizon: activeBody.aboveHorizon,
    bodyAltitude: activeBody.altitude,
    moonIllumination: celestial.moon.illumination,
    time,
    clouds,
    precipitation,
    visibility,
    seaState,
  }), [activeBody.aboveHorizon, activeBody.altitude, activeBodyKind, celestial.moon.illumination, clouds, precipitation, seaState, time, visibility]);
  const skyVisibility = useMemo(() => getSkyVisibility({ time, clouds, precipitation, visibility, aircraftCount, lowSignatureAircraft, vesselCount, lowSignatureVessels: lowSignatureFleet }), [time, clouds, precipitation, visibility, aircraftCount, lowSignatureAircraft, vesselCount, lowSignatureFleet]);
  const starPlacements = useMemo(() => createStarPlacements(starfieldSeed, STARFIELD_LIMITS.fieldStars), [starfieldSeed]);
  const completeStarfieldPlan = useMemo(() => createStarfieldPlan({
    seed: starfieldSeed,
    theme,
    placements: starPlacements,
    visibleCount: STARFIELD_LIMITS.fieldStars,
  }), [starPlacements, starfieldSeed, theme]);
  const starfieldPlan = useMemo(() => visibleStarfieldPlan(completeStarfieldPlan, {
    viewLayer,
    time,
    clouds,
    precipitation,
    visibility,
    seaState,
    maximumVisible: skyVisibility.starCount,
    subsurfaceOptics,
  }), [clouds, completeStarfieldPlan, precipitation, seaState, skyVisibility.starCount, subsurfaceOptics, time, viewLayer, visibility]);
  const wavePlan = useMemo(() => createWaveFieldPlan({
    seed: stableSeed(exerciseId, region, climate, scenarioDate),
    seaState,
    storming,
    precipitation,
    climate,
    waveHeading,
    windHeading,
    windSpeed,
    currentHeading,
    currentSpeed,
  }), [climate, currentHeading, currentSpeed, exerciseId, precipitation, region, scenarioDate, seaState, storming, waveHeading, windHeading, windSpeed]);
  const atmospherePlan = useMemo(() => createAtmospherePlan({
    seed: stableSeed(exerciseId, region, scenarioDate, "atmosphere"),
    climate,
    time,
    clouds,
    precipitation,
    seaState,
    visibility,
    storming,
    lightningCapable,
    windHeading,
    windSpeed,
  }), [climate, clouds, exerciseId, lightningCapable, precipitation, region, scenarioDate, seaState, storming, time, visibility, windHeading, windSpeed]);
  const auroraPlan = useMemo(() => createAuroraPlan({
    seed: stableSeed(exerciseId, region, scenarioDate),
    climate,
    latitude: observerLatitude,
    season,
    time,
    clouds,
    precipitation,
    storming,
  }), [climate, clouds, exerciseId, observerLatitude, precipitation, region, scenarioDate, season, storming, time]);
  // Stars is a dedicated canopy-observation layer. Aurora remains part of the
  // atmospheric Sky, Air, and Surface views, where depth and weather can give
  // the curtains their intended spatial context without tinting the star field.
  const auroraVisibleInLayer = auroraPlan.visible && viewLayer !== "stars" && viewLayer !== "subsurface";
  const lifeProfile = useMemo(() => getSubsurfaceLifeProfile(climate, region, exerciseId), [climate, region, exerciseId]);
  const wildlifePlan = useMemo(() => createWildlifePlan({
    seed: stableSeed(exerciseId, regionId, "wildlife"),
    regionId,
    climate,
    season,
    time,
    clouds,
    precipitation,
    storming,
    windSpeed,
    seaState,
    visibility,
  }), [climate, clouds, exerciseId, precipitation, regionId, seaState, season, storming, time, visibility, windSpeed]);
  const visibleWildlife = useMemo(() => wildlifeForView(wildlifePlan, viewLayer), [viewLayer, wildlifePlan]);
  const wildlifeDescription = useMemo(() => describeWildlifeForView(wildlifePlan, viewLayer), [viewLayer, wildlifePlan]);
  const reactToWildlife = (animal: VisibleWildlife) => {
    wildlifeReactRef.current(animal.id);
    setWildlifeReaction((current) => ({ memberId: animal.id, message: wildlifeReactionMessage(animal), nonce: current.nonce + 1 }));
  };
  const greetNextWildlife = () => {
    if (!visibleWildlife.length) return;
    const currentIndex = visibleWildlife.findIndex((animal) => animal.id === wildlifeReaction.memberId);
    reactToWildlife(visibleWildlife[(currentIndex + 1) % visibleWildlife.length]);
  };
  const fallbackStars = useMemo(() => sampleFallbackStars(starfieldPlan.stars), [starfieldPlan.stars]);
  const fallbackStarNodes = useMemo(() => fallbackStars.map((star, index) => {
    const position = fallbackStarPosition(star);
    const apparentScale = star.population === "nebula"
      ? 0.66 + star.scale * 1.55
      : 0.72 + star.scale * 1.15;
    return <i
      className={`${star.population} ${star.depth} ${star.motion} ${star.prominence}`}
      key={`${star.nebulaId ?? "field"}-${index}`}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`,
        transform: `scale(${apparentScale}) rotate(${star.rotation}rad)`,
        animationDelay: `${-unitIntervalFromIndex(index) * 4.8}s`,
        animationDuration: `${2.4 + unitIntervalFromIndex(index + 97) * 3.1}s`,
      }}
    />;
  }), [fallbackStars]);
  const starfieldDescription = useMemo(() => describeStarfield(starfieldPlan), [starfieldPlan]);
  const contactPlan = useMemo(() => createContactVisualizationPlan(
    stableSeed(exerciseId, region, climate, "unknown-contacts"),
    contactVisibility,
  ), [climate, contactVisibility, exerciseId, region]);
  const contactDomain = useMemo(() => contactDomainForView(viewLayer), [viewLayer]);
  const visibleUnknownContacts = useMemo(() => contactsForView(contactPlan, viewLayer), [contactPlan, viewLayer]);
  const contactDescription = useMemo(() => describeContactState(contactDomain, visibleUnknownContacts.length), [contactDomain, visibleUnknownContacts.length]);
  const celestialProminence = useMemo(() => getCelestialProminence({
    body: activeBodyKind,
    viewLayer,
    supportedAircraftCount: aircraftCount,
    aboveHorizon: activeBody.aboveHorizon,
    subsurfaceTransmission: subsurfaceOptics.activeBodyVisible,
  }), [activeBody.aboveHorizon, activeBodyKind, aircraftCount, subsurfaceOptics.activeBodyVisible, viewLayer]);
  const activeBodyBrightness = activeBodyKind === "moon" ? celestial.moon.illumination : 1;
  const celestialReflectionVisible = activeBody.aboveHorizon
    && activeBodyBrightness >= 0.002
    && (viewLayer === "surface" || viewLayer === "air" || viewLayer === "sky");

  const hudDisclosureIdentity = `${exerciseId}:${scenarioDate}:${time}:${viewLayer}:${currentPhaseContentActive ? "current" : "planning"}`;
  const openHudDisclosure = hudDisclosureState.identity === hudDisclosureIdentity ? hudDisclosureState.disclosure : null;
  const toggleHudDisclosure = (disclosure: HudDisclosure, open: boolean) => {
    setHudDisclosureState((current) => open
      ? { identity: hudDisclosureIdentity, disclosure }
      : current.identity === hudDisclosureIdentity && current.disclosure === disclosure
        ? { identity: hudDisclosureIdentity, disclosure: null }
        : current);
  };

  useEffect(() => {
    if (!host.current || !celestial || !activeBody || !celestialProminence) return;
    const container = host.current;
    const colors = BATTLEFIELD_PALETTES[theme][time];
    const viewConfig = VIEW_CONFIG[viewLayer];
    const poses = viewPoses.current;
    const scene = new THREE.Scene();
    const sceneColor = viewLayer === "stars"
      ? (theme === "dark" ? 0x292b4b : 0x515878)
      : viewLayer === "subsurface"
        ? (theme === "dark" ? 0x102b38 : 0x315c68)
        : colors[0];
    scene.background = new THREE.Color(sceneColor);
    scene.fog = viewLayer === "stars"
      ? null
      : new THREE.FogExp2(sceneColor, viewLayer === "subsurface" ? 0.052 : atmospherePlan.fog.horizonDensity);

    // The celestial canopy spans genuinely distinct near-to-far shells. Keep
    // the complete 404-unit background inside the camera without moving any
    // tactical foreground geometry or changing its perspective.
    const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 450);
    const savedPose = poses[viewLayer];
    camera.position.fromArray(savedPose?.position || viewConfig.camera);
    const initialTarget = new THREE.Vector3().fromArray(savedPose?.target || viewConfig.target);
    camera.lookAt(initialTarget);
    const initialDirection = initialTarget.clone().sub(camera.position).normalize();
    const initialAngles = viewTelemetryFromDirection(initialDirection.x, initialDirection.y, initialDirection.z);
    const initialDistance = Math.round(camera.position.distanceTo(initialTarget) * 10) / 10;
    setViewTelemetry({ ...initialAngles, distance: initialDistance });

    if (rendererUnavailable.current) return;
    let renderer = rendererRef.current;
    if (!renderer) {
      const renderCanvas = document.createElement("canvas");
      const renderingContext = renderCanvas.getContext("webgl2", { antialias: true, alpha: false });
      if (!renderingContext) {
        rendererUnavailable.current = true;
        container.dataset.webgl = "unavailable";
        return;
      }
      try {
        renderer = new THREE.WebGLRenderer({ canvas: renderCanvas, context: renderingContext, antialias: true, alpha: false });
      } catch {
        rendererUnavailable.current = true;
        container.dataset.webgl = "unavailable";
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.shadowMap.enabled = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute("aria-hidden", "true");
      renderer.domElement.tabIndex = -1;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      container.dataset.webgl = "ready";
    }
    renderer.setSize(container.clientWidth, container.clientHeight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !reducedMotion;
    controls.enablePan = false;
    controls.minDistance = viewConfig.minDistance;
    controls.maxDistance = viewConfig.maxDistance;
    controls.minPolarAngle = viewConfig.minPolarAngle;
    controls.maxPolarAngle = viewConfig.maxPolarAngle;
    controls.minAzimuthAngle = -Math.PI * 0.99;
    controls.maxAzimuthAngle = Math.PI * 0.99;
    controls.target.copy(initialTarget);

    let renderReducedFrame = () => {};
    const updateViewTelemetry = () => {
      const direction = camera.getWorldDirection(new THREE.Vector3());
      const angles = viewTelemetryFromDirection(direction.x, direction.y, direction.z);
      const distance = Math.round(camera.position.distanceTo(controls.target) * 10) / 10;
      setViewTelemetry((current) => (
        current.heading === angles.heading
          && current.elevation === angles.elevation
          && current.direction === angles.direction
          && current.distance === distance
          ? current
          : { ...angles, distance }
      ));
    };
    const onControlsChange = () => {
      updateViewTelemetry();
      renderReducedFrame();
    };
    controls.addEventListener("change", onControlsChange);
    controls.update();
    updateViewTelemetry();

    const onPlotKeyDown = (event: KeyboardEvent) => {
      const supported = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_"].includes(event.key);
      if (!supported) return;
      event.preventDefault();
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === "ArrowLeft") spherical.theta -= 0.12;
      if (event.key === "ArrowRight") spherical.theta += 0.12;
      if (event.key === "ArrowUp") spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - 0.08);
      if (event.key === "ArrowDown") spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + 0.08);
      if (event.key === "+" || event.key === "=") spherical.radius = Math.max(controls.minDistance, spherical.radius - 1.5);
      if (event.key === "-" || event.key === "_") spherical.radius = Math.min(controls.maxDistance, spherical.radius + 1.5);
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      camera.lookAt(controls.target);
      controls.update();
      updateViewTelemetry();
      const updatedDirection = camera.getWorldDirection(new THREE.Vector3());
      const updatedAngles = viewTelemetryFromDirection(updatedDirection.x, updatedDirection.y, updatedDirection.z);
      const updatedDistance = Math.round(camera.position.distanceTo(controls.target) * 10) / 10;
      setKeyboardTelemetry(`View ${updatedAngles.heading} degrees ${updatedAngles.direction}, elevation ${updatedAngles.elevation} degrees, range ${updatedDistance.toFixed(1)}.`);
    };
    container.addEventListener("keydown", onPlotKeyDown);

    const hemi = new THREE.HemisphereLight(
      viewLayer === "stars" ? 0x9c98c8 : viewLayer === "subsurface" ? 0x4d8190 : colors[1],
      viewLayer === "subsurface" ? 0x071722 : time === "night" ? 0x17202e : 0xd7e0d8,
      viewLayer === "stars" ? 0.72 : viewLayer === "subsurface" ? 1.35 : time === "night" ? 1.05 : 2.1,
    );
    scene.add(hemi);
    const sunVectorData = horizontalVector(celestial.sun.azimuth, celestial.sun.altitude);
    const sunAirDirection = new THREE.Vector3(sunVectorData.x, sunVectorData.y, sunVectorData.z).normalize();
    const refractedSunData = viewLayer === "subsurface" ? refractSkyDirection(sunVectorData) : null;
    const sunDirection = refractedSunData
      ? new THREE.Vector3(refractedSunData.x, refractedSunData.y, refractedSunData.z).normalize()
      : sunAirDirection;
    const sunLight = new THREE.DirectionalLight(time === "dusk" || time === "dawn" ? 0xffd7ba : 0xeaf6f4, time === "night" ? 0.4 : 2.2);
    sunLight.position.copy(sunAirDirection).multiplyScalar(60);
    sunLight.castShadow = false;
    if (viewLayer !== "subsurface" && viewLayer !== "stars") scene.add(sunLight);

    let sunDisk: THREE.Group | null = null;
    if (activeBodyKind === "sun" && celestialProminence.renderInScene) {
      sunDisk = createLowPolySun(time, celestialProminence, false);
      scene.add(sunDisk);
    }

    const moonVectorData = horizontalVector(celestial.moon.azimuth, celestial.moon.altitude);
    const moonAirDirection = new THREE.Vector3(moonVectorData.x, moonVectorData.y, moonVectorData.z).normalize();
    const refractedMoonData = viewLayer === "subsurface" ? refractSkyDirection(moonVectorData) : null;
    const moonDirection = refractedMoonData
      ? new THREE.Vector3(refractedMoonData.x, refractedMoonData.y, refractedMoonData.z).normalize()
      : moonAirDirection;
    let moonDisk: THREE.Group | null = null;
    if (activeBodyKind === "moon" && celestialProminence.renderInScene) {
      moonDisk = createLowPolyMoon(moonAirDirection, sunAirDirection, theme, celestialProminence, false);
      scene.add(moonDisk);
    }

    if (celestialReflectionVisible) {
      scene.add(createCelestialWaterReflection(
        activeBodyKind,
        time,
        theme,
        activeBodyKind === "sun" ? sunAirDirection : moonAirDirection,
        activeBodyBrightness,
      ));
    }

    const {
      skyCanopy,
      water,
      waterGeometry,
      foamMesh,
      auroraEngine,
      underseaSilt,
      seaCreatures,
      wildlife,
      ships,
      aircraft,
      atmosphere,
      starfield,
    } = buildSceneContents({
      scene,
      colors,
      theme,
      viewLayer,
      starfieldPlan,
      contactPlan,
      wavePlan,
      auroraPlan,
      atmospherePlan,
      time,
      climate,
      region,
      exerciseId,
      lifeProfile,
      wildlifePlan,
      displayedFleet: visualFleet,
      displayedAirWing: visualAirWing,
      result,
    });
    const clock3d = new THREE.Clock();
    const wildlifeRaycaster = new THREE.Raycaster();
    const wildlifePointer = new THREE.Vector2();
    const pointerStart = { id: -1, x: 0, y: 0 };
    const pickWildlife = (clientX: number, clientY: number) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return null;
      wildlifePointer.set(
        (clientX - bounds.left) / bounds.width * 2 - 1,
        -((clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      wildlifeRaycaster.setFromCamera(wildlifePointer, camera);
      const hit = wildlifeRaycaster.intersectObjects(wildlife, true)[0]?.object;
      let target: THREE.Object3D | null = hit ?? null;
      while (target && !target.userData.environmentalWildlife) target = target.parent;
      return target instanceof THREE.Group ? target : null;
    };
    const announceWildlifeReaction = (animal: THREE.Group) => {
      triggerWildlifeAvatarReaction(animal, clock3d.getElapsedTime());
      const reactionAnimal = {
        kind: animal.userData.kind,
        medium: animal.userData.medium,
        restingPose: Boolean(animal.userData.restingPose),
      } as Pick<VisibleWildlife, "kind" | "medium" | "restingPose">;
      setWildlifeReaction((current) => ({ memberId: String(animal.userData.memberId), message: wildlifeReactionMessage(reactionAnimal), nonce: current.nonce + 1 }));
      container.dataset.wildlifeLastReaction = String(animal.userData.kind);
      renderReducedFrame();
    };
    wildlifeReactRef.current = (memberId) => {
      const animal = wildlife.find((candidate) => candidate.userData.memberId === memberId);
      if (animal) announceWildlifeReaction(animal);
    };
    const onWildlifePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerStart.id = event.pointerId;
      pointerStart.x = event.clientX;
      pointerStart.y = event.clientY;
    };
    const onWildlifePointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerStart.id || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7) return;
      pointerStart.id = -1;
      const animal = pickWildlife(event.clientX, event.clientY);
      if (animal) announceWildlifeReaction(animal);
    };
    const onWildlifePointerMove = (event: PointerEvent) => {
      if (event.buttons) return;
      renderer.domElement.style.cursor = pickWildlife(event.clientX, event.clientY) ? "pointer" : "grab";
    };
    renderer.domElement.addEventListener("pointerdown", onWildlifePointerDown);
    renderer.domElement.addEventListener("pointerup", onWildlifePointerUp);
    renderer.domElement.addEventListener("pointermove", onWildlifePointerMove);
    let frame = 0;
    let lastFrameAt = -Infinity;
    let lastNormalsAt = -Infinity;
    const foamMatrix = new THREE.Matrix4();
    const foamQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const foamPosition = new THREE.Vector3();
    const foamScale = new THREE.Vector3();
    const fogViewDirection = new THREE.Vector3();
    const waveBaseColor = new THREE.Color(colors[2]);
    const renderFrame = (frameAt: number) => {
      if (document.hidden) return;
      const frameInterval = 1000 / 30;
      if (!reducedMotion && frameAt - lastFrameAt < frameInterval) return;
      lastFrameAt = frameAt;
      const elapsed = clock3d.getElapsedTime();
      const motionTime = reducedMotion ? 0 : elapsed;
      ships.forEach((ship, index) => {
        if (ship.userData.baseY >= 0 && water.visible) {
          const localY = -ship.position.z;
          const waveHeight = sampleWaveField(wavePlan, ship.position.x, localY, motionTime);
          const slope = sampleWaveSlope(wavePlan, ship.position.x, localY, motionTime);
          ship.position.y = ship.userData.baseY + waveHeight;
          ship.rotation.x = Math.atan(-slope.y) * 0.32;
          ship.rotation.z = Math.atan(slope.x) * 0.38;
          const wake = ship.userData.wake as THREE.Mesh | undefined;
          if (wake && wake.material instanceof THREE.MeshBasicMaterial) {
            wake.material.opacity = 0.2 + wavePlan.whitecapFraction * 0.24;
          }
        } else {
          ship.position.y = ship.userData.baseY + (reducedMotion ? 0 : Math.sin(elapsed * 0.72 + index) * 0.035);
        }
        const ring = ship.userData.ring as THREE.Mesh;
        if (ring) ring.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(elapsed * 1.5 + index) * 0.07);
      });
      aircraft.forEach((craft, index) => {
        craft.position.y = craft.userData.baseY + (reducedMotion ? 0 : Math.sin(elapsed * 0.82 + index) * 0.08);
        craft.position.x = craft.userData.baseX + (reducedMotion ? 0 : Math.sin(elapsed * 0.22 + index) * 0.12);
        const rotor = craft.userData.rotor as THREE.Mesh | undefined;
        if (rotor) rotor.rotation.y = reducedMotion ? 0 : elapsed * 8.5;
      });
      seaCreatures.forEach((creature) => {
        if (reducedMotion) return;
        const phase = creature.userData.phase as number;
        const speed = creature.userData.speed as number;
        const radius = creature.userData.radius as number;
        const angle = elapsed * speed + phase;
        creature.position.x = creature.userData.baseX + Math.sin(angle) * radius;
        creature.position.y = creature.userData.baseY + Math.sin(angle * 1.7) * 0.16;
        creature.position.z = creature.userData.baseZ + Math.cos(angle) * radius * 0.55;
        creature.rotation.y = -angle + Math.PI / 2;
      });
      updateWildlifeAvatars(wildlife, wavePlan, elapsed, reducedMotion);
      updateAtmosphere(atmosphere, atmospherePlan, elapsed, reducedMotion);
      updateDreamEmission([...ships, ...aircraft], elapsed, reducedMotion);
      if (skyCanopy) skyCanopy.position.copy(camera.position);
      if (scene.fog instanceof THREE.FogExp2 && viewLayer !== "subsurface") {
        camera.getWorldDirection(fogViewDirection);
        const elevation = Math.asin(Math.max(-1, Math.min(1, fogViewDirection.y))) * 180 / Math.PI;
        scene.fog.density = fogDensityAtView(atmospherePlan, elevation, camera.position.y);
        container.dataset.fogDensity = scene.fog.density.toFixed(5);
      }
      if (underseaSilt) {
        underseaSilt.rotation.y = reducedMotion ? 0 : Math.sin(elapsed * 0.045) * 0.035;
        underseaSilt.position.x = reducedMotion ? 0 : Math.sin(elapsed * 0.08) * 0.12;
      }
      updateStarfield(starfield, elapsed, reducedMotion, camera.position);
      if (water.visible) {
        const wavePositions = waterGeometry.attributes.position as THREE.BufferAttribute;
        const waveColors = waterGeometry.attributes.color as THREE.BufferAttribute;
        for (let index = 0; index < wavePositions.count; index++) {
          const x = wavePositions.getX(index); const y = wavePositions.getY(index);
          const height = sampleWaveField(wavePlan, x, y, motionTime);
          const ratio = Math.max(-1, Math.min(1, height / Math.max(0.08, wavePlan.peakToTrough * 0.5)));
          const crest = Math.max(0, ratio) * 0.48;
          const trough = 1 + Math.min(0, ratio) * 0.25;
          wavePositions.setZ(index, height);
          waveColors.setXYZ(
            index,
            (waveBaseColor.r + (1 - waveBaseColor.r) * crest) * trough,
            (waveBaseColor.g + (1 - waveBaseColor.g) * crest) * trough,
            (waveBaseColor.b + (1 - waveBaseColor.b) * crest) * trough,
          );
        }
        wavePositions.needsUpdate = true;
        waveColors.needsUpdate = true;
        if (reducedMotion || elapsed - lastNormalsAt >= 0.45) {
          waterGeometry.computeVertexNormals();
          lastNormalsAt = elapsed;
        }
      }
      if (foamMesh) {
        const primary = wavePlan.components[0];
        const driftSpeed = primary.angularSpeed / Math.max(0.1, primary.frequency);
        wavePlan.foamPatches.forEach((patch, index) => {
          const travel = motionTime * driftSpeed + patch.phaseOffset * 0.31;
          const localX = ((patch.x + primary.directionX * travel + 42) % 84) - 42;
          const localY = ((patch.y + primary.directionY * travel + 42) % 84) - 42;
          const height = sampleWaveField(wavePlan, localX, localY, motionTime) + 0.035;
          foamPosition.set(localX, height, -localY);
          foamScale.set(patch.scale * (1.3 + wavePlan.whitecapFraction), patch.scale * 0.42, 1);
          foamMatrix.compose(foamPosition, foamQuaternion, foamScale);
          foamMesh.setMatrixAt(index, foamMatrix);
        });
        foamMesh.instanceMatrix.needsUpdate = true;
      }
      updateAuroraEngine(auroraEngine, elapsed, reducedMotion);
      if (sunDisk) sunDisk.position.copy(camera.position).addScaledVector(sunDirection, celestialProminence.distance);
      if (moonDisk) moonDisk.position.copy(camera.position).addScaledVector(moonDirection, celestialProminence.distance);
      if (!reducedMotion) controls.update();
      renderer.render(scene, camera);
      container.dataset.renderedLayer = viewLayer;
      container.dataset.renderedTheme = theme;
    };
    const animate = (frameAt: number) => {
      frame = requestAnimationFrame(animate);
      renderFrame(frameAt);
    };
    if (reducedMotion) {
      renderReducedFrame = () => renderFrame(0);
      renderReducedFrame();
    } else {
      frame = requestAnimationFrame(animate);
    }

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderReducedFrame();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      poses[viewLayer] = {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
      };
      controls.removeEventListener("change", onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onWildlifePointerDown);
      renderer.domElement.removeEventListener("pointerup", onWildlifePointerUp);
      renderer.domElement.removeEventListener("pointermove", onWildlifePointerMove);
      renderer.domElement.style.removeProperty("cursor");
      wildlifeReactRef.current = () => {};
      container.removeEventListener("keydown", onPlotKeyDown);
      if (container.dataset.renderedLayer === viewLayer) {
        delete container.dataset.renderedLayer;
        delete container.dataset.renderedTheme;
      }
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.LineSegments) {
          object.geometry?.dispose();
          const material = object.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose();
        }
      });
      renderer.renderLists.dispose();
    };
  }, [climate, time, region, visualFleet, visualAirWing, exerciseId, result, theme, viewLayer, celestial, activeBody, activeBodyKind, activeBodyBrightness, celestialProminence, celestialReflectionVisible, reducedMotion, starfieldPlan, contactPlan, lifeProfile, wildlifePlan, wavePlan, auroraPlan, atmospherePlan]);

  useEffect(() => () => {
    const renderer = rendererRef.current;
    const container = host.current;
    if (renderer) {
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    rendererRef.current = null;
    rendererUnavailable.current = false;
    if (container) delete container.dataset.webgl;
  }, []);

  const onLayerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const nextLayer = nextViewLayer(viewLayer, event.key === "PageUp" ? -1 : 1);
      setViewLayer(nextLayer);
      if (nextLayer !== viewLayer) {
        const nextDomain = contactDomainForView(nextLayer);
        const nextContactCount = contactsForView(contactPlan, nextLayer).length;
        setKeyboardTelemetry(`View layer changed to ${nextLayer}. ${describeContactState(nextDomain, nextContactCount)}`);
      }
      return;
    }
    if (host.current?.dataset.webgl !== "unavailable") return;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "_"].includes(event.key)) return;
    event.preventDefault();
    setViewTelemetry((current) => {
      const heading = event.key === "ArrowLeft"
        ? (current.heading + 353) % 360
        : event.key === "ArrowRight"
          ? (current.heading + 7) % 360
          : current.heading;
      const elevation = event.key === "ArrowUp"
        ? Math.min(89, current.elevation + 4)
        : event.key === "ArrowDown"
          ? Math.max(-89, current.elevation - 4)
          : current.elevation;
      const distance = event.key === "+" || event.key === "="
        ? Math.max(1, current.distance - 1.5)
        : event.key === "-" || event.key === "_"
          ? current.distance + 1.5
          : current.distance;
      return { heading, elevation, distance, direction: headingToCompass(heading) };
    });
  };

  const celestialOpticalAppearance = viewLayer === "subsurface"
    ? subsurfaceOptics.activeBodyVisible
      ? `${activeBodyKind === "sun" ? "Sun" : "Moon"} light is seen directly through the water surface—not as a reflection`
      : `${activeBodyKind === "sun" ? "Sun" : "Moon"} light does not pass the modeled water-and-weather sightline in this view`
    : !activeBody.aboveHorizon
      ? `The ${activeBodyKind} is not visible because it is below the horizon`
    : activeBody.aboveHorizon && (viewLayer === "surface" || viewLayer === "air" || viewLayer === "sky")
      ? `The ${activeBodyKind} is direct; the broken facets on the water are its reflection`
      : `The ${activeBodyKind} is a direct sky sightline, not a reflection`;

  return (
    <div
      className={`battlefield-canvas layer-${viewLayer}`}
      data-hud-open={openHudDisclosure ?? "none"}
      data-starfield-seed={starfieldPlan.seed}
      data-starfield-stars={starfieldPlan.stars.length}
      data-starfield-near={starfieldPlan.counts.near}
      data-starfield-far={starfieldPlan.counts.far}
      data-starfield-still={starfieldPlan.counts.still}
      data-starfield-swirling={starfieldPlan.counts.swirling}
      data-starfield-field-stars={starfieldPlan.counts.field}
      data-starfield-nebula-stars={starfieldPlan.counts.nebula}
      data-starfield-nebulae={starfieldPlan.nebulae.length}
      data-starfield-meshes={starfieldPlan.stars.length > 0 ? STARFIELD_LIMITS.maxMeshes : 0}
      data-starfield-occlusion="scene-depth"
      data-starfield-appearance={starfieldPlan.appearance}
      data-starfield-animation={reducedMotion ? "still" : "alive-bounded-wander"}
      data-sky-canopy={viewLayer === "subsurface" ? "subsurface" : "faceted-pastel-gradient"}
      data-time={time}
      data-dream-emission={time === "day" ? "off" : reducedMotion ? "still" : "breathing"}
      data-dream-emission-halo={time === "day" ? "none" : "dual-native-color-shell"}
      data-dream-emission-occlusion="scene-depth-fog-waves"
      data-dream-emission-max-halo-meshes={DREAM_EMISSION_LIMITS.maxHaloMeshes}
      data-dream-emission-halo-meshes={time === "day" ? 0 : (
        listedUnits(visualFleet, 8, 22).filter((type) => viewLayer !== "stars" && (viewLayer !== "subsurface" || type.includes("submarine"))).length
        + (viewLayer === "subsurface" || viewLayer === "stars" ? 0 : listedUnits(visualAirWing, 5, 20).length)
      ) * DREAM_EMISSION_LIMITS.haloMeshesPerSubject}
      data-weather-tier={atmospherePlan.precipitation.tier}
      data-fog-class={atmospherePlan.fog.classification}
      data-fog-banks={atmospherePlan.fog.banks.length}
      data-fog-density={atmospherePlan.fog.horizonDensity.toFixed(5)}
      data-cloud-regime={atmospherePlan.clouds.regime}
      data-cloud-masses={atmospherePlan.clouds.masses.length}
      data-cloud-lobes={atmospherePlan.clouds.lobeCount}
      data-cloud-geometry={atmospherePlan.clouds.masses.length ? "cohesive-faceted-shells" : "none"}
      data-cloud-motion={atmospherePlan.clouds.masses.length ? (reducedMotion ? "still" : "bounded-drifting-breathing-morphing") : "none"}
      data-precipitation-presentation={atmospherePlan.precipitation.presentation}
      data-precipitation-source="cloud-bases"
      data-precipitation-cells={atmospherePlan.precipitation.cells.length}
      data-precipitation-particle-size={atmospherePlan.precipitation.particleSize.toFixed(2)}
      data-precipitation-fall-speed={atmospherePlan.precipitation.fallSpeed.toFixed(2)}
      data-precipitation-streak-length={atmospherePlan.precipitation.streakLength.toFixed(2)}
      data-precipitation-rendered={precipitation !== "none" && viewLayerSupportsFallingPrecipitation(viewLayer) ? precipitation : "none"}
      data-precipitation-particles={viewLayerSupportsFallingPrecipitation(viewLayer) ? atmospherePlan.precipitation.particleCount : 0}
      data-rain-curtains={viewLayerSupportsFallingPrecipitation(viewLayer) ? atmospherePlan.precipitation.curtainCount : 0}
      data-storm-light={atmospherePlan.stormLight.visible ? "localized-non-flashing" : "none"}
      data-subsurface-aperture={subsurfaceOptics.surfaceApertureOpen ? "open" : "closed"}
      data-celestial-visible={celestialProminence.renderInScene ? "true" : "false"}
      data-celestial-appearance={celestialProminence.renderInScene ? celestialProminence.appearance : "not visible"}
      data-celestial-reflection={celestialReflectionVisible ? activeBodyKind : "none"}
      data-moon-phase-geometry={activeBodyKind === "moon" ? "illuminated-facets-only" : "not-active"}
      data-moon-dark-side={activeBodyKind === "moon" ? "transparent" : "not-active"}
      data-wave-components={wavePlan.components.length}
      data-wave-foam-patches={wavePlan.foamPatches.length}
      data-wave-heading={Math.round(wavePlan.travelHeading)}
      data-wave-peak-to-trough={wavePlan.peakToTrough}
      data-aurora={auroraVisibleInLayer ? auroraPlan.hemisphere : "none"}
      data-aurora-bands={auroraVisibleInLayer ? auroraPlan.bands.length : 0}
      data-aurora-geometry={auroraVisibleInLayer ? "domain-warp-spline-multiveils" : "none"}
      data-aurora-engine={auroraVisibleInLayer ? "fastnoise-lite-domain-warp-mit-adaptation" : "none"}
      data-aurora-motion={auroraVisibleInLayer ? (reducedMotion ? "still" : "snaking-wavering-breathing") : "none"}
      data-aurora-darkness={auroraPlan.darknessMultiplier.toFixed(2)}
      data-render-scheduling={reducedMotion ? "event-driven" : "animated"}
      data-contact-domain={contactDomain ?? "none"}
      data-visible-unknown-contacts={visibleUnknownContacts.length}
      data-wildlife-groups={new Set(visibleWildlife.map((animal) => animal.groupId)).size}
      data-wildlife-individuals={visibleWildlife.length}
      data-wildlife-proximity={wildlifePlan.proximityToLand}
      data-wildlife-status="environmental-nontactical"
      data-wildlife-engine={visibleWildlife.length ? "articulated-low-poly-wildlife" : "none"}
      data-wildlife-motion={visibleWildlife.length ? (reducedMotion ? "active-pose-frozen" : "bounded-route-active") : "none"}
      data-wildlife-route={visibleWildlife.length ? "closed-ecological-waypoints" : "none"}
      data-wildlife-resting-penguins={visibleWildlife.filter((animal) => animal.kind === "penguin" && animal.restingPose).length}
      data-wildlife-interaction={visibleWildlife.length ? "click-or-keyboard-greeting" : "none"}
      data-wildlife-last-reaction={wildlifeReaction.memberId || "none"}
      ref={host}
      role="group"
      tabIndex={0}
      aria-label="Interactive three-dimensional tactical plot"
      aria-describedby={`battlefield-state-note sky-model-note environment-visual-note weather-visual-note contact-visual-note wave-visual-note${visibleWildlife.length ? " wildlife-visual-note" : ""}${starfieldPlan.stars.length > 0 || starfieldPlan.nebulae.length > 0 ? " starfield-visual-note" : ""}${auroraVisibleInLayer ? " aurora-visual-note" : ""}${viewLayer === "subsurface" ? " subsurface-optics-note" : ""}`}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + - PageUp PageDown"
      onKeyDown={onLayerKeyDown}
    >
      <div className="fallback-scene" aria-hidden="true">
        <div className="fallback-stars">
          {fallbackStarNodes}
        </div>
        {auroraVisibleInLayer && <div className="fallback-aurora" style={{ mixBlendMode: "normal" }}>
          {auroraPlan.bands.map((band, index) => <i key={index} style={{
            left: `${Math.max(-105, Math.min(78, -18 + band.x * 0.92))}%`,
            top: `${Math.max(-22, 39 - band.height * (viewLayer === "surface" ? 0.82 : 0.72))}%`,
            width: `${Math.max(148, band.width * 2.32)}%`,
            minWidth: 0,
            height: `${Math.max(22, band.verticalSpan * 4.25)}%`,
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 13%, #000 87%, transparent 100%), linear-gradient(to bottom, #000 0%, #000 24%, transparent 100%)",
            maskImage: "linear-gradient(to right, transparent 0%, #000 13%, #000 87%, transparent 100%), linear-gradient(to bottom, #000 0%, #000 24%, transparent 100%)",
            WebkitMaskComposite: "source-in",
            maskComposite: "intersect",
            "--aurora-color": `#${band.color.toString(16).padStart(6, "0")}`,
            "--aurora-accent": `#${band.accentColor.toString(16).padStart(6, "0")}`,
            "--aurora-lower-edge": `#${band.lowerEdgeColor.toString(16).padStart(6, "0")}`,
            "--aurora-opacity": band.opacity,
            "--aurora-duration": `${Math.round(band.primaryPeriod)}s`,
            "--aurora-phase": `${-band.phase * 3}s`,
            "--aurora-depth": `${(index - (auroraPlan.bands.length - 1) / 2) * 24}px`,
            "--aurora-tilt": `${band.tilt}rad`,
          } as React.CSSProperties} />)}
        </div>}
        <div className={`fallback-clouds ${atmospherePlan.clouds.regime}`}>
          {atmospherePlan.clouds.masses.map((mass, index) => <i key={index} style={{
            left: `${Math.max(-18, Math.min(92, 46 + mass.x * 1.75))}%`,
            top: `${Math.max(1, 38 - mass.y * 2.35)}%`,
            width: `${Math.max(11, mass.scaleX * 2.5)}%`,
            height: `${Math.max(5, mass.scaleY * 4.25)}%`,
            opacity: mass.opacity,
            "--cloud-duration": `${Math.round(30 + 1 / mass.breathSpeed)}s`,
            "--cloud-drift-x": `${(atmospherePlan.clouds.driftX >= 0 ? 1 : -1) * (5 + mass.driftScale * 3)}%`,
            "--cloud-phase": `${-mass.phase * 4}s`,
          } as React.CSSProperties} />)}
        </div>
        <div className={`fallback-fog ${atmospherePlan.fog.classification}`}>
          {atmospherePlan.fog.banks.map((bank, index) => <i key={index} style={{ left: `${Math.max(-15, Math.min(95, 50 + bank.x * 1.8))}%`, top: `${46 + index * 6}%`, width: `${Math.max(24, bank.scaleX * 4)}%`, opacity: bank.opacity, animationDelay: `${-bank.phase * 2}s` }} />)}
        </div>
        <div className="fallback-horizon" />
        {celestialReflectionVisible && <div className={`fallback-celestial-reflection ${activeBodyKind}`} style={{ opacity: Math.sqrt(activeBodyBrightness) }}><i /><i /><i /><i /><i /></div>}
        <div className={`fallback-waves ${storming ? "storm" : precipitation}`} style={{ "--wave-heading": `${wavePlan.travelHeading}deg`, "--wave-duration": `${Math.max(2.8, 8 / wavePlan.components[0].angularSpeed)}s`, "--whitecap-opacity": wavePlan.whitecapFraction } as React.CSSProperties}>
          <i /><i /><i />
        </div>
        {storming && lightningCapable && <i className="fallback-lightning" />}
        <div className="fallback-grid" style={{ transform: `rotateX(64deg) rotateZ(${-viewTelemetry.heading}deg)` }} />
        {climate !== "ocean" && Array.from({ length: 9 }, (_, index) => <i className={`ice-floe ice-${index + 1}`} key={index} />)}
        {fallbackFleet.map((type, index) => {
          const style = { left: `${30 + ((index * 19) % 47)}%`, top: `${39 + ((index * 23) % 42)}%` };
          const kind = type.includes("submarine") ? "submarine" : type.includes("aviation") || type.includes("expeditionary") ? "aviation" : "ship";
          return <Fragment key={`${type}-${index}`}>
            <b className={`fallback-dream-halo ship ${kind}`} style={{ ...style, "--dream-duration": `${24 + unitIntervalFromIndex(index + 211) * 14}s`, "--dream-delay": `${-unitIntervalFromIndex(index + 307) * 31}s` } as React.CSSProperties} />
            <i className={`fallback-ship fallback-${type}`} style={style}><span /></i>
          </Fragment>;
        })}
        {fallbackAircraft.map((type, index) => {
          const style = { left: `${19 + ((index * 17) % 66)}%`, top: `${14 + ((index * 11) % 17)}%` };
          const shape = ROTORCRAFT.includes(type) ? "rotor" : "wing";
          return <Fragment key={`${type}-${index}`}>
            <b className={`fallback-dream-halo aircraft ${shape}`} style={{ ...style, "--dream-duration": `${24 + unitIntervalFromIndex(index + 401) * 14}s`, "--dream-delay": `${-unitIntervalFromIndex(index + 503) * 31}s` } as React.CSSProperties} />
            <i className={`fallback-aircraft ${shape}`} style={style} />
          </Fragment>;
        })}
        <div className="fallback-sea-life">
          {Array.from({ length: lifeProfile.solitaryCount + lifeProfile.schoolCount }, (_, index) => <i className={index < lifeProfile.solitaryCount ? "solitary" : "schooling"} key={index} style={{ left: `${12 + ((index * 23) % 76)}%`, top: `${24 + ((index * 17) % 57)}%`, animationDelay: `${-(index % 9) * 0.7}s` }} />)}
        </div>
        <div className="fallback-wildlife">
          {visibleWildlife.map((animal, index) => <i
            className={`wildlife-creature wildlife-${animal.kind} wildlife-${animal.medium}${animal.restingPose ? " wildlife-resting" : ""}${wildlifeReaction.memberId === animal.id ? " reacting" : ""}`}
            key={`${animal.groupId}-${animal.id}-${wildlifeReaction.memberId === animal.id ? wildlifeReaction.nonce : 0}`}
            onClick={() => reactToWildlife(animal)}
            style={{
              left: `${Math.max(4, Math.min(94, 50 + animal.x * 2.1))}%`,
              top: `${animal.medium === "air" ? Math.max(8, Math.min(52, 55 - animal.y * 3.8)) : animal.medium === "subsurface" ? Math.max(38, Math.min(88, 48 + animal.depth * 8)) : 59 + ((index * 7) % 20)}%`,
              // CSS fallback silhouettes already encode species size in their
              // native dimensions. This narrow display range preserves those
              // proportions while the WebGL avatar uses the scene scale.
              "--wildlife-scale": Math.max(0.46, Math.min(0.66, 0.42 + animal.scale * 0.45)).toFixed(2),
              "--wildlife-duration": `${Math.round(10 + 1 / animal.speed)}s`,
              "--wildlife-delay": `${(-animal.phase * 2).toFixed(1)}s`,
            } as React.CSSProperties}
          />)}
        </div>
        {visibleUnknownContacts.map((contact, index) => (
          <i
            className={`fallback-contact contact-${contact.domain}`}
            key={`${contact.domain}-${index}`}
            style={{
              left: `${Math.max(5, Math.min(94, 50 + contact.x * 2.9))}%`,
              top: `${contact.domain === "air" ? 18 + ((index * 13) % 24) : contact.domain === "surface" ? 42 + ((index * 17) % 31) : 52 + ((index * 19) % 30)}%`,
              transform: `scale(${contact.scale}) rotate(${contact.heading}rad)`,
            }}
          />
        ))}
        {precipitation !== "none" && viewLayerSupportsFallingPrecipitation(viewLayer) && <div className={`fallback-weather ${precipitation} weather-tier-${atmospherePlan.precipitation.tier} ${atmospherePlan.precipitation.presentation}`}>
          {atmospherePlan.precipitation.cells.map((cell, index) => <i key={index} style={{
            left: `${Math.max(-8, Math.min(94, 46 + cell.x * 1.75 - cell.spreadX * 1.35))}%`,
            top: `${Math.max(8, Math.min(46, 47 - cell.cloudBaseY * 2.35))}%`,
            width: `${Math.max(13, cell.spreadX * 2.7)}%`,
            "--weather-flake-size": `${Math.max(2.6, atmospherePlan.precipitation.particleSize * 0.72).toFixed(1)}px`,
            "--weather-density": `${Math.max(6, 29 - atmospherePlan.precipitation.tier * 4.2).toFixed(1)}px`,
            "--weather-phase": `${-(index * 0.47 + cell.driftScale).toFixed(2)}s`,
          } as React.CSSProperties} />)}
        </div>}
      </div>

      <div className="depth-control" role="group" aria-label="Tactical plot view">
        {VIEW_LAYERS.map((layer) => (
          <button key={layer} type="button" aria-pressed={viewLayer === layer} onClick={() => setViewLayer(layer)}>{layer}</button>
        ))}
      </div>

      <details
        className="plot-data-readout"
        open={openHudDisclosure === "plot"}
      >
        <summary id="tactical-heading" onClick={(event) => { event.preventDefault(); toggleHudDisclosure("plot", openHudDisclosure !== "plot"); }}><span className="hud-label-long">PLOT DATA</span><span className="hud-label-short">PLOT</span><b aria-hidden="true" /></summary>
        <div className="plot-data-details">
          <strong>SIMULATION GRID N-04</strong>
          <div className="plot-data-telemetry">
            <i aria-hidden="true"><b style={{ transform: `rotate(${viewTelemetry.heading}deg)` }} /></i>
            <div>
              <span>VIEW · {viewLayer.toUpperCase()}</span>
              <strong>{String(viewTelemetry.heading).padStart(3, "0")}° {viewTelemetry.direction}</strong>
              <small>ELEVATION {viewTelemetry.elevation >= 0 ? "+" : ""}{viewTelemetry.elevation}° · RANGE {viewTelemetry.distance.toFixed(1)}</small>
            </div>
          </div>
        </div>
      </details>

      <details
        className="legend"
        open={openHudDisclosure === "contacts"}
      >
        <summary onClick={(event) => { event.preventDefault(); toggleHudDisclosure("contacts", openHudDisclosure !== "contacts"); }}><span className="hud-label-long">CONTACT KEY</span><span className="hud-label-short">KEY</span><b aria-hidden="true" /></summary>
        <div className="legend-items">
          <span><i className="friendly" /> FRIENDLY</span>
          <span><i className="unknown" /> UNKNOWN</span>
          <span><i className="objective" /> OBJECTIVE</span>
          <small>{contactDescription}</small>
        </div>
      </details>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">{keyboardTelemetry}</p>

      {celestial && activeBody && (
        <CelestialHud
          celestial={celestial}
          bodyKind={activeBodyKind}
          time={time}
          scenarioDate={scenarioDate}
          viewHeading={viewTelemetry.heading}
          currentPhaseContentActive={currentPhaseContentActive}
          opticalAppearance={celestialOpticalAppearance}
          open={openHudDisclosure === "celestial"}
          onOpenChange={(open) => toggleHudDisclosure("celestial", open)}
        />
      )}

      {viewLayer === "stars" && (
        <details
          className="environment-readout star-environment-readout"
          open={openHudDisclosure === "environment"}
        >
          <summary onClick={(event) => { event.preventDefault(); toggleHudDisclosure("environment", openHudDisclosure !== "environment"); }}><strong className="hud-label-long">SKY LIGHTS</strong><strong className="hud-label-short">STARS</strong><b aria-hidden="true" /></summary>
          <div className="environment-readout-details">
            <span>{starfieldPlan.stars.length} VISIBLE LIGHTS · {skyVisibility.clarity.toUpperCase()}</span>
            <small>Crystalline canopy · foreground weather and contacts stay clear</small>
          </div>
        </details>
      )}
      {viewLayer === "subsurface" && (
        <details
          className="environment-readout life-environment-readout"
          open={openHudDisclosure === "environment"}
        >
          <summary onClick={(event) => { event.preventDefault(); toggleHudDisclosure("environment", openHudDisclosure !== "environment"); }}><strong className="hud-label-long">SUBSURFACE DATA</strong><strong className="hud-label-short">SUBSEA</strong><b aria-hidden="true" /></summary>
          <div className="environment-readout-details">
            <span>{lifeProfile.solitaryCount} VAGUE FORMS · {lifeProfile.schoolCount ? `${lifeProfile.schoolCount} SMALL SCHOOLING FORMS` : "NO SCHOOL VISIBLE"} · {visibleWildlife.length ? `${visibleWildlife.length} RECOGNIZABLE ENVIRONMENTAL ANIMALS` : "NO RECOGNIZABLE WILDLIFE"}</span>
            <small>{lifeProfile.depthLabel} · wildlife is non-tactical scenery · {starfieldPlan.stars.length} brightness-qualified celestial points · {subsurfaceOptics.description}</small>
          </div>
        </details>
      )}
      <span id="battlefield-state-note" className="visually-hidden">
        {`Viewing ${viewLayer}. Heading ${viewTelemetry.heading} degrees ${viewTelemetry.direction}; elevation ${viewTelemetry.elevation} degrees. ${region}, ${climate}, ${season}, ${time}. Weather: ${storming ? "storming with " : ""}${precipitation === "none" ? cloudCoverPhrase(clouds) : `${atmospherePlan.precipitation.presentation} ${precipitation}`}. Wind travels toward ${windHeading} degrees at ${windSpeed} knots; current travels toward ${currentHeading} degrees at ${currentSpeed} knots; resulting waves travel toward ${wavePlan.travelHeading} degrees.${atmospherePlan.stormLight.visible ? " Static low-poly lightning geometry remains visible with localized, eased, non-flashing cloud-interior light." : ""}${time === "day" ? "" : " Visible selected vessels, submarines, and aircraft retain crisp silhouettes with faint native-color halos that breathe slowly and asynchronously."}${auroraVisibleInLayer ? " Aurora is visible and described separately." : ""}${viewLayer === "stars" ? ` Visibility: ${skyVisibility.clarity}.` : ""}${viewLayer === "subsurface" ? ` ${lifeProfile.solitaryCount} vague solitary environmental forms and ${lifeProfile.schoolCount} small schooling forms appear at ${lifeProfile.depthLabel}.` : ""}`}
      </span>
      <span id="environment-visual-note" className="visually-hidden">View layers change only through the labelled buttons or Page Up and Page Down keys. Dragging and arrow keys rotate the current view without changing layers.</span>
      <span id="weather-visual-note" className="visually-hidden">{atmospherePlan.description} {time === "day" ? "Dream emission is inactive in daylight." : "Selected visible vessels, submarines, and aircraft keep hard, clean low-poly cores with thin, soft native-color halos that breathe much more slowly than stars twinkle; scene depth, fog, and waves continue to soften or cover them, and reduced motion freezes the halos."}</span>
      <span id="contact-visual-note" className="visually-hidden">{contactDescription}</span>
      <span id="wave-visual-note" className="visually-hidden">{wavePlan.description}</span>
      {visibleWildlife.length > 0 && <>
        <button type="button" className="wildlife-keyboard-greet" onClick={greetNextWildlife}>Greet a visible animal</button>
        <span id="wildlife-visual-note" className="visually-hidden">{wildlifeDescription} Non-resting animals continuously travel toward the next point on a bounded ecological route while performing species-appropriate activity. A deterministic minority of visible penguins may pause lying down; never the whole group. Clicking a resting penguin, or reaching it with the keyboard greeting control, prompts a grounded recovery to its feet, confused head scratch, and return to rest without spinning. Every response is habitat-appropriate and changes no gameplay state.</span>
      </>}
      <span id="wildlife-reaction-status" className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{wildlifeReaction.message}</span>
      {viewLayer === "subsurface" && <span id="subsurface-optics-note" className="visually-hidden">{subsurfaceOptics.description}</span>}
      {auroraVisibleInLayer && <span id="aurora-visual-note" className="visually-hidden">{auroraPlan.description}</span>}
      {(starfieldPlan.stars.length > 0 || starfieldPlan.nebulae.length > 0) && <span id="starfield-visual-note" className="visually-hidden">{starfieldDescription}</span>}
    </div>
  );
}

export default memo(Battlefield);
