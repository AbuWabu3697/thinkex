export const pricingPlans = [
	{
		id: "free",
		name: "Free",
		price: "$0",
		features: [
			"500 messages a month",
			"30 messages on premium models",
			"50 file uploads",
			"Live collaboration",
			"No credit card required",
		],
		emphasized: false,
	},
	{
		id: "pro",
		name: "Pro",
		price: "$7.99",
		priceSuffix: "per month",
		features: [
			"3,000 messages a month",
			"400 messages on premium models",
			"500 file uploads",
			"Live collaboration",
			"Priority access to new features",
		],
		emphasized: true,
	},
] as const;

export type PricingPlan = (typeof pricingPlans)[number];
