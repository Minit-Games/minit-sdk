// @minit-games/sdk — tutorial visual design tokens (bundled defaults).
//
// Games must NOT edit this file or pass per-call style overrides unless the
// creator explicitly requests a custom look. Change tokens here only when
// updating the SDK-wide tutorial appearance for all drops.

export const TUTORIAL_THEME = {
	// Design space every LENGTH token below is authored in. A game that
	// renders a fixed logical surface of this size (the `width` / `height`
	// passed to createTutorialOverlay) consumes the tokens 1:1.
	//
	// A game with a FLUID canvas — one sized in CSS pixels straight from
	// window.innerWidth, passing no width/height — would otherwise consume
	// them as raw px: on a 324px-wide phone a 48px message inside 48px of
	// padding and a 100px screen margin leaves a 120px text budget, so the
	// pill wraps one word per line and fills the screen. `primitives/pill.js`
	// therefore scales its layout tokens by the same contain-fit factor a
	// fixed surface of this size would get, which keeps the card at the same
	// FRACTION of the screen in both modes. That correction applies to the
	// FLUID path only — in fixed-logical mode the layer transform already
	// does it, and doing both would shrink the card twice.
	referenceWidth: 960,
	referenceHeight: 1480,

	// Default zIndex for the overlay container. Sits above gameplay
	// (typically <100) but below modal screens (e.g. game-over at zIndex 10000).
	zIndex: 1000,

	// Modal pill (showPill) — the only text overlay. Always modal: blocks
	// input via a full-screen backdrop, dismissed by tapping the OK button.
	pill: {
		bgColor: 0x0d2845,
		bgAlpha: 0.95,
		// padX / padY: padding INSIDE the card (between text and the
		// rounded edge). Increase to give the message more breathing room.
		padX: 48,
		padY: 36,
		// screenMarginX: minimum horizontal gap between the card edge and
		// the canvas edge, in app.screen units. Text auto-wraps so the
		// card never grows wider than `app.screen.width - 2 * screenMarginX`.
		//
		// Sized for the worst-case stack of TWO horizontal overscans some
		// games apply on top of each other:
		//   1. Canvas DOM overscan: e.g. zip's `#gameCanvas { width:110%;
		//      left:-5% }` inside an `overflow:hidden` wrapper hides ~5%
		//      of PIXI's screen on each side (~48 units on a 960-wide
		//      canvas), no matter the viewport.
		//   2. Cover-fit wrapper crop: portrait phones rendering a
		//      portrait-but-narrower-ratio canvas (zip is 960×1480, ratio
		//      0.65; iPhone Pro 393×852 is 0.46) trigger the maxCrop=5%
		//      fallback, hiding another ~5% of canvas width per side.
		// Combined worst case ≈ 10% per side ≈ 96 units. We pick 100 to
		// keep a small visible breathing buffer beyond that. Bump higher
		// to push the pill further in; lower for contain-fit games where
		// neither overscan applies.
		screenMarginX: 100,
		cornerRadius: 28,
		// Default delay (seconds) before the modal pops in when the caller
		// doesn't specify one. Input is blocked for the full duration so
		// the player can't squeeze in a tap during the wait. The small
		// pause prevents pills from materialising mid-animation right when
		// the game state changes (e.g. a tile finishes its hop into place
		// and 50ms later a pill explains it). Pass `delay: 0` to opt out.
		defaultDelaySeconds: 0.5,
		// Minimum delay (seconds) enforced on the FIRST pill of a tutorial,
		// regardless of what the caller passes. The very first pill appears
		// right as the game finishes booting/dealing, so it needs more
		// breathing room than later pills to avoid popping in mid-load.
		// `showPill` floors the first pill's delay to this value — a game
		// passing `delay: 0` (or omitting it) on its intro pill still waits
		// this long; a game passing a larger delay (e.g. to let a board
		// animation finish) keeps its larger value.
		firstPillMinDelaySeconds: 0.75,
		// Lato isn't loaded by any game today — text falls back to the system
		// sans-serif. The reference is kept so games can opt into a Lato
		// @font-face (or similar) later without changing this file.
		fontFamily: 'Lato, sans-serif',
		// Single source of truth for pill font size across every game.
		fontSize: 48,
		// Multi-line vertical spacing as a multiple of fontSize.
		lineHeightFactor: 1.25,
		fontColor: 0xffffff,
		fontWeight: 'bold',
		dropShadow: {
			color: 0x000000,
			alpha: 1,
			blur: 3,
			distance: 8,
			angle: Math.PI / 4,
		},
		outline: {
			color: 0x1f467f,
			width: 4,
		},
		// Built-in pill SFX. The MP3s are bundled automatically into
		// every game's dist/ via Vite's static import tracing — see the
		// imports at the top of primitives/pill.js. Disable both by
		// setting `enabled: false`; tune individual volumes via
		// popInVolume / okVolume (0..1).
		sounds: {
			enabled: true,
			// Conservative defaults: pill SFX should sit alongside game
			// audio (music ≈ 0.2, SFX bus ≈ 1.0), not dominate it.
			popInVolume: 0.5,
			okVolume: 0.6,
		},
	},

	// Modal chrome: backdrop that blocks input + the OK button that closes
	// the pill. Visual styling lives entirely here so every modal looks
	// identical in every game.
	modal: {
		// Invisible full-screen layer behind the pill. Its sole job is to
		// capture pointer events so taps don't reach the gameplay underneath
		// — it is intentionally NOT a dimmer (alpha = 0). PIXI still
		// hit-tests it because eventMode is set on the Graphics in pill.js;
		// alpha only affects rendering, not the hit-test pipeline.
		backdrop: {
			color: 0x000000,
			alpha: 0,
		},
		// Dismissal: tapping ANYWHERE on the modal (button or surrounding
		// blocker) closes the pill — the entire surface is a "tap to
		// continue" target. The button itself still shows its press
		// visual when the pointer is over it, but it isn't required as
		// the hit target; players don't have to aim for it.
		//
		// Rendered from a sprite asset (shared/tutorial/assets/button-ok.png)
		// rather than drawn with Graphics, so artwork tweaks happen in the
		// PNG and the code only needs display size + animation tokens.
		okButton: {
			// Display HEIGHT of the sprite in app.screen units. Width
			// follows the asset's natural aspect ratio so the button stays
			// pill-shaped regardless of the source resolution.
			height: 100,
			// Gap between the message text (or footer row) and the button.
			// Bigger value ⇒ more breathing room under the copy.
			marginTop: 56,
			// Extra space BELOW the OK button, between its bottom edge
			// and the inner bottom of the card. Stacks on top of the
			// symmetric `pill.padY` so the bottom inset feels visually
			// roomier than the top without pushing the message text
			// downward too. Bump this if the button is hugging the
			// rounded corner; lower to tighten the modal vertically.
			marginBottom: 8,
			// Visual feedback scale while a pointer is held over the button.
			pressedScale: 0.94,
			// Independent reveal animation: the OK button is HIDDEN
			// while the card itself pops in, and only fades/scales in
			// `openDelayMs` after the pill begins popping in. This
			// draws the player's eye to the message first, then
			// reveals the dismiss target. Dismissal is suppressed
			// until the reveal starts (a player can't accidentally
			// tap-to-close before they've seen the button).
			//
			// Tweak guide:
			//   openDelayMs    — wait between pill open and button reveal.
			//   openDurationMs — length of the button's own fade/scale-in.
			//   openFromScale  — start scale of the reveal (overshoots to 1).
			//   openFromAlpha  — start alpha of the reveal (fades to 1).
			openDelayMs:    250,
			openDurationMs: 240,
			openFromScale:  0.6,
			openFromAlpha:  0,
			// Subtle "bubble" pop that fires at a randomised interval while
			// the pill is sitting open. Replaces the old constant scale
			// pulse so the button reads as static-but-alive instead of
			// breathing nonstop.
			//
			// Tweak guide:
			//   minIntervalMs / maxIntervalMs — frequency window between
			//     bubbles. Picked uniformly at random each cycle. Currently
			//     1–2 s; widen for sparser pops.
			//   durationMs   — length of a single bubble. Lower = snappier.
			//   peakScale    — how big the bubble grows at its apex.
			//                  1.05 = barely there, 1.15 = punchy.
			//   preDipScale  — tiny squash BEFORE the peak for an "anticipation"
			//                  feel. Set to 1.0 to disable; lower (e.g. 0.95)
			//                  for a more cartoony anticipation.
			idleBubble: {
				minIntervalMs: 1000,
				maxIntervalMs: 2000,
				durationMs:    420,
				peakScale:     1.125,
				preDipScale:   0.9625,
			},
		},
		// "Nudge" feedback fired when the player taps the dead space
		// OUTSIDE the pill card. Pulls the player's eye back to the
		// modal by flashing the outline white and pulsing the card's
		// scale around its center. Bounce and flash run simultaneously
		// from the same start time; the longer of the two governs
		// total length.
		//
		// Tweak guide:
		//   bouncePeakScale   — peak scale factor at the midpoint of
		//                       the bounce. 1.0 = no change, 1.05 =
		//                       barely there, 1.12 = punchy. Composes
		//                       on top of the current phase scale so
		//                       it works during popIn / shown alike.
		//   bounceDurationMs  — full up-and-back cycle (single half-
		//                       sine, peaks at the midpoint).
		//   flashCount        — number of 0→1→0 flashes on the white
		//                       outline overlay.
		//   flashDurationMs   — total time across all flashes.
		//   flashColor        — outline colour during the flash. White
		//                       reads as "look here" against any pill
		//                       background.
		//   flashWidthPx      — stroke width of the flash outline.
		//                       Wider than the normal pill outline so
		//                       it stays visible over the resting one.
		nudge: {
			bouncePeakScale:  1.08,
			bounceDurationMs: 200,
			flashCount:       3,
			flashDurationMs:  620,
			flashColor:       0xffffff,
			flashWidthPx:     6,
		},
		// Pop-in: scale-up with overshoot, like a sprung iOS/Android dialog.
		// Uses easeOutBack so the card briefly overshoots ~10% past 1.0
		// before settling — this is what gives the "snappy" feel.
		popIn: {
			durationMs: 240,
			fromScale: 0.6,    // start visibly smaller — pops INTO existence
			fromAlpha: 0,
		},
		// Pop-out: quicker than the entrance with a quadratic ease-in. The
		// card shrinks slightly and fades — fast enough that a follow-up
		// pill can pop in immediately without dead air.
		popOut: {
			durationMs: 180,
			toScale: 0.85,
			toAlpha: 0,
		},
	},

	// Pulsing finger over expanding ripple rings
	finger: {
		// Default emoji per direction. The pointing tip determines the anchor.
		glyph: { down: '👇', up: '👆', left: '👈', right: '👉' },
		// Anchor: where in the glyph the "fingertip" is. Determines what
		// (x, y) means when you call showFinger.
		anchor: {
			down:  { x: 0.5, y: 1.0 },  // tip at bottom of glyph
			up:    { x: 0.5, y: 0.0 },  // tip at top
			left:  { x: 0.0, y: 0.5 },  // tip at left
			right: { x: 1.0, y: 0.5 },  // tip at right
		},
		fontSize: 108,
		// Vertical bob applied perpendicular to the pointing axis, in px
		bobAmplitudePx: 10,
		// Full sin cycle in ms. Preserves the legacy ~2.2s feel (original code
		// hardcoded sin(time/350), period = 2π·350 ≈ 2199ms).
		bobPeriodMs: 2200,
		// Distance the visible fingertip sits from the target point along the
		// pointing axis. Two parts:
		//   gapPx        — clear gap between the visible fingertip and the
		//                  target element (so the hand body is clearly OFF
		//                  the highlight, not covering it).
		//   tipInsetFactor — emoji glyphs have transparent padding around
		//                  the visible content. The fingertip pixel is
		//                  inside the bounding box edge by ~this fraction
		//                  of fontSize. We compensate by shifting the
		//                  emoji further from the anchor so the *visible*
		//                  fingertip — not the bbox edge — lands at the
		//                  target + gap.
		hoverOffsetPx: 24,
		tipInsetFactor: 0.12,
	},

	// Two ripple rings expanding outward from the anchor point
	ripple: {
		color: 0xffffff,
		radiusPx: 56,
		periodMs: 1600,
		strokeMaxPx: 7,             // base stroke width when the ring is at radius 0
	},

	// Standalone ripple used to mark a static target the player should act
	// on (build cell, exit tile, level-up power-up, ...). Same expanding-
	// ring animation as the ripple beneath `showFinger`, but rendered on
	// its own — no finger emoji, no occlusion of the highlighted element.
	//
	// We share the visual language with `ripple` (above) on purpose so
	// "finger + highlight pointing at the same target" reads as one unit,
	// and bumped no individual token here — defaults match the finger
	// ripple. Override per-call with `radius` / `pulseScale` to match the
	// size of the element you're highlighting.
	highlight: {
		color: 0xffffff,
		radiusPx: 56,
		strokeMaxPx: 7,        // initial stroke width when ring is at radius 0
		periodMs: 1600,        // full life of one ring (two rings, 180° out of phase)
	},

	// Swipe finger that travels from one point to another.
	swipe: {
		fontSize: 132,
		// Default glyph per orientation. 👆 (finger pointing UP) reads
		// as a hand approaching the screen FROM BELOW — i.e. "bottom-
		// up". 👇 (finger pointing DOWN) reads as a hand approaching
		// from above — i.e. "top-down". Keep these matched with
		// `tipAnchor` below so the visible fingertip rides the path.
		glyph: { up: '👆', down: '👇' },
		// Anchor the emoji so the *visible fingertip* (not the bounding-
		// box centre) lies on the travel path. For 👆 the fingertip is
		// near the TOP of the bbox (y close to 0); for 👇 it's near the
		// BOTTOM (y close to 1). The small inset compensates for the
		// emoji's transparent padding so the tip pixel — not the empty
		// space — rides the path.
		tipAnchor: {
			up:   { x: 0.5, y: 0.12 },
			down: { x: 0.5, y: 0.88 },
		},
		// One full A → B sweep including the press-down + lift book-ends
		// of the gesture loop (see `gesture` below). Travel itself fits
		// inside the `pressed` phase; press-down/lift/gap eat fixed
		// chunks at the ends.
		cycleDurationMs: 1500,
		// DEPRECATED: kept for back-compat with existing call sites that
		// pass these. The press-loop replaces the echo trail (the hand
		// itself now visibly presses/lifts to convey motion). Values here
		// are unused by the runtime.
		echo: {
			count: 0,
			fontSizeStepPx: 18,
			lagSteps: [0.07, 0.14, 0.21],
			alphaSteps: [0.45, 0.25, 0.12],
		},
	},

	// Gesture press-loop. ALL tutorial fingers (static + travelling)
	// share the same lifecycle:
	//   gap        — invisible pause between cycles (hand off-glass)
	//   pressDown  — hand scales liftedScale → 1 + alpha liftedAlpha → 1
	//                ("hand approaches the glass and touches down")
	//   pressed    — hand at full alpha, current size; gesture-specific
	//                cue plays at the fingertip (sparkles / slow ripples
	//                / fingertip ring). For swipe, the hand also travels
	//                A→B during this phase.
	//   lift       — hand scales 1 → liftedScale + alpha 1 → liftedAlpha
	//                ("hand pulls away from the glass")
	// Then loops back to `gap`. Per-gesture overrides only need to set
	// `cueDurationMs` and the cue-specific tokens; the press timings are
	// shared so every gesture feels mechanically the same.
	gesture: {
		// "Lifted off the glass" appearance — hand renders bigger and
		// translucent so the press-down reads as approaching the screen.
		liftedScale: 1.4,
		liftedAlpha: 0.5,
		pressDownMs: 220,
		liftMs: 180,
		// Quiet beat between lift and the next press-down — gives the
		// loop visible rhythm instead of immediate retap.
		loopGapMs: 240,

		// Tap: a quick radial sparkle burst around the fingertip,
		// modelled after the standard "tap" cursor icon (8 short lines
		// flying outward).
		tap: {
			cueDurationMs: 360,
			sparkleCount: 8,
			// Sparkle lines start as short stubs hugging the fingertip
			// then expand outward as the cue plays.
			sparkleInnerStartPx: 14,
			sparkleInnerEndPx: 28,
			sparkleOuterStartPx: 22,
			sparkleOuterEndPx: 50,
			sparkleStrokePx: 5,
			sparkleColor: 0xffffff,
		},

		// Long press: slow concentric ripples expanding outward from the
		// fingertip while the hand stays pressed. Slower than the
		// generic ripple (`ripple.periodMs`) so the gesture reads as
		// "hold", not "tap".
		longPress: {
			cueDurationMs: 1400,
			ringRadiusPx: 64,
			ringStrokeMaxPx: 6,
			ringPeriodMs: 1400,
			ringColor: 0xffffff,
		},

		// Swipe: a single stroked ring around the fingertip at fixed
		// size, present throughout the travel portion of the cycle.
		// The moving hand carries the motion — pulsing the ring on top
		// would add visual noise without information.
		swipe: {
			ringRadiusPx: 36,
			ringStrokePx: 5,
			ringColor: 0xffffff,
		},
	},
};
