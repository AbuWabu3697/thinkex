import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { cn } from "#/lib/utils";

import {
	FIXED_STEP,
	pointInsideBody,
	stepSimulation,
	type PhysicsBody,
	type PhysicsDrag,
} from "./gravity-physics";

type GravityProps = {
	children: ReactNode;
	className?: string;
	gravity?: { x: number; y: number };
	topBoundaryOffset?: number;
};

type GravityBodyProps = {
	children: ReactNode;
	className?: string;
	x?: number | string;
	y?: number | string;
	angle?: number;
};

type GravityBodyOptions = Pick<GravityBodyProps, "angle" | "x" | "y">;

type Body = PhysicsBody & { element: HTMLElement };

type DragState = PhysicsDrag & { body: Body; pointerId: number };

const MAX_FRAME_DELTA = 0.05;
const MAX_STEPS_PER_FRAME = 8;

const GravityContext = createContext<{
	registerElement: (id: string, element: HTMLElement, options: GravityBodyOptions) => void;
	unregisterElement: (id: string) => void;
} | null>(null);

/**
 * Lightweight rigid-body motion inspired by Superlogical's playful 404 page:
 * https://www.superlogical.com/secret
 *
 * This is an independent, rectangle-only implementation for ThinkEx cards. It
 * uses the same broad ideas: fixed time steps, impulse collisions, spring
 * dragging, damping, and sleeping bodies.
 */
export function Gravity({
	children,
	className,
	gravity = { x: 0, y: 1 },
	topBoundaryOffset = 0,
}: GravityProps) {
	const gravityX = gravity.x;
	const gravityY = gravity.y;
	const sceneRef = useRef<HTMLDivElement | null>(null);
	const bodiesRef = useRef(new Map<string, Body>());
	const dragRef = useRef<DragState | null>(null);
	const frameRef = useRef<number | null>(null);
	const [isReady, setIsReady] = useState(false);
	const [isNearViewport, setIsNearViewport] = useState(false);
	const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

	const renderBody = useCallback((body: Body) => {
		if (!body.dirty) return;

		body.element.style.transform = `translate3d(${body.x - body.width / 2}px, ${
			body.y - body.height / 2
		}px, 0) rotate(${body.angle}rad)`;
		body.element.style.opacity = "1";
		body.dirty = false;
	}, []);

	const registerElement = useCallback(
		(id: string, element: HTMLElement, options: GravityBodyOptions) => {
			const scene = sceneRef.current;

			if (!scene) {
				return;
			}

			const sceneWidth = scene.clientWidth;
			const sceneHeight = scene.clientHeight;
			const width = element.offsetWidth;
			const height = element.offsetHeight;
			const mass = Math.max((width * height) / 10_000, 0.1);
			const body: Body = {
				element,
				x: calculatePosition(options.x, sceneWidth),
				y: calculatePosition(options.y, sceneHeight),
				angle: ((options.angle ?? 0) * Math.PI) / 180,
				vx: 0,
				vy: 0,
				angularVelocity: 0,
				width,
				height,
				invMass: 1 / mass,
				invInertia: 12 / (mass * (width * width + height * height)),
				idleFor: 0,
				asleep: prefersReducedMotion,
				touching: false,
				dirty: true,
			};

			bodiesRef.current.set(id, body);
			renderBody(body);
		},
		[prefersReducedMotion, renderBody],
	);

	const unregisterElement = useCallback((id: string) => {
		const body = bodiesRef.current.get(id);

		if (dragRef.current?.body === body) {
			dragRef.current = null;
		}

		bodiesRef.current.delete(id);
	}, []);

	useEffect(() => {
		const media = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setPrefersReducedMotion(media.matches);

		update();
		media.addEventListener("change", update);

		return () => media.removeEventListener("change", update);
	}, []);

	useEffect(() => {
		const frame = window.requestAnimationFrame(() => setIsReady(true));

		return () => window.cancelAnimationFrame(frame);
	}, []);

	useEffect(() => {
		const scene = sceneRef.current;

		if (!scene || typeof window.IntersectionObserver === "undefined") {
			setIsNearViewport(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => setIsNearViewport(entry?.isIntersecting ?? false),
			{
				root: scene.closest("[data-scroll-root]"),
				rootMargin: "240px",
			},
		);

		observer.observe(scene);

		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const scene = sceneRef.current;

		if (!scene) {
			return;
		}

		let previousWidth = scene.clientWidth;
		let previousHeight = scene.clientHeight;
		const observer = new ResizeObserver(() => {
			const width = scene.clientWidth;
			const height = scene.clientHeight;

			if (width === previousWidth && height === previousHeight) {
				return;
			}

			const scaleX = previousWidth > 0 ? width / previousWidth : 1;
			const scaleY = previousHeight > 0 ? height / previousHeight : 1;

			for (const body of bodiesRef.current.values()) {
				body.x *= scaleX;
				body.y *= scaleY;
				body.width = body.element.offsetWidth;
				body.height = body.element.offsetHeight;
				body.dirty = true;
				body.asleep = prefersReducedMotion;
				body.idleFor = 0;
				renderBody(body);
			}

			previousWidth = width;
			previousHeight = height;
		});

		observer.observe(scene);

		return () => observer.disconnect();
	}, [prefersReducedMotion, renderBody]);

	useEffect(() => {
		if (!isNearViewport || prefersReducedMotion) {
			if (frameRef.current !== null) {
				window.cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
			return;
		}

		let previousTime = 0;
		let accumulator = 0;
		let cancelled = false;

		const tick = (time: number) => {
			if (cancelled) {
				return;
			}

			if (previousTime === 0) {
				previousTime = time;
			}

			accumulator += Math.min((time - previousTime) / 1_000, MAX_FRAME_DELTA);
			previousTime = time;

			let steps = 0;
			while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
				stepSimulation(
					bodiesRef.current.values(),
					dragRef.current,
					sceneRef.current?.clientWidth ?? 0,
					sceneRef.current?.clientHeight ?? 0,
					topBoundaryOffset,
					{ x: gravityX, y: gravityY },
				);
				accumulator -= FIXED_STEP;
				steps += 1;
			}

			for (const body of bodiesRef.current.values()) {
				renderBody(body);
			}

			frameRef.current = window.requestAnimationFrame(tick);
		};

		frameRef.current = window.requestAnimationFrame(tick);

		return () => {
			cancelled = true;
			if (frameRef.current !== null) {
				window.cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
		};
	}, [gravityX, gravityY, isNearViewport, prefersReducedMotion, renderBody, topBoundaryOffset]);

	const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		const scene = sceneRef.current;

		if (!scene) {
			return;
		}

		const bounds = scene.getBoundingClientRect();
		const x = event.clientX - bounds.left;
		const y = event.clientY - bounds.top;
		const bodies = [...bodiesRef.current.values()];

		for (let index = bodies.length - 1; index >= 0; index -= 1) {
			const body = bodies[index];

			if (!body || !pointInsideBody(x, y, body)) {
				continue;
			}

			const cos = Math.cos(body.angle);
			const sin = Math.sin(body.angle);
			const offsetX = x - body.x;
			const offsetY = y - body.y;
			dragRef.current = {
				body,
				pointerId: event.pointerId,
				localX: offsetX * cos + offsetY * sin,
				localY: -offsetX * sin + offsetY * cos,
				x,
				y,
			};
			body.asleep = false;
			body.idleFor = 0;
			body.dirty = true;
			event.currentTarget.setPointerCapture(event.pointerId);
			event.preventDefault();
			return;
		}
	}, []);

	const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		const scene = sceneRef.current;
		const drag = dragRef.current;

		if (!scene || !drag || drag.pointerId !== event.pointerId) {
			return;
		}

		const bounds = scene.getBoundingClientRect();
		drag.x = event.clientX - bounds.left;
		drag.y = event.clientY - bounds.top;
	}, []);

	const releasePointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
		if (dragRef.current?.pointerId !== event.pointerId) {
			return;
		}

		dragRef.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	}, []);

	const contextValue = useMemo(
		() => ({ registerElement, unregisterElement }),
		[registerElement, unregisterElement],
	);

	return (
		<GravityContext.Provider value={contextValue}>
			<div
				ref={sceneRef}
				className={cn(
					"relative h-full w-full touch-pan-y cursor-grab overflow-hidden active:cursor-grabbing",
					className,
				)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={releasePointer}
				onPointerCancel={releasePointer}
			>
				{isReady ? children : null}
			</div>
		</GravityContext.Provider>
	);
}

export function GravityBody({
	children,
	className,
	x = "50%",
	y = "50%",
	angle = 0,
}: GravityBodyProps) {
	const elementRef = useRef<HTMLDivElement | null>(null);
	const id = useId();
	const context = useContext(GravityContext);

	useLayoutEffect(() => {
		if (!context || !elementRef.current) {
			return;
		}

		context.registerElement(id, elementRef.current, { angle, x, y });

		return () => context.unregisterElement(id);
	}, [angle, context, id, x, y]);

	return (
		<div
			ref={elementRef}
			className={cn(
				"pointer-events-auto absolute top-0 left-0 touch-none opacity-0 will-change-transform",
				className,
			)}
		>
			{children}
		</div>
	);
}

function calculatePosition(value: number | string | undefined, containerSize: number) {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "string" && value.endsWith("%")) {
		return containerSize * (Number.parseFloat(value) / 100);
	}

	return containerSize / 2;
}
