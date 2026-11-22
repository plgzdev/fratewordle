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
import {
	ArrowLeft,
	CalendarPlus,
	ChevronLeft,
	ChevronRight,
	Layers,
	Search,
	Trash2
} from 'lucide-react';

type ScheduleData = NonNullable<Awaited<ReturnType<typeof getAdminSchedule>>>;
type ScheduleItem = ScheduleData['items'][number];

const DAYS_PER_PAGE = 5;

export function AdminPanel({ initialSchedule }: { initialSchedule: ScheduleData }) {
	const [schedule, setSchedule] = useState<ScheduleData>(initialSchedule);
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState<string | null>(null);

	// Filtros y paginación de la lista programada
	const [modeFilter, setModeFilter] = useState<'all' | 'word' | 'phrase'>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [page, setPage] = useState(1);

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

	// Agrupar items por fecha (1 tarjeta por día con Palabra + Frase juntas)
	const groupedDays = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		const map = new Map<
			string,
			{ dateStr: string; word?: ScheduleItem; phrase?: ScheduleItem }
		>();

		for (const item of schedule.items) {
			if (modeFilter !== 'all' && item.mode !== modeFilter) continue;
			if (
				q &&
				!item.word.toLowerCase().includes(q) &&
				!item.dateStr.includes(q) &&
				!(item.hint?.toLowerCase().includes(q) ?? false)
			) {
				continue;
			}

			const existing = map.get(item.dateStr) ?? { dateStr: item.dateStr };
			if (item.mode === 'word') existing.word = item;
			else existing.phrase = item;
			map.set(item.dateStr, existing);
		}

		return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
	}, [modeFilter, schedule.items, searchQuery]);

	const totalPages = Math.max(1, Math.ceil(groupedDays.length / DAYS_PER_PAGE));
	const safePage = Math.min(page, totalPages);
	const paginatedDays = useMemo(() => {
		const start = (safePage - 1) * DAYS_PER_PAGE;
		return groupedDays.slice(start, start + DAYS_PER_PAGE);
	}, [groupedDays, safePage]);

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

	async function handleDeleteDay(day: {
		dateStr: string;
		word?: ScheduleItem;
		phrase?: ScheduleItem;
	}) {
		const ids = [day.word?.id, day.phrase?.id].filter((id): id is number => Boolean(id));
		if (ids.length === 0) return;

		await Promise.all(ids.map((id) => deleteChallenge(id)));
		await reload();
		notify(`Día ${day.dateStr} eliminado por completo.`);
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

				{/* LISTA DE PRÓXIMOS DÍAS AGRUPADA POR FECHA + PAGINACIÓN */}
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
							Días programados ({groupedDays.length})
						</h2>

						{/* Botones de filtro: Todos / Palabras / Frases */}
						<div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs font-bold">
							<button
								type="button"
								onClick={() => {
									setModeFilter('all');
									setPage(1);
								}}
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
								onClick={() => {
									setModeFilter('word');
									setPage(1);
								}}
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
								onClick={() => {
									setModeFilter('phrase');
									setPage(1);
								}}
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
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setPage(1);
								}}
								placeholder="Buscar por fecha (2026-11...), palabra o pista..."
								className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-200 placeholder:text-zinc-500"
							/>
						</div>
					)}

					{schedule.items.length === 0 ? (
						<p className="text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 text-center">
							No hay días programados todavía. Usa el formulario de arriba para cargar la semana.
						</p>
					) : paginatedDays.length === 0 ? (
						<p className="text-xs text-zinc-400 bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 text-center">
							No hay elementos que coincidan con ese filtro.
						</p>
					) : (
						<>
							<div className="space-y-2.5">
								{paginatedDays.map((day) => {
									const isToday = day.dateStr === schedule.today;
									const itemsInDay = (day.word ? 1 : 0) + (day.phrase ? 1 : 0);

									return (
										<div
											key={day.dateStr}
											className={`bg-zinc-900 border rounded-xl p-3 space-y-2 transition-colors ${
												isToday ? 'border-emerald-500/50' : 'border-zinc-800'
											}`}
										>
											{/* Cabecera del día con botón para borrar todo el día */}
											<div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-1.5">
												<div className="flex items-center gap-2">
													<span className="text-xs font-mono font-bold text-zinc-200">
														{day.dateStr}
													</span>
													{isToday && (
														<span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
															Hoy
														</span>
													)}
												</div>

												<div className="flex items-center gap-2">
													<span className="text-[11px] text-zinc-500 hidden sm:inline">
														{[day.word && 'Palabra', day.phrase && 'Frase']
															.filter(Boolean)
															.join(' + ')}
													</span>
													<button
														type="button"
														onClick={() => handleDeleteDay(day)}
														title={
															itemsInDay > 1
																? 'Borrar palabra y frase de este día'
																: 'Borrar día'
														}
														className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 hover:text-rose-200 text-[11px] font-bold transition-colors cursor-pointer"
													>
														<Trash2 className="w-3 h-3" />
														Borrar día
													</button>
												</div>
											</div>

											{/* Retos del día en 2 columnas en desktop / apilados compactos en móvil */}
											<div
												className={`grid gap-2 ${
													modeFilter === 'all' ? 'sm:grid-cols-2' : 'grid-cols-1'
												}`}
											>
												{modeFilter !== 'phrase' && (
													<div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
														{day.word ? (
															<>
																<div className="min-w-0 space-y-0.5">
																	<span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
																		Palabra
																	</span>
																	<p className="text-xs font-bold text-zinc-100 break-words">
																		{day.word.word}
																	</p>
																	{day.word.hint && (
																		<p className="text-[11px] text-zinc-400 line-clamp-1">
																			{day.word.hint}
																		</p>
																	)}
																</div>
																<button
																	type="button"
																	onClick={() => handleDelete(day.word!.id)}
																	title="Eliminar solo la palabra"
																	className="p-1 text-zinc-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</button>
															</>
														) : (
															<span className="text-[11px] text-zinc-500 italic py-1">
																Sin palabra (usará respaldo)
															</span>
														)}
													</div>
												)}

												{modeFilter !== 'word' && (
													<div className="bg-zinc-950/70 border border-zinc-800/80 rounded-lg px-2.5 py-2 flex items-start justify-between gap-2">
														{day.phrase ? (
															<>
																<div className="min-w-0 space-y-0.5">
																	<span className="inline-block text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
																		Frase
																	</span>
																	<p className="text-xs font-bold text-zinc-100 break-words">
																		{day.phrase.word}
																	</p>
																	{day.phrase.hint && (
																		<p className="text-[11px] text-zinc-400 line-clamp-1">
																			{day.phrase.hint}
																		</p>
																	)}
																</div>
																<button
																	type="button"
																	onClick={() => handleDelete(day.phrase!.id)}
																	title="Eliminar solo la frase"
																	className="p-1 text-zinc-500 hover:text-rose-400 rounded cursor-pointer shrink-0"
																>
																	<Trash2 className="w-3.5 h-3.5" />
																</button>
															</>
														) : (
															<span className="text-[11px] text-zinc-500 italic py-1">
																Sin frase (usará respaldo)
															</span>
														)}
													</div>
												)}
											</div>
										</div>
									);
								})}
							</div>

							{/* Controles de paginación */}
							{totalPages > 1 && (
								<div className="flex items-center justify-between pt-1">
									<button
										type="button"
										disabled={safePage <= 1}
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
									>
										<ChevronLeft className="w-3.5 h-3.5" />
										Anterior
									</button>
									<span className="text-xs font-semibold text-zinc-400">
										Página {safePage} de {totalPages}
									</span>
									<button
										type="button"
										disabled={safePage >= totalPages}
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
									>
										Siguiente
										<ChevronRight className="w-3.5 h-3.5" />
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</div>
	);
}