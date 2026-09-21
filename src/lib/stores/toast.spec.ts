import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toast } from './toast.svelte';

describe('toast store', () => {
	beforeEach(() => {
		toast.clear();
		vi.useFakeTimers();
	});

	it('adds toasts with default or specified variants and auto-dismisses', () => {
		const id = toast.success('Vaga confirmada!');
		expect(toast.toasts).toHaveLength(1);
		expect(toast.toasts[0]).toEqual({
			id,
			message: 'Vaga confirmada!',
			variant: 'success',
			duration: 5000
		});

		vi.advanceTimersByTime(5000);
		expect(toast.toasts).toHaveLength(0);
	});

	it('supports pending, error, and info toasts', () => {
		toast.pending('Pedido enviado');
		toast.error('Erro ao conectar');
		toast.info('Nova notificação');

		expect(toast.toasts).toHaveLength(3);
		expect(toast.toasts[0].variant).toBe('pending');
		expect(toast.toasts[1].variant).toBe('error');
		expect(toast.toasts[2].variant).toBe('info');
	});

	it('dismisses a toast manually', () => {
		const id = toast.success('Operação realizada');
		expect(toast.toasts).toHaveLength(1);

		toast.dismiss(id);
		expect(toast.toasts).toHaveLength(0);
	});
});
