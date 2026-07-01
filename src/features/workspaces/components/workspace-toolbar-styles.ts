const workspaceToolbarButtonSizeClass = "size-10 sm:size-8.5";

const workspaceToolbarIconButtonClass = `${workspaceToolbarButtonSizeClass} justify-center px-0 text-muted-foreground hover:text-foreground aria-expanded:text-foreground [&_svg:not([class*='size-'])]:size-4`;

const workspaceToolbarTextButtonClass =
	"h-10 gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground sm:h-8.5 sm:px-2.5 [&_svg:not([class*='size-'])]:size-4";

const workspaceToolbarGroupClassName = "flex items-center gap-1 sm:gap-0.5";

const workspaceToolbarScrollGroupClassName =
	"flex max-w-full min-w-0 items-center gap-1 overflow-x-auto sm:gap-0.5";

export {
	workspaceToolbarButtonSizeClass,
	workspaceToolbarGroupClassName,
	workspaceToolbarIconButtonClass,
	workspaceToolbarScrollGroupClassName,
	workspaceToolbarTextButtonClass,
};
