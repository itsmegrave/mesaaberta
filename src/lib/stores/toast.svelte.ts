export type ToastVariant = 'success' | 'pending' | 'warning' | 'error' | 'info';

export type Toast = {
	id: string;
	message: string;
	variant: ToastVariant;
	duration?: number;
};

class ToastStore {
	toasts = $state<Toast[]>([]);

	add(toast: { message: string; variant?: ToastVariant; duration?: number }): string {
		const id = crypto.randomUUID();
		const newToast: Toast = {
			id,
			message: toast.message,
			variant: toast.variant ?? 'info',
			duration: toast.duration ?? 5000
		};
		this.toasts.push(newToast);

		if (newToast.duration && newToast.duration > 0) {
			setTimeout(() => {
				this.dismiss(id);
			}, newToast.duration);
		}
		return id;
	}

	success(message: string, duration = 5000): string {
		return this.add({ message, variant: 'success', duration });
	}

	pending(message: string, duration = 5000): string {
		return this.add({ message, variant: 'pending', duration });
	}

	warning(message: string, duration = 5000): string {
		return this.add({ message, variant: 'warning', duration });
	}

	error(message: string, duration = 6000): string {
		return this.add({ message, variant: 'error', duration });
	}

	info(message: string, duration = 5000): string {
		return this.add({ message, variant: 'info', duration });
	}

	dismiss(id: string): void {
		const index = this.toasts.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.toasts.splice(index, 1);
		}
	}

	clear(): void {
		this.toasts = [];
	}
}

export const toast = new ToastStore();
