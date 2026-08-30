// CU Scroll Animation — Framer Code Component (FIXED)
//
// KEY CHANGES vs. previous version:
// 1. position: fixed  →  position: sticky inside the scroll container.
//    The stage now releases at the end of the 600vh section, so any frame
//    placed BELOW this component (e.g. your course-card section) is visible.
// 2. Scroll progress is measured from THIS container's bounding rect,
//    not from the whole document. The 195 frames now complete inside the
//    component's own scroll length, regardless of what comes after it.
// 3. 100vw/100vh → 100% of the stage + overflow: hidden, so the cover-fit
//    canvas is clipped to the frame instead of bleeding past its edges.
// 4. Overlay updates run every frame (they used to be trapped inside the
//    "is it still easing?" check, so they froze once scrolling stopped).
// 5. pointerEvents defaults to none; only the CTA buttons are clickable,
//    so the overlay never swallows clicks meant for content below.

import { addPropertyControls, ControlType } from "framer"
import { useRef, useEffect, useCallback } from "react"

// ─── CHANGE THIS TO YOUR CDN URL ───
const BASE_URL = "https://himanshup11-ux.github.io/Scroll-animation-frames"
// ────────────────────────────────────

const TOTAL_FRAMES = 195

function getFramePath(index: number, baseUrl: string): string {
    const padded = String(index).padStart(3, "0")
    return `${baseUrl}/ezgif-frame-${padded}.jpg`
}

const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))

function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function staggerProgress(progress: number, i: number, total: number): number {
    const start = i / total
    const end = (i + 1) / total
    return clamp((progress - start) / (end - start))
}

interface Props {
    badgesImg: string
    topTextImg: string
    card1Img: string
    card2Img: string
    card3Img: string
    cdnBaseUrl?: string
    scrollLength?: number
    fitMode?: "cover" | "contain"
    style?: React.CSSProperties
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1440
 * @framerIntrinsicHeight 900
 */
export default function CUScrollAnimation({
    badgesImg,
    topTextImg,
    card1Img,
    card2Img,
    card3Img,
    cdnBaseUrl = BASE_URL,
    scrollLength = 600,
    fitMode = "cover",
    style,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const stageRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    const imagesRef = useRef<HTMLImageElement[]>([])
    const currentFrameRef = useRef(1)
    const targetFrameRef = useRef(1)

    // Overlay refs
    const heroWordsRef = useRef<(HTMLSpanElement | null)[]>([])
    const ctaRef = useRef<HTMLDivElement>(null)
    const badgesRef = useRef<HTMLImageElement>(null)
    const heroOverlayRef = useRef<HTMLDivElement>(null)

    const scrollWordsRef = useRef<(HTMLSpanElement | null)[]>([])
    const scrollLinesRef = useRef<(HTMLParagraphElement | null)[]>([])

    const rankingsOverlayRef = useRef<HTMLDivElement>(null)
    const rankingsTopImgRef = useRef<HTMLImageElement>(null)
    const card1Ref = useRef<HTMLImageElement>(null)
    const card2Ref = useRef<HTMLImageElement>(null)
    const card3Ref = useRef<HTMLImageElement>(null)

    const heroSubWords = [
        "Real",
        "Skills.",
        "Real",
        "Career",
        "Growth.",
        "UGC-entitled",
        "University",
        "Degree.",
    ]
    const allHeroWordsCount = 9 + heroSubWords.length

    const scrollTextLines = [
        {
            words: [
                "Step",
                "into",
                "an",
                "AI-powered",
                "learning",
                "ecosystem",
                "where",
            ],
            italic: true,
        },
        {
            words: [
                "India's",
                "finest",
                "faculty,",
                "global",
                "industry",
                "leaders,",
            ],
            italic: true,
        },
        {
            words: ["and", "world-class", "curriculum", "come", "together"],
            italic: false,
        },
        {
            words: ["to", "shape", "tomorrow's", "professionals."],
            italic: false,
        },
    ]
    const allScrollWordsCount = scrollTextLines.reduce(
        (n, l) => n + l.words.length,
        0
    )
    let scrollWordIndex = 0

    // ── Render one frame, sized to the STAGE (not the window) ──
    const renderFrame = useCallback(
        (index: number) => {
            const canvas = canvasRef.current
            const stage = stageRef.current
            if (!canvas || !stage) return
            const ctx = canvas.getContext("2d")
            if (!ctx) return

            const frameIndex = Math.max(
                1,
                Math.min(TOTAL_FRAMES, Math.round(index))
            )
            const img = imagesRef.current[frameIndex - 1]
            if (!img || !img.complete || img.naturalWidth === 0) return

            const width = stage.clientWidth
            const height = stage.clientHeight
            if (!width || !height) return

            ctx.clearRect(0, 0, width, height)

            const imgRatio = img.naturalWidth / img.naturalHeight
            const canvasRatio = width / height
            let drawWidth: number, drawHeight: number

            const useWidth =
                fitMode === "cover"
                    ? canvasRatio > imgRatio
                    : canvasRatio < imgRatio

            if (useWidth) {
                drawWidth = width
                drawHeight = width / imgRatio
            } else {
                drawHeight = height
                drawWidth = height * imgRatio
            }

            const offsetX = (width - drawWidth) / 2
            const offsetY = (height - drawHeight) / 2

            ctx.imageSmoothingEnabled = true
            ctx.imageSmoothingQuality = "high"
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
        },
        [fitMode]
    )

    // ── Size the canvas backing store to the stage box ──
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const stage = stageRef.current
        if (!canvas || !stage) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const width = stage.clientWidth
        const height = stage.clientHeight
        if (!width || !height) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
        canvas.style.width = width + "px"
        canvas.style.height = height + "px"
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        renderFrame(currentFrameRef.current)
    }, [renderFrame])

    useEffect(() => {
        // Preload frames
        const imgs: HTMLImageElement[] = []
        for (let i = 1; i <= TOTAL_FRAMES; i++) {
            const img = new Image()
            img.decoding = "async"
            img.src = getFramePath(i, cdnBaseUrl)
            if (i === 1) img.onload = () => renderFrame(1)
            imgs.push(img)
        }
        imagesRef.current = imgs

        resizeCanvas()

        // ── Progress measured from THIS container, not the document ──
        const onScroll = () => {
            const el = containerRef.current
            const stage = stageRef.current
            if (!el || !stage) return
            const rect = el.getBoundingClientRect()
            const distance = rect.height - stage.clientHeight
            const p = distance <= 0 ? 0 : clamp(-rect.top / distance)
            targetFrameRef.current = 1 + p * (TOTAL_FRAMES - 1)
        }

        const applyOverlays = (f: number) => {
            // Hero overlay: fades out over frames 1-30
            const progress = clamp((f - 1) / 30)

            heroWordsRef.current.forEach((el, i) => {
                if (!el) return
                const wp = staggerProgress(progress, i, allHeroWordsCount)
                el.style.opacity = String(1 - wp)
                el.style.transform = `translateY(${wp * -12}px)`
            })

            if (ctaRef.current)
                ctaRef.current.style.opacity = String(1 - progress)
            if (badgesRef.current)
                badgesRef.current.style.opacity = String(1 - progress)

            if (heroOverlayRef.current) {
                heroOverlayRef.current.style.background =
                    progress >= 1
                        ? "none"
                        : `radial-gradient(60.36% 41.79% at 19.31% 87.5%, rgba(0,0,0,${1 - progress}) 9.41%, rgba(0,0,0,0) 100%)`
                heroOverlayRef.current.style.visibility =
                    progress >= 1 ? "hidden" : "visible"
            }

            // Scroll text: frames 35-110
            scrollWordsRef.current.forEach((el, i) => {
                if (!el) return
                if (f < 35 || f > 110) {
                    el.style.opacity = "0"
                    el.style.transform = "translateY(12px)"
                } else if (f < 65) {
                    const wp = staggerProgress(
                        (f - 35) / 30,
                        i,
                        allScrollWordsCount
                    )
                    el.style.opacity = String(wp)
                    el.style.transform = `translateY(${(1 - wp) * 12}px)`
                } else {
                    el.style.opacity = "1"
                    el.style.transform = "translateY(0)"
                }
            })

            scrollLinesRef.current.forEach((el, i) => {
                if (!el) return
                if (f >= 80 && f <= 110) {
                    const lp = staggerProgress((f - 80) / 30, i, 4)
                    el.style.filter = `blur(${lp * 12}px)`
                    el.style.opacity = String(1 - lp)
                } else {
                    el.style.filter = "blur(0px)"
                    el.style.opacity = "1"
                }
            })

            // Rankings overlay: frames 110-195
            const ro = rankingsOverlayRef.current
            const ti = rankingsTopImgRef.current
            const c1 = card1Ref.current
            const c2 = card2Ref.current
            const c3 = card3Ref.current
            if (!ro) return

            const introP = clamp((f - 110) / 30)
            if (ti) {
                ti.style.opacity = String(introP)
                ti.style.transform = `translateY(${(1 - introP) * 12}px)`
            }
            ro.style.background =
                introP <= 0
                    ? "none"
                    : `radial-gradient(84.62% 42.66% at 50% 0%, rgba(76,0,0,${0.7 * introP}) 0%, rgba(76,0,0,0) 100%)`

            const applyCard = (
                el: HTMLImageElement | null,
                start: number,
                axis: "x" | "y",
                dist: number
            ) => {
                if (!el) return
                const p = clamp((f - start) / 20)
                const ep = easeInOut(p)
                el.style.opacity = String(p)
                const shift = dist * (1 - ep)
                el.style.transform = `scale(${1.2 - 0.2 * ep}) ${
                    axis === "x"
                        ? `translateX(${shift}px)`
                        : `translateY(${shift}px)`
                }`
            }

            applyCard(c1, 140, "x", -40)
            applyCard(c2, 150, "y", 40)
            applyCard(c3, 160, "x", 40)
        }

        let rafId = 0
        const loop = () => {
            const diff = targetFrameRef.current - currentFrameRef.current
            if (Math.abs(diff) > 0.001) {
                currentFrameRef.current += diff * 0.12
            } else {
                currentFrameRef.current = targetFrameRef.current
            }
            renderFrame(currentFrameRef.current)
            applyOverlays(currentFrameRef.current)
            rafId = requestAnimationFrame(loop)
        }

        // capture: true so it also fires if Framer scrolls a nested container
        window.addEventListener("scroll", onScroll, {
            passive: true,
            capture: true,
        })
        window.addEventListener("resize", resizeCanvas)

        const ro = new ResizeObserver(() => {
            resizeCanvas()
            onScroll()
        })
        if (stageRef.current) ro.observe(stageRef.current)

        onScroll()
        rafId = requestAnimationFrame(loop)

        return () => {
            window.removeEventListener("scroll", onScroll, { capture: true })
            window.removeEventListener("resize", resizeCanvas)
            ro.disconnect()
            cancelAnimationFrame(rafId)
        }
    }, [renderFrame, resizeCanvas, cdnBaseUrl])

    scrollWordIndex = 0

    // Shared absolute-fill style for every overlay layer
    const layer: React.CSSProperties = {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
    }

    return (
        <div
            ref={containerRef}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: `${scrollLength}vh`,
                backgroundColor: "#050505",
            }}
        >
            {/* STICKY STAGE — releases at the end of the container */}
            <div
                ref={stageRef}
                style={{
                    position: "sticky",
                    top: 0,
                    width: "100%",
                    height: "100vh",
                    overflow: "hidden",
                    isolation: "isolate",
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "block",
                        pointerEvents: "none",
                        zIndex: 1,
                    }}
                />

                {/* Hero Overlay */}
                <div
                    ref={heroOverlayRef}
                    style={{
                        ...layer,
                        padding: "0 0 50px clamp(24px, 8vw, 120px)",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        background:
                            "radial-gradient(60.36% 41.79% at 19.31% 87.5%, #000 9.41%, rgba(0,0,0,0) 100%)",
                        zIndex: 10,
                        fontFamily: "'Inter', sans-serif",
                        color: "white",
                        boxSizing: "border-box",
                    }}
                >
                    <div
                        style={{
                            maxWidth: 800,
                            flexShrink: 1,
                            position: "relative",
                            zIndex: 2,
                        }}
                    >
                        <h1
                            style={{
                                fontSize: "clamp(2rem, 3.4vw, 3rem)",
                                lineHeight: 1.2,
                                marginBottom: 20,
                                fontWeight: 400,
                            }}
                        >
                            <span style={{ fontFamily: "'Inter', sans-serif" }}>
                                {["Study", "at", "India's", "No.1"].map(
                                    (word, i) => (
                                        <span
                                            key={i}
                                            ref={(el) => {
                                                heroWordsRef.current[i] = el
                                            }}
                                            style={{ display: "inline-block" }}
                                        >
                                            {word}
                                            {i < 3 ? " " : ""}
                                        </span>
                                    )
                                )}
                            </span>
                            <br />
                            <span
                                style={{
                                    fontFamily: "'Playfair Display', serif",
                                    fontStyle: "italic",
                                    fontWeight: 600,
                                }}
                            >
                                {[
                                    "Private",
                                    "University.",
                                    "Online.",
                                ].map((word, i) => (
                                    <span
                                        key={i}
                                        ref={(el) => {
                                            heroWordsRef.current[4 + i] = el
                                        }}
                                        style={{ display: "inline-block" }}
                                    >
                                        {word}
                                        {i < 4 ? " " : ""}
                                    </span>
                                ))}
                            </span>
                        </h1>
                        <p
                            style={{
                                fontSize: "1.1rem",
                                marginBottom: 40,
                                fontWeight: 400,
                            }}
                        >
                            {heroSubWords.map((word, i) => (
                                <span
                                    key={i}
                                    ref={(el) => {
                                        heroWordsRef.current[9 + i] = el
                                    }}
                                    style={{ display: "inline-block" }}
                                >
                                    {word}
                                    {i < heroSubWords.length - 1
                                        ? " "
                                        : ""}
                                </span>
                            ))}
                        </p>
                        <div
                            ref={ctaRef}
                            style={{
                                display: "flex",
                                gap: 20,
                                pointerEvents: "auto",
                            }}
                        >
                            <button
                                style={{
                                    padding: "15px 30px",
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: "1rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    backgroundColor: "#ff3b4b",
                                    color: "white",
                                    border: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                }}
                            >
                                Explore Programmes <span>→</span>
                            </button>
                            <button
                                style={{
                                    padding: "15px 30px",
                                    fontFamily: "'Inter', sans-serif",
                                    fontSize: "1rem",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    backgroundColor: "transparent",
                                    color: "white",
                                    border: "1px solid rgba(255,255,255,0.5)",
                                }}
                            >
                                Talk to a Counsellor
                            </button>
                        </div>
                    </div>
                    <img
                        ref={badgesRef}
                        src={badgesImg}
                        alt="Accreditation Badges"
                        style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: "40%",
                            maxWidth: 620,
                            height: "auto",
                            zIndex: 1,
                        }}
                    />
                </div>

                {/* Scroll Text Overlay */}
                <div
                    style={{
                        ...layer,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 11,
                    }}
                >
                    <div
                        style={{
                            textAlign: "center",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 10,
                            maxWidth: "80%",
                        }}
                    >
                        {scrollTextLines.map((line, lineIdx) => (
                            <p
                                key={lineIdx}
                                ref={(el) => {
                                    scrollLinesRef.current[lineIdx] = el
                                }}
                                style={{
                                    fontFamily: line.italic
                                        ? "'Playfair Display', serif"
                                        : "'Inter', sans-serif",
                                    fontStyle: line.italic
                                        ? "italic"
                                        : "normal",
                                    fontWeight: line.italic ? 700 : 500,
                                    fontSize: "clamp(24px, 2.8vw, 40px)",
                                    lineHeight: 1.3,
                                    color: "#4c0000",
                                    margin: 0,
                                }}
                            >
                                {line.words.map((word, wi) => {
                                    const globalIdx = scrollWordIndex++
                                    return (
                                        <span
                                            key={wi}
                                            ref={(el) => {
                                                scrollWordsRef.current[
                                                    globalIdx
                                                ] = el
                                            }}
                                            style={{
                                                display: "inline-block",
                                                opacity: 0,
                                            }}
                                        >
                                            {word}
                                            {wi < line.words.length - 1
                                                ? " "
                                                : ""}
                                        </span>
                                    )
                                })}
                            </p>
                        ))}
                    </div>
                </div>

                {/* Rankings Overlay */}
                <div
                    ref={rankingsOverlayRef}
                    style={{
                        ...layer,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "space-between",
                        zIndex: 12,
                        padding: "60px 0",
                        boxSizing: "border-box",
                    }}
                >
                    <img
                        ref={rankingsTopImgRef}
                        src={topTextImg}
                        alt="Study at India's No.1 private university"
                        style={{
                            width: "36%",
                            maxWidth: 700,
                            height: "auto",
                            opacity: 0,
                        }}
                    />
                    <div
                        style={{
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "center",
                            gap: "2vw",
                            width: "100%",
                            padding: "0 60px",
                            boxSizing: "border-box",
                        }}
                    >
                        {[
                            { ref: card1Ref, src: card1Img, alt: "QS Rank 01" },
                            { ref: card2Ref, src: card2Img, alt: "QS Rank 02" },
                            {
                                ref: card3Ref,
                                src: card3Img,
                                alt: "NIRF Rank 19",
                            },
                        ].map((c, i) => (
                            <img
                                key={i}
                                ref={c.ref}
                                src={c.src}
                                alt={c.alt}
                                style={{
                                    width: "28%",
                                    maxWidth: 380,
                                    height: "auto",
                                    borderRadius: 12,
                                    opacity: 0,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

addPropertyControls(CUScrollAnimation, {
    cdnBaseUrl: {
        type: ControlType.String,
        title: "CDN Base URL",
        defaultValue: BASE_URL,
        placeholder: "https://your-cdn.com/frames",
        description: "Base URL where the 195 frame images are hosted.",
    },
    scrollLength: {
        type: ControlType.Number,
        title: "Scroll Length",
        defaultValue: 600,
        min: 200,
        max: 1200,
        step: 50,
        unit: "vh",
        description: "Total scroll distance for the animation.",
    },
    fitMode: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["cover", "contain"],
        optionTitles: ["Cover (crop)", "Contain (letterbox)"],
        defaultValue: "cover",
    },
    badgesImg: { type: ControlType.Image, title: "Accreditation Badges" },
    topTextImg: { type: ControlType.Image, title: "Top Text Image" },
    card1Img: { type: ControlType.Image, title: "Card 1 (Left)" },
    card2Img: { type: ControlType.Image, title: "Card 2 (Center)" },
    card3Img: { type: ControlType.Image, title: "Card 3 (Right)" },
})
