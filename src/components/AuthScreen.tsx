import AuthPanel, { AuthLegalNotice } from "#/components/AuthPanel";
import ThinkExLogo from "#/components/ThinkExLogo";

interface AuthScreenProps {
	callbackURL: string;
}

export default function AuthScreen({ callbackURL }: AuthScreenProps) {
	return (
		<div className="relative h-dvh overflow-hidden bg-background text-foreground">
			<main className="flex h-full items-center justify-center overflow-hidden px-6 pt-6 pb-24 sm:px-10 sm:pt-10 sm:pb-28">
				<div className="flex w-full max-w-md flex-col items-center gap-8 px-8 text-center sm:px-12">
					<ThinkExLogo size={36} />
					<h1 className="text-2xl font-medium tracking-tight">Continue to ThinkEx</h1>
					<div className="w-full">
						<AuthPanel callbackURL={callbackURL} showLegalNotice={false} />
					</div>
				</div>
			</main>
			<div className="absolute inset-x-6 bottom-6 mx-auto max-w-sm sm:bottom-8">
				<AuthLegalNotice />
			</div>
		</div>
	);
}
