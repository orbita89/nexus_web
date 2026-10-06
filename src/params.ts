import { defineParams } from '@sveltejs/kit/params';
import { kindBySlug } from '#lib/catalog/kinds.ts';

export const params = defineParams({
	/** films | series | books | games */
	kind: (param) => kindBySlug(param)?.slug
});
