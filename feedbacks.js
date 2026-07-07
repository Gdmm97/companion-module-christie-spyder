import { combineRgb } from '@companion-module/base'

function getLayerChoices(self) {
	const count = self._lastLayerCount || 0
	if (!count) return [{ id: '2', label: 'Layer 1 – connecting…' }]
	return Array.from({ length: count }, (_, i) => {
		const layerId = i + 2
		return { id: String(layerId), label: `Layer ${i + 1}` }
	})
}

function getSourceChoices(self) {
	if (!self.sources?.length) return [{ id: '', label: '(no sources loaded yet – type manually)' }]
	return self.sources.map((s) => ({ id: s.name, label: s.name }))
}

// Returns 'pgm' | 'pvw' | null for the bus a layer is currently on,
// derived from its live pixelspace (RLK) and the pgm/pvw pairs (RPM).
function busOfLayer(self, layerId) {
	const ps = self.layerPS?.[parseInt(layerId)]
	if (ps == null) return null
	for (const p of self.psPairs || []) {
		if (p.pgmId === ps) return 'pgm'
		if (p.pvwId === ps) return 'pvw'
	}
	return null
}

function getPairChoices(self) {
	if (!self.psPairs?.length) return [{ id: '0', label: 'Pair 1 – connecting…' }]
	return self.psPairs.map((p, i) => ({
		id: String(i),
		label: self.pixelspaces
			? `${self.pixelspaces.find((ps) => ps.id === p.pgmId)?.name ?? `PS ${p.pgmId}`} / ${self.pixelspaces.find((ps) => ps.id === p.pvwId)?.name ?? `PS ${p.pvwId}`}`
			: `Pair ${i + 1} (PGM ${p.pgmId} / PVW ${p.pvwId})`,
	}))
}

export function GetFeedbackDefinitions(self) {
	return {
		inp_ok: {
			type: 'boolean',
			name: 'Script Active',
			description: 'Button lights when the specified script is currently running',
			defaultStyle: {
				bgcolor: combineRgb(180, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					label: 'ID Type',
					id: 'type',
					default: 'S',
					choices: [
						{ id: 'S', label: 'Script ID (default)' },
						{ id: 'R', label: 'Register ID' },
					],
				},
				{
					type: 'number',
					label: 'Script ID / Register ID',
					id: 'sidx',
					default: 1,
					min: 0,
					max: 9999,
				},
			],
			callback: (fb) => {
				const id = fb.options.sidx
				const reg = fb.options.type === 'R' ? self.reg[id - 1] : self.reg[self.script2reg[id]]
				return !!reg?.active
			},
		},

		source_on_pgm: {
			type: 'boolean',
			name: 'Source on Program',
			description: 'Button lights when the named source is visible on a Program PixelSpace',
			defaultStyle: {
				bgcolor: combineRgb(200, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'textinput',
					label: 'Source Name (exact match)',
					id: 'sourceName',
					default: 'Camera1',
				},
			],
			callback: (fb) => {
				const bus = self.activeSources?.get(fb.options.sourceName)
				return bus === 1 || bus === 2
			},
		},

		source_on_pvw: {
			type: 'boolean',
			name: 'Source on Preview',
			description: 'Button lights when the named source is visible on a Preview PixelSpace',
			defaultStyle: {
				bgcolor: combineRgb(0, 160, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'textinput',
					label: 'Source Name (exact match)',
					id: 'sourceName',
					default: 'Camera1',
				},
			],
			callback: (fb) => {
				const bus = self.activeSources?.get(fb.options.sourceName)
				return bus === 0 || bus === 2
			},
		},

		layer_on_bus: {
			type: 'boolean',
			name: 'Layer on PGM / PVW',
			description: 'Button lights when the selected layer is on the PGM or PVW pixelspace of the chosen pair',
			defaultStyle: {
				bgcolor: combineRgb(200, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Pixelspace Pair',
					id: 'pairIdx',
					default: '0',
					allowCustom: true,
					choices: getPairChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layerId',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: 'pgm',
					choices: [
						{ id: 'pgm', label: 'Program (PGM)' },
						{ id: 'pvw', label: 'Preview (PVW)' },
					],
				},
			],
			callback: (fb) => {
				const pair = self.psPairs?.[parseInt(fb.options.pairIdx)]
				if (!pair) return false
				const layerId = parseInt(fb.options.layerId)
				const targetPs = fb.options.bus === 'pgm' ? pair.pgmId : pair.pvwId
				const layerPsVal = self.layerPS?.[layerId]
				// Both being undefined must NOT count as a match
				if (layerPsVal == null || targetPs == null) return false
				// An "off" layer parks back on the program pixelspace, so also require
				// the layer to be actively on-bus (visible), not parked/hidden.
				if (!self.layerVis?.[layerId]) return false
				return layerPsVal === targetPs
			},
		},

		source_on_layer: {
			type: 'boolean',
			name: 'Source on Layer',
			description:
				'Button lights when the selected source is loaded on a layer. In Mixer mode it targets whichever of the two mixer layers is currently on the chosen bus (PGM/PVW).',
			defaultStyle: {
				bgcolor: combineRgb(0, 100, 200),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: 'layer',
					choices: [
						{ id: 'layer', label: 'Single Layer' },
						{ id: 'mixer', label: 'Mixer (resolve layer by bus)' },
					],
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layerId',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
					isVisible: (opts) => opts.mode !== 'mixer',
				},
				{
					type: 'dropdown',
					label: 'Target Bus',
					id: 'bus',
					default: 'pgm',
					choices: [
						{ id: 'pgm', label: 'Program (PGM)' },
						{ id: 'pvw', label: 'Preview (PVW)' },
					],
					isVisible: (opts) => opts.mode === 'mixer',
				},
				{
					type: 'dropdown',
					label: 'Mixer Layer A',
					id: 'layerA',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
					isVisible: (opts) => opts.mode === 'mixer',
				},
				{
					type: 'dropdown',
					label: 'Mixer Layer B',
					id: 'layerB',
					default: '3',
					allowCustom: true,
					choices: getLayerChoices(self),
					isVisible: (opts) => opts.mode === 'mixer',
				},
				{
					type: 'dropdown',
					label: 'Source Name',
					id: 'sourceName',
					default: '',
					allowCustom: true,
					choices: getSourceChoices(self),
				},
			],
			callback: (fb) => {
				let target
				if (fb.options.mode === 'mixer') {
					// Resolve which of the two mixer layers is on the target bus, live.
					if (busOfLayer(self, fb.options.layerA) === fb.options.bus) target = fb.options.layerA
					else if (busOfLayer(self, fb.options.layerB) === fb.options.bus) target = fb.options.layerB
					else return false
				} else {
					target = fb.options.layerId
				}
				const cur = self.layerSource?.[parseInt(target)]
				if (cur == null || cur === '') return false
				return cur === fb.options.sourceName
			},
		},
	}
}
