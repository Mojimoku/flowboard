import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computePendulumParams,
  stepPendulum,
  GRAVITY_M_S2,
  type PendulumParams,
  type PendulumState,
} from '../lib/cardPhysics';
import type { Card, ColumnId } from '../types';

export interface FloatingCard {
  card: Card;
  left: number;
  top: number;
  width: number;
  height: number;
  transform: string;
  transformOrigin: string;
}

interface UseCardDragOptions {
  /** Greatly limits how far a grabbed card can lean (the in-app "Reduce motion" setting). */
  reduceMotion: boolean;
  onDrop: (cardId: string, columnId: ColumnId, position: { x: number; y: number }) => void;
}

interface FallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The Uncategorized section's top edge, in viewport px, captured once at drop time. */
  targetTop: number;
}

interface DragSession {
  card: Card;
  params: PendulumParams;
  state: PendulumState;
  rect: { left: number; top: number; width: number; height: number };
  grabLocal: { x: number; y: number };
  latestPointer: { x: number; y: number };
  sampledPointer: { x: number; y: number };
  velocityMPerS: { x: number; y: number };
  lastFrameTime: number;
  grabTime: number;
  rafId: number;
  fall: FallState | null;
}

// Only dampingRatio is a "feel" tuning constant (hinge/air friction isn't a
// given physical property) — the oscillation frequency itself is derived
// per-drag from real gravity, mass, and the grab geometry (see
// computePendulumParams). The angle/velocity limits are safety clamps, not
// feel — a corner grab legitimately needs to swing close to vertical.
const TUNING = {
  dampingRatio: 0.6,
  maxAngleRad: (165 * Math.PI) / 180,
  maxAngularVelocity: 30,
};
// "Reduce motion": the card may only tilt a few degrees, instead of up to 165°.
const REDUCED_TUNING = { ...TUNING, maxAngleRad: (12 * Math.PI) / 180 };
const MAX_ACCEL_M_S2 = 60; // clamps noisy/huge pointer jumps (frame drops, refocus, etc.)
const VELOCITY_SMOOTHING = 0.5;
// How long after grabbing it takes for gravity/momentum to reach full
// authority — like a hand briefly steadying what it just picked up before
// letting it swing freely.
const GRAB_RAMP_MS = 250;

// Real 9.81 m/s², converted through the card's actual 70mm scale, would
// clear the screen in a blink (a real 70mm object falls its own height in
// ~0.1s) — not a visible "fall". For this translational drop we instead
// treat the viewport height as roughly a table-height drop (~1.2m), which
// keeps it real constant-acceleration free-fall kinematics while actually
// being watchable (~0.5s to clear a typical screen).
const ASSUMED_FALL_HEIGHT_M = 1.2;

function fallGravityPxPerS2(): number {
  const pxToMetersForFall = ASSUMED_FALL_HEIGHT_M / window.innerHeight;
  return GRAVITY_M_S2 / pxToMetersForFall;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function useCardDrag({ onDrop, reduceMotion }: UseCardDragOptions) {
  const reduceMotionRef = useRef(reduceMotion);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);
  const [floating, setFloating] = useState<FloatingCard | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<ColumnId | null>(null);
  const sessionRef = useRef<DragSession | null>(null);

  const frame = useCallback((now: number) => {
    const session = sessionRef.current;
    if (!session) return;

    const dt = clamp((now - session.lastFrameTime) / 1000, 0.001, 0.033);
    session.lastFrameTime = now;

    if (session.fall) {
      const fall = session.fall;
      const g = fallGravityPxPerS2();
      fall.vy += g * dt;
      fall.x += fall.vx * dt;
      fall.y += fall.vy * dt;
      session.state.angleRad += session.state.angularVelocityRad * dt;
      if (reduceMotionRef.current) {
        const limit = REDUCED_TUNING.maxAngleRad;
        session.state.angleRad = clamp(session.state.angleRad, -limit, limit);
      }

      // Hard floor: never let it fall through the bottom of the viewport.
      // In normal operation the landing check below fires first (the
      // Uncategorized section's top is always above this), but this is a
      // safety net for edge cases (tiny window, section not yet laid out).
      const maxY = window.innerHeight - session.rect.height;
      if (fall.y > maxY) {
        fall.y = maxY;
        fall.vy = 0;
      }

      if (fall.y + session.rect.height >= fall.targetTop) {
        onDrop(session.card.id, 'uncategorized', { x: fall.x, y: fall.y });
        cancelAnimationFrame(session.rafId);
        sessionRef.current = null;
        setFloating(null);
        setDraggingCardId(null);
        setOverColumnId(null);
        return;
      }

      const degrees = (session.state.angleRad * 180) / Math.PI;
      setFloating({
        card: session.card,
        left: fall.x,
        top: fall.y,
        width: session.rect.width,
        height: session.rect.height,
        transform: `rotate(${degrees}deg)`,
        transformOrigin: '50% 50%',
      });

      session.rafId = requestAnimationFrame(frame);
      return;
    }

    const dxPx = session.latestPointer.x - session.sampledPointer.x;
    const dyPx = session.latestPointer.y - session.sampledPointer.y;
    session.sampledPointer = { ...session.latestPointer };

    const rawVx = (dxPx * session.params.pxToMeters) / dt;
    const rawVy = (dyPx * session.params.pxToMeters) / dt;
    const newVx =
      session.velocityMPerS.x + (rawVx - session.velocityMPerS.x) * VELOCITY_SMOOTHING;
    const newVy =
      session.velocityMPerS.y + (rawVy - session.velocityMPerS.y) * VELOCITY_SMOOTHING;

    let accelX = (newVx - session.velocityMPerS.x) / dt;
    let accelY = (newVy - session.velocityMPerS.y) / dt;
    session.velocityMPerS = { x: newVx, y: newVy };

    const accelMag = Math.hypot(accelX, accelY);
    if (accelMag > MAX_ACCEL_M_S2) {
      const scale = MAX_ACCEL_M_S2 / accelMag;
      accelX *= scale;
      accelY *= scale;
    }

    const rampProgress = clamp((now - session.grabTime) / GRAB_RAMP_MS, 0, 1);
    const torqueRamp = smoothstep(rampProgress);

    session.state = stepPendulum(
      session.state,
      session.params,
      { x: accelX, y: accelY },
      dt,
      reduceMotionRef.current ? REDUCED_TUNING : TUNING,
      torqueRamp,
    );

    const el = document.elementFromPoint(session.latestPointer.x, session.latestPointer.y);
    const columnEl = el?.closest<HTMLElement>('[data-column-id]');
    setOverColumnId((columnEl?.dataset.columnId as ColumnId | undefined) ?? null);

    const tx = session.latestPointer.x - (session.rect.left + session.grabLocal.x);
    const ty = session.latestPointer.y - (session.rect.top + session.grabLocal.y);
    const degrees = (session.state.angleRad * 180) / Math.PI;

    setFloating({
      card: session.card,
      left: session.rect.left,
      top: session.rect.top,
      width: session.rect.width,
      height: session.rect.height,
      transform: `translate(${tx}px, ${ty}px) rotate(${degrees}deg)`,
      transformOrigin: `${session.grabLocal.x}px ${session.grabLocal.y}px`,
    });

    session.rafId = requestAnimationFrame(frame);
  }, [onDrop]);

  const handleDragStart = useCallback(
    (card: Card, cardElement: HTMLElement, grabClientX: number, grabClientY: number) => {
      const domRect = cardElement.getBoundingClientRect();
      const rect = {
        left: domRect.left,
        top: domRect.top,
        width: domRect.width,
        height: domRect.height,
      };
      const params = computePendulumParams(rect, grabClientX, grabClientY);
      const grabLocal = { x: grabClientX - rect.left, y: grabClientY - rect.top };
      const now = performance.now();

      sessionRef.current = {
        card,
        params,
        state: { angleRad: 0, angularVelocityRad: 0 },
        rect,
        grabLocal,
        latestPointer: { x: grabClientX, y: grabClientY },
        sampledPointer: { x: grabClientX, y: grabClientY },
        velocityMPerS: { x: 0, y: 0 },
        lastFrameTime: now,
        grabTime: now,
        rafId: 0,
        fall: null,
      };

      setDraggingCardId(card.id);
      setFloating({
        card,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transform: 'translate(0px, 0px) rotate(0deg)',
        transformOrigin: `${grabLocal.x}px ${grabLocal.y}px`,
      });

      sessionRef.current.rafId = requestAnimationFrame(frame);
    },
    [frame],
  );

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    const session = sessionRef.current;
    if (!session) return;
    session.latestPointer = { x: clientX, y: clientY };
  }, []);

  const handleDragEnd = useCallback(
    (clientX: number, clientY: number) => {
      const session = sessionRef.current;
      if (!session) return;

      const el = document.elementFromPoint(clientX, clientY);
      const columnEl = el?.closest<HTMLElement>('[data-column-id]');
      const targetColumnId = columnEl?.dataset.columnId as ColumnId | undefined;

      if (targetColumnId) {
        cancelAnimationFrame(session.rafId);
        sessionRef.current = null;
        setFloating(null);
        setDraggingCardId(null);
        setOverColumnId(null);
        onDrop(session.card.id, targetColumnId, { x: clientX, y: clientY });
        return;
      }

      // Dropped over the background: let it fall, carrying its current
      // velocity and spin, straight down into Uncategorized — instead of
      // silently snapping back, or (as before) falling off the bottom of
      // the screen and re-entering from the top. Start from where it
      // actually is on screen right now (the held phase renders it via a
      // translate() offset from the grab-time rect, not at the rect
      // itself).
      const uncategorizedRect = document
        .querySelector<HTMLElement>('[data-column-id="uncategorized"]')
        ?.getBoundingClientRect();

      if (!uncategorizedRect) {
        // Shouldn't happen — the section is always rendered — but land it
        // rather than leave it stuck mid-air.
        cancelAnimationFrame(session.rafId);
        sessionRef.current = null;
        setFloating(null);
        setDraggingCardId(null);
        setOverColumnId(null);
        onDrop(session.card.id, 'uncategorized', { x: clientX, y: clientY });
        return;
      }

      setOverColumnId(null);
      session.fall = {
        x: clientX - session.grabLocal.x,
        y: clientY - session.grabLocal.y,
        vx: session.velocityMPerS.x / session.params.pxToMeters,
        vy: session.velocityMPerS.y / session.params.pxToMeters,
        targetTop: uncategorizedRect.top,
      };
      // Loop is already running via the rAF chain started in handleDragStart.
    },
    [onDrop],
  );

  useEffect(() => {
    return () => {
      if (sessionRef.current) cancelAnimationFrame(sessionRef.current.rafId);
    };
  }, []);

  return { floating, draggingCardId, overColumnId, handleDragStart, handleDragMove, handleDragEnd };
}
