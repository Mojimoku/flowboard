const CARD_MASS_KG = 0.5;
const CARD_WIDTH_M = 0.07;
export const GRAVITY_M_S2 = 9.81;

export interface PendulumParams {
  massKg: number;
  /** Vector from the grab point to the card's center of mass, in meters, in the card's own unrotated frame. */
  pivotToCenterLocal: { x: number; y: number };
  /** Moment of inertia about the grab point (parallel-axis theorem) — constant for the life of a drag, since it's a rigid body. */
  momentOfInertia: number;
  /** Scale factor to convert on-screen pixels to meters, derived from the card's real width. */
  pxToMeters: number;
  /**
   * Natural angular frequency of this card as a real physical pendulum
   * hanging from its actual grab point: sqrt(m·g·d / I), where d is the
   * distance from the grab point to the center of mass. Zero if grabbed
   * exactly at the center of mass (no lever arm for gravity to act on).
   */
  naturalFrequency: number;
}

export interface PendulumState {
  angleRad: number;
  angularVelocityRad: number;
}

export interface PendulumTuning {
  /** unitless damping ratio (0 = never settles, 1 = no overshoot) — stands in for hinge/air friction, which isn't a given physical constant. */
  dampingRatio: number;
  /** safety clamp, not a "feel" parameter — keeps the sim bounded under pathological input. */
  maxAngleRad: number;
  maxAngularVelocity: number;
}

/** Derives the rigid-body parameters for a card grabbed at a specific point, given its on-screen box at grab time. */
export function computePendulumParams(
  rect: { left: number; top: number; width: number; height: number },
  grabClientX: number,
  grabClientY: number,
): PendulumParams {
  const pxToMeters = CARD_WIDTH_M / rect.width;
  const heightM = rect.height * pxToMeters;

  const grabLocalX = grabClientX - rect.left;
  const grabLocalY = grabClientY - rect.top;
  const centerLocalX = rect.width / 2;
  const centerLocalY = rect.height / 2;

  const pivotToCenterLocal = {
    x: (centerLocalX - grabLocalX) * pxToMeters,
    y: (centerLocalY - grabLocalY) * pxToMeters,
  };

  const distance = Math.hypot(pivotToCenterLocal.x, pivotToCenterLocal.y);

  // Flat rectangular plate, moment of inertia about its own center for
  // rotation in the screen plane, shifted to the grab point.
  const momentOfInertiaAboutCenter =
    (CARD_MASS_KG / 12) * (CARD_WIDTH_M * CARD_WIDTH_M + heightM * heightM);
  const momentOfInertia =
    momentOfInertiaAboutCenter + CARD_MASS_KG * distance * distance;

  const naturalFrequency =
    distance > 0
      ? Math.sqrt((CARD_MASS_KG * GRAVITY_M_S2 * distance) / momentOfInertia)
      : 0;

  return {
    massKg: CARD_MASS_KG,
    pivotToCenterLocal,
    momentOfInertia,
    pxToMeters,
    naturalFrequency,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Advances the pendulum simulation by dt seconds, given the current
 * acceleration of the pivot (the point pinned to the cursor).
 *
 * Two torques act on the card about the grab point: an inertial torque from
 * the accelerating pivot (the "fling"), and real gravity pulling the center
 * of mass straight down — the same as any hand-held pendulum. Where that
 * settles depends entirely on the grab point: dead-center means no lever
 * arm and no gravity torque at all (it just stays as grabbed), while an
 * off-center grab swings until the center of mass hangs directly below the
 * pivot.
 *
 * `torqueRamp` (0..1) scales both of those torques — a fresh grab starts
 * near 0, like a hand momentarily steadying what it just picked up, and
 * ramps to 1 (full physical response) shortly after. Damping is exempt:
 * it only opposes existing motion, which is near-zero during the ramp
 * anyway, and should stay fully authoritative once the card is moving.
 */
export function stepPendulum(
  state: PendulumState,
  params: PendulumParams,
  pivotAcceleration: { x: number; y: number },
  dt: number,
  tuning: PendulumTuning,
  torqueRamp: number,
): PendulumState {
  const { x: rx0, y: ry0 } = params.pivotToCenterLocal;
  const cos = Math.cos(state.angleRad);
  const sin = Math.sin(state.angleRad);
  // Center-of-mass offset rotates with the body.
  const rx = rx0 * cos - ry0 * sin;
  const ry = rx0 * sin + ry0 * cos;

  // In the pivot's (non-inertial) reference frame, the accelerating pivot
  // produces a pseudo-force on the center of mass: F = -m * a_pivot.
  const fx = -params.massKg * pivotAcceleration.x;
  const fy = -params.massKg * pivotAcceleration.y;
  const inertialTorque = (rx * fy - ry * fx) * torqueRamp; // z-component of r × F

  // Gravity acts straight down (screen +y). Its torque about the pivot is
  // rx * m*g — the horizontal offset is the lever arm for a vertical force.
  const gravityTorque = rx * params.massKg * GRAVITY_M_S2 * torqueRamp;

  const dampingCoefficient =
    2 * tuning.dampingRatio * params.momentOfInertia * params.naturalFrequency;
  const dampingTorque = -dampingCoefficient * state.angularVelocityRad;

  const angularAcceleration =
    (inertialTorque + gravityTorque + dampingTorque) / params.momentOfInertia;

  let angularVelocityRad = state.angularVelocityRad + angularAcceleration * dt;
  angularVelocityRad = clamp(
    angularVelocityRad,
    -tuning.maxAngularVelocity,
    tuning.maxAngularVelocity,
  );

  let angleRad = state.angleRad + angularVelocityRad * dt;
  if (angleRad > tuning.maxAngleRad) {
    angleRad = tuning.maxAngleRad;
    if (angularVelocityRad > 0) angularVelocityRad = 0;
  } else if (angleRad < -tuning.maxAngleRad) {
    angleRad = -tuning.maxAngleRad;
    if (angularVelocityRad < 0) angularVelocityRad = 0;
  }

  return { angleRad, angularVelocityRad };
}
