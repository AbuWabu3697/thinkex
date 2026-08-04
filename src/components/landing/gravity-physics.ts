export type PhysicsBody = {
	x: number;
	y: number;
	angle: number;
	vx: number;
	vy: number;
	angularVelocity: number;
	width: number;
	height: number;
	invMass: number;
	invInertia: number;
	idleFor: number;
	asleep: boolean;
	touching: boolean;
	dirty: boolean;
};

export type PhysicsDrag = {
	body: PhysicsBody;
	localX: number;
	localY: number;
	x: number;
	y: number;
};

type Contact = {
	a: PhysicsBody | null;
	b: PhysicsBody;
	nx: number;
	ny: number;
	px: number;
	py: number;
	penetration: number;
};

type Point = { x: number; y: number };

const FIXED_STEP = 1 / 120;
const LINEAR_DAMPING = 0.3;
const ANGULAR_DAMPING = 0.5;
const CONTACT_ANGULAR_DAMPING = 8;
const FRICTION = 0.9;
const BOUNCE = 0.1;
const BOUNCE_SPEED = 90;
const DRAG_STIFFNESS = 520;
const DRAG_DAMPING = 34;
const SLEEP_DELAY = 0.45;

export { FIXED_STEP };

export function stepSimulation(
	bodiesInput: Iterable<PhysicsBody>,
	drag: PhysicsDrag | null,
	width: number,
	height: number,
	topBoundaryOffset: number,
	gravity: { x: number; y: number },
) {
	const bodies = [...bodiesInput];
	const gravityX = gravity.x * width * 2.5;
	const gravityY = gravity.y * height * 2.5;
	const gravityMagnitude = Math.max(Math.hypot(gravityX, gravityY), height);

	for (const body of bodies) {
		body.touching = false;
		if (body.asleep && body !== drag?.body) {
			continue;
		}

		body.vx += gravityX * FIXED_STEP;
		body.vy += gravityY * FIXED_STEP;
		if (body === drag?.body) {
			applyDragSpring(body, drag, gravityMagnitude);
		}
		body.vx *= 1 - LINEAR_DAMPING * FIXED_STEP;
		body.vy *= 1 - LINEAR_DAMPING * FIXED_STEP;
		body.angularVelocity *= 1 - ANGULAR_DAMPING * FIXED_STEP;
	}

	const contacts = findContacts(bodies, width, height, topBoundaryOffset, drag);
	for (let iteration = 0; iteration < 10; iteration += 1) {
		if (iteration % 2 === 0) {
			for (const contact of contacts) {
				solveVelocity(contact, drag);
			}
		} else {
			for (let index = contacts.length - 1; index >= 0; index -= 1) {
				const contact = contacts[index];
				if (contact) solveVelocity(contact, drag);
			}
		}
	}

	for (const body of bodies) {
		if (body.asleep && body !== drag?.body) {
			continue;
		}
		body.x += body.vx * FIXED_STEP;
		body.y += body.vy * FIXED_STEP;
		body.angle += body.angularVelocity * FIXED_STEP;
		body.dirty = true;
	}

	for (const contact of contacts) correctOverlap(contact);

	for (const body of bodies) {
		if (body === drag?.body || body.asleep) {
			continue;
		}
		body.angularVelocity *= 1 - (body.touching ? CONTACT_ANGULAR_DAMPING : 0) * FIXED_STEP;
		const isStill =
			body.touching &&
			Math.hypot(body.vx, body.vy) < height * 0.12 &&
			Math.abs(body.angularVelocity) < 0.8;
		body.idleFor = isStill ? body.idleFor + FIXED_STEP : 0;
		if (body.idleFor > SLEEP_DELAY) {
			body.asleep = true;
			body.vx = 0;
			body.vy = 0;
			body.angularVelocity = 0;
		}
	}
}

export function pointInsideBody(x: number, y: number, body: PhysicsBody) {
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	const offsetX = x - body.x;
	const offsetY = y - body.y;
	const localX = offsetX * cos + offsetY * sin;
	const localY = -offsetX * sin + offsetY * cos;

	return Math.abs(localX) <= body.width / 2 && Math.abs(localY) <= body.height / 2;
}

function applyDragSpring(body: PhysicsBody, drag: PhysicsDrag, gravityMagnitude: number) {
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	const grabX = drag.localX * cos - drag.localY * sin;
	const grabY = drag.localX * sin + drag.localY * cos;
	const pointVelocityX = body.vx - body.angularVelocity * grabY;
	const pointVelocityY = body.vy + body.angularVelocity * grabX;
	const mass = 1 / body.invMass;
	let forceX =
		((drag.x - (body.x + grabX)) * DRAG_STIFFNESS - pointVelocityX * DRAG_DAMPING) * mass;
	let forceY =
		((drag.y - (body.y + grabY)) * DRAG_STIFFNESS - pointVelocityY * DRAG_DAMPING) * mass;
	const maximumForce = 12 * mass * gravityMagnitude;
	const force = Math.hypot(forceX, forceY);

	if (force > maximumForce) {
		forceX *= maximumForce / force;
		forceY *= maximumForce / force;
	}
	applyImpulse(body, forceX * FIXED_STEP, forceY * FIXED_STEP, grabX, grabY);
}

function findContacts(
	bodies: PhysicsBody[],
	width: number,
	height: number,
	topBoundaryOffset: number,
	drag: PhysicsDrag | null,
) {
	const contacts: Contact[] = [];

	for (const body of bodies) {
		contacts.push(...findWallContacts(body, width, height, topBoundaryOffset));
	}

	// ponytail: O(n^2) is the simplest correct broad phase for five landing cards.
	for (let first = 0; first < bodies.length; first += 1) {
		for (let second = first + 1; second < bodies.length; second += 1) {
			const a = bodies[first];
			const b = bodies[second];
			if (!a || !b || (a.asleep && b.asleep)) continue;

			const maximumDistance = Math.hypot(a.width, a.height) / 2 + Math.hypot(b.width, b.height) / 2;
			if (Math.hypot(a.x - b.x, a.y - b.y) > maximumDistance) continue;

			const contact = findBodyContact(a, b);
			if (contact) {
				contacts.push(contact);
				wakeBody(a, b, drag);
				wakeBody(b, a, drag);
			}
		}
	}
	return contacts;
}

function findWallContacts(
	body: PhysicsBody,
	width: number,
	height: number,
	topBoundaryOffset: number,
) {
	const corners = getCorners(body);
	const contacts: Contact[] = [];
	const addDeepest = (
		isOutside: (point: Point) => boolean,
		getPenetration: (point: Point) => number,
		nx: number,
		ny: number,
	) => {
		let point: Point | null = null;
		let penetration = 0;
		for (const corner of corners) {
			const depth = getPenetration(corner);
			if (isOutside(corner) && depth > penetration) {
				point = corner;
				penetration = depth;
			}
		}
		if (point) {
			body.touching = true;
			contacts.push({ a: null, b: body, nx, ny, px: point.x, py: point.y, penetration });
		}
	};

	addDeepest(
		(point) => point.y > height,
		(point) => point.y - height,
		0,
		-1,
	);
	addDeepest(
		(point) => point.y < -topBoundaryOffset,
		(point) => -topBoundaryOffset - point.y,
		0,
		1,
	);
	addDeepest(
		(point) => point.x < 0,
		(point) => -point.x,
		1,
		0,
	);
	addDeepest(
		(point) => point.x > width,
		(point) => point.x - width,
		-1,
		0,
	);
	return contacts;
}

function findBodyContact(a: PhysicsBody, b: PhysicsBody): Contact | null {
	const cornersA = getCorners(a);
	const cornersB = getCorners(b);
	let penetration = Number.POSITIVE_INFINITY;
	let normal: Point | undefined;

	for (const axis of [...getAxes(a), ...getAxes(b)]) {
		const projectionA = project(cornersA, axis);
		const projectionB = project(cornersB, axis);
		const overlap =
			Math.min(projectionA.max, projectionB.max) - Math.max(projectionA.min, projectionB.min);
		if (overlap <= 0) return null;
		if (overlap < penetration) {
			penetration = overlap;
			normal = axis;
		}
	}
	if (!normal) return null;
	if ((b.x - a.x) * normal.x + (b.y - a.y) * normal.y < 0) {
		normal = { x: -normal.x, y: -normal.y };
	}

	const supportA = supportPoint(cornersA, normal.x, normal.y);
	const supportB = supportPoint(cornersB, -normal.x, -normal.y);
	a.touching = true;
	b.touching = true;
	return {
		a,
		b,
		nx: normal.x,
		ny: normal.y,
		px: (supportA.x + supportB.x) / 2,
		py: (supportA.y + supportB.y) / 2,
		penetration,
	};
}

function solveVelocity(contact: Contact, drag: PhysicsDrag | null) {
	const { a, b, nx, ny, px, py } = contact;
	const raX = a ? px - a.x : 0;
	const raY = a ? py - a.y : 0;
	const rbX = px - b.x;
	const rbY = py - b.y;
	const velocityA = a ? velocityAtPoint(a, raX, raY) : { x: 0, y: 0 };
	const velocityB = velocityAtPoint(b, rbX, rbY);
	const relativeX = velocityB.x - velocityA.x;
	const relativeY = velocityB.y - velocityA.y;
	const normalVelocity = relativeX * nx + relativeY * ny;
	if (normalVelocity >= 0) return;

	const normalMass = effectiveMass(a, b, raX, raY, rbX, rbY, nx, ny);
	const isDragged = drag && (drag.body === a || drag.body === b);
	const restitution = -normalVelocity > BOUNCE_SPEED && !isDragged ? BOUNCE : 0;
	const normalImpulse = (-(1 + restitution) * normalVelocity) / normalMass;
	applyContactImpulse(contact, normalImpulse * nx, normalImpulse * ny);

	const tangentX = -ny;
	const tangentY = nx;
	const tangentMass = effectiveMass(a, b, raX, raY, rbX, rbY, tangentX, tangentY);
	const tangentVelocity = relativeX * tangentX + relativeY * tangentY;
	const unclampedFriction = -tangentVelocity / tangentMass;
	const frictionImpulse = Math.max(
		-FRICTION * normalImpulse,
		Math.min(FRICTION * normalImpulse, unclampedFriction),
	);
	applyContactImpulse(contact, frictionImpulse * tangentX, frictionImpulse * tangentY);
}

function effectiveMass(
	a: PhysicsBody | null,
	b: PhysicsBody,
	raX: number,
	raY: number,
	rbX: number,
	rbY: number,
	directionX: number,
	directionY: number,
) {
	const raCross = raX * directionY - raY * directionX;
	const rbCross = rbX * directionY - rbY * directionX;
	return Math.max(
		(a?.invMass ?? 0) +
			b.invMass +
			raCross * raCross * (a?.invInertia ?? 0) +
			rbCross * rbCross * b.invInertia,
		0.000_001,
	);
}

function applyContactImpulse(contact: Contact, impulseX: number, impulseY: number) {
	const { a, b, px, py } = contact;
	applyImpulse(b, impulseX, impulseY, px - b.x, py - b.y);
	if (a) applyImpulse(a, -impulseX, -impulseY, px - a.x, py - a.y);
}

function applyImpulse(
	body: PhysicsBody,
	impulseX: number,
	impulseY: number,
	offsetX: number,
	offsetY: number,
) {
	body.vx += impulseX * body.invMass;
	body.vy += impulseY * body.invMass;
	body.angularVelocity += (offsetX * impulseY - offsetY * impulseX) * body.invInertia;
}

function correctOverlap(contact: Contact) {
	const { a, b, nx, ny } = contact;
	const totalInvMass = (a?.invMass ?? 0) + b.invMass;
	const correction =
		(Math.max(contact.penetration - 0.3, 0) * 0.8) / Math.max(totalInvMass, 0.000_001);
	if (correction === 0) return;

	b.x += nx * correction * b.invMass;
	b.y += ny * correction * b.invMass;
	b.dirty = true;
	if (a) {
		a.x -= nx * correction * a.invMass;
		a.y -= ny * correction * a.invMass;
		a.dirty = true;
	}
}

function wakeBody(body: PhysicsBody, other: PhysicsBody, drag: PhysicsDrag | null) {
	const impactSpeed =
		Math.hypot(other.vx, other.vy) +
		Math.abs(other.angularVelocity) * (Math.hypot(other.width, other.height) / 2);
	if (!body.asleep || other.asleep || (other !== drag?.body && impactSpeed < 100)) return;
	body.asleep = false;
	body.idleFor = 0;
}

function getCorners(body: PhysicsBody) {
	const halfWidth = body.width / 2;
	const halfHeight = body.height / 2;
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	return [
		rotatePoint(-halfWidth, -halfHeight, body.x, body.y, cos, sin),
		rotatePoint(halfWidth, -halfHeight, body.x, body.y, cos, sin),
		rotatePoint(halfWidth, halfHeight, body.x, body.y, cos, sin),
		rotatePoint(-halfWidth, halfHeight, body.x, body.y, cos, sin),
	];
}

function getAxes(body: PhysicsBody) {
	const cos = Math.cos(body.angle);
	const sin = Math.sin(body.angle);
	return [
		{ x: cos, y: sin },
		{ x: -sin, y: cos },
	];
}

function rotatePoint(
	x: number,
	y: number,
	centerX: number,
	centerY: number,
	cos: number,
	sin: number,
) {
	return { x: centerX + x * cos - y * sin, y: centerY + x * sin + y * cos };
}

function project(points: Point[], axis: Point) {
	let min = Number.POSITIVE_INFINITY;
	let max = Number.NEGATIVE_INFINITY;
	for (const point of points) {
		const value = point.x * axis.x + point.y * axis.y;
		min = Math.min(min, value);
		max = Math.max(max, value);
	}
	return { min, max };
}

function supportPoint(points: Point[], directionX: number, directionY: number) {
	let support = points[0] ?? { x: 0, y: 0 };
	let maximum = Number.NEGATIVE_INFINITY;
	for (const point of points) {
		const projection = point.x * directionX + point.y * directionY;
		if (projection > maximum) {
			maximum = projection;
			support = point;
		}
	}
	return support;
}

function velocityAtPoint(body: PhysicsBody, offsetX: number, offsetY: number) {
	return {
		x: body.vx - body.angularVelocity * offsetY,
		y: body.vy + body.angularVelocity * offsetX,
	};
}
