import { combineRgb } from '@companion-module/base'

const WHITE     = combineRgb(255, 255, 255)
const BLACK     = combineRgb(0, 0, 0)
const RED       = combineRgb(200, 0, 0)
const RED_DIM   = combineRgb(120, 0, 0)
const GREEN     = combineRgb(0, 180, 0)
const GREEN_DIM = combineRgb(0, 100, 0)
const BLUE      = combineRgb(0, 80, 200)
const ORANGE    = combineRgb(220, 120, 0)
const DARK_GREY = combineRgb(40, 40, 40)
const GREY      = combineRgb(80, 80, 80)
const PURPLE    = combineRgb(120, 0, 180)

function btn(text, bgcolor = DARK_GREY, color = WHITE) {
	return { text, size: 'auto', color, bgcolor }
}

// Shorten a name for a button label (max ~8 chars)
function short(name, fallback) {
	if (!name) return fallback
	return name.length > 8 ? name.slice(0, 7) + '…' : name
}

function tplLayerOptions(layerId, patternType) {
	return {
		target: '1', idLayer: String(layerId), idPs: '0', idOutput: '0',
		patternType: String(patternType),
		outline: false, centerCircle: false, centerX: false, grid: false,
		bgColor: combineRgb(0, 0, 0), fgColor: combineRgb(255, 255, 255),
	}
}

function tplPsOptions(psId, patternType) {
	return {
		target: '0', idLayer: '2', idPs: String(psId), idOutput: '0',
		patternType: String(patternType),
		outline: false, centerCircle: false, centerX: false, grid: false,
		bgColor: combineRgb(0, 0, 0), fgColor: combineRgb(255, 255, 255),
	}
}

export function compilePresetDefinitions(self) {

	// ── Dynamic: Take presets per PixelSpace pair ────────────────────────────
	const takePairPresets = {}
	if (self.psPairs?.length) {
		self.psPairs.forEach((pair, i) => {
			const pgm = self.pixelspaces?.find((ps) => ps.id === pair.pgmId)
			const pgmLabel = short(pgm?.name, `PS${pair.pgmId}`)

			const takeOpts = (dir, dur) => ({
				pairIdx: String(i), direction: dir, dur, keepInPvw: true,
			})

			takePairPresets[`take_pair_${i}_pvw_mix`] = {
				type: 'button', category: 'Take',
				name: `Take Mix – ${pgmLabel} (PVW→PGM)`,
				style: btn(`TAKE\nMIX\n${pgmLabel}`, RED),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('pvw_to_pgm', 60) }], up: [] }],
				feedbacks: [],
			}
			takePairPresets[`take_pair_${i}_pvw_cut`] = {
				type: 'button', category: 'Take',
				name: `Take Cut – ${pgmLabel} (PVW→PGM)`,
				style: btn(`TAKE\nCUT\n${pgmLabel}`, RED_DIM),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('pvw_to_pgm', 1) }], up: [] }],
				feedbacks: [],
			}
			takePairPresets[`take_pair_${i}_pgm_mix`] = {
				type: 'button', category: 'Take',
				name: `Take Mix – ${pgmLabel} (PGM→PVW)`,
				style: btn(`SEND\nMIX\n${pgmLabel}`, GREEN_DIM),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('pgm_to_pvw', 60) }], up: [] }],
				feedbacks: [],
			}
			takePairPresets[`take_pair_${i}_pgm_cut`] = {
				type: 'button', category: 'Take',
				name: `Take Cut – ${pgmLabel} (PGM→PVW)`,
				style: btn(`SEND\nCUT\n${pgmLabel}`, GREEN_DIM),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('pgm_to_pvw', 1) }], up: [] }],
				feedbacks: [],
			}
			takePairPresets[`take_pair_${i}_switch_mix`] = {
				type: 'button', category: 'Take',
				name: `Switch Mix – ${pgmLabel}`,
				style: btn(`SWITCH\nMIX\n${pgmLabel}`, PURPLE),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('switch', 60) }], up: [] }],
				feedbacks: [],
			}
			takePairPresets[`take_pair_${i}_switch_cut`] = {
				type: 'button', category: 'Take',
				name: `Switch Cut – ${pgmLabel}`,
				style: btn(`SWITCH\nCUT\n${pgmLabel}`, PURPLE),
				steps: [{ down: [{ actionId: 'take', options: takeOpts('switch', 1) }], up: [] }],
				feedbacks: [],
			}
		})
	} else {
		// Fallback when not yet connected
		takePairPresets['take_ps_pair_0_mix'] = {
			type: 'button', category: 'Take', name: 'Take Mix (PS pair 0)',
			style: btn('TAKE\nMIX', RED),
			steps: [{ down: [{ actionId: 'take', options: { pairIdx: '0', direction: 'pvw_to_pgm', dur: 60, keepInPvw: true } }], up: [] }],
			feedbacks: [],
		}
		takePairPresets['take_ps_pair_0_cut'] = {
			type: 'button', category: 'Take', name: 'Take Cut (PS pair 0)',
			style: btn('TAKE\nCUT', RED_DIM),
			steps: [{ down: [{ actionId: 'take', options: { pairIdx: '0', direction: 'pvw_to_pgm', dur: 1, keepInPvw: true } }], up: [] }],
			feedbacks: [],
		}
	}

	// ── Dynamic: Basic Presets from RBL ──────────────────────────────────────
	const basicPresetPresets = {}
	if (self.basicPresets?.length) {
		self.basicPresets.forEach((p) => {
			const label = short(p.name, `P${p.id}`)
			basicPresetPresets[`bpr_dyn_${p.id}`] = {
				type: 'button', category: 'Basic Presets',
				name: `Recall – ${p.name}`,
				style: btn(`PRESET\n${label}`, GREEN),
				steps: [{ down: [{ actionId: 'bpr', options: { idx: String(p.id), dur: 60 } }], up: [] }],
				feedbacks: [],
			}
			basicPresetPresets[`bpl_dyn_${p.id}`] = {
				type: 'button', category: 'Basic Presets',
				name: `Learn – ${p.name}`,
				style: btn(`LEARN\n${label}`, ORANGE),
				steps: [{ down: [{ actionId: 'bpl', options: { idx: String(p.id), dur: 60 } }], up: [] }],
				feedbacks: [],
			}
		})
	} else {
		// Static fallback presets 1-8
		for (let i = 1; i <= 8; i++) {
			basicPresetPresets[`bpr_static_${i}`] = {
				type: 'button', category: 'Basic Presets', name: `Recall Preset ${i}`,
				style: btn(`PRESET\n${i}`, GREEN),
				steps: [{ down: [{ actionId: 'bpr', options: { idx: String(i), dur: 60 } }], up: [] }],
				feedbacks: [],
			}
		}
		basicPresetPresets['bpl_static_1'] = {
			type: 'button', category: 'Basic Presets', name: 'Learn Preset 1',
			style: btn('LEARN\nPRESET 1', ORANGE),
			steps: [{ down: [{ actionId: 'bpl', options: { idx: '1', dur: 60 } }], up: [] }],
			feedbacks: [],
		}
	}

	// ── Dynamic: Script Recall from RRL ──────────────────────────────────────
	const scriptPresets = {}
	const scripts = Object.values(self.reg || {}).filter((r) => r.scriptId != null)
	if (scripts.length) {
		scripts.forEach((r) => {
			const label = short(r.name, `Scr${r.scriptId}`)
			const numCues = parseInt(r.numCues) || 1
			// One button per cue (up to 8 shown)
			const maxCues = Math.min(numCues, 8)
			for (let c = 1; c <= maxCues; c++) {
				scriptPresets[`rsc_dyn_${r.scriptId}_${c}`] = {
					type: 'button', category: 'Script Recall',
					name: `${r.name || 'Script ' + r.scriptId} – Cue ${c}`,
					style: btn(`${label}\nCUE ${c}`, BLUE),
					steps: [{ down: [{ actionId: 'rsc', options: { sidx: String(r.scriptId), cidx: c, type: 'S' } }], up: [] }],
					feedbacks: [{ feedbackId: 'inp_ok', options: { type: 'S', sidx: r.scriptId }, style: { bgcolor: RED, color: WHITE } }],
				}
			}
		})
	} else {
		// Static fallback
		for (let s = 1; s <= 3; s++) {
			for (let c = 1; c <= 2; c++) {
				scriptPresets[`rsc_static_${s}_${c}`] = {
					type: 'button', category: 'Script Recall', name: `Script ${s} Cue ${c}`,
					style: btn(`SCR ${s}\nCUE ${c}`, BLUE),
					steps: [{ down: [{ actionId: 'rsc', options: { sidx: String(s), cidx: c, type: 'S' } }], up: [] }],
					feedbacks: [],
				}
			}
		}
	}

	// ── Dynamic: Test patterns per PixelSpace ─────────────────────────────────
	const psPatternPresets = {}
	if (self.pixelspaces?.length) {
		self.pixelspaces.forEach((ps) => {
			const label = short(ps.name, `PS${ps.id}`)
			psPatternPresets[`tpl_bars_ps_${ps.id}`] = {
				type: 'button', category: 'Test Patterns',
				name: `Color Bars on ${ps.name || `PS ${ps.id}`}`,
				style: btn(`BARS\n${label}`, GREY),
				steps: [{ down: [{ actionId: 'tpl', options: tplPsOptions(ps.id, 0) }], up: [] }],
				feedbacks: [],
			}
			psPatternPresets[`tpl_grid_ps_${ps.id}`] = {
				type: 'button', category: 'Test Patterns',
				name: `Grid 32 on ${ps.name || `PS ${ps.id}`}`,
				style: btn(`GRID\n${label}`, GREY),
				steps: [{ down: [{ actionId: 'tpl', options: tplPsOptions(ps.id, 6) }], up: [] }],
				feedbacks: [],
			}
			psPatternPresets[`tpc_ps_${ps.id}`] = {
				type: 'button', category: 'Test Patterns',
				name: `Clear Pattern on ${ps.name || `PS ${ps.id}`}`,
				style: btn(`CLR PAT\n${label}`, RED_DIM),
				steps: [{ down: [{ actionId: 'tpc', options: { target: '0', idLayer: '2', idPs: String(ps.id), idOutput: '0' } }], up: [] }],
				feedbacks: [],
			}
		})
	}

	// ── Dynamic: PGM/PVW tally buttons per source ─────────────────────────────
	const sourceTallyPresets = {}
	if (self.sources?.length) {
		self.sources.forEach((src) => {
			const label = short(src.name, `Src${src.id}`)
			sourceTallyPresets[`tally_pgm_${src.id}`] = {
				type: 'button', category: 'Tally', name: `PGM Tally – ${src.name}`,
				style: btn(label, DARK_GREY),
				steps: [],
				feedbacks: [{ feedbackId: 'source_on_pgm', options: { sourceName: src.name }, style: { bgcolor: RED, color: WHITE } }],
			}
			sourceTallyPresets[`tally_pvw_${src.id}`] = {
				type: 'button', category: 'Tally', name: `PVW Tally – ${src.name}`,
				style: btn(label, DARK_GREY),
				steps: [],
				feedbacks: [{ feedbackId: 'source_on_pvw', options: { sourceName: src.name }, style: { bgcolor: GREEN, color: WHITE } }],
			}
		})
	}

	return {

		// ════════════════════════════════════════════════════════════════════════
		// CUE CONTROL
		// ════════════════════════════════════════════════════════════════════════
		'preset_asc_take': {
			type: 'button', category: 'Cue Control', name: 'Script Take',
			style: btn('TAKE', RED),
			steps: [{ down: [{ actionId: 'asc', options: { cueNum: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_advance_1': {
			type: 'button', category: 'Cue Control', name: 'Advance 1 Cue',
			style: btn('+1 CUE', BLUE),
			steps: [{ down: [{ actionId: 'asc', options: { cueNum: '+1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_back_1': {
			type: 'button', category: 'Cue Control', name: 'Step Back 1 Cue',
			style: btn('-1 CUE', BLUE),
			steps: [{ down: [{ actionId: 'asc', options: { cueNum: '-1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_advance_10': {
			type: 'button', category: 'Cue Control', name: 'Advance 10 Cues',
			style: btn('+10 CUE', GREY),
			steps: [{ down: [{ actionId: 'asc', options: { cueNum: '+10' } }], up: [] }],
			feedbacks: [],
		},
		'preset_back_10': {
			type: 'button', category: 'Cue Control', name: 'Step Back 10 Cues',
			style: btn('-10 CUE', GREY),
			steps: [{ down: [{ actionId: 'asc', options: { cueNum: '-10' } }], up: [] }],
			feedbacks: [],
		},
		'preset_stop_scripts': {
			type: 'button', category: 'Cue Control', name: 'Stop Running Scripts',
			style: btn('STOP\nSCRIPTS', RED),
			steps: [{ down: [{ actionId: 'srs', options: { op: 'S' } }], up: [] }],
			feedbacks: [],
		},
		'preset_disconnect_scripts': {
			type: 'button', category: 'Cue Control', name: 'Disconnect Scripts from Layers',
			style: btn('DISCNCT\nSCRIPTS', ORANGE),
			steps: [{ down: [{ actionId: 'srs', options: { op: 'D' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// BACKGROUND
		// ════════════════════════════════════════════════════════════════════════
		'preset_btr_60': {
			type: 'button', category: 'Background', name: 'Background Transition (60 frames)',
			style: btn('BG\nTRANS', BLUE),
			steps: [{ down: [{ actionId: 'btr', options: { dur: 60 } }], up: [] }],
			feedbacks: [],
		},
		'preset_btr_30': {
			type: 'button', category: 'Background', name: 'Background Transition (30 frames)',
			style: btn('BG TRANS\n30fr', BLUE),
			steps: [{ down: [{ actionId: 'btr', options: { dur: 30 } }], up: [] }],
			feedbacks: [],
		},
		'preset_btr_cut': {
			type: 'button', category: 'Background', name: 'Background Cut',
			style: btn('BG CUT', GREY),
			steps: [{ down: [{ actionId: 'btr', options: { dur: 1 } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// LAYER CONTROL
		// ════════════════════════════════════════════════════════════════════════
		'preset_frz_on_2': {
			type: 'button', category: 'Layer Control', name: 'Freeze Layer 2 On',
			style: btn('FRZ ON\nL2', ORANGE),
			steps: [{ down: [{ actionId: 'frz', options: { frzonoff: '1', lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_frz_off_2': {
			type: 'button', category: 'Layer Control', name: 'Freeze Layer 2 Off',
			style: btn('FRZ OFF\nL2', GREY),
			steps: [{ down: [{ actionId: 'frz', options: { frzonoff: '0', lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_trn_on_2': {
			type: 'button', category: 'Layer Control', name: 'Transition Layer 2 On (Mix)',
			style: btn('TRN ON\nL2', GREEN),
			steps: [{ down: [{ actionId: 'trn', options: { mix: '1', dur: 60, lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_trn_off_2': {
			type: 'button', category: 'Layer Control', name: 'Transition Layer 2 Off',
			style: btn('TRN OFF\nL2', RED),
			steps: [{ down: [{ actionId: 'trn', options: { mix: '0', dur: 60, lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ktp_opaque_2': {
			type: 'button', category: 'Layer Control', name: 'Layer 2 Fully Opaque',
			style: btn('OPAQUE\nL2', GREEN),
			steps: [{ down: [{ actionId: 'ktp', options: { transparency: 0, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ktp_50_2': {
			type: 'button', category: 'Layer Control', name: 'Layer 2 Transparency 50%',
			style: btn('50%\nTRANS L2', GREY),
			steps: [{ down: [{ actionId: 'ktp', options: { transparency: 128, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ktp_invis_2': {
			type: 'button', category: 'Layer Control', name: 'Layer 2 Invisible',
			style: btn('INVIS\nL2', RED),
			steps: [{ down: [{ actionId: 'ktp', options: { transparency: 255, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_swa_23': {
			type: 'button', category: 'Layer Control', name: 'Swap Layer 2 and 3',
			style: btn('SWAP\nL2↔L3', BLUE),
			steps: [{ down: [{ actionId: 'swa', options: { lay1: '2', lay2: '3' } }], up: [] }],
			feedbacks: [],
		},
		'preset_scl_2': {
			type: 'button', category: 'Layer Control', name: 'Clear Still on Layer 2',
			style: btn('CLR STILL\nL2', GREY),
			steps: [{ down: [{ actionId: 'scl', options: { layers: '2' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// LAYER POSITION & SIZE
		// ════════════════════════════════════════════════════════════════════════
		'preset_kps_topleft_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Layer 2 – Position Top-Left (0,0)',
			style: btn('TL 0,0\nL2', GREY),
			steps: [{ down: [{ actionId: 'kps', options: { posType: '0', h: 0, v: 0, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ksz_1920_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Layer 2 – Width 1920px',
			style: btn('1920w\nL2', GREY),
			steps: [{ down: [{ actionId: 'ksz', options: { horz: 1920, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ksz_1280_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Layer 2 – Width 1280px',
			style: btn('1280w\nL2', GREY),
			steps: [{ down: [{ actionId: 'ksz', options: { horz: 1280, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lsp_full_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Layer 2 – Fullscreen 1920×1080',
			style: btn('FULL SCR\nL2', GREEN),
			steps: [{ down: [{ actionId: 'lsp', options: { posType: '0', h: 0, v: 0, size: 1920, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lsp_pip_br_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Layer 2 – PiP Bottom-Right',
			style: btn('PiP BR\nL2', GREY),
			steps: [{ down: [{ actionId: 'lsp', options: { posType: '0', h: 1440, v: 810, size: 480, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lac_snap_top': {
			type: 'button', category: 'Layer Position & Size', name: 'Snap Layers 2+3 to Top',
			style: btn('SNAP TOP\nL2+L3', GREY),
			steps: [{ down: [{ actionId: 'lac', options: { effect: '21', dur: 30, layers: '2 3' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lac_center_h': {
			type: 'button', category: 'Layer Position & Size', name: 'Center Layer 2 Horizontally',
			style: btn('CTR H\nL2', GREY),
			steps: [{ down: [{ actionId: 'lac', options: { effect: '6', dur: 30, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lac_fit_width': {
			type: 'button', category: 'Layer Position & Size', name: 'Size Layer 2 to Display Width',
			style: btn('FIT W\nL2', GREY),
			steps: [{ down: [{ actionId: 'lac', options: { effect: '17', dur: 30, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lac_fit_height': {
			type: 'button', category: 'Layer Position & Size', name: 'Size Layer 2 to Display Height',
			style: btn('FIT H\nL2', GREY),
			steps: [{ down: [{ actionId: 'lac', options: { effect: '16', dur: 30, layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_crp_none_2': {
			type: 'button', category: 'Layer Position & Size', name: 'Remove Crop on Layer 2',
			style: btn('NO CROP\nL2', GREY),
			steps: [{ down: [{ actionId: 'crp', options: { left: 0, right: 0, top: 0, bottom: 0, layers: '2' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// SOURCE CONTROL
		// ════════════════════════════════════════════════════════════════════════
		'preset_sra_layer2': {
			type: 'button', category: 'Source Control', name: 'Apply Source to Layer 2',
			style: btn('SRC\nL2', BLUE),
			steps: [{ down: [{ actionId: 'sra', options: { name: '', layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_sra_layer3': {
			type: 'button', category: 'Source Control', name: 'Apply Source to Layer 3',
			style: btn('SRC\nL3', BLUE),
			steps: [{ down: [{ actionId: 'sra', options: { name: '', layers: '3' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ktr_1_l2': {
			type: 'button', category: 'Source Control', name: 'Recall Treatment 1 on Layer 2',
			style: btn('TREAT 1\nL2', PURPLE),
			steps: [{ down: [{ actionId: 'ktr', options: { id: 1, lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ktr_2_l2': {
			type: 'button', category: 'Source Control', name: 'Recall Treatment 2 on Layer 2',
			style: btn('TREAT 2\nL2', PURPLE),
			steps: [{ down: [{ actionId: 'ktr', options: { id: 2, lay: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_fkr_1': {
			type: 'button', category: 'Source Control', name: 'Function Key 1 on Layer 2',
			style: btn('FN KEY\n1', BLUE),
			steps: [{ down: [{ actionId: 'fkr', options: { fkrid: 1, lay: '2', idType: 'F' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ila_reset_2': {
			type: 'button', category: 'Source Control', name: 'Reset Input Levels on Layer 2',
			style: btn('RESET\nLEVELS L2', GREY),
			steps: [{ down: [{ actionId: 'ila', options: { brightness: 1, contrast: 1, hue: 0, saturation: 1, gamma: 1, layers: '2' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// OUTPUT CONTROL
		// ════════════════════════════════════════════════════════════════════════
		'preset_ofz_on_0': {
			type: 'button', category: 'Output Control', name: 'Freeze Output 1 On',
			style: btn('FRZ\nOUT 1', ORANGE),
			steps: [{ down: [{ actionId: 'ofz', options: { frzonoff: '1', output: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ofz_off_0': {
			type: 'button', category: 'Output Control', name: 'Freeze Output 1 Off',
			style: btn('UNFRZ\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ofz', options: { frzonoff: '0', output: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ofz_on_1': {
			type: 'button', category: 'Output Control', name: 'Freeze Output 2 On',
			style: btn('FRZ\nOUT 2', ORANGE),
			steps: [{ down: [{ actionId: 'ofz', options: { frzonoff: '1', output: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ofz_off_1': {
			type: 'button', category: 'Output Control', name: 'Freeze Output 2 Off',
			style: btn('UNFRZ\nOUT 2', GREY),
			steps: [{ down: [{ actionId: 'ofz', options: { frzonoff: '0', output: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocs_0': {
			type: 'button', category: 'Output Control', name: 'Save Output 1 Config',
			style: btn('SAVE\nOUT 1', ORANGE),
			steps: [{ down: [{ actionId: 'ocs', options: { outputId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocu_0': {
			type: 'button', category: 'Output Control', name: 'Undo Output 1 Config',
			style: btn('UNDO\nOUT 1', RED),
			steps: [{ down: [{ actionId: 'ocu', options: { outputId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_cso_0': {
			type: 'button', category: 'Output Control', name: 'Clear Still on Output 1',
			style: btn('CLR STILL\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'cso', options: { outputId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocr_0_90': {
			type: 'button', category: 'Output Control', name: 'Rotate Output 1 90°',
			style: btn('ROT 90°\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ocr', options: { outputId: '0', angle: '90' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocr_0_0': {
			type: 'button', category: 'Output Control', name: 'Rotate Output 1 0° (Normal)',
			style: btn('ROT 0°\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ocr', options: { outputId: '0', angle: '0' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// OUTPUT MODE
		// ════════════════════════════════════════════════════════════════════════
		'preset_ocm_normal_0': {
			type: 'button', category: 'Output Mode', name: 'Output 1 – Normal Mode',
			style: btn('NORMAL\nOUT 1', BLUE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '0', mode: 'Normal', hStart: 0, vStart: 0 } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocm_scaled_0': {
			type: 'button', category: 'Output Mode', name: 'Output 1 – Scaled Mode',
			style: btn('SCALED\nOUT 1', BLUE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '0', mode: 'Scaled', psId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocm_multiview_3': {
			type: 'button', category: 'Output Mode', name: 'Output 4 – Multiview Mode',
			style: btn('MVTV\nOUT 4', PURPLE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '3', mode: 'Multiview', presetName: '' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocm_opmon_3': {
			type: 'button', category: 'Output Mode', name: 'Output 4 – OpMon Mode',
			style: btn('OPMON\nOUT 4', PURPLE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '3', mode: 'OpMon', psId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocm_srcmon_3': {
			type: 'button', category: 'Output Mode', name: 'Output 4 – SourceMon Mode',
			style: btn('SRCMON\nOUT 4', PURPLE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '3', mode: 'SourceMon' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocm_aux_0': {
			type: 'button', category: 'Output Mode', name: 'Output 1 – Aux Mode',
			style: btn('AUX\nOUT 1', ORANGE),
			steps: [{ down: [{ actionId: 'ocm', options: { outputId: '0', mode: 'Aux', sourceName: '', bgColor: combineRgb(0, 0, 0) } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// OUTPUT POSITION & FORMAT
		// ════════════════════════════════════════════════════════════════════════
		'preset_ocp_origin_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Position 0,0',
			style: btn('POS 0,0\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ocp', options: { outputId: '0', hStart: 0, vStart: 0 } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocp_1920_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Position H:1920',
			style: btn('POS H\n1920 O1', GREY),
			steps: [{ down: [{ actionId: 'ocp', options: { outputId: '0', hStart: 1920, vStart: 0 } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocp_3840_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Position H:3840',
			style: btn('POS H\n3840 O1', GREY),
			steps: [{ down: [{ actionId: 'ocp', options: { outputId: '0', hStart: 3840, vStart: 0 } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocp_origin_1': {
			type: 'button', category: 'Output Position & Format', name: 'Output 2 – Position 0,0',
			style: btn('POS 0,0\nOUT 2', GREY),
			steps: [{ down: [{ actionId: 'ocp', options: { outputId: '1', hStart: 0, vStart: 0 } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocf_1080p60_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – 1920×1080 @60Hz',
			style: btn('1080p60\nOUT 1', BLUE),
			steps: [{ down: [{ actionId: 'ocf', options: { outputId: '0', hActive: 1920, vActive: 1080, refresh: '60', interlaced: '0', timing: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocf_1080p50_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – 1920×1080 @50Hz',
			style: btn('1080p50\nOUT 1', BLUE),
			steps: [{ down: [{ actionId: 'ocf', options: { outputId: '0', hActive: 1920, vActive: 1080, refresh: '50', interlaced: '0', timing: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocf_4k60_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – 3840×2160 @60Hz',
			style: btn('4K60\nOUT 1', BLUE),
			steps: [{ down: [{ actionId: 'ocf', options: { outputId: '0', hActive: 3840, vActive: 2160, refresh: '60', interlaced: '0', timing: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocf_720p60_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – 1280×720 @60Hz',
			style: btn('720p60\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ocf', options: { outputId: '0', hActive: 1280, vActive: 720, refresh: '60', interlaced: '0', timing: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_occ_hdmi_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Connector HDMI',
			style: btn('HDMI\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'occ', options: { outputId: '0', connType: '4', enabled: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_occ_dp_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Connector DisplayPort',
			style: btn('DP\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'occ', options: { outputId: '0', connType: '5', enabled: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_occ_sdi_0': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Connector SDI',
			style: btn('SDI\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'occ', options: { outputId: '0', connType: '2', enabled: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_ocn_out1': {
			type: 'button', category: 'Output Position & Format', name: 'Output 1 – Set Name',
			style: btn('RENAME\nOUT 1', GREY),
			steps: [{ down: [{ actionId: 'ocn', options: { outputId: '0', name: 'Output 1' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// MULTIVIEWER
		// ════════════════════════════════════════════════════════════════════════
		'preset_mvpr_opmon_4': {
			type: 'button', category: 'Multiviewer', name: 'Output 4 – OpMon',
			style: btn('OPMON\nOUT 4', BLUE),
			steps: [{ down: [{ actionId: 'mvpr', options: { outputId: '3', presetType: '0', presetName: '' } }], up: [] }],
			feedbacks: [],
		},
		'preset_mvpr_srcmon_4': {
			type: 'button', category: 'Multiviewer', name: 'Output 4 – SourceMon',
			style: btn('SRCMON\nOUT 4', BLUE),
			steps: [{ down: [{ actionId: 'mvpr', options: { outputId: '3', presetType: '1', presetName: '' } }], up: [] }],
			feedbacks: [],
		},
		'preset_mvpl_4': {
			type: 'button', category: 'Multiviewer', name: 'Output 4 – Learn Custom MV Preset',
			style: btn('MV LEARN\nOUT 4', ORANGE),
			steps: [{ down: [{ actionId: 'mvpl', options: { outputId: '3', presetName: 'MyPreset' } }], up: [] }],
			feedbacks: [],
		},
		'preset_mvca_4': {
			type: 'button', category: 'Multiviewer', name: 'Output 4 – Clear All Views',
			style: btn('CLR ALL\nOUT 4', RED),
			steps: [{ down: [{ actionId: 'mvca', options: { outputId: '3' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// STILLS
		// ════════════════════════════════════════════════════════════════════════
		'preset_sld_l2': {
			type: 'button', category: 'Stills', name: 'Load Still on Layer 2',
			style: btn('LOAD\nSTILL L2', BLUE),
			steps: [{ down: [{ actionId: 'sld', options: { filename: 'image.png', layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_scl_l2_stills': {
			type: 'button', category: 'Stills', name: 'Clear Still on Layer 2',
			style: btn('CLR\nSTILL L2', GREY),
			steps: [{ down: [{ actionId: 'scl', options: { layers: '2' } }], up: [] }],
			feedbacks: [],
		},
		'preset_lso_0': {
			type: 'button', category: 'Stills', name: 'Load Still on Output 1',
			style: btn('LOAD\nSTILL O1', BLUE),
			steps: [{ down: [{ actionId: 'lso', options: { filename: 'image.png', outputId: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_cso_stills': {
			type: 'button', category: 'Stills', name: 'Clear Still on Output 1',
			style: btn('CLR\nSTILL O1', GREY),
			steps: [{ down: [{ actionId: 'cso', options: { outputId: '0' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// TEST PATTERNS (static layer fallbacks; PS patterns are dynamic below)
		// ════════════════════════════════════════════════════════════════════════
		'preset_tpl_bars_l2': {
			type: 'button', category: 'Test Patterns', name: 'Color Bars on Layer 2',
			style: btn('BARS\nL2', GREY),
			steps: [{ down: [{ actionId: 'tpl', options: tplLayerOptions(2, 0) }], up: [] }],
			feedbacks: [],
		},
		'preset_tpl_pluge_l2': {
			type: 'button', category: 'Test Patterns', name: 'Color Bars Pluge on Layer 2',
			style: btn('PLUGE\nL2', GREY),
			steps: [{ down: [{ actionId: 'tpl', options: tplLayerOptions(2, 2) }], up: [] }],
			feedbacks: [],
		},
		'preset_tpl_grid_l2': {
			type: 'button', category: 'Test Patterns', name: 'Grid 32 on Layer 2',
			style: btn('GRID 32\nL2', GREY),
			steps: [{ down: [{ actionId: 'tpl', options: tplLayerOptions(2, 6) }], up: [] }],
			feedbacks: [],
		},
		'preset_tpl_black_l2': {
			type: 'button', category: 'Test Patterns', name: 'Black on Layer 2',
			style: btn('BLACK\nL2', DARK_GREY),
			steps: [{ down: [{ actionId: 'tpl', options: { ...tplLayerOptions(2, 3), bgColor: combineRgb(0, 0, 0), fgColor: combineRgb(0, 0, 0) } }], up: [] }],
			feedbacks: [],
		},
		'preset_tpl_white_l2': {
			type: 'button', category: 'Test Patterns', name: 'White on Layer 2',
			style: btn('WHITE\nL2', GREY),
			steps: [{ down: [{ actionId: 'tpl', options: { ...tplLayerOptions(2, 3), bgColor: combineRgb(255, 255, 255), fgColor: combineRgb(255, 255, 255) } }], up: [] }],
			feedbacks: [],
		},
		'preset_tpc_l2': {
			type: 'button', category: 'Test Patterns', name: 'Clear Test Pattern on Layer 2',
			style: btn('CLR PAT\nL2', RED_DIM),
			steps: [{ down: [{ actionId: 'tpc', options: { target: '1', idLayer: '2', idPs: '0', idOutput: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_tpl_bars_l3': {
			type: 'button', category: 'Test Patterns', name: 'Color Bars on Layer 3',
			style: btn('BARS\nL3', GREY),
			steps: [{ down: [{ actionId: 'tpl', options: tplLayerOptions(3, 0) }], up: [] }],
			feedbacks: [],
		},
		'preset_tpc_l3': {
			type: 'button', category: 'Test Patterns', name: 'Clear Test Pattern on Layer 3',
			style: btn('CLR PAT\nL3', RED_DIM),
			steps: [{ down: [{ actionId: 'tpc', options: { target: '1', idLayer: '3', idPs: '0', idOutput: '0' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// MIXER / DEVICE
		// ════════════════════════════════════════════════════════════════════════
		'preset_dmb_pgm': {
			type: 'button', category: 'Mixer', name: 'Device 0 to PGM',
			style: btn('DEV 0\nPGM', RED),
			steps: [{ down: [{ actionId: 'dmb', options: { dur: 60, bus: 'PGM', device: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_dmb_pvw': {
			type: 'button', category: 'Mixer', name: 'Device 0 to PVW',
			style: btn('DEV 0\nPVW', GREEN_DIM),
			steps: [{ down: [{ actionId: 'dmb', options: { dur: 60, bus: 'PVM', device: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_dmb_off': {
			type: 'button', category: 'Mixer', name: 'Device 0 Off',
			style: btn('DEV 0\nOFF', GREY),
			steps: [{ down: [{ actionId: 'dmb', options: { dur: 60, bus: 'OFF', device: '0' } }], up: [] }],
			feedbacks: [],
		},
		'preset_dmt_0': {
			type: 'button', category: 'Mixer', name: 'Device 0 Transition',
			style: btn('DEV 0\nTRANS', BLUE),
			steps: [{ down: [{ actionId: 'dmt', options: { dur: 60, dev: '0' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// SERVER
		// ════════════════════════════════════════════════════════════════════════
		'preset_sav': {
			type: 'button', category: 'Server', name: 'Force Server Save',
			style: btn('SAVE\nSERVER', ORANGE),
			steps: [{ down: [{ actionId: 'sav', options: {} }], up: [] }],
			feedbacks: [],
		},
		'preset_sdn_restart': {
			type: 'button', category: 'Server', name: 'Restart Spyder Server',
			style: btn('RESTART\nSERVER', RED),
			steps: [{ down: [{ actionId: 'sdn', options: { state: '1' } }], up: [] }],
			feedbacks: [],
		},
		'preset_sdn_poweroff': {
			type: 'button', category: 'Server', name: 'Power Off Spyder Server',
			style: btn('POWER\nOFF', RED),
			steps: [{ down: [{ actionId: 'sdn', options: { state: '0' } }], up: [] }],
			feedbacks: [],
		},

		// ════════════════════════════════════════════════════════════════════════
		// TALLY – aggregated variables
		// ════════════════════════════════════════════════════════════════════════
		'preset_tally_pgm_all': {
			type: 'button', category: 'Tally', name: 'PGM Sources (variable)',
			style: btn('$(christie-spyder:active_pgm_sources)', RED),
			steps: [], feedbacks: [],
		},
		'preset_tally_pvw_all': {
			type: 'button', category: 'Tally', name: 'PVW Sources (variable)',
			style: btn('$(christie-spyder:active_pvw_sources)', GREEN),
			steps: [], feedbacks: [],
		},
		'preset_tally_pgm_count': {
			type: 'button', category: 'Tally', name: 'PGM Source Count',
			style: btn('PGM\n$(christie-spyder:active_pgm_count) src', RED),
			steps: [], feedbacks: [],
		},
		'preset_tally_pvw_count': {
			type: 'button', category: 'Tally', name: 'PVW Source Count',
			style: btn('PVW\n$(christie-spyder:active_pvw_count) src', GREEN),
			steps: [], feedbacks: [],
		},
		'preset_info_layers': {
			type: 'button', category: 'Tally', name: 'Layer Count',
			style: btn('LAYERS\n$(christie-spyder:layer_count)', DARK_GREY),
			steps: [], feedbacks: [],
		},
		'preset_info_framerate': {
			type: 'button', category: 'Tally', name: 'System Frame Rate',
			style: btn('$(christie-spyder:system_framerate)', DARK_GREY),
			steps: [], feedbacks: [],
		},

		// ── Dynamic presets merged last ───────────────────────────────────────
		...takePairPresets,
		...basicPresetPresets,
		...scriptPresets,
		...psPatternPresets,
		...sourceTallyPresets,
	}
}
