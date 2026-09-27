import { createToaster } from '@skeletonlabs/skeleton-svelte';

export const toaster = createToaster({ placement: 'top-end' });

/** The calls the app already makes, on Skeleton's toaster. */
export const toast = {
	success: (message: string) => toaster.success({ title: message }),
	/** Amber: something is waiting on someone else, such as a request the GM has not answered. */
	pending: (message: string) => toaster.warning({ title: message }),
	warning: (message: string) => toaster.warning({ title: message }),
	error: (message: string) => toaster.error({ title: message, duration: 6000 }),
	info: (message: string) => toaster.info({ title: message }),
	dismiss: (id?: string) => toaster.dismiss(id),
	clear: () => toaster.dismiss()
};
