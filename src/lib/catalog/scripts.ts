// Скрипты админки (/admin/scripts): реестр бэкенда (описание, команда, флаги), запуск фоновой
// задачей, лог по строкам (опрос), отмена, отчёт сухого прогона. Только с токеном admin.
// Запустить можно только скрипт из реестра — флаги бэкенд проверяет сам (400 с field = флаг).

import { ApiError, unwrap } from '#lib/api/errors.ts';
import type { Api } from '#lib/api/client.ts';
import type {
	SchemaFlag,
	SchemaJobInfo,
	SchemaJobLog,
	SchemaJobStatus,
	SchemaScript
} from '#lib/api/generated/catalog.ts';

export type Script = SchemaScript;
export type Flag = SchemaFlag;
export type JobInfo = SchemaJobInfo;
export type JobLog = SchemaJobLog;
export type JobStatus = SchemaJobStatus;
/** Значения формы: число, строка или да/нет; пустое не передаётся. */
export type FlagValues = Record<string, string | number | boolean | null>;

export const JOB_STATUS_TITLES: Record<JobStatus, string> = {
	running: 'Идёт',
	succeeded: 'Готово',
	failed: 'Ошибка',
	stopped: 'Обработано, не записано',
	cancelled: 'Отменён'
};

/** Начальные значения формы: да/нет — false, остальное пусто (значение скрипта по умолчанию). */
export function emptyValues(script: Script): FlagValues {
	return Object.fromEntries(script.flags.map((f) => [f.name, f.type === 'bool' ? false : '']));
}

/** Убрать пустое и привести числа: `{limit: '100', ai: ''}` → `{limit: 100}`. */
export function cleanValues(script: Script, values: FlagValues): FlagValues {
	const out: FlagValues = {};
	for (const flag of script.flags) {
		const v = values[flag.name];
		if (v === '' || v === null || v === undefined || v === false) continue;
		out[flag.name] = flag.type === 'int' ? Number(v) : v;
	}
	return out;
}

/** Команда, как она уйдёт скрипту: `--limit 100 --yes`. */
export function previewArgs(script: Script, values: FlagValues): string {
	return Object.entries(cleanValues(script, values))
		.map(([name, v]) => (v === true ? `--${name}` : `--${name} ${v}`))
		.join(' ');
}

export function listScripts(api: Api): Promise<Script[]> {
	return unwrap(api.catalog.GET('/api/v1/catalog/admin/scripts'));
}

export function runScript(api: Api, id: string, flags: FlagValues): Promise<JobInfo> {
	return unwrap(
		api.catalog.POST('/api/v1/catalog/admin/scripts/{id}/run', {
			params: { path: { id } },
			body: { flags }
		})
	);
}

export function listJobs(api: Api): Promise<JobInfo[]> {
	return unwrap(api.catalog.GET('/api/v1/catalog/admin/scripts/jobs'));
}

export function jobLog(api: Api, job: number, after: number): Promise<JobLog> {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/admin/scripts/jobs/{job}', {
			params: { path: { job }, query: { after } }
		})
	);
}

export async function cancelJob(api: Api, job: number): Promise<void> {
	await unwrap(
		api.catalog.POST('/api/v1/catalog/admin/scripts/jobs/{job}/cancel', {
			params: { path: { job } }
		})
	);
}

export function scriptReport(api: Api, id: string): Promise<string> {
	return unwrap(
		api.catalog.GET('/api/v1/catalog/admin/scripts/{id}/report', {
			params: { path: { id } },
			parseAs: 'text'
		})
	) as Promise<string>;
}

/** Прогресс чистки книг (`progress.json` скрипта). */
export interface ScriptProgress {
	total: number;
	classified: number;
	written: number;
	remaining: number;
	pending_write: number;
	exported_not_classified: number;
	last_batch: number | null;
	batches_written: number;
	updated_at: string;
}

/** `null` — скрипт ещё ни разу не считал прогресс. */
export async function scriptProgress(api: Api, id: string): Promise<ScriptProgress | null> {
	try {
		return (await unwrap(
			api.catalog.GET('/api/v1/catalog/admin/scripts/{id}/progress', { params: { path: { id } } })
		)) as unknown as ScriptProgress;
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) return null;
		throw e;
	}
}
