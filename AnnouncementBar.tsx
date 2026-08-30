// CU Announcement Bar — Framer Code Component
//
// Implements Figma node 219:477 (Chandigarh University Website New).
// Exact geometry from the design (bar 684x53 at the reference copy length):
//   8 pad | 32 arrow | 16 | copy | 16 | CTA | 4 | 32 arrow | 8 pad
//   row height 37, corner radius 30, CTA #ff3b4d, copy 18px @ 90% white.
//
// Everything an editor needs is a property control — no code edits required:
//   • 1–6 announcements, each with its own CTA toggle / copy / link
//   • prev+next arrows (auto-hidden at a single announcement), PNG-uploadable
//   • auto-rotate interval (2s default)
//   • max bar width (1200px default); copy marquees when it would overflow
//
// Exports:
//   default AnnouncementBar        — standalone Framer component
//   AnnouncementBarView            — inner view, accepts a ref (see handle)
//   AnnouncementBarHandle          — imperative { setHideProgress(0..1) }
//   announcementBarControls        — property controls, spreadable into a host

import { addPropertyControls, ControlType } from "framer"
import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from "react"

// ── Design constants (from Figma metadata) ──
export const MAX_ANNOUNCEMENTS = 6

const BAR_PADDING = 8
const BAR_RADIUS = 30
const ROW_HEIGHT = 37
const GAP_ARROW_COPY = 16
const GAP_COPY_CTA = 16
const GAP_CTA_ARROW = 4
const COPY_SIZE = 18
const CTA_SIZE = 16
const CTA_PAD_X = 19
const CTA_PAD_Y = 8
const MARQUEE_GAP = 64

// Slide transition geometry: rise up + scale down on exit, in from below.
const ENTER_SCALE = 0.85
const EXIT_SCALE = 0.85
const SLIDE_TRAVEL = "110%"
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)"

const FONT_STACK = "'Google Sans', 'Inter', sans-serif"

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

export interface Announcement {
    text: string
    highlight: string
    showCTA: boolean
    ctaLabel: string
    ctaLink: string
}

export interface AnnouncementBarProps {
    announcements?: Announcement[]
    autoRotate?: boolean
    rotateInterval?: number
    pauseOnHover?: boolean
    showArrows?: boolean
    arrowPrevImg?: string
    arrowNextImg?: string
    arrowSize?: number
    arrowColor?: string
    backgroundImg?: string
    barMaxWidth?: number
    copyColor?: string
    highlightColor?: string
    ctaColor?: string
    ctaTextColor?: string
    transitionMs?: number
    marqueeSpeed?: number
    style?: React.CSSProperties
}

/** Imperative handle so a scroll-driven host can hide the bar without re-rendering it. */
export interface AnnouncementBarHandle {
    /** 0 = fully visible, 1 = scaled down and moved off the top of the screen. */
    setHideProgress: (p: number) => void
}

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
    {
        text: "Applications for the Sep’26 intake close on",
        highlight: "31 Aug’26.",
        showCTA: true,
        ctaLabel: "Apply now",
        ctaLink: "",
    },
]

// vuesax/linear/arrow-left + arrow-right, used when no PNG is supplied.
function Chevron({
    dir,
    size,
    color,
}: {
    dir: "left" | "right"
    size: number
    color: string
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
            style={{ display: "block" }}
        >
            <path
                d={
                    dir === "left"
                        ? "M14.5 18.5 8.4 12.4a1.98 1.98 0 0 1 0-2.8L14.5 5.5"
                        : "M9.5 5.5l6.1 6.1a1.98 1.98 0 0 1 0 2.8L9.5 18.5"
                }
                stroke={color}
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export const AnnouncementBarView = forwardRef<
    AnnouncementBarHandle,
    AnnouncementBarProps
>(function AnnouncementBarView(
    {
        announcements,
        autoRotate = true,
        rotateInterval = 2,
        pauseOnHover = true,
        showArrows = true,
        arrowPrevImg,
        arrowNextImg,
        arrowSize = 32,
        arrowColor = "rgba(255,255,255,0.9)",
        backgroundImg,
        barMaxWidth = 1200,
        copyColor = "rgba(255,255,255,0.9)",
        highlightColor = "#ffffff",
        ctaColor = "#ff3b4d",
        ctaTextColor = "#ffffff",
        transitionMs = 600,
        marqueeSpeed = 60,
        style,
    },
    ref
) {
    // Min 1 / max 6 enforced here as well as in the control's maxCount.
    const source =
        announcements && announcements.length > 0
            ? announcements.slice(0, MAX_ANNOUNCEMENTS)
            : DEFAULT_ANNOUNCEMENTS
    const count = source.length
    const multi = count > 1
    const navVisible = showArrows && multi

    const rawId = useId()
    const uid = rawId.replace(/[^a-zA-Z0-9]/g, "")
    const marqueeName = `cuAbMarquee${uid}`

    const wrapperRef = useRef<HTMLDivElement>(null)
    const slideRefs = useRef<(HTMLDivElement | null)[]>([])
    const copyBoxRefs = useRef<(HTMLDivElement | null)[]>([])
    const trackRefs = useRef<(HTMLDivElement | null)[]>([])
    const copyRefs = useRef<(HTMLSpanElement | null)[]>([])

    const [active, setActive] = useState(0)
    const [overflowing, setOverflowing] = useState<boolean[]>([])
    const [hovered, setHovered] = useState(false)
    const [hiddenByScroll, setHiddenByScroll] = useState(false)
    const [reducedMotion, setReducedMotion] = useState(false)

    const dirRef = useRef<1 | -1>(1)
    const prevActiveRef = useRef(0)
    const hideDistRef = useRef<number | null>(null)
    const lastHideRef = useRef(-1)
    const hiddenBoolRef = useRef(false)

    // Keep the active index valid if the editor removes announcements.
    useEffect(() => {
        setActive((a) => (a >= count ? 0 : a))
    }, [count])

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const sync = () => setReducedMotion(mq.matches)
        sync()
        mq.addEventListener?.("change", sync)
        return () => mq.removeEventListener?.("change", sync)
    }, [])

    // ── Marquee: does the copy exceed the width the flex row gave it? ──
    const contentKey = source
        .map((a) => `${a.text}|${a.highlight}|${a.showCTA}|${a.ctaLabel}`)
        .join("~")

    useLayoutEffect(() => {
        const measure = () => {
            const next = source.map((_, i) => {
                const box = copyBoxRefs.current[i]
                const copy = copyRefs.current[i]
                const track = trackRefs.current[i]
                if (!box || !copy) return false
                const natural = copy.offsetWidth
                const room = box.clientWidth
                const over = natural > room + 1
                if (track) {
                    const shift = natural + MARQUEE_GAP
                    track.style.setProperty("--cu-ab-shift", `-${shift}px`)
                    track.style.animationDuration = `${Math.max(
                        4,
                        shift / Math.max(10, marqueeSpeed)
                    )}s`
                }
                return over
            })
            setOverflowing((prev) =>
                prev.length === next.length &&
                next.every((v, i) => v === prev[i])
                    ? prev
                    : next
            )
        }

        measure()

        const ro = new ResizeObserver(measure)
        copyBoxRefs.current.forEach((el) => el && ro.observe(el))
        if (wrapperRef.current) ro.observe(wrapperRef.current)

        let cancelled = false
        // Web fonts land after first paint and change the natural text width.
        const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
        fonts?.ready?.then(() => {
            if (!cancelled) measure()
        })

        return () => {
            cancelled = true
            ro.disconnect()
        }
    }, [contentKey, count, barMaxWidth, marqueeSpeed, navVisible])

    // ── Slide transition, driven imperatively so it never fights React ──
    useLayoutEffect(() => {
        const from = prevActiveRef.current
        const to = active
        prevActiveRef.current = to

        const dir = dirRef.current
        const enterY = dir > 0 ? SLIDE_TRAVEL : `-${SLIDE_TRAVEL}`
        const exitY = dir > 0 ? `-${SLIDE_TRAVEL}` : SLIDE_TRAVEL
        const transition = reducedMotion
            ? "opacity 120ms linear"
            : `transform ${transitionMs}ms ${EASE}, opacity ${transitionMs}ms ${EASE}`

        const slides = slideRefs.current

        // Park every slide that is not part of this transition.
        slides.forEach((el, i) => {
            if (!el || i === to || i === from) return
            el.style.transition = "none"
            el.style.opacity = "0"
            el.style.visibility = "hidden"
            el.style.pointerEvents = "none"
            el.style.transform = `translateY(${enterY}) scale(${ENTER_SCALE})`
        })

        const incoming = slides[to]
        const outgoing = from !== to ? slides[from] : null

        if (incoming) {
            if (outgoing && !reducedMotion) {
                // Snap to the enter position, then animate in on the next frame.
                incoming.style.transition = "none"
                incoming.style.visibility = "visible"
                incoming.style.opacity = "0"
                incoming.style.transform = `translateY(${enterY}) scale(${ENTER_SCALE})`
                void incoming.offsetHeight // force reflow
            }
            incoming.style.transition = transition
            incoming.style.visibility = "visible"
            incoming.style.opacity = "1"
            incoming.style.pointerEvents = "auto"
            incoming.style.transform = "translateY(0px) scale(1)"
        }

        if (outgoing) {
            outgoing.style.transition = transition
            outgoing.style.opacity = "0"
            outgoing.style.pointerEvents = "none"
            outgoing.style.transform = reducedMotion
                ? "translateY(0px) scale(1)"
                : `translateY(${exitY}) scale(${EXIT_SCALE})`
        }
    }, [active, count, transitionMs, reducedMotion])

    // ── Auto-rotate ──
    const paused =
        hiddenByScroll || (pauseOnHover && hovered) || reducedMotion || !multi

    useEffect(() => {
        if (!autoRotate || paused) return
        const ms = Math.max(500, rotateInterval * 1000)
        const id = window.setInterval(() => {
            dirRef.current = 1
            setActive((a) => (a + 1) % count)
        }, ms)
        return () => window.clearInterval(id)
    }, [autoRotate, paused, rotateInterval, count])

    const go = useCallback(
        (delta: 1 | -1) => {
            dirRef.current = delta
            setActive((a) => (a + delta + count) % count)
        },
        [count]
    )

    // ── Scroll-linked hide, mutated directly (called up to 60x/sec) ──
    useImperativeHandle(
        ref,
        () => ({
            setHideProgress(p: number) {
                const el = wrapperRef.current
                if (!el) return
                const cp = clamp(p)
                if (cp === lastHideRef.current) return
                lastHideRef.current = cp

                if (cp === 0 || hideDistRef.current == null) {
                    // Distance from the bar's bottom edge to the top of the
                    // viewport, measured while untransformed.
                    const rect = el.getBoundingClientRect()
                    if (rect.height > 0) hideDistRef.current = rect.bottom + 24
                }
                const dist = hideDistRef.current ?? 120

                el.style.opacity = String(1 - cp)
                el.style.transform = `translateY(${-cp * dist}px) scale(${
                    1 - 0.18 * cp
                })`
                el.style.visibility = cp >= 1 ? "hidden" : "visible"
                el.style.pointerEvents = cp > 0.02 ? "none" : "auto"

                const nowHidden = cp >= 1
                if (nowHidden !== hiddenBoolRef.current) {
                    hiddenBoolRef.current = nowHidden
                    setHiddenByScroll(nowHidden)
                }
            },
        }),
        []
    )

    const arrowButtonStyle: React.CSSProperties = {
        flex: "0 0 auto",
        width: arrowSize,
        height: arrowSize,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        appearance: "none",
        WebkitTapHighlightColor: "transparent",
    }

    const renderArrow = (dir: "left" | "right") => {
        const img = dir === "left" ? arrowPrevImg : arrowNextImg
        return (
            <button
                type="button"
                aria-label={
                    dir === "left" ? "Previous announcement" : "Next announcement"
                }
                onClick={() => go(dir === "left" ? -1 : 1)}
                style={{
                    ...arrowButtonStyle,
                    marginRight: dir === "left" ? GAP_ARROW_COPY : 0,
                    marginLeft: dir === "right" ? GAP_CTA_ARROW : 0,
                }}
            >
                {img ? (
                    <img
                        src={img}
                        alt=""
                        aria-hidden="true"
                        style={{
                            width: arrowSize,
                            height: arrowSize,
                            objectFit: "contain",
                            display: "block",
                        }}
                    />
                ) : (
                    <Chevron dir={dir} size={arrowSize} color={arrowColor} />
                )}
            </button>
        )
    }

    return (
        <div
            ref={wrapperRef}
            style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                transformOrigin: "center top",
                willChange: "transform, opacity",
                ...style,
            }}
        >
            <style>{`@keyframes ${marqueeName}{from{transform:translateX(0)}to{transform:translateX(var(--cu-ab-shift,0px))}}`}</style>

            <div
                role="region"
                aria-label="Announcements"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: barMaxWidth,
                    display: "flex",
                    alignItems: "center",
                    padding: BAR_PADDING,
                    borderRadius: BAR_RADIUS,
                    boxSizing: "border-box",
                    overflow: "hidden",
                    fontFamily: FONT_STACK,
                    // Fallback sheen; the exported Figma fill overrides it.
                    background:
                        "linear-gradient(90deg, #d6d6d6 0%, #ededed 28%, #f4f4f4 50%, #e4e4e4 76%, #cfcfcf 100%)",
                }}
            >
                {backgroundImg ? (
                    <img
                        src={backgroundImg}
                        alt=""
                        aria-hidden="true"
                        style={{
                            position: "absolute",
                            inset: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            borderRadius: BAR_RADIUS,
                            pointerEvents: "none",
                        }}
                    />
                ) : null}

                {navVisible ? renderArrow("left") : null}

                {/* Slide viewport — takes whatever width the arrows and CTA leave */}
                <div
                    aria-live="polite"
                    aria-atomic="true"
                    style={{
                        position: "relative",
                        flex: "1 1 auto",
                        minWidth: 0,
                        height: ROW_HEIGHT,
                        overflow: "hidden",
                        zIndex: 1,
                    }}
                >
                    {source.map((item, i) => {
                        const isOver = overflowing[i] === true
                        const hasCTA = item.showCTA !== false && !!item.ctaLabel

                        const copy = (
                            <span
                                ref={(el) => {
                                    copyRefs.current[i] = el
                                }}
                                style={{
                                    display: "inline-block",
                                    whiteSpace: "nowrap",
                                    fontSize: COPY_SIZE,
                                    lineHeight: 1.3,
                                    fontWeight: 500,
                                    color: copyColor,
                                }}
                            >
                                {item.text}
                                {item.highlight ? (
                                    <>
                                        {" "}
                                        <strong
                                            style={{
                                                fontWeight: 700,
                                                color: highlightColor,
                                            }}
                                        >
                                            {item.highlight}
                                        </strong>
                                    </>
                                ) : null}
                            </span>
                        )

                        const ctaStyle: React.CSSProperties = {
                            flex: "0 0 auto",
                            marginLeft: GAP_COPY_CTA,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: `${CTA_PAD_Y}px ${CTA_PAD_X}px`,
                            borderRadius: BAR_RADIUS,
                            border: "none",
                            background: ctaColor,
                            color: ctaTextColor,
                            fontFamily: FONT_STACK,
                            fontSize: CTA_SIZE,
                            fontWeight: 700,
                            lineHeight: 1.3,
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                            cursor: "pointer",
                            pointerEvents: "auto",
                            boxSizing: "border-box",
                            transformOrigin: "center",
                            transition: `transform 220ms ${EASE}`,
                            appearance: "none",
                            WebkitTapHighlightColor: "transparent",
                        }

                        // Hover press: shrink to 0.92x.
                        const hoverHandlers = {
                            onMouseEnter: (
                                e: React.MouseEvent<HTMLElement>
                            ) => {
                                e.currentTarget.style.transform = "scale(0.92)"
                            },
                            onMouseLeave: (
                                e: React.MouseEvent<HTMLElement>
                            ) => {
                                e.currentTarget.style.transform = "scale(1)"
                            },
                            onFocus: (e: React.FocusEvent<HTMLElement>) => {
                                e.currentTarget.style.transform = "scale(0.92)"
                            },
                            onBlur: (e: React.FocusEvent<HTMLElement>) => {
                                e.currentTarget.style.transform = "scale(1)"
                            },
                        }

                        return (
                            <div
                                key={i}
                                ref={(el) => {
                                    slideRefs.current[i] = el
                                }}
                                aria-hidden={i === active ? undefined : true}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    height: ROW_HEIGHT,
                                    opacity: i === active ? 1 : 0,
                                    visibility:
                                        i === active ? "visible" : "hidden",
                                    pointerEvents:
                                        i === active ? "auto" : "none",
                                    transformOrigin: "center",
                                    willChange: "transform, opacity",
                                }}
                            >
                                <div
                                    ref={(el) => {
                                        copyBoxRefs.current[i] = el
                                    }}
                                    style={{
                                        flex: "1 1 auto",
                                        minWidth: 0,
                                        overflow: "hidden",
                                        display: "flex",
                                        alignItems: "center",
                                        // Centred until it no longer fits.
                                        justifyContent: isOver
                                            ? "flex-start"
                                            : "center",
                                        textAlign: "center",
                                        maskImage: isOver
                                            ? "linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)"
                                            : undefined,
                                        WebkitMaskImage: isOver
                                            ? "linear-gradient(90deg, transparent 0, #000 24px, #000 calc(100% - 24px), transparent 100%)"
                                            : undefined,
                                    }}
                                >
                                    <div
                                        ref={(el) => {
                                            trackRefs.current[i] = el
                                        }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: isOver ? MARQUEE_GAP : 0,
                                            flex: "0 0 auto",
                                            willChange: isOver
                                                ? "transform"
                                                : undefined,
                                            animationName:
                                                isOver && !reducedMotion
                                                    ? marqueeName
                                                    : "none",
                                            animationTimingFunction: "linear",
                                            animationIterationCount: "infinite",
                                            animationPlayState:
                                                hovered && pauseOnHover
                                                    ? "paused"
                                                    : "running",
                                        }}
                                    >
                                        {copy}
                                        {isOver && !reducedMotion ? (
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    display: "inline-block",
                                                    whiteSpace: "nowrap",
                                                    fontSize: COPY_SIZE,
                                                    lineHeight: 1.3,
                                                    fontWeight: 500,
                                                    color: copyColor,
                                                }}
                                            >
                                                {item.text}
                                                {item.highlight ? (
                                                    <>
                                                        {" "}
                                                        <strong
                                                            style={{
                                                                fontWeight: 700,
                                                                color: highlightColor,
                                                            }}
                                                        >
                                                            {item.highlight}
                                                        </strong>
                                                    </>
                                                ) : null}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>

                                {hasCTA ? (
                                    item.ctaLink ? (
                                        <a
                                            href={item.ctaLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={ctaStyle}
                                            {...hoverHandlers}
                                        >
                                            {item.ctaLabel}
                                        </a>
                                    ) : (
                                        <button
                                            type="button"
                                            style={ctaStyle}
                                            {...hoverHandlers}
                                        >
                                            {item.ctaLabel}
                                        </button>
                                    )
                                ) : null}
                            </div>
                        )
                    })}
                </div>

                {navVisible ? renderArrow("right") : null}
            </div>
        </div>
    )
})

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 684
 * @framerIntrinsicHeight 53
 */
export default function AnnouncementBar(props: AnnouncementBarProps) {
    return <AnnouncementBarView {...props} />
}

// Spreadable so a host component can expose the same panel.
export const announcementBarControls = {
    announcements: {
        type: ControlType.Array,
        title: "Announcements",
        maxCount: MAX_ANNOUNCEMENTS,
        defaultValue: DEFAULT_ANNOUNCEMENTS,
        description: `1 to ${MAX_ANNOUNCEMENTS} items. Arrows hide themselves when there is only one.`,
        control: {
            type: ControlType.Object,
            controls: {
                text: {
                    type: ControlType.String,
                    title: "Copy",
                    defaultValue:
                        "Applications for the Sep’26 intake close on",
                    displayTextArea: true,
                },
                highlight: {
                    type: ControlType.String,
                    title: "Bold Part",
                    defaultValue: "31 Aug’26.",
                    description: "Appended in bold white after the copy.",
                },
                showCTA: {
                    type: ControlType.Boolean,
                    title: "CTA",
                    defaultValue: true,
                    enabledTitle: "Show",
                    disabledTitle: "Hide",
                },
                ctaLabel: {
                    type: ControlType.String,
                    title: "CTA Copy",
                    defaultValue: "Apply now",
                    hidden: (p: Announcement) => !p.showCTA,
                },
                ctaLink: {
                    type: ControlType.Link,
                    title: "CTA Link",
                    hidden: (p: Announcement) => !p.showCTA,
                },
            },
        },
    },
    autoRotate: {
        type: ControlType.Boolean,
        title: "Auto Rotate",
        defaultValue: true,
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    rotateInterval: {
        type: ControlType.Number,
        title: "Every",
        defaultValue: 2,
        min: 0.5,
        max: 20,
        step: 0.5,
        unit: "s",
        hidden: (p: AnnouncementBarProps) => !p.autoRotate,
    },
    pauseOnHover: {
        type: ControlType.Boolean,
        title: "Pause on Hover",
        defaultValue: true,
        enabledTitle: "Yes",
        disabledTitle: "No",
    },
    showArrows: {
        type: ControlType.Boolean,
        title: "Arrows",
        defaultValue: true,
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    arrowPrevImg: {
        type: ControlType.Image,
        title: "Arrow Left",
        description: "Optional PNG. Falls back to the Figma chevron.",
        hidden: (p: AnnouncementBarProps) => !p.showArrows,
    },
    arrowNextImg: {
        type: ControlType.Image,
        title: "Arrow Right",
        hidden: (p: AnnouncementBarProps) => !p.showArrows,
    },
    arrowSize: {
        type: ControlType.Number,
        title: "Arrow Size",
        defaultValue: 32,
        min: 16,
        max: 64,
        step: 1,
        unit: "px",
        hidden: (p: AnnouncementBarProps) => !p.showArrows,
    },
    arrowColor: {
        type: ControlType.Color,
        title: "Arrow Tint",
        defaultValue: "rgba(255,255,255,0.9)",
        description: "Used by the built-in chevron only.",
        hidden: (p: AnnouncementBarProps) => !p.showArrows,
    },
    backgroundImg: {
        type: ControlType.Image,
        title: "Bar Background",
        description: "Export the pill fill from Figma and drop it here.",
    },
    barMaxWidth: {
        type: ControlType.Number,
        title: "Max Width",
        defaultValue: 1200,
        min: 320,
        max: 1600,
        step: 10,
        unit: "px",
        description: "Copy scrolls once it no longer fits this width.",
    },
    ctaColor: {
        type: ControlType.Color,
        title: "CTA Fill",
        defaultValue: "#ff3b4d",
    },
    ctaTextColor: {
        type: ControlType.Color,
        title: "CTA Text",
        defaultValue: "#ffffff",
    },
    copyColor: {
        type: ControlType.Color,
        title: "Copy Colour",
        defaultValue: "rgba(255,255,255,0.9)",
    },
    highlightColor: {
        type: ControlType.Color,
        title: "Bold Colour",
        defaultValue: "#ffffff",
    },
    transitionMs: {
        type: ControlType.Number,
        title: "Transition",
        defaultValue: 600,
        min: 150,
        max: 1500,
        step: 50,
        unit: "ms",
    },
    marqueeSpeed: {
        type: ControlType.Number,
        title: "Scroll Speed",
        defaultValue: 60,
        min: 10,
        max: 200,
        step: 5,
        unit: "px/s",
        description: "Only used when the copy overflows.",
    },
}

addPropertyControls(AnnouncementBar, announcementBarControls)
