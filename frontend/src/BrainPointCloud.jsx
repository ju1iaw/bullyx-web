import { useEffect, useRef } from 'react'

/**
 * Procedural point-cloud brain rendered on a 2D canvas.
 * Scroll progress (0..1) drives a shockwave explosion: the cerebrum ignites at the
 * frontal pole, blows apart into evidence fragments, then the surviving signal
 * points settle into slow orbital shells around the governed core.
 */

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const CAM_Z = 3.1
const ALPHA_STEPS = 16
const COLORS = [
  [126, 190, 138], // tissue
  [203, 236, 141], // signal
  [240, 255, 206], // core
]
const ALPHA_BASE = [1.5, 2.4, 3.4]
const SIZE_BASE = [1, 1.3, 1.9]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const ease = (v) => v * v * (3 - 2 * v)

function rand(seed) {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s)
}

// Meandering triple-sine field used as the gyri / sulci displacement, plus a
// higher-frequency octave so the surface still has texture at full density.
// Frequencies are tuned for roughly ten ridges across the cerebrum.
function folds(x, y, z) {
  const a = Math.sin(15.5 * x + 2.2 * Math.sin(10.4 * z + 0.9))
  const b = Math.sin(13.1 * y + 2.5 * Math.sin(9.6 * x + 1.7))
  const c = Math.sin(12.2 * z + 2 * Math.sin(10.8 * y + 2.4))
  const coarse = (a * b + b * c + c * a) / 3
  const fine = Math.sin(29 * x + 3.1 * Math.sin(23 * y)) * Math.sin(26 * z + 2.6 * Math.sin(25 * x))
  return coarse * 0.72 + fine * 0.28
}

// Light direction, upper-left-front of the camera.
const LX = -0.44
const LY = 0.6
const LZ = 0.67

// Tilted orbital rings the surviving evidence fragments reorganise onto.
// Rings read as deliberate structure where overlapping shells just read as dust.
function makeRing(radius, tiltX, tiltZ, rate) {
  const cxr = Math.cos(tiltX)
  const sxr = Math.sin(tiltX)
  const czr = Math.cos(tiltZ)
  const szr = Math.sin(tiltZ)
  // basis vectors of the orbit plane, tilted about X then Z
  const ux = czr
  const uy = szr
  const uz = 0
  const vx = -szr * cxr
  const vy = czr * cxr
  const vz = sxr
  return {
    radius,
    rate,
    ux,
    uy,
    uz,
    vx,
    vy,
    vz,
    nx: uy * vz - uz * vy,
    ny: uz * vx - ux * vz,
    nz: ux * vy - uy * vx,
  }
}

const RINGS = [
  makeRing(0.7, 1.24, -0.18, 1),
  makeRing(0.97, 0.62, 0.38, -0.72),
  makeRing(1.22, 1.42, 0.12, 0.55),
]

function buildGeometry(total) {
  const home = new Float32Array(total * 3)
  const norm = new Float32Array(total * 3)
  const dir = new Float32Array(total * 3)
  const speed = new Float32Array(total)
  const delay = new Float32Array(total)
  const size = new Float32Array(total)
  const wobble = new Float32Array(total)
  const ringIndex = new Uint8Array(total)
  const ringRadius = new Float32Array(total)
  const ringPhase = new Float32Array(total)
  const ringOffset = new Float32Array(total)
  const shade = new Float32Array(total)
  const settles = new Uint8Array(total)
  const tint = new Uint8Array(total)

  // shares are tuned by surface area, not volume, so the small cerebellum
  // does not end up looking denser than the cerebrum
  const cerebrum = Math.round(total * 0.87)
  const cerebellum = Math.round(total * 0.085)

  for (let i = 0; i < total; i++) {
    let x
    let y
    let z
    let lit = 1
    let mx = 0
    let my = 1
    let mz = 0

    if (i < cerebrum) {
      // --- cerebrum: tapered ellipsoid + folds + fissures ---
      // jittered Fibonacci sampling — the clean lattice shows as a spiral moiré
      const t = (i + 0.5 + (rand(i * 1.7) - 0.5) * 0.85) / cerebrum
      const uy = 1 - 2 * t
      const ring = Math.sqrt(Math.max(0, 1 - uy * uy))
      const theta = GOLDEN * i + (rand(i * 2.1) - 0.5) * 0.7
      const ux = Math.cos(theta) * ring
      const uz = Math.sin(theta) * ring

      x = ux * 0.8
      y = uy * 0.6
      z = uz * 0.95

      const front = clamp01(z / 0.95)
      const back = clamp01(-z / 0.95)
      x *= 1 - 0.3 * front * front - 0.2 * back * back
      y *= 1 - 0.18 * front * front - 0.1 * back * back
      if (y < 0) y *= 0.86
      y += 0.05

      // temporal lobe bulge on the lower lateral surface
      const temporal = Math.exp(-((y + 0.2) * (y + 0.2)) / 0.02 - ((z - 0.1) * (z - 0.1)) / 0.3)
      x += (x < 0 ? -1 : 1) * 0.1 * temporal

      const len = Math.hypot(x, y, z) || 1
      const nx = x / len
      const ny = y / len
      const nz = z / len

      const field = folds(x, y, z)
      let disp = 0.045 * field

      // bump-map the normal off the fold gradient so ridges catch the light
      const eps = 0.01
      const gx = (folds(x + eps, y, z) - folds(x - eps, y, z)) / (2 * eps)
      const gy = (folds(x, y + eps, z) - folds(x, y - eps, z)) / (2 * eps)
      const gz = (folds(x, y, z + eps) - folds(x, y, z - eps)) / (2 * eps)
      const gn = gx * nx + gy * ny + gz * nz
      mx = nx - 0.028 * (gx - gn * nx)
      my = ny - 0.028 * (gy - gn * ny)
      mz = nz - 0.028 * (gz - gn * nz)

      // longitudinal fissure between the hemispheres
      const fissure = Math.exp(-(x * x) / 0.0034) * clamp01((y + 0.1) / 0.55)
      disp -= 0.185 * fissure

      // lateral (Sylvian) fissure sweeping front-to-back on each side
      const lateral = clamp01((Math.abs(x) - 0.16) / 0.18)
      const groove = y - (-0.04 + 0.22 * z - 0.16 * z * z)
      const sylvian = lateral * Math.exp(-(groove * groove) / 0.0045)
      disp -= 0.095 * sylvian

      // crests of the fold field read bright, sulci sink into shadow — this is
      // what makes the gyri legible once the cloud is dense.
      lit = (0.07 + 0.93 * ease(clamp01((field + 0.42) / 0.84))) * (1 - 0.88 * fissure) * (1 - 0.75 * sylvian)

      const inward = 1 - rand(i * 3.7) ** 2 * 0.05
      x = x * inward + nx * disp + (x < 0 ? -1 : 1) * 0.016 * fissure
      y = y * inward + ny * disp
      z = z * inward + nz * disp
    } else if (i < cerebrum + cerebellum) {
      // --- cerebellum: dense ellipsoid with fine folia ---
      const j = i - cerebrum
      const t = (j + 0.5) / cerebellum
      const uy = 1 - 2 * t
      const ring = Math.sqrt(Math.max(0, 1 - uy * uy))
      const theta = GOLDEN * j
      const ux = Math.cos(theta) * ring
      const uz = Math.sin(theta) * ring

      x = ux * 0.29
      y = uy * 0.165
      z = uz * 0.24

      const phase = 52 * (y - 0.3 * z)
      const wave = Math.sin(phase)
      const folia = 0.014 * wave
      const vermis = -0.03 * Math.exp(-(x * x) / 0.0012)
      const push = folia + vermis
      x += ux * push
      y += uy * push
      z += uz * push
      lit = 0.42 + 0.58 * clamp01((wave + 0.6) / 1.2)

      // folia ridges perturb the normal along the striation gradient
      const gy = Math.cos(phase) * 52
      const gz = -0.3 * gy
      const gn = gy * uy + gz * uz
      mx = ux - 0.012 * (-gn * ux)
      my = uy - 0.012 * (gy - gn * uy)
      mz = uz - 0.012 * (gz - gn * uz)

      y -= 0.4
      z -= 0.53
    } else {
      // --- brain stem: tapered column dropping down and back ---
      const j = i - cerebrum - cerebellum
      const stem = total - cerebrum - cerebellum
      const t = (j + 0.5) / stem
      const ang = GOLDEN * j * 7.3
      const r = 0.105 - 0.05 * t
      x = Math.cos(ang) * r
      y = -0.3 - 0.42 * t + (rand(j * 1.3) - 0.5) * 0.02
      z = -0.14 - 0.14 * t + Math.sin(ang) * r * 0.9
      lit = 0.72
      mx = Math.cos(ang)
      my = 0.12
      mz = Math.sin(ang)
    }

    const i3 = i * 3
    home[i3] = x
    home[i3 + 1] = y
    home[i3 + 2] = z
    shade[i] = lit

    const mlen = Math.hypot(mx, my, mz) || 1
    norm[i3] = mx / mlen
    norm[i3 + 1] = my / mlen
    norm[i3 + 2] = mz / mlen

    // Blast vector stays mostly radial — heavy scatter turns the explosion into
    // structureless dust instead of an expanding brain-shaped shell.
    const len = Math.hypot(x, y, z) || 1
    let ex = x / len + (rand(i * 5.1) - 0.5) * 0.42
    let ey = y / len + (rand(i * 7.7) - 0.5) * 0.42 + 0.07
    let ez = z / len + (rand(i * 9.3) - 0.5) * 0.42
    const elen = Math.hypot(ex, ey, ez) || 1
    ex /= elen
    ey /= elen
    ez /= elen
    dir[i3] = ex
    dir[i3 + 1] = ey
    dir[i3 + 2] = ez

    speed[i] = 0.7 + rand(i * 2.3) ** 1.3 * 0.6

    // Shockwave ignites at the frontal pole and travels backwards. The window is
    // wide on purpose: mid-scroll the front is already debris while the occipital
    // half is still an intact brain, which is what sells the explosion.
    const ignition = Math.hypot(x, y - 0.05, z - 0.92) / 2.1
    delay[i] = clamp01(ignition) * 0.58 + rand(i * 8.9) * 0.07

    wobble[i] = rand(i * 4.7) * Math.PI * 2

    const c = rand(i * 11.7)
    const cls = c > 0.988 ? 2 : c > 0.93 ? 1 : 0
    tint[i] = cls

    // Destination orbit for the fragments that reorganise instead of dispersing.
    // Evidence nodes always survive — that is the point being made.
    const band = Math.floor(rand(i * 4.3) * RINGS.length)
    ringIndex[i] = band
    ringRadius[i] = RINGS[band].radius * (0.94 + rand(i * 6.1) * 0.12)
    ringPhase[i] = rand(i * 10.7) * Math.PI * 2
    ringOffset[i] = (rand(i * 12.3) - 0.5) * 0.11
    settles[i] = cls > 0 || rand(i * 2.9) < 0.3 ? 1 : 0
    size[i] = SIZE_BASE[cls] * (0.92 + rand(i * 13.1) * 0.18)
  }

  return { total, home, norm, dir, speed, delay, size, wobble, ringIndex, ringRadius, ringPhase, ringOffset, shade, settles, tint }
}

const geometryCache = new Map()
function getGeometry(total) {
  if (!geometryCache.has(total)) geometryCache.set(total, buildGeometry(total))
  return geometryCache.get(total)
}

const styleCache = COLORS.flatMap(([r, g, b]) =>
  Array.from({ length: ALPHA_STEPS }, (_, a) => `rgba(${r},${g},${b},${((a + 0.5) / ALPHA_STEPS).toFixed(3)})`),
)

export default function BrainPointCloud({ progressRef, className = '' }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return undefined

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = window.innerWidth < 760 ? 18000 : 42000
    const geo = getGeometry(total)

    const bucketCount = COLORS.length * ALPHA_STEPS
    const tmpX = new Float32Array(total)
    const tmpY = new Float32Array(total)
    const tmpS = new Float32Array(total)
    const tmpB = new Uint8Array(total)
    const outX = new Float32Array(total)
    const outY = new Float32Array(total)
    const outS = new Float32Array(total)
    const counts = new Int32Array(bucketCount)
    const cursor = new Int32Array(bucketCount)

    let raf = 0
    let onScreen = true
    let visibilityCountdown = 0
    let smoothed = 0
    let seeded = false
    let stride = 1
    let frameEma = 16
    let lastFrame = 0
    const started = performance.now()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      // deliberately capped low: fewer backing pixels keeps the cloud reading
      // as a dense surface rather than isolated specks on hidpi screens
      const dpr = Math.min(1.2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
    }

    const render = (now) => {
      const target = clamp01(progressRef?.current ?? 0)
      if (!seeded) {
        smoothed = target
        seeded = true
      }
      // catch up fast on big jumps (anchor links, scroll restoration), ease on
      // ordinary scrolling
      const gap = Math.abs(target - smoothed)
      smoothed += (target - smoothed) * (gap > 0.25 ? 0.45 : 0.14)
      const p = reduced ? 0 : smoothed
      const t = reduced ? 0 : now - started

      const W = canvas.width
      const H = canvas.height
      ctx.clearRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'lighter'

      const base = Math.min(W, H)
      const focal = 1.16 * base * (1 - 0.36 * p)
      const cx = W / 2
      const cy = H / 2
      // dropping to every other point halves the draw calls; the survivors grow
      // and brighten so the cloud keeps roughly the same visual density
      const sizeScale = (base / 1000) * 1.45 * (stride > 1 ? 1.3 : 1)
      const strideGain = stride > 1 ? 1.35 : 1

      // rock around the lateral profile rather than spinning through the
      // front/back views, where the silhouette stops reading as a brain
      const spinY = 1.42 + Math.sin(t * 0.00021) * 0.42 + p * 0.85
      const tiltX = -0.1 + Math.sin(t * 0.00016) * 0.07 + p * 0.24
      const cosY = Math.cos(spinY)
      const sinY = Math.sin(spinY)
      const cosX = Math.cos(tiltX)
      const sinX = Math.sin(tiltX)

      const blast = ease(clamp01((p - 0.18) / 0.42))
      const settle = ease(clamp01((p - 0.6) / 0.28))
      // soft radial cutoff so drifting debris never meets the canvas rectangle
      const fadeStart = base * 0.34
      const fadeSpan = base * 0.15
      const fadeStartSq = fadeStart * fadeStart
      const fadeEndSq = (fadeStart + fadeSpan) * (fadeStart + fadeSpan)
      const breathe = 1 + 0.02 * Math.sin(t * 0.0016)
      const sweep = Math.sin(t * 0.00055) * 0.95
      const orbitSpin = t * 0.00026

      counts.fill(0)
      let visible = 0

      for (let i = 0; i < total; i += stride) {
        const i3 = i * 3
        const hz = geo.home[i3 + 2]
        const d0 = geo.delay[i]
        const local = ease(clamp01((blast - d0) / (1 - d0 + 1e-4)))
        const spread = local * geo.speed[i] * 0.72

        let x = geo.home[i3] * breathe + geo.dir[i3] * spread
        let y = geo.home[i3 + 1] * breathe + geo.dir[i3 + 1] * spread
        let z = hz * breathe + geo.dir[i3 + 2] * spread

        if (local > 0) {
          const tb = t * 0.0012 + geo.wobble[i]
          const amp = 0.05 * local
          x += Math.sin(tb) * amp
          y += Math.cos(tb * 1.21) * amp
          z += Math.sin(tb * 0.83) * amp
        }

        // debris dims as it travels; the fragments that will reorganise hold on
        let alphaMul = 1 - (geo.settles[i] ? 0.22 : 0.58) * local
        if (settle > 0) {
          if (geo.settles[i]) {
            const ring = RINGS[geo.ringIndex[i]]
            const a = geo.ringPhase[i] + orbitSpin * ring.rate
            const ca = Math.cos(a) * geo.ringRadius[i]
            const sa = Math.sin(a) * geo.ringRadius[i]
            const off = geo.ringOffset[i]
            const tx = ring.ux * ca + ring.vx * sa + ring.nx * off
            const ty = ring.uy * ca + ring.vy * sa + ring.ny * off
            const tz = ring.uz * ca + ring.vz * sa + ring.nz * off
            x += (tx - x) * settle
            y += (ty - y) * settle
            z += (tz - z) * settle
          } else {
            const drift = 1 + settle * 0.9
            x *= drift
            y *= drift
            z *= drift
            alphaMul *= 1 - settle * 0.9
          }
        }

        const rx = x * cosY + z * sinY
        const rz0 = z * cosY - x * sinY
        const ry = y * cosX - rz0 * sinX
        const rz = y * sinX + rz0 * cosX

        const depth = CAM_Z - rz
        if (depth < 0.4) continue
        const inv = focal / depth
        const px = cx + rx * inv
        const py = cy - ry * inv
        const ox = px - cx
        const oy = py - cy
        const radialSq = ox * ox + oy * oy
        if (radialSq > fadeEndSq) continue
        const vignette = radialSq > fadeStartSq ? 1 - ease((Math.sqrt(radialSq) - fadeStart) / fadeSpan) : 1

        // surface lighting fades out as the cloud disperses — debris has no surface
        const nxr = geo.norm[i3] * cosY + geo.norm[i3 + 2] * sinY
        const nz0 = geo.norm[i3 + 2] * cosY - geo.norm[i3] * sinY
        const nyr = geo.norm[i3 + 1] * cosX - nz0 * sinX
        const nzr = geo.norm[i3 + 1] * sinX + nz0 * cosX
        const lambert = clamp01(nxr * LX + nyr * LY + nzr * LZ)
        const facing = 0.1 + 0.9 * clamp01(nzr * 1.3 + 0.25)
        const surface = geo.shade[i] * (0.35 + 0.65 * lambert) * facing
        // loose fragments twinkle so the dispersed cloud never reads as flat noise
        const loose = 0.5 + 0.28 * Math.sin(t * 0.0021 + geo.wobble[i] * 3.1)
        const lit = surface + (loose - surface) * local

        // evidence nodes only flare up once the brain starts coming apart
        const cls = geo.tint[i]
        const gain = ALPHA_BASE[0] + (ALPHA_BASE[cls] - ALPHA_BASE[0]) * (0.18 + 0.82 * local)
        let alpha = gain * strideGain * lit * (0.35 + 0.65 * clamp01((4.7 - depth) / 2.9)) * alphaMul * vignette
        if (blast < 1) {
          const dz = hz - sweep
          alpha *= 1 + 0.9 * Math.exp(-(dz * dz) / 0.01) * (1 - blast)
        }
        if (alpha < 0.01) continue
        if (alpha > 1) alpha = 1

        let sizePx = geo.size[i] * (0.72 + 0.38 * lit) * sizeScale * (CAM_Z / depth)
        if (sizePx < 0.7) sizePx = 0.7

        const bucket = cls * ALPHA_STEPS + Math.min(ALPHA_STEPS - 1, (alpha * ALPHA_STEPS) | 0)
        tmpX[visible] = px
        tmpY[visible] = py
        tmpS[visible] = sizePx
        tmpB[visible] = bucket
        counts[bucket] += 1
        visible += 1
      }

      let offset = 0
      for (let b = 0; b < bucketCount; b++) {
        cursor[b] = offset
        offset += counts[b]
      }
      for (let n = 0; n < visible; n++) {
        const slot = cursor[tmpB[n]]
        cursor[tmpB[n]] = slot + 1
        outX[slot] = tmpX[n]
        outY[slot] = tmpY[n]
        outS[slot] = tmpS[n]
      }

      let cursorStart = 0
      for (let b = 0; b < bucketCount; b++) {
        const count = counts[b]
        if (!count) continue
        ctx.fillStyle = styleCache[b]
        const end = cursorStart + count
        for (let n = cursorStart; n < end; n++) {
          const s = outS[n]
          if (s > 3.2) {
            ctx.beginPath()
            ctx.arc(outX[n], outY[n], s * 0.5, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillRect(outX[n] - s * 0.5, outY[n] - s * 0.5, s, s)
          }
        }
        cursorStart = end
      }

      ctx.globalCompositeOperation = 'source-over'
    }

    // The loop always stays scheduled and cheaply bails when off-screen.
    // Visibility is re-derived from the element's own rect a few times a second
    // rather than latched from an observer callback — a missed notification
    // would otherwise leave the canvas frozen on a stale frame.
    const loop = (now) => {
      raf = window.requestAnimationFrame(loop)
      if (visibilityCountdown <= 0) {
        visibilityCountdown = 10
        const rect = canvas.getBoundingClientRect()
        const wasOffScreen = !onScreen
        onScreen = rect.bottom > -200 && rect.top < window.innerHeight + 200
        if (onScreen && wasOffScreen) resize()
      }
      visibilityCountdown -= 1
      if (!onScreen) {
        lastFrame = 0
        return
      }
      if (lastFrame) {
        const delta = now - lastFrame
        // ignore tab-restore spikes, they are not a rendering-cost signal
        if (delta < 200) frameEma += (delta - frameEma) * 0.08
        if (stride === 1 && frameEma > 26) stride = 2
        else if (stride === 2 && frameEma < 15) stride = 1
      }
      lastFrame = now
      render(now)
    }

    resize()

    // The canvas often has no layout box yet when the effect runs, so sizing has
    // to come from the observer rather than this first call.
    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduced) render(started)
    })
    resizeObserver.observe(canvas)

    if (reduced) {
      render(started)
      return () => resizeObserver.disconnect()
    }

    raf = window.requestAnimationFrame(loop)

    return () => {
      resizeObserver.disconnect()
      if (raf) window.cancelAnimationFrame(raf)
    }
  }, [progressRef])

  return (
    <canvas
      ref={canvasRef}
      className={`bx2-brain-canvas ${className}`}
      role="img"
      aria-label="Point-cloud model of a company brain exploding into evidence fragments"
    />
  )
}
