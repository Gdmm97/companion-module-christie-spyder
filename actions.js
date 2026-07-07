import { combineRgb } from '@companion-module/base'

function colorToRGB(color) {
	const r = (color >> 16) & 0xff
	const g = (color >> 8) & 0xff
	const b = color & 0xff
	return { r, g, b }
}

// ── Dynamic choice helpers ──────────────────────────────────────────────────

function getLayerChoices(self) {
	const count = self._lastLayerCount || 0
	if (!count) return [{ id: '2', label: 'Layer 1 – connecting…' }]
	return Array.from({ length: count }, (_, i) => {
		const layerId = i + 2
		return { id: String(layerId), label: `Layer ${i + 1}` }
	})
}

function getPixelspaceChoices(self) {
	if (!self.pixelspaces?.length) return [{ id: '0', label: 'Connecting…' }]
	return self.pixelspaces.map((ps) => ({
		id: String(ps.id),
		label: ps.name || `PixelSpace ${ps.id}`,
	}))
}

function getOutputChoices() {
	// Spyder X80 supports up to 16 outputs (0-based)
	return Array.from({ length: 16 }, (_, i) => ({
		id: String(i),
		label: `Output ${i + 1}`,
	}))
}

function getSourceChoices(self) {
	if (!self.sources?.length) return [{ id: '', label: '(no sources loaded yet – type manually)' }]
	return self.sources.map((s) => ({ id: s.name, label: s.name }))
}

function getBasicPresetChoices(self) {
	if (!self.basicPresets?.length) return [{ id: '1', label: 'Preset 1 – none loaded yet' }]
	return self.basicPresets.map((p) => ({ id: String(p.id), label: p.name || `Preset ${p.id}` }))
}

function getScriptChoices(self) {
	const entries = Object.entries(self.reg || {}).filter(([, r]) => r.scriptId != null)
	if (!entries.length) return [{ id: '', label: '(no scripts found – check connection)' }]
	return entries
		.map(([key, r]) => {
			const regId = parseInt(key)
			const page = !isNaN(regId) ? Math.floor(regId / 1000) + 1 : null
			const pageLabel = page !== null ? `Page ${page}` : null
			const scriptName = r.name || `Script ${r.scriptId}`
			const cuesLabel = r.numCues ? ` (${r.numCues} cues)` : ''
			const label = pageLabel ? `${pageLabel} – ${scriptName}${cuesLabel}` : `${scriptName}${cuesLabel}`
			return { id: String(r.scriptId), label, _page: page ?? 9999 }
		})
		.sort((a, b) => a._page - b._page || a.label.localeCompare(b.label))
		.map(({ id, label }) => ({ id, label }))
}

function getMvPresetChoices(self) {
	if (!self.mvPresets?.length) return []
	return self.mvPresets.map((p) => ({ id: p, label: p }))
}

function getTreatmentChoices(self) {
	if (!self.treatments?.length) return [{ id: '', label: '(no treatments loaded yet – type ID manually)' }]
	return self.treatments.map((t) => ({ id: String(t.id), label: `${t.name} (ID ${t.id})` }))
}

// Returns 'pgm' | 'pvw' | null for the bus the given layer is currently on,
// derived from its live pixelspace (RLK polling) and the pgm/pvw pairs (RPM).
function busOfLayer(self, layerId) {
	const ps = self.layerPS?.[parseInt(layerId)]
	if (ps == null) return null
	for (const p of self.psPairs || []) {
		if (p.pgmId === ps) return 'pgm'
		if (p.pvwId === ps) return 'pvw'
	}
	return null
}

function getScriptCueChoices(self) {
	const choices = []
	for (const [scriptId, cues] of Object.entries(self.scriptCues || {})) {
		const regKey = self.script2reg?.[scriptId]
		const regId = regKey !== undefined ? parseInt(regKey) : NaN
		const page = !isNaN(regId) ? Math.floor(regId / 1000) + 1 : null
		const scriptName = (regKey !== undefined ? self.reg?.[regKey]?.name : null) || `Script ${scriptId}`
		const pageLabel = page !== null ? ` – page ${page}` : ''
		for (const cue of (cues || [])) {
			const cueName = cue.name || `Cue ${cue.index + 1}`
			choices.push({
				id: `${scriptId}:${cue.index}`,
				label: `${cueName} (${scriptName}${pageLabel})`,
			})
		}
	}
	return choices.length ? choices : []
}


const MV_OUTPUTS = [
	{ id: '3',  label: 'Output 4' },
	{ id: '7',  label: 'Output 8' },
	{ id: '11', label: 'Output 12' },
	{ id: '15', label: 'Output 16' },
]

// ── Action definitions ──────────────────────────────────────────────────────

export function compileActionDefinitions(self) {
	const sendCmd = self.sendCmd

	return {
		'asc': {
			name: 'Take / Advance Script Cue',
			options: [
				{
					type: 'dropdown',
					label: 'Script',
					id: 'scriptId',
					default: (() => { const sc = getScriptChoices(self); return sc[0]?.id || '' })(),
					choices: getScriptChoices(self),
					tooltip: 'Select the script to operate on. Name, page and cue count are shown. Used for custom cue jumps; step/advance commands advance the current active script.',
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'step',
					default: '0',
					choices: [
						{ id: '-10',    label: 'Step back 10 Cues' },
						{ id: '-1',     label: 'Step back 1 Cue' },
						{ id: '0',      label: 'Take / Advance (next cue)' },
						{ id: '+1',     label: 'Advance 1 Cue' },
						{ id: '+10',    label: 'Advance 10 Cues' },
						{ id: 'custom', label: '— jump to custom cue below —' },
					],
				},
				{
					type: 'number',
					label: 'Custom cue index',
					id: 'customCue',
					default: 0,
					min: 0,
					max: 9999,
					isVisible: (opts) => opts.step === 'custom',
				},
			],
			callback: async (action) => {
				const { scriptId, step, customCue } = action.options
				if (step === 'custom') {
					// Jump to a specific cue in the selected script
					await sendCmd(`RSC ${scriptId} ${customCue}`)
				} else {
					// Advance / step via ASC
					await sendCmd('ASC' + (step === '0' ? '' : ' ' + step))
				}
			},
		},

		'air': {
			name: 'Aspect Insensitive Resize',
			options: [
				{
					type: 'dropdown',
					label: 'Sizing Type',
					id: 'sizingType',
					default: '0',
					choices: [
						{ id: '0', label: 'Absolute (pixels)' },
						{ id: '1', label: 'Relative (pixels)' },
					],
				},
				{
					type: 'dropdown',
					label: 'Dimension',
					id: 'dimension',
					default: '0',
					choices: [
						{ id: '0', label: 'Width (Horizontal)' },
						{ id: '1', label: 'Height (Vertical)' },
					],
				},
				{
					type: 'number',
					label: 'New Size (pixels)',
					id: 'newSize',
					default: 1920,
					min: 0,
					max: 99999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { sizingType, dimension, newSize, layers } = action.options
				await sendCmd(`AIR ${sizingType} ${dimension} ${newSize} ${layers}`)
			},
		},

		'arl': {
			name: 'Apply Register to Layer',
			options: [
				{
					type: 'dropdown',
					label: 'Register Type',
					id: 'regType',
					default: '6',
					choices: [
						{ id: '0',  label: 'Effect' },
						{ id: '1',  label: 'Playitem' },
						{ id: '4',  label: 'Command Key / Script' },
						{ id: '5',  label: 'Treatment' },
						{ id: '6',  label: 'Source' },
						{ id: '7',  label: 'Function Key' },
						{ id: '10', label: 'Still Image' },
					],
				},
				{
					type: 'number',
					label: 'Register ID',
					id: 'regId',
					default: 1,
					min: 0,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { regType, regId, layers } = action.options
				await sendCmd(`ARL ${regType} ${regId} ${layers}`)
			},
		},

		'aro': {
			name: 'Aspect Ratio Offset',
			options: [
				{
					type: 'dropdown',
					label: 'Type',
					id: 'type',
					default: 't',
					choices: [
						{ id: 't', label: 'Set Total Aspect Ratio' },
						{ id: 'o', label: 'Set Keyframe AR Offset' },
						{ id: 'a', label: 'Adjust Keyframe AR Offset' },
					],
				},
				{
					type: 'textinput',
					label: 'Aspect Ratio (e.g. 1.777 for 16:9)',
					id: 'ratio',
					default: '1.777',
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { type, ratio, layers } = action.options
				await sendCmd(`ARO ${type} ${ratio} ${layers}`)
			},
		},

		'bld': {
			name: 'Load Still in Background',
			options: [
				{
					type: 'textinput',
					label: 'Filename (on Spyder server)',
					id: 'filename',
					default: 'image.png',
				},
				{
					type: 'dropdown',
					label: 'PixelSpace',
					id: 'psId',
					default: '0',
					allowCustom: true,
					choices: getPixelspaceChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: '0',
					choices: [
						{ id: '0', label: 'Next Background Layer' },
						{ id: '1', label: 'Current Background Layer' },
					],
				},
			],
			callback: async (action) => {
				const { filename, psId, layer } = action.options
				await sendCmd(`BLD ${filename} ${psId} ${layer}`)
			},
		},

		'bpl': {
			name: 'Basic Preset Learn',
			options: [
				{
					type: 'dropdown',
					label: 'Preset ID',
					id: 'idx',
					default: '1',
					allowCustom: true,
					choices: getBasicPresetChoices(self),
					tooltip: 'Select an existing preset or type a new numeric ID. Note: preset names can only be set in Spyder Studio — the serial API (BPL) does not support naming presets.',
				},
				{
					type: 'number',
					label: 'Transition Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
			],
			callback: async (action) => {
				const { idx, dur } = action.options
				await sendCmd(`BPL ${idx} ${dur}`)
			},
		},

		'bpr': {
			name: 'Basic Preset Recall',
			options: [
				{
					type: 'dropdown',
					label: 'Preset',
					id: 'idx',
					default: '1',
					allowCustom: true,
					choices: getBasicPresetChoices(self),
				},
				{
					type: 'number',
					label: 'Transition Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
			],
			callback: async (action) => {
				const { idx, dur } = action.options
				await sendCmd(`BPR ${idx} ${dur}`)
			},
		},

		'btr': {
			name: 'Background Transition',
			options: [
				{
					type: 'number',
					label: 'Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
			],
			callback: async (action) => {
				await sendCmd(`BTR ${action.options.dur}`)
			},
		},

		'cii': {
			name: 'Capture Input Image',
			options: [
				{
					type: 'number',
					label: 'Input ID (0-based)',
					id: 'inputId',
					default: 0,
					min: 0,
					max: 99,
				},
				{
					type: 'textinput',
					label: 'File Name (e.g. capture.png)',
					id: 'filename',
					default: 'input.png',
				},
			],
			callback: async (action) => {
				const { inputId, filename } = action.options
				await sendCmd(`CII ${inputId} ${filename}`)
			},
		},

		'cli': {
			name: 'Capture Layer Image',
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layerId',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'textinput',
					label: 'File Name (e.g. capture.png)',
					id: 'filename',
					default: 'layer.png',
				},
			],
			callback: async (action) => {
				const { layerId, filename } = action.options
				await sendCmd(`CLI ${layerId} ${filename}`)
			},
		},

		'coi': {
			name: 'Capture Output Image',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'textinput',
					label: 'File Name (e.g. capture.png)',
					id: 'filename',
					default: 'output.png',
				},
			],
			callback: async (action) => {
				const { outputId, filename } = action.options
				await sendCmd(`COI ${outputId} ${filename}`)
			},
		},

		'crp': {
			name: 'Crop Layer',
			options: [
				{
					type: 'number',
					label: 'Left Crop (0.0 = none, 1.0 = 100%)',
					id: 'left',
					default: 0,
					min: 0,
					max: 1,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Right Crop (0.0 = none, 1.0 = 100%)',
					id: 'right',
					default: 0,
					min: 0,
					max: 1,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Top Crop (0.0 = none, 1.0 = 100%)',
					id: 'top',
					default: 0,
					min: 0,
					max: 1,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Bottom Crop (0.0 = none, 1.0 = 100%)',
					id: 'bottom',
					default: 0,
					min: 0,
					max: 1,
					step: 0.01,
					range: true,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { left, right, top, bottom, layers } = action.options
				await sendCmd(`CRP ${left} ${right} ${top} ${bottom} ${layers}`)
			},
		},

		'cso': {
			name: 'Clear Still on Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
			],
			callback: async (action) => {
				await sendCmd(`CSO ${action.options.outputId}`)
			},
		},

		'dck': {
			name: 'Delete Command Key',
			options: [
				{
					type: 'number',
					label: 'ID',
					id: 'id',
					default: 1,
					min: 0,
					max: 9999,
				},
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
			],
			callback: async (action) => {
				const { id, type } = action.options
				await sendCmd(`DCK ${id} ${type}`)
			},
		},

		'dmb': {
			name: 'Device Mixer Bus Apply',
			options: [
				{
					type: 'number',
					label: 'Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'Bus',
					id: 'bus',
					default: 'PGM',
					choices: [
						{ id: 'OFF', label: 'OFF – both layers off screen' },
						{ id: 'PVW', label: 'PVW – program layer in preview' },
						{ id: 'PGM', label: 'PGM – both program and preview visible' },
					],
				},
				{
					type: 'textinput',
					label: 'Device Index(es) (space-delimited, 0-based)',
					id: 'device',
					default: '0',
				},
			],
			callback: async (action) => {
				const { dur, bus, device } = action.options
				await sendCmd(`DMB ${dur} ${bus} ${device}`)
			},
		},

		'dmt': {
			name: 'Device Mixer Transition',
			options: [
				{
					type: 'number',
					label: 'Duration (frames; 1 = cut)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
				{
					type: 'textinput',
					label: 'Device ID(s) (space-delimited, 0-based)',
					id: 'dev',
					default: '0',
				},
			],
			callback: async (action) => {
				const { dur, dev } = action.options
				await sendCmd(`DMT ${dur} ${dev}`)
			},
		},

		'lsmb': {
			name: 'Load Source to Mixer Bus',
			options: [
				{
					type: 'dropdown',
					label: 'Source Name',
					id: 'name',
					default: '',
					allowCustom: true,
					choices: getSourceChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Target Bus',
					id: 'bus',
					default: 'pvw',
					choices: [
						{ id: 'pgm', label: 'Program (PGM)' },
						{ id: 'pvw', label: 'Preview (PVW)' },
					],
				},
				{
					type: 'dropdown',
					label: 'Mixer Layer A',
					id: 'layerA',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Mixer Layer B',
					id: 'layerB',
					default: '3',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { name, bus, layerA, layerB } = action.options
				// Resolve, live, which of the two mixer layers is on the target bus.
				const busA = busOfLayer(self, layerA)
				const busB = busOfLayer(self, layerB)
				let target = null
				if (busA === bus) target = layerA
				else if (busB === bus) target = layerB

				if (target == null) {
					self.log(
						'warn',
						`Load Source to Mixer Bus: could not find a layer on ${bus.toUpperCase()} ` +
							`(A=${layerA}→${busA ?? 'unknown'}, B=${layerB}→${busB ?? 'unknown'}). ` +
							`Check the two layer IDs and that RLK polling is populating layer state.`
					)
					return
				}
				const escapedName = String(name).replace(/ /g, '%20')
				await sendCmd(`SRA ${escapedName} ${target}`)
			},
		},

		'fkr': {
			name: 'Function Key Recall',
			options: [
				{
					type: 'number',
					label: 'Function Key ID (page 2+ = page*1000 + ID)',
					id: 'fkrid',
					default: 1,
					min: 0,
					max: 99999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'lay',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'dropdown',
					label: 'ID Type',
					id: 'idType',
					default: 'F',
					choices: [
						{ id: 'F', label: 'Function Key ID (default)' },
						{ id: 'R', label: 'Register ID' },
					],
				},
			],
			callback: async (action) => {
				const { fkrid, lay, idType } = action.options
				await sendCmd(`FKR ${fkrid} ${lay} ${idType}`)
			},
		},

		'frz': {
			name: 'Freeze Layer(s)',
			options: [
				{
					type: 'dropdown',
					label: 'Freeze',
					id: 'frzonoff',
					default: '1',
					choices: [
						{ id: '1', label: 'Freeze On' },
						{ id: '0', label: 'Freeze Off' },
					],
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'lay',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { frzonoff, lay } = action.options
				await sendCmd(`FRZ ${frzonoff} ${lay}`)
			},
		},

		'ick': {
			name: 'Input Color Key (Chroma Key)',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'enabled',
					default: '1',
					choices: [
						{ id: '1', label: 'Enable' },
						{ id: '0', label: 'Disable' },
					],
				},
				{
					type: 'colorpicker',
					label: 'Key Color',
					id: 'keyColor',
					default: combineRgb(0, 255, 0),
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'number',
					label: 'Range Red (0–255)',
					id: 'rangeR',
					default: 30,
					min: 0,
					max: 255,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'number',
					label: 'Range Green (0–255)',
					id: 'rangeG',
					default: 30,
					min: 0,
					max: 255,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'number',
					label: 'Range Blue (0–255)',
					id: 'rangeB',
					default: 30,
					min: 0,
					max: 255,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'number',
					label: 'Color Gain (0–512)',
					id: 'gain',
					default: 256,
					min: 0,
					max: 512,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { enabled, keyColor, rangeR, rangeG, rangeB, gain, layers } = action.options
				if (enabled === '0') {
					await sendCmd(`ICK 0 0 0 0 0 0 0 0 ${layers}`)
				} else {
					const { r, g, b } = colorToRGB(keyColor)
					await sendCmd(`ICK 1 ${r} ${g} ${b} ${rangeR} ${rangeG} ${rangeB} ${gain} ${layers}`)
				}
			},
		},

		'icl': {
			name: 'Input Config Learn',
			options: [
				{
					type: 'number',
					label: 'Input Config ID (save to)',
					id: 'input',
					default: 1,
					min: 0,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layerId',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { input, layerId } = action.options
				await sendCmd(`ICL ${input} ${layerId}`)
			},
		},

		'icr': {
			name: 'Input Configuration Recall',
			options: [
				{
					type: 'number',
					label: 'Configuration ID (-1 = Auto-Sync)',
					id: 'configId',
					default: 1,
					min: -1,
					max: 9999,
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
					label: 'Connector Type (Auto-Sync only)',
					id: 'connType',
					default: '0',
					choices: [
						{ id: '0', label: 'HDMI' },
						{ id: '1', label: 'Display Port' },
						{ id: '2', label: 'SDI' },
					],
					isVisible: (options) => String(options.configId) === '-1',
				},
			],
			callback: async (action) => {
				const { configId, layerId, connType } = action.options
				if (String(configId) === '-1') {
					await sendCmd(`ICR -1 ${layerId} ${connType}`)
				} else {
					await sendCmd(`ICR ${configId} ${layerId}`)
				}
			},
		},

		'ics': {
			name: 'Input Config Raster Size',
			options: [
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
					label: 'Raster Edge',
					id: 'edge',
					default: 'Top',
					choices: [
						{ id: 'Top',    label: 'Top' },
						{ id: 'Bottom', label: 'Bottom' },
						{ id: 'Left',   label: 'Left' },
						{ id: 'Right',  label: 'Right' },
					],
				},
				{
					type: 'number',
					label: 'Delta (pixels)',
					id: 'delta',
					default: 0,
					min: -9999,
					max: 9999,
				},
			],
			callback: async (action) => {
				const { layerId, edge, delta } = action.options
				await sendCmd(`ICS ${layerId} ${edge} ${delta}`)
			},
		},

		'ila': {
			name: 'Input Level Adjust (Brightness / Contrast / Hue / Saturation)',
			options: [
				{
					type: 'number',
					label: 'Brightness (0.0–2.0, default 1.0)',
					id: 'brightness',
					default: 1,
					min: 0,
					max: 2,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Contrast (0.0–2.5, default 1.0)',
					id: 'contrast',
					default: 1,
					min: 0,
					max: 2.5,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Hue (-180 to 180, default 0)',
					id: 'hue',
					default: 0,
					min: -180,
					max: 180,
					step: 1,
					range: true,
				},
				{
					type: 'number',
					label: 'Saturation (0.0–2.0, default 1.0)',
					id: 'saturation',
					default: 1,
					min: 0,
					max: 2,
					step: 0.01,
					range: true,
				},
				{
					type: 'number',
					label: 'Gamma (0.0–3.0, default 1.0)',
					id: 'gamma',
					default: 1,
					min: 0,
					max: 3,
					step: 0.01,
					range: true,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { brightness, contrast, hue, saturation, gamma, layers } = action.options
				await sendCmd(`ILA ${brightness} ${contrast} ${hue} ${saturation} ${gamma} ${layers}`)
			},
		},

		'ilk': {
			name: 'Input Luminance Key',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'enabled',
					default: '1',
					choices: [
						{ id: '1', label: 'Enable' },
						{ id: '0', label: 'Disable' },
					],
				},
				{
					type: 'number',
					label: 'Clip (0–512)',
					id: 'clip',
					default: 256,
					min: 0,
					max: 512,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'number',
					label: 'Gain (0–512)',
					id: 'gain',
					default: 256,
					min: 0,
					max: 512,
					isVisible: (options) => options.enabled === '1',
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { enabled, clip, gain, layers } = action.options
				if (enabled === '0') {
					await sendCmd(`ILK 0 0 0 ${layers}`)
				} else {
					await sendCmd(`ILK 1 ${clip} ${gain} ${layers}`)
				}
			},
		},

		'ira': {
			name: 'Input Config Raster Adjust',
			options: [
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
					label: 'Edge',
					id: 'edge',
					default: 'A',
					choices: [
						{ id: 'L', label: 'Left' },
						{ id: 'R', label: 'Right' },
						{ id: 'T', label: 'Top' },
						{ id: 'B', label: 'Bottom' },
						{ id: 'A', label: 'Auto Raster (analog only)' },
					],
				},
				{
					type: 'number',
					label: 'Delta (pixels; negative = inward)',
					id: 'delta',
					default: 0,
					min: -9999,
					max: 9999,
					isVisible: (options) => options.edge !== 'A',
				},
			],
			callback: async (action) => {
				const { layerId, edge, delta } = action.options
				await sendCmd(`IRA ${layerId} ${edge}${edge !== 'A' ? ' ' + delta : ''}`)
			},
		},

		'kbd': {
			name: 'Border Adjust',
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'id',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'number',
					label: 'Border Thickness (-255 to 255; negative = outside softness)',
					id: 'thickness',
					default: 10,
					min: -255,
					max: 255,
				},
				{
					type: 'colorpicker',
					label: 'Border Color',
					id: 'color',
					default: combineRgb(255, 255, 255),
				},
				{
					type: 'number',
					label: 'Horizontal Bevel Offset',
					id: 'hBevel',
					default: 0,
					min: -9999,
					max: 9999,
				},
				{
					type: 'number',
					label: 'Vertical Bevel Offset',
					id: 'vBevel',
					default: 0,
					min: -9999,
					max: 9999,
				},
				{
					type: 'number',
					label: 'Inside Softness',
					id: 'softness',
					default: 0,
					min: 0,
					max: 255,
				},
			],
			callback: async (action) => {
				const { id, thickness, color, hBevel, vBevel, softness } = action.options
				const { r, g, b } = colorToRGB(color)
				await sendCmd(`KBD ${id} ${thickness} ${r} ${g} ${b} ${hBevel} ${vBevel} ${softness}`)
			},
		},

		'kps': {
			name: 'Layer Position Change',
			options: [
				{
					type: 'dropdown',
					label: 'Position Type',
					id: 'posType',
					default: '0',
					choices: [
						{ id: '0', label: 'Absolute (pixels from top-left)' },
						{ id: '1', label: 'Relative (offset from current)' },
					],
				},
				{
					type: 'number',
					label: 'Horizontal Position (pixels)',
					id: 'h',
					default: 0,
					min: -99999,
					max: 99999,
				},
				{
					type: 'number',
					label: 'Vertical Position (pixels)',
					id: 'v',
					default: 0,
					min: -99999,
					max: 99999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { posType, h, v, layers } = action.options
				await sendCmd(`KPS ${posType} ${h} ${v} ${layers}`)
			},
		},

		'ksh': {
			name: 'Shadow Adjust',
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'id',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'number',
					label: 'Horizontal Offset (0–255)',
					id: 'h',
					default: 10,
					min: 0,
					max: 255,
				},
				{
					type: 'number',
					label: 'Vertical Offset (0–255)',
					id: 'v',
					default: 10,
					min: 0,
					max: 255,
				},
				{
					type: 'number',
					label: 'Size',
					id: 'size',
					default: 5,
					min: 0,
					max: 255,
				},
				{
					type: 'number',
					label: 'Transparency (0–255)',
					id: 'transparency',
					default: 128,
					min: 0,
					max: 255,
				},
				{
					type: 'number',
					label: 'Softness',
					id: 'softness',
					default: 5,
					min: 0,
					max: 255,
				},
			],
			callback: async (action) => {
				const { id, h, v, size, transparency, softness } = action.options
				await sendCmd(`KSH ${id} ${h} ${v} ${size} ${transparency} ${softness}`)
			},
		},

		'ksz': {
			name: 'Layer Size Change (Width)',
			options: [
				{
					type: 'number',
					label: 'Width (pixels; height auto-scales to maintain AR)',
					id: 'horz',
					default: 1920,
					min: 1,
					max: 99999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { horz, layers } = action.options
				await sendCmd(`KSZ ${horz} ${layers}`)
			},
		},

		'ktl': {
			name: 'Treatment Learn',
			options: [
				{
					type: 'number',
					label: 'Treatment ID (-1 = next available)',
					id: 'treatId',
					default: -1,
					min: -1,
					max: 9999,
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
					type: 'textinput',
					label: 'Treatment Name (avoid pure numbers)',
					id: 'name',
					default: 'MyTreatment',
				},
				{ type: 'checkbox', label: 'Learn Position',     id: 'learnPos',     default: true  },
				{ type: 'checkbox', label: 'Learn Crop',         id: 'learnCrop',    default: true  },
				{ type: 'checkbox', label: 'Learn Clone',        id: 'learnClone',   default: false },
				{ type: 'checkbox', label: 'Learn Border',       id: 'learnBorder',  default: true  },
				{ type: 'checkbox', label: 'Learn Shadow',       id: 'learnShadow',  default: false },
				{ type: 'checkbox', label: 'Learn Aspect Ratio', id: 'learnAR',      default: false },
				{ type: 'checkbox', label: 'Learn Pan/Zoom',     id: 'learnPanZoom', default: false },
				{ type: 'checkbox', label: 'Learn Duration',     id: 'learnDur',     default: true  },
				{ type: 'checkbox', label: 'Learn Transparency', id: 'learnTrans',   default: false },
				{ type: 'checkbox', label: 'Learn Size',         id: 'learnSize',    default: true  },
			],
			callback: async (action) => {
				const o = action.options
				const flags = [o.learnPos, o.learnCrop, o.learnClone, o.learnBorder, o.learnShadow,
					o.learnAR, o.learnPanZoom, o.learnDur, o.learnTrans, o.learnSize]
					.map((v) => (v ? '1' : '0')).join(' ')
				await sendCmd(`KTL ${o.treatId} ${o.layerId} ${o.name} ${flags}`)
			},
		},

		'ktp': {
			name: 'Layer Transparency',
			options: [
				{
					type: 'number',
					label: 'Transparency (0 = opaque, 255 = fully transparent)',
					id: 'transparency',
					default: 0,
					min: 0,
					max: 255,
					range: true,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { transparency, layers } = action.options
				await sendCmd(`KTP ${transparency} ${layers}`)
			},
		},

		'ktr': {
			name: 'Treatment Recall',
			options: [
				{
					type: 'dropdown',
					label: 'Treatment',
					id: 'id',
					default: '',
					allowCustom: true,
					choices: getTreatmentChoices(self),
					tooltip: 'Pick a treatment by name; the module sends its ID. Type an ID manually if not yet loaded.',
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'lay',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { id, lay } = action.options
				await sendCmd(`KTR ${id} ${lay}`)
			},
		},

		'lac': {
			name: 'Layer Alignment Control',
			options: [
				{
					type: 'dropdown',
					label: 'Effect',
					id: 'effect',
					default: '0',
					choices: [
						{ id: '0',  label: 'Align Bottom' },
						{ id: '1',  label: 'Align Center (horizontal)' },
						{ id: '2',  label: 'Align Left' },
						{ id: '3',  label: 'Align Middle (vertical)' },
						{ id: '4',  label: 'Align Right' },
						{ id: '5',  label: 'Align Top' },
						{ id: '6',  label: 'Center Horizontal (in pixelspace)' },
						{ id: '7',  label: 'Center Vertical (in pixelspace)' },
						{ id: '8',  label: 'Horizontal Spacing Decrease' },
						{ id: '9',  label: 'Horizontal Spacing Increase' },
						{ id: '10', label: 'Make Horizontal Equal' },
						{ id: '11', label: 'Make Same Height' },
						{ id: '12', label: 'Make Same Width' },
						{ id: '13', label: 'Make Vertically Equal' },
						{ id: '14', label: 'Remove Horizontal Spacing' },
						{ id: '15', label: 'Remove Vertical Spacing' },
						{ id: '16', label: 'Size to Display Height' },
						{ id: '17', label: 'Size to Display Width' },
						{ id: '18', label: 'Snap to Bottom' },
						{ id: '19', label: 'Snap to Left' },
						{ id: '20', label: 'Snap to Right' },
						{ id: '21', label: 'Snap to Top' },
						{ id: '22', label: 'Stack Horizontal' },
						{ id: '23', label: 'Stack Vertical' },
						{ id: '24', label: 'Swap Windows' },
					],
				},
				{
					type: 'number',
					label: 'Recall Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
				{
					type: 'textinput',
					label: 'Layer IDs (space-delimited, 2 or more required)',
					id: 'layers',
					default: '2 3',
				},
			],
			callback: async (action) => {
				const { effect, dur, layers } = action.options
				await sendCmd(`LAC ${effect} ${dur} ${layers}`)
			},
		},

		'lap': {
			name: 'Layer Assign PixelSpace',
			options: [
				{
					type: 'dropdown',
					label: 'PixelSpace',
					id: 'psId',
					default: '0',
					allowCustom: true,
					choices: getPixelspaceChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Visibility',
					id: 'visibility',
					default: '0',
					choices: [
						{ id: '0', label: 'Hide (configure before transitioning)' },
						{ id: '1', label: 'Show immediately' },
					],
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { psId, visibility, layers } = action.options
				await sendCmd(`LAP ${psId} ${visibility} ${layers}`)
			},
		},

		'lcc': {
			name: 'Layer Clone Control',
			options: [
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
					label: 'Clone Mode',
					id: 'mode',
					default: '0',
					choices: [
						{ id: '0', label: 'Off' },
						{ id: '1', label: 'Offset' },
						{ id: '2', label: 'Mirror' },
					],
				},
				{
					type: 'number',
					label: 'Offset',
					id: 'offset',
					default: 0,
					min: -99999,
					max: 99999,
					isVisible: (options) => options.mode !== '0',
				},
				{
					type: 'dropdown',
					label: 'Offset Type',
					id: 'offsetType',
					default: '1',
					choices: [
						{ id: '0', label: 'Absolute (pixels)' },
						{ id: '1', label: 'Relative coordinate (default)' },
					],
					isVisible: (options) => options.mode !== '0',
				},
			],
			callback: async (action) => {
				const { layerId, mode, offset, offsetType } = action.options
				if (mode === '0') {
					await sendCmd(`LCC ${layerId} 0`)
				} else {
					await sendCmd(`LCC ${layerId} ${mode} ${offset} ${offsetType}`)
				}
			},
		},

		'lck': {
			name: 'Learn Command Key',
			options: [
				{
					type: 'dropdown',
					label: 'Learn As',
					id: 'learnAs',
					default: '0',
					choices: [
						{ id: '0', label: 'Absolute' },
						{ id: '1', label: 'Relative' },
					],
				},
				{
					type: 'textinput',
					label: 'Name',
					id: 'name',
					default: 'CommandKey1',
				},
				{
					type: 'number',
					label: 'Register ID',
					id: 'regId',
					default: 1,
					min: 0,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'Learn From',
					id: 'learnFrom',
					default: '3',
					choices: [
						{ id: '1', label: 'Preview Only' },
						{ id: '2', label: 'Program Only' },
						{ id: '3', label: 'Both' },
					],
				},
				{
					type: 'dropdown',
					label: 'Include Mixers',
					id: 'learnMixers',
					default: '0',
					choices: [
						{ id: '0', label: 'No' },
						{ id: '1', label: 'Yes' },
					],
				},
			],
			callback: async (action) => {
				const { learnAs, name, regId, learnFrom, learnMixers } = action.options
				await sendCmd(`LCK ${learnAs} ${name} ${regId} ${learnFrom} ${learnMixers}`)
			},
		},

		'lso': {
			name: 'Load Still on Output',
			options: [
				{
					type: 'textinput',
					label: 'Filename (must exist on Spyder server Stills folder)',
					id: 'filename',
					default: 'image.png',
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
			],
			callback: async (action) => {
				const { filename, outputId } = action.options
				await sendCmd(`LSO ${filename} ${outputId}`)
			},
		},

		'lsp': {
			name: 'Layer Size and Position Change',
			options: [
				{
					type: 'dropdown',
					label: 'Position Type',
					id: 'posType',
					default: '0',
					choices: [
						{ id: '0', label: 'Absolute (pixels)' },
						{ id: '1', label: 'Relative (offset from current)' },
					],
				},
				{
					type: 'number',
					label: 'Horizontal Position (pixels)',
					id: 'h',
					default: 0,
					min: -99999,
					max: 99999,
				},
				{
					type: 'number',
					label: 'Vertical Position (pixels)',
					id: 'v',
					default: 0,
					min: -99999,
					max: 99999,
				},
				{
					type: 'number',
					label: 'Width (pixels)',
					id: 'size',
					default: 1920,
					min: 1,
					max: 99999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { posType, h, v, size, layers } = action.options
				await sendCmd(`LSP ${posType} ${h} ${v} ${size} ${layers}`)
			},
		},

		'mvac': {
			name: 'Multi-Viewer Assign Content',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
				{
					type: 'number',
					label: 'View ID',
					id: 'viewId',
					default: 0,
					min: 0,
					max: 999,
				},
				{
					type: 'number',
					label: 'Input ID (0-based)',
					id: 'inputId',
					default: 0,
					min: 0,
					max: 99,
				},
			],
			callback: async (action) => {
				const { outputId, viewId, inputId } = action.options
				await sendCmd(`MVAC ${outputId} ${viewId} ${inputId}`)
			},
		},

		'mvas': {
			name: 'Multi-Viewer Add Single View',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
				{
					type: 'dropdown',
					label: 'View Type',
					id: 'viewType',
					default: '0',
					choices: [
						{ id: '0', label: 'PGM' },
						{ id: '1', label: 'PVW' },
						{ id: '2', label: 'Input' },
						{ id: '3', label: 'Output' },
					],
				},
				{
					type: 'number',
					label: 'Content ID (-1 for custom PGM/PVW section)',
					id: 'contentId',
					default: 0,
					min: -1,
					max: 999,
				},
				{ type: 'number', label: 'Left Position', id: 'left',   default: 0,   min: 0, max: 99999 },
				{ type: 'number', label: 'Top Position',  id: 'top',    default: 0,   min: 0, max: 99999 },
				{ type: 'number', label: 'Width',         id: 'width',  default: 960, min: 1, max: 99999 },
				{ type: 'number', label: 'Height',        id: 'height', default: 540, min: 1, max: 99999 },
				{
					type: 'number',
					label: 'Border Thickness (0 = none)',
					id: 'borderThickness',
					default: 0,
					min: 0,
					max: 100,
				},
				{
					type: 'colorpicker',
					label: 'Border Color',
					id: 'borderColor',
					default: combineRgb(255, 255, 255),
					isVisible: (options) => options.borderThickness > 0,
				},
			],
			callback: async (action) => {
				const { outputId, viewType, contentId, left, top, width, height, borderThickness, borderColor } = action.options
				if (borderThickness > 0) {
					const { r, g, b } = colorToRGB(borderColor)
					await sendCmd(`MVAS ${outputId} ${viewType} ${contentId} ${left} ${top} ${width} ${height} ${borderThickness} ${r} ${g} ${b}`)
				} else {
					await sendCmd(`MVAS ${outputId} ${viewType} ${contentId} ${left} ${top} ${width} ${height}`)
				}
			},
		},

		'mvca': {
			name: 'Multi-Viewer Clear All',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
			],
			callback: async (action) => {
				await sendCmd(`MVCA ${action.options.outputId}`)
			},
		},

		'mvkf': {
			name: 'Multi-Viewer Set Keyframe Properties',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
				{ type: 'number', label: 'View ID', id: 'viewId', default: 0,   min: 0, max: 999   },
				{ type: 'number', label: 'Left',    id: 'left',   default: 0,   min: 0, max: 99999 },
				{ type: 'number', label: 'Top',     id: 'top',    default: 0,   min: 0, max: 99999 },
				{ type: 'number', label: 'Width',   id: 'width',  default: 960, min: 1, max: 99999 },
				{ type: 'number', label: 'Height',  id: 'height', default: 540, min: 1, max: 99999 },
				{
					type: 'number',
					label: 'Border Thickness (0–100)',
					id: 'borderThickness',
					default: 2,
					min: 0,
					max: 100,
				},
				{
					type: 'colorpicker',
					label: 'Border Color',
					id: 'borderColor',
					default: combineRgb(255, 255, 255),
				},
			],
			callback: async (action) => {
				const { outputId, viewId, left, top, width, height, borderThickness, borderColor } = action.options
				const { r, g, b } = colorToRGB(borderColor)
				await sendCmd(`MVKF ${outputId} ${viewId} ${left} ${top} ${width} ${height} ${borderThickness} ${r} ${g} ${b}`)
			},
		},

		'mvpl': {
			name: 'Multi-Viewer Preset Learn',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
				{
					type: 'textinput',
					label: 'Preset Name',
					id: 'presetName',
					default: 'MyPreset',
					tooltip: 'Name for the new custom MV preset. Will appear in the Recall dropdown after learning.',
				},
			],
			callback: async (action) => {
				const { outputId, presetName } = action.options
				const name = String(presetName).trim()
				await sendCmd(`MVPL ${outputId} ${name}`)
				// Store learned preset name so it appears in recall dropdown
				if (name && !self.mvPresets.includes(name)) {
					self.mvPresets = [...self.mvPresets, name]
					self.scheduleRebuild()
				}
			},
		},

		'mvpr': {
			name: 'Multi-Viewer Preset Recall',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '3',
					choices: MV_OUTPUTS,
				},
				{
					type: 'dropdown',
					label: 'Preset Type',
					id: 'presetType',
					default: '0',
					choices: [
						{ id: '0', label: 'OpMon' },
						{ id: '1', label: 'SourceMon' },
						{ id: '2', label: 'Custom' },
					],
				},
				{
					type: 'dropdown',
					label: 'Custom Preset Name',
					id: 'presetName',
					default: '',
					allowCustom: true,
					choices: getMvPresetChoices(self),
					isVisible: (options) => options.presetType === '2',
					tooltip: 'Select a previously learned preset or type a name directly.',
				},
			],
			callback: async (action) => {
				const { outputId, presetType, presetName } = action.options
				if (presetType === '2') {
					await sendCmd(`MVPR ${outputId} 2 ${presetName}`)
				} else {
					await sendCmd(`MVPR ${outputId} ${presetType}`)
				}
			},
		},

		'ocb': {
			name: 'Output Configuration Blending',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'dropdown',
					label: 'Edge',
					id: 'edge',
					default: 'L',
					choices: [
						{ id: 'L', label: 'Left' },
						{ id: 'R', label: 'Right' },
					],
				},
				{
					type: 'dropdown',
					label: 'Enable Blending',
					id: 'enable',
					default: '1',
					choices: [
						{ id: '1', label: 'Enable' },
						{ id: '0', label: 'Disable' },
					],
				},
				{
					type: 'number',
					label: 'Blend Width (pixels)',
					id: 'blendWidth',
					default: 256,
					min: 0,
					max: 9999,
					isVisible: (options) => options.enable === '1',
				},
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: 'Bezier',
					choices: [
						{ id: 'Bezier',   label: 'Bezier' },
						{ id: 'Gamma',    label: 'Gamma' },
						{ id: 'Velocity', label: 'Velocity' },
					],
					isVisible: (options) => options.enable === '1',
				},
				{
					type: 'number',
					label: 'Curve 1 (0.000–1.000)',
					id: 'curve1',
					default: 0.5,
					min: 0,
					max: 1,
					step: 0.001,
					isVisible: (options) => options.enable === '1',
				},
				{
					type: 'number',
					label: 'Curve 2 (0.000–1.000)',
					id: 'curve2',
					default: 0.5,
					min: 0,
					max: 1,
					step: 0.001,
					isVisible: (options) => options.enable === '1',
				},
			],
			callback: async (action) => {
				const { outputId, edge, enable, blendWidth, mode, curve1, curve2 } = action.options
				await sendCmd(`OCB ${outputId} ${edge} ${enable} ${blendWidth} ${mode} ${curve1} ${curve2}`)
			},
		},

		'occ': {
			name: 'Output Config Connection (Connector Type)',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'dropdown',
					label: 'Connector Type',
					id: 'connType',
					default: '4',
					choices: [
						{ id: '0', label: 'Analog' },
						{ id: '1', label: 'DVI' },
						{ id: '2', label: 'SDI' },
						{ id: '3', label: 'Composite / S-Video' },
						{ id: '4', label: 'HDMI' },
						{ id: '5', label: 'Display Port' },
					],
				},
				{
					type: 'dropdown',
					label: 'Enabled',
					id: 'enabled',
					default: '1',
					choices: [
						{ id: '1', label: 'Enable' },
						{ id: '0', label: 'Disable' },
					],
				},
			],
			callback: async (action) => {
				const { outputId, connType, enabled } = action.options
				await sendCmd(`OCC ${outputId} ${connType} ${enabled}`)
			},
		},

		'ocf': {
			name: 'Output Configuration Format',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'number',
					label: 'Horizontal Active (pixels)',
					id: 'hActive',
					default: 1920,
					min: 1,
					max: 99999,
				},
				{
					type: 'number',
					label: 'Vertical Active (pixels)',
					id: 'vActive',
					default: 1080,
					min: 1,
					max: 99999,
				},
				{
					type: 'textinput',
					label: 'Refresh Rate (e.g. 60 or 59.94)',
					id: 'refresh',
					default: '60',
				},
				{
					type: 'dropdown',
					label: 'Scan',
					id: 'interlaced',
					default: '0',
					choices: [
						{ id: '0', label: 'Progressive' },
						{ id: '1', label: 'Interlaced' },
					],
				},
				{
					type: 'dropdown',
					label: 'Reduced Blanking',
					id: 'timing',
					default: '0',
					choices: [
						{ id: '0', label: 'Off' },
						{ id: '1', label: 'Reduced Level 1' },
						{ id: '2', label: 'Reduced Level 2' },
					],
				},
			],
			callback: async (action) => {
				const { outputId, hActive, vActive, refresh, interlaced, timing } = action.options
				await sendCmd(`OCF ${outputId} ${hActive} ${vActive} ${refresh} ${interlaced} ${timing}`)
			},
		},

		'ocm': {
			name: 'Configure Output Mode',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'dropdown',
					label: 'Mode',
					id: 'mode',
					default: 'Normal',
					choices: [
						{ id: 'Normal',    label: 'Normal' },
						{ id: 'Aux',       label: 'Aux' },
						{ id: 'Scaled',    label: 'Scaled' },
						{ id: 'Multiview', label: 'Multiview' },
						{ id: 'OpMon',     label: 'OpMon (Multiview w/ OpMon Preset)' },
						{ id: 'SourceMon', label: 'SourceMon (Multiview w/ SourceMon Preset)' },
					],
				},
				{
					type: 'number',
					label: 'Horizontal Start (Normal mode)',
					id: 'hStart',
					default: 0,
					min: 0,
					max: 99999,
					isVisible: (options) => options.mode === 'Normal',
				},
				{
					type: 'number',
					label: 'Vertical Start (Normal mode)',
					id: 'vStart',
					default: 0,
					min: 0,
					max: 99999,
					isVisible: (options) => options.mode === 'Normal',
				},
				{
					type: 'textinput',
					label: 'Preset Name (Multiview mode)',
					id: 'presetName',
					default: '',
					isVisible: (options) => options.mode === 'Multiview',
				},
				{
					type: 'dropdown',
					label: 'PixelSpace (Scaled / OpMon mode)',
					id: 'psId',
					default: '0',
					allowCustom: true,
					choices: getPixelspaceChoices(self),
					isVisible: (options) => options.mode === 'Scaled' || options.mode === 'OpMon',
				},
				{
					type: 'dropdown',
					label: 'Source Name (Aux mode)',
					id: 'sourceName',
					default: '',
					allowCustom: true,
					choices: getSourceChoices(self),
					isVisible: (options) => options.mode === 'Aux',
				},
				{
					type: 'colorpicker',
					label: 'Background Color (Aux mode)',
					id: 'bgColor',
					default: combineRgb(0, 0, 0),
					isVisible: (options) => options.mode === 'Aux',
				},
			],
			callback: async (action) => {
				const { outputId, mode, hStart, vStart, presetName, psId, sourceName, bgColor } = action.options
				switch (mode) {
					case 'Normal':
						await sendCmd(`OCM ${outputId} Normal ${hStart} ${vStart}`)
						break
					case 'Aux': {
						const { r, g, b } = colorToRGB(bgColor)
						const name = String(sourceName).replace(/ /g, '%20')
						await sendCmd(`OCM ${outputId} Aux ${name} ${r} ${g} ${b}`)
						break
					}
					case 'Scaled':
						await sendCmd(`OCM ${outputId} Scaled ${psId}`)
						break
					case 'Multiview':
						await sendCmd(`OCM ${outputId} Multiview${presetName ? ' ' + presetName : ''}`)
						break
					case 'OpMon':
						await sendCmd(`OCM ${outputId} OpMon ${psId}`)
						break
					case 'SourceMon':
						await sendCmd(`OCM ${outputId} SourceMon`)
						break
				}
			},
		},

		'ocr': {
			name: 'Output Configuration Rotation',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'dropdown',
					label: 'Rotation Angle',
					id: 'angle',
					default: '0',
					choices: [
						{ id: '0',   label: '0°' },
						{ id: '90',  label: '90°' },
						{ id: '180', label: '180°' },
						{ id: '270', label: '270°' },
					],
				},
			],
			callback: async (action) => {
				const { outputId, angle } = action.options
				await sendCmd(`OCR ${outputId} ${angle}`)
			},
		},

		'ocs': {
			name: 'Output Configuration Save',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
			],
			callback: async (action) => {
				await sendCmd(`OCS ${action.options.outputId}`)
			},
		},

		'ocp': {
			name: 'Output Set Position (Normal mode)',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'number',
					label: 'Horizontal Start (pixels)',
					id: 'hStart',
					default: 0,
					min: 0,
					max: 99999,
					tooltip: 'Sets the output horizontal offset within the pixelspace. Sends OCM <output> Normal <hStart> <vStart>.',
				},
				{
					type: 'number',
					label: 'Vertical Start (pixels)',
					id: 'vStart',
					default: 0,
					min: 0,
					max: 99999,
				},
			],
			callback: async (action) => {
				const { outputId, hStart, vStart } = action.options
				await sendCmd(`OCM ${outputId} Normal ${hStart} ${vStart}`)
			},
		},

		'ocn': {
			name: 'Output Set Name',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
				{
					type: 'textinput',
					label: 'Name',
					id: 'name',
					default: 'Output 1',
					tooltip: 'Sets the output name via OSP OutputName property.',
				},
			],
			callback: async (action) => {
				const { outputId, name } = action.options
				await sendCmd(`OSP ${outputId} OutputName ${encodeURIComponent(name)}`)
			},
		},

		'ocu': {
			name: 'Output Config Undo / Cancel',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'outputId',
					default: '0',
					choices: getOutputChoices(),
				},
			],
			callback: async (action) => {
				await sendCmd(`OCU ${action.options.outputId}`)
			},
		},

		'ofz': {
			name: 'Output Freeze',
			options: [
				{
					type: 'dropdown',
					label: 'Freeze',
					id: 'frzonoff',
					default: '1',
					choices: [
						{ id: '1', label: 'Freeze On' },
						{ id: '0', label: 'Freeze Off' },
					],
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: '0',
					choices: getOutputChoices(),
				},
			],
			callback: async (action) => {
				const { frzonoff, output } = action.options
				await sendCmd(`OFZ ${frzonoff} ${output}`)
			},
		},

		'rcr': {
			name: 'Router Crosspoint Recall',
			options: [
				{
					type: 'number',
					label: 'Router ID',
					id: 'routerId',
					default: 0,
					min: 0,
					max: 99,
				},
				{
					type: 'dropdown',
					label: 'Switch Type',
					id: 'switchType',
					default: 'L',
					choices: [
						{ id: 'L', label: 'Logical Output (default)' },
						{ id: 'P', label: 'Physical Output' },
					],
				},
				{
					type: 'number',
					label: 'Output (0-based)',
					id: 'output',
					default: 0,
					min: 0,
					max: 999,
				},
				{
					type: 'number',
					label: 'Input (0-based)',
					id: 'input',
					default: 0,
					min: 0,
					max: 999,
				},
			],
			callback: async (action) => {
				const { routerId, switchType, output, input } = action.options
				await sendCmd(`RCR ${routerId} ${switchType} ${output} ${input}`)
			},
		},

		'rsc': {
			name: 'Recall Script Cue',
			options: [
				{
					type: 'number',
					label: 'Script / Register ID',
					id: 'sidx',
					default: 0,
					min: 0,
					max: 9999,
				},
				{
					type: 'number',
					label: 'Script Cue',
					id: 'cidx',
					default: 1,
					min: 1,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'ID Type',
					id: 'type',
					default: 'S',
					choices: [
						{ id: 'S', label: 'ScriptID' },
						{ id: 'R', label: 'RegisterID' },
					],
				},
			],
			callback: async (action) => {
				const { sidx, cidx, type } = action.options
				await sendCmd(`RSC ${sidx} ${cidx} ${type}`)
			},
		},

		'sav': {
			name: 'Force Server Save',
			options: [],
			callback: async () => {
				await sendCmd('SAV')
			},
		},

		'scl': {
			name: 'Clear Still on Layer(s)',
			options: [
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				await sendCmd(`SCL ${action.options.layers}`)
			},
		},

		'sdn': {
			name: 'Restart / Power Off Spyder Server',
			options: [
				{
					type: 'dropdown',
					label: 'Action',
					id: 'state',
					default: '1',
					choices: [
						{ id: '0', label: 'Power Off' },
						{ id: '1', label: 'Restart' },
					],
				},
			],
			callback: async (action) => {
				await sendCmd(`SDN ${action.options.state}`)
			},
		},

		'sld': {
			name: 'Load Still on Layer(s)',
			options: [
				{
					type: 'textinput',
					label: 'Filename (must exist on Spyder server)',
					id: 'filename',
					default: 'image.png',
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { filename, layers } = action.options
				await sendCmd(`SLD ${filename} ${layers}`)
			},
		},

		'sra': {
			name: 'Source Apply to Layer(s)',
			options: [
				{
					type: 'dropdown',
					label: 'Source Name',
					id: 'name',
					default: '',
					allowCustom: true,
					choices: getSourceChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layers',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { name, layers } = action.options
				const escapedName = String(name).replace(/ /g, '%20')
				await sendCmd(`SRA ${escapedName} ${layers}`)
			},
		},

		'srs': {
			name: 'Stop Running Scripts',
			options: [
				{
					type: 'dropdown',
					label: 'Operation',
					id: 'op',
					default: 'S',
					choices: [
						{ id: 'S', label: 'Cancel pending cue triggers' },
						{ id: 'D', label: 'Disconnect layers from scripts' },
					],
				},
			],
			callback: async (action) => {
				await sendCmd(`SRS ${action.options.op}`)
			},
		},

		'swa': {
			name: 'Swap Layers',
			options: [
				{
					type: 'dropdown',
					label: 'First Layer',
					id: 'lay1',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
				{
					type: 'dropdown',
					label: 'Second Layer',
					id: 'lay2',
					default: '3',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { lay1, lay2 } = action.options
				await sendCmd(`SWA ${lay1} ${lay2}`)
			},
		},

		// ── Test Patterns ─────────────────────────────────────────────────────────
		// Target type drives which ID picker is visible: 0=PS, 1=Layer, 2=Output

		'tpc': {
			name: 'Test Pattern Clear',
			options: [
				{
					type: 'dropdown',
					label: 'Target',
					id: 'target',
					default: '1',
					choices: [
						{ id: '0', label: 'PixelSpace' },
						{ id: '1', label: 'Layer' },
						{ id: '2', label: 'Output' },
					],
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'idLayer',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
					isVisible: (options) => options.target === '1',
				},
				{
					type: 'dropdown',
					label: 'PixelSpace',
					id: 'idPs',
					default: '0',
					allowCustom: true,
					choices: getPixelspaceChoices(self),
					isVisible: (options) => options.target === '0',
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'idOutput',
					default: '0',
					choices: getOutputChoices(),
					isVisible: (options) => options.target === '2',
				},
			],
			callback: async (action) => {
				const { target, idLayer, idPs, idOutput } = action.options
				const id = target === '0' ? idPs : target === '1' ? idLayer : idOutput
				await sendCmd(`TPC ${target} ${id}`)
			},
		},

		'tpl': {
			name: 'Test Pattern Load',
			options: [
				{
					type: 'dropdown',
					label: 'Target',
					id: 'target',
					default: '1',
					choices: [
						{ id: '0', label: 'PixelSpace' },
						{ id: '1', label: 'Layer' },
						{ id: '2', label: 'Output' },
					],
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'idLayer',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
					isVisible: (options) => options.target === '1',
				},
				{
					type: 'dropdown',
					label: 'PixelSpace',
					id: 'idPs',
					default: '0',
					allowCustom: true,
					choices: getPixelspaceChoices(self),
					isVisible: (options) => options.target === '0',
				},
				{
					type: 'dropdown',
					label: 'Output',
					id: 'idOutput',
					default: '0',
					choices: getOutputChoices(),
					isVisible: (options) => options.target === '2',
				},
				{
					type: 'dropdown',
					label: 'Pattern Type',
					id: 'patternType',
					default: '0',
					choices: [
						{ id: '0',  label: 'Color Bars Gray' },
						{ id: '1',  label: 'Color Bars Horizontal' },
						{ id: '2',  label: 'Color Bars Pluge' },
						{ id: '3',  label: 'Single Color' },
						{ id: '4',  label: 'Color Ramp 8-bit' },
						{ id: '5',  label: 'RGB Color Gradient 8-bit' },
						{ id: '6',  label: 'Grid 32' },
						{ id: '7',  label: 'Grid 64' },
						{ id: '8',  label: 'Grid 128' },
						{ id: '9',  label: 'Gray Gamma' },
						{ id: '10', label: 'Gray Top → Bottom 16 steps' },
						{ id: '11', label: 'Gray Bottom → Top 16 steps' },
						{ id: '12', label: 'Gray Top → Bottom 32 steps' },
						{ id: '13', label: 'Gray Bottom → Top 32 steps' },
						{ id: '14', label: 'Gray Split 16 steps' },
						{ id: '15', label: 'Gray Split 32 steps' },
						{ id: '16', label: 'Grill Horizontal' },
						{ id: '17', label: 'Grill Vertical' },
						{ id: '18', label: 'Sweep Left → Right' },
						{ id: '19', label: 'Sweep Right → Left' },
						{ id: '20', label: 'Sweep Top → Bottom' },
						{ id: '21', label: 'Sweep Bottom → Top' },
					],
				},
				{ type: 'checkbox', label: 'Outline',       id: 'outline',      default: false },
				{ type: 'checkbox', label: 'Center Circle', id: 'centerCircle', default: false },
				{ type: 'checkbox', label: 'Center X',      id: 'centerX',      default: false },
				{ type: 'checkbox', label: 'Grid Overlay',  id: 'grid',         default: false },
				{
					type: 'colorpicker',
					label: 'Background Color',
					id: 'bgColor',
					default: combineRgb(0, 0, 0),
				},
				{
					type: 'colorpicker',
					label: 'Foreground Color',
					id: 'fgColor',
					default: combineRgb(255, 255, 255),
				},
			],
			callback: async (action) => {
				const { target, idLayer, idPs, idOutput, patternType, outline, centerCircle, centerX, grid, bgColor, fgColor } = action.options
				const id = target === '0' ? idPs : target === '1' ? idLayer : idOutput
				const bg = colorToRGB(bgColor)
				const fg = colorToRGB(fgColor)
				const flags = [outline, centerCircle, centerX, grid].map((v) => (v ? 1 : 0)).join(' ')
				await sendCmd(`TPL ${target} ${id} ${patternType} ${flags} ${bg.r} ${bg.g} ${bg.b} ${fg.r} ${fg.g} ${fg.b}`)
			},
		},

		'trn': {
			name: 'Transition Layer(s)',
			options: [
				{
					type: 'dropdown',
					label: 'Transition Mix',
					id: 'mix',
					default: '1',
					choices: [
						{ id: '1', label: 'Mix On' },
						{ id: '0', label: 'Mix Off' },
					],
				},
				{
					type: 'number',
					label: 'Duration (frames)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'lay',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { mix, dur, lay } = action.options
				await sendCmd(`TRN ${mix} ${dur} ${lay}`)
			},
		},

		'zpa': {
			name: 'Zoom / Pan Adjust',
			options: [
				{
					type: 'dropdown',
					label: 'Recall Mode',
					id: 'recallMode',
					default: '0',
					choices: [
						{ id: '0', label: 'Absolute' },
						{ id: '1', label: 'Relative (adjust from current)' },
					],
				},
				{
					type: 'number',
					label: 'Zoom (0.0–20.0)',
					id: 'zoom',
					default: 1,
					min: 0,
					max: 20,
					step: 0.1,
					range: true,
				},
				{
					type: 'number',
					label: 'Horizontal Pan (-2048 to 2048)',
					id: 'hPan',
					default: 0,
					min: -2048,
					max: 2048,
				},
				{
					type: 'number',
					label: 'Vertical Pan (-2048 to 2048)',
					id: 'vPan',
					default: 0,
					min: -2048,
					max: 2048,
				},
				{
					type: 'dropdown',
					label: 'Layer',
					id: 'layerId',
					default: '2',
					allowCustom: true,
					choices: getLayerChoices(self),
				},
			],
			callback: async (action) => {
				const { recallMode, zoom, hPan, vPan, layerId } = action.options
				await sendCmd(`ZPA ${recallMode} ${zoom} ${hPan} ${vPan} ${layerId}`)
			},
		},

		'take': {
			name: 'Transition Layers (Preview ↔ Program)',
			options: [
				{
					type: 'dropdown',
					label: 'PixelSpace Pair',
					id: 'pairIdx',
					default: '0',
					allowCustom: true,
					choices: self.psPairs?.length
						? self.psPairs.map((p, i) => {
								const pgm = self.pixelspaces?.find((ps) => ps.id === p.pgmId)
								return { id: String(i), label: pgm?.name || `PixelSpace ${p.pgmId}` }
						  })
						: [{ id: '0', label: 'Connecting…' }],
				},
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'direction',
					default: 'pvw_to_pgm',
					choices: [
						{ id: 'pvw_to_pgm', label: 'Preview → Program (bring on)' },
						{ id: 'pgm_to_pvw', label: 'Program → Preview (send back)' },
						{ id: 'switch', label: 'Switch (swap Preview ⇄ Program)' },
					],
				},
				{
					type: 'textinput',
					label: 'Exclude Layers (1-based layer numbers; space/comma separated)',
					id: 'exclude',
					default: '',
					tooltip: 'Optional. Layer numbers as shown in the UI (Layer 1, 2, …) that should NOT be transitioned. Leave empty to transition everything currently on the source side.',
				},
				{
					type: 'number',
					label: 'Transition Duration (frames; 1 = cut)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
			],
			callback: async (action) => {
				const { pairIdx, direction, dur, exclude } = action.options
				const pair = self.psPairs?.[parseInt(pairIdx)]
				if (!pair) {
					self.log('warn', 'Transition Layers: no PixelSpace pair configured')
					return
				}
				const { pgmId, pvwId } = pair
				const durFrames = parseInt(dur) || 60
				const isCut = durFrames <= 1
				const frameRateHz = self.frameRateHz || 60
				const durationMs = Math.ceil((durFrames / frameRateHz) * 1000)

				// Exclude list is 1-based UI layer numbers; internal layer id = number + 1.
				const excludeIds = new Set(
					String(exclude || '')
						.split(/[\s,]+/)
						.filter(Boolean)
						.map((n) => String(parseInt(n) + 1))
				)

				// Collect, from live state, the meaningful (visible or sourced) layers on a
				// pixelspace, minus excluded ones.
				const collectOn = (psId) =>
					Object.entries(self.layerPS)
						.filter(([id, ps]) =>
							ps === psId &&
							!excludeIds.has(id) &&
							(self.layerVis[id] || (self.layerSource?.[id] ?? '') !== '')
						)
						.map(([id]) => id)

				// Lock RLK polling for the transition plus a buffer so optimistic state holds.
				self._transitionUntil = Date.now() + durationMs + 1000

				// All dissolves happen on the visible program output (pgmId).
				if (direction === 'pvw_to_pgm') {
					const L = collectOn(pvwId)
					if (!L.length) { self.log('warn', 'Transition Layers: no layers on preview to bring on'); return }
					const s2 = L.join(' ')
					if (isCut) {
						await self.cueCmd(`LAP ${pgmId} 1 ${s2}`)
					} else {
						await self.cueCmd(`LAP ${pgmId} 0 ${s2}`)
						await self.cueCmd(`TRN 1 ${durFrames} ${s2}`)
					}
					for (const id of L) { self.layerPS[id] = pgmId; self.layerVis[id] = true }
				} else if (direction === 'pgm_to_pvw') {
					const L = collectOn(pgmId)
					if (!L.length) { self.log('warn', 'Transition Layers: no layers on program to send back'); return }
					const s2 = L.join(' ')
					// Move the layers to preview while they are still OPAQUE — LAP will not
					// relocate a faded-out layer, so a TRN-then-move approach snaps them back
					// to program. This is effectively a cut off program into preview.
					await self.cueCmd(`LAP ${pvwId} 1 ${s2}`)
					for (const id of L) { self.layerPS[id] = pvwId; self.layerVis[id] = true }
				} else {
					// Switch — swap the two sides: preview layers come to program, program
					// layers go to preview. Excluded layers (e.g. backgrounds) stay put on
					// both sides, so only the "changes" swap.
					const toPgm = collectOn(pvwId) // preview → program
					const toPvw = collectOn(pgmId) // program → preview
					if (!toPgm.length && !toPvw.length) { self.log('warn', 'Transition Layers: nothing to switch'); return }
					const sPgm = toPgm.join(' ')
					const sPvw = toPvw.join(' ')
					if (isCut) {
						if (toPgm.length) await self.cueCmd(`LAP ${pgmId} 1 ${sPgm}`)
						if (toPvw.length) await self.cueCmd(`LAP ${pvwId} 1 ${sPvw}`)
					} else {
						// Incoming (preview→program) dissolves IN on program.
						if (toPgm.length) {
							await self.cueCmd(`LAP ${pgmId} 0 ${sPgm}`)
							await self.cueCmd(`TRN 1 ${durFrames} ${sPgm}`)
						}
						// Outgoing (program→preview) stays opaque on program during the
						// incoming fade, then moves to preview once covered. Moving while
						// opaque is reliable — LAP won't relocate a faded-out layer.
						if (toPvw.length) {
							setTimeout(async () => { await self.cueCmd(`LAP ${pvwId} 1 ${sPvw}`) }, durationMs + 200)
						}
					}
					for (const id of toPgm) { self.layerPS[id] = pgmId; self.layerVis[id] = true }
					for (const id of toPvw) { self.layerPS[id] = pvwId; self.layerVis[id] = true }
				}
				self.checkFeedbacks('layer_on_bus', 'source_on_layer')
			},
		},

		'takel': {
			name: 'Transition Specific Layers (by ID)',
			options: [
				{
					type: 'dropdown',
					label: 'PixelSpace Pair',
					id: 'pairIdx',
					default: '0',
					allowCustom: true,
					choices: self.psPairs?.length
						? self.psPairs.map((p, i) => {
								const pgm = self.pixelspaces?.find((ps) => ps.id === p.pgmId)
								return { id: String(i), label: pgm?.name || `PixelSpace ${p.pgmId}` }
						  })
						: [{ id: '0', label: 'Connecting…' }],
				},
				{
					type: 'dropdown',
					label: 'Direction',
					id: 'direction',
					default: 'pvw_to_pgm',
					choices: [
						{ id: 'pvw_to_pgm', label: 'Preview → Program (bring on)' },
						{ id: 'pgm_to_pvw', label: 'Program → Preview (send back)' },
						{ id: 'switch', label: 'Switch (swap Preview ⇄ Program)' },
					],
				},
				{
					type: 'textinput',
					label: 'Layers (1-based layer numbers; space/comma separated)',
					id: 'layers',
					default: '',
					tooltip: 'The exact layers to transition, as shown in the UI (Layer 1, 2, …). Only these are touched.',
				},
				{
					type: 'number',
					label: 'Transition Duration (frames; 1 = cut)',
					id: 'dur',
					default: 60,
					min: 1,
					max: 9999,
				},
			],
			callback: async (action) => {
				const { pairIdx, direction, dur, layers } = action.options
				const pair = self.psPairs?.[parseInt(pairIdx)]
				if (!pair) {
					self.log('warn', 'Transition Specific Layers: no PixelSpace pair configured')
					return
				}
				const { pgmId, pvwId } = pair
				const durFrames = parseInt(dur) || 60
				const isCut = durFrames <= 1
				const frameRateHz = self.frameRateHz || 60
				const durationMs = Math.ceil((durFrames / frameRateHz) * 1000)

				// 1-based UI layer numbers → internal layer id (number + 1).
				const ids = String(layers || '')
					.split(/[\s,]+/)
					.filter(Boolean)
					.map((n) => String(parseInt(n) + 1))
				if (!ids.length) {
					self.log('warn', 'Transition Specific Layers: no layers specified')
					return
				}

				self._transitionUntil = Date.now() + durationMs + 1000

				if (direction === 'pvw_to_pgm') {
					const s2 = ids.join(' ')
					if (isCut) {
						await self.cueCmd(`LAP ${pgmId} 1 ${s2}`)
					} else {
						await self.cueCmd(`LAP ${pgmId} 0 ${s2}`)
						await self.cueCmd(`TRN 1 ${durFrames} ${s2}`)
					}
					for (const id of ids) { self.layerPS[id] = pgmId; self.layerVis[id] = true }
				} else if (direction === 'pgm_to_pvw') {
					// Move to preview while opaque (reliable — LAP won't relocate a faded layer).
					await self.cueCmd(`LAP ${pvwId} 1 ${ids.join(' ')}`)
					for (const id of ids) { self.layerPS[id] = pvwId; self.layerVis[id] = true }
				} else {
					// Switch — split the specified layers by their current side and swap each.
					const toPgm = ids.filter((id) => self.layerPS[id] === pvwId) // on preview → program
					const toPvw = ids.filter((id) => self.layerPS[id] === pgmId) // on program → preview
					if (!toPgm.length && !toPvw.length) {
						self.log('warn', 'Transition Specific Layers: none of the specified layers are on this pair')
						return
					}
					const sPgm = toPgm.join(' ')
					const sPvw = toPvw.join(' ')
					if (isCut) {
						if (toPgm.length) await self.cueCmd(`LAP ${pgmId} 1 ${sPgm}`)
						if (toPvw.length) await self.cueCmd(`LAP ${pvwId} 1 ${sPvw}`)
					} else {
						if (toPgm.length) {
							await self.cueCmd(`LAP ${pgmId} 0 ${sPgm}`)
							await self.cueCmd(`TRN 1 ${durFrames} ${sPgm}`)
						}
						// Outgoing stays opaque during the incoming fade, then moves once covered.
						if (toPvw.length) {
							setTimeout(async () => { await self.cueCmd(`LAP ${pvwId} 1 ${sPvw}`) }, durationMs + 200)
						}
					}
					for (const id of toPgm) { self.layerPS[id] = pgmId; self.layerVis[id] = true }
					for (const id of toPvw) { self.layerPS[id] = pvwId; self.layerVis[id] = true }
				}
				self.checkFeedbacks('layer_on_bus', 'source_on_layer')
			},
		},


		'cmd': {
			name: 'Custom Command',
			options: [
				{
					type: 'textinput',
					label: 'Command',
					id: 'cmd',
					default: 'RSC',
				},
				{
					type: 'textinput',
					label: 'Argument(s) (leave empty for none)',
					id: 'arg',
					default: '0 1',
				},
			],
			callback: async (action) => {
				const { cmd, arg } = action.options
				if (arg !== '') {
					await sendCmd(`${cmd} ${arg}`)
				} else {
					await sendCmd(`${cmd}`)
				}
			},
		},
	}
}
