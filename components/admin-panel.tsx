'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
	deleteChallenge,
	getAdminSchedule,
	saveBulkSchedule,
	saveSingleChallenge
} from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CalendarPlus, Layers, Search, Trash2 } from 'lucide-react';

type ScheduleData = NonNullable<Awaited<ReturnType<typeof getAdminSchedule>>>;

export function AdminPanel({ initialSchedule }: { initialSchedule: ScheduleData }) {
	const [schedule, setSchedule] = useState<ScheduleData>(initialSchedule);
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	// Filtros de la lista programada
	const [modeFilter, setModeFilter] = useState<'all' | 'word' | 'phrase'>('all');
	const [searchQuery, setSearchQuery] = useState('');

	// Estado formulario por lote
	const [bulkStartDate, setBulkStartDate] = useState(initialSchedule.today);
	const [bulkMode, setBulkMode] = useState<'word' | 'phrase'>('word');
	const [bulkLines, setBulkLines] = useState('');

	// Estado formulario individual
	const [singleDate, setSingleDate] = useState(initialSchedule.today);
	const [singleMode, setSingleMode] = useState<'word' | 'phrase'>('word');
	const [singleWord, setSingleWord] = useState('');
	const [singleHint, setSingleHint] = useState('');

	async function reload() {
		const fresh = await getAdminSchedule();
		if (fresh) setSchedule(fresh);
	}

	function notify(text: string) {
		setMsg(text);
		setTimeout(() => setMsg(null), 3000);
	}

	const wordCount = useMemo(
		() => schedule.items.filter((item) => item.mode === 'word').length,
		[schedule.items]
	);

	const phraseCount = useMemo(
		() => schedule.items.filter((item) => item.mode === 'phrase').length,
		[schedule.items]
	);

	const filteredItems = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		return schedule.items.filter((item) => {
			if (modeFilter !== 'all' && item.mode !== modeFilter) return false;
			if (!q) return true;
			return (
				item.word.toLowerCase().includes(q) ||
				item.dateStr.includes(q) ||
				(item.hint?.toLowerCase().includes(q) ?? false)
			);
		});
	}, [modeFilter, schedule.items, searchQuery]);

	async function handleBulkSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		const res = await saveBulkSchedule({
			startDate: bulkStartDate,
			mode: bulkMode,
			rawLines: bulkLines
		});
		setLoading(false);

		if ('ok' in res && res.ok) {
			setBulkLines('');
			await reload();
			notify(`¡Listo! Se programaron ${res.count} días seguidos.`);
		} else {
			notify('Revisa el formato de la lista.');
		}
	}

	async function handleSingleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		const res = await saveSingleChallenge({
			dateStr: singleDate,
			mode: singleMode,
			word: singleWord,
			hint: singleHint
		});
		setLoading(false);

		if ('ok' in res && res.ok) {
			setSingleWord('');
			setSingleHint('');
			await reload();
			notify('Guardado correctamente.');
		} else {
			notify('La palabra o frase es muy corta.');
		}
	}

	async function handleDelete(id: number) {
		await deleteChallenge(id);
		await reload();
		notify('Eliminado.');
	}

	return (
		<div className="min-h-dvh bg-zinc-950 text-zinc-100 px-4 py-6">
			<div className="max-w-xl mx-auto space-y-6">
				<div className="flex items-center justify-between gap-2">
					<div>
						<h1 className="text-lg font-extrabold tracking-tight text-zinc-100">
							Admin · FrateWordleSquad
						</h1>
						<p className="text-xs text-zinc-400">Programación diaria del Squad</p>
					</div>
					<Link href="/">
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:text-white"
						>
							<ArrowLeft className="w-3.5 h-3.5" />
							Volver al juego
						</Button>
					</Link>
				</div>

				{msg && (
					<div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium px-4 py-2.5 rounded-xl">
						{msg}
					</div>
				)}

				<Tabs defaultValue="bulk" className="space-y-4">
					<TabsList className="grid grid-cols-2 w-full bg-zinc-900 border border-zinc-800 p-1 h-10">
						<TabsTrigger
							value="bulk"
							className="gap-1.5 font-semibold text-zinc-400 hover:text-zinc-200 data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950"
						>
							<Layers className="w-3.5 h-3.5" />
							Por Lote (Semana/Mes)
						</TabsTrigger>
						<TabsTrigger
							value="single"
							className="gap-1.5 font-semibold text-zinc-400 hover:text-zinc-200 data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-950"
						>
							<CalendarPlus className="w-3.5 h-3.5" />
							Un Día
						</TabsTrigger>
					</TabsList>

					{/* CARGA MASIVA */}
					<TabsContent value="bulk">
						<form
							onSubmit={handleBulkSubmit}
							className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4"
						>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<label className="text-xs font-medium text-zinc-300">Fecha de inicio</label>
									<Input
										type="date"
										value={bulkStartDate}
										onChange={(e) => setBulkStartDate(e.target.value)}
										required
										className="bg-zinc-950 border-zinc-700 text-zinc-100 text-sm [color-scheme:dark]"
									/>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-medium text-zinc-300">Modo</label>
									<select
										value={bulkMode}
										onChange={(e) => setBulkMode(e.target.value as 'word' | 'phrase')}
										className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 px-3 text-sm text-zinc-100"
									>
										<option value="word">Palabra</option>
										<option value="phrase">Frase (Ahorcado)</option>
									</select>
								</div>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-zinc-300">
									Lista (una por línea · usa <code className="text-emerald-400">| pista</code> si quieres)
								</label>
								<textarea
									rows={7}
									value={bulkLines}
									onChange={(e) => setBulkLines(e.target.value)}
									placeholder={
										bulkMode === 'word'
											? 'AREPA | Desayuno criollo\nCHIGUIRE | Roedor gigante\nCACHAPA | Con queso de mano'
											: 'CAMARON QUE SE DUERME | Refrán\nMAS VALE PAJARO EN MANO | Dicho popular'
									}
									required
									className="w-full rounded-xl bg-zinc-950 border border-zinc-700 p-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
								/>
							</div>

							<Button
								type="submit"
								disabled={loading}
								className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold cursor-pointer"
							>
								{loading ? 'Programando...' : 'Programar días consecutivos'}
							</Button>
						</form>
					</TabsContent>

					{/* CARGA INDIVIDUAL */}
					<TabsContent value="single">
						<form
							onSubmit={handleSingleSubmit}
							className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4"
						>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-1">
									<label className="text-xs font-medium text-zinc-300">Fecha</label>
									<Input
										type="date"
										value={singleDate}
										onChange={(e) => setSingleDate(e.target.value)}
										required
										className="bg-zinc-950 border-zinc-700 text-zinc-100 text-sm [color-scheme:dark]"
									/>
								</div>

								<div className="space-y-1">
									<label className="text-xs font-medium text-zinc-300">Modo</label>
									<select
										value={singleMode}
										onChange={(e) => setSingleMode(e.target.value as 'word' | 'phrase')}
										className="w-full h-9 rounded-md bg-zinc-950 border border-zinc-700 px-3 text-sm text-zinc-100"
									>
										<option value="word">Palabra</option>
										<option value="phrase">Frase (Ahorcado)</option>
									</select>
								</div>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-zinc-300">
									{singleMode === 'word' ? 'Palabra' : 'Frase completa'}
								</label>
								<Input
									value={singleWord}
									onChange={(e) => setSingleWord(e.target.value)}
									placeholder={singleMode === 'word' ? 'Ej: TURPIAL' : 'Ej: A CABALLO REGALADO'}
									required
									className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 uppercase"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-zinc-300">Pista (opcional)</label>
								<Input
									value={singleHint}
									onChange={(e) => setSingleHint(e.target.value)}
									placeholder="Ej: Ave nacional"
									className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
								/>
							</div>

							<Button
								type="submit"
								disabled={loading}
								className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold cursor-pointer"
							>
								{loading ? 'Guardando...' : 'Guardar día'}
							</Button>
						</form>
					</TabsContent>
				</Tabs>

				{/* LISTA DE PRÓXIMOS DÍAS PROGRAMADOS CON FILTROS */}
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
							Programados desde hoy ({schedule.items.length})
						</h2>

						{/* Botones de filtro: Todos / Palabras / Frases */}
						<div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs font-bold">
							<button
								type="button"
								onClick={() => setModeFilter('all')}
								className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
									modeFilter === 'all'
										? 'bg-zinc-100 text-zinc-950'
										: 'text-zinc-400 hover:text-zinc-200'
								}`}
							>
								Todos ({schedule.items.length})
							</button>
							<button
								type="button"
								onClick={() => setModeFilter('word')}
								className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
									modeFilter === 'word'
										? 'bg-emerald-500 text-zinc-950'
										: 'text-zinc-400 hover:text-emerald-400'
								}`}
							>
								Palabras ({wordCount})
							</button>
							<button
								type="button"
								onClick={() => setModeFilter('phrase')}
								className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
									modeFilter === 'phrase'
										? 'bg-amber-400 text-zinc-950'
										: 'text-zinc-400 hover:text-amber-300'
								}`}
							>
								Frases ({phraseCount})
							</button>
						</div>
					</div>

					{/* Buscador por fecha, palabra o pista */}
					{schedule.items.length > 0 && (
						<div className="relative">
							<Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
							<Input
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Buscar por fecha (2026-11...), palabra o pista..."
								className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-500"
							/>
						</div>
					)}

					{schedule.items.length === 0 ? (
						<p className="text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 text-center">
							No hay días programados todavía. Usa el formulario de arriba para cargar la semana.
						</p>
					) : filteredItems.length === 0 ? (
						<p className="text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 text-center">
							No hay elementos que coincidan con ese filtro.
						</p>
					) : (
						<div className="space-y-2">
							{filteredItems.map((item) => (
								<div
									key={item.id}
									className="flex items-center justify-between gap-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-3.5 py-2.5 transition-colors"
								>
									<div className="space-y-0.5 min-w-0">
										<div className="flex items-center gap-2">
											<span className="text-xs font-mono font-semibold text-zinc-300">
												{item.dateStr}
											</span>
											<span
												className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
													item.mode === 'word'
														? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
														: 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
												}`}
											>
												{item.mode === 'word' ? 'Palabra' : 'Frase'}
											</span>
										</div>
										<p className="text-sm font-bold tracking-wide text-zinc-100 break-words">
											{item.word}
										</p>
										{item.hint && <p className="text-xs text-zinc-400">Pista: {item.hint}</p>}
									</div>

									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDelete(item.id)}
										className="shrink-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}