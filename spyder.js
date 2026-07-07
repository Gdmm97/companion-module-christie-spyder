import { combineRgb, Regex, UDPHelper } from '@companion-module/base'
import { runEntrypoint, InstanceBase, InstanceStatus } from '@companion-module/base'
import { compileActionDefinitions } from './actions.js'
import { GetFeedbackDefinitions } from './feedbacks.js'
import { compilePresetDefinitions } from './presets.js'

const Upgradereg = []

class SpyderInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.devMode = process.env.DEVELOPER
		this.hasError = false
	}

	cueCmd = async (cmd) => {
		if (cmd !== undefined) {
			if (this.pending.length) {
				this.nextCmd.push(cmd)
			} else {
				await this.sendCmd(cmd)
			}
		}
	}

	sendCmd = async (cmd) => {
		const now = Date.now()
		let c = cmd.split(' ')
		if (c[2] != '-1') {
			c = c.slice(0, 3)
		} else {
			c = c.slice(0, 2)
		}
		c = c.join(' ')

		if (this.udp !== undefined) {
			await this.udp.send('spyder\x00\x00\x00\x00' + cmd)
			this.pending.push({ cmd: c, sent: now })
			this.lastCmd = cmd
		}
	}

	async init(config) {
		this.hasError = false
		this.config = config
		// Write defaults into stored config so hidden fields have a value
		// when they first become visible (Companion doesn't apply `default` to hidden fields)
		if (!this.config.polling_rate) {
			this.config.polling_rate = '1000'
			this.saveConfig(this.config)
			return // configUpdated will be called by saveConfig and continue startup
		}
		this.start('Initializing')
	}

	async configUpdated(config) {
		await this.destroy()
		this.config = config
		if (!this.config.polling_rate) this.config.polling_rate = '1000'
		this.start('Restarting')
	}

	async destroy() {
		this.updateStatus(InstanceStatus.Disconnected, 'Closed')
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			delete this.pollTimer
		}
		if (this.udp !== undefined) {
			this.udp.destroy()
		}
	}

	start(msg) {
		this.updateStatus(InstanceStatus.Connecting, msg)
		this.setActionDefinitions(compileActionDefinitions(this))
		this.setFeedbackDefinitions(GetFeedbackDefinitions(this))
		this.setPresetDefinitions(compilePresetDefinitions(this))
		this.pending = []
		this.nextCmd = []
		this.status = {}
		this.activeSources = new Map()
		this.sources = []
		this.treatments = []
		this.pixelspaces = []
		this.psPairs = []
		this.layerPS = {}
		this.layerVis = {}
		this.layerSource = {}
		this.layerKF = {}
		this.pollCount = 0
		this.frameRateHz = 60
		this._lastLayerCount = -1
		this.rebuildTimer = null
		this.init_variables()
		this.init_udp()
	}

	scheduleRebuild() {
		if (this.rebuildTimer) clearTimeout(this.rebuildTimer)
		this.rebuildTimer = setTimeout(() => {
			this.setActionDefinitions(compileActionDefinitions(this))
			this.setFeedbackDefinitions(GetFeedbackDefinitions(this))
			this.setPresetDefinitions(compilePresetDefinitions(this))
			this.checkFeedbacks('layer_on_bus')
			this.rebuildTimer = null
		}, 200)
	}

	init_variables() {
		this.reg = {}
		this.script2reg = {}
		this.basicPresets = []
		this.mvPresets = []
		this.scriptCues = {} // { [scriptId]: [{ index, name }, ...] }
		this.variableDefs = [
			{ name: 'Active PGM Sources', variableId: 'active_pgm_sources' },
			{ name: 'Active PVW Sources', variableId: 'active_pvw_sources' },
			{ name: 'Active PGM Source Count', variableId: 'active_pgm_count' },
			{ name: 'Active PVW Source Count', variableId: 'active_pvw_count' },
			{ name: 'Layer Count', variableId: 'layer_count' },
			{ name: 'System Frame Rate', variableId: 'system_framerate' },
			{ name: '[DEBUG] Layer→PixelSpace map', variableId: 'dbg_layer_ps' },
			{ name: '[DEBUG] PGM/PVW pairs', variableId: 'dbg_ps_pairs' },
			{ name: '[DEBUG] On-bus layer source+keyframe', variableId: 'dbg_layer_kf' },
		]
		this.variableValues = {
			active_pgm_sources: '',
			active_pvw_sources: '',
			active_pgm_count: 0,
			active_pvw_count: 0,
			layer_count: 0,
			system_framerate: '',
			dbg_layer_ps: '{}',
			dbg_ps_pairs: '[]',
			dbg_layer_kf: '',
		}
		this.setVariableDefinitions(this.variableDefs)
		this.setVariableValues(this.variableValues)
		this.variableValues = {}
	}

	init_udp() {
		if (this.config.host !== undefined) {
			this.udp = new UDPHelper(this.config.host, 11116)

			this.udp.on('error', (err) => {
				if (!this.hasError) {
					this.log('debug', `Network error ${err}`)
					this.updateStatus(InstanceStatus.UnknownError, err.message)
					this.log('error', 'Network error: ' + err.message)
					this.hasError = true
				}
				if (this.pollTimer) {
					clearInterval(this.pollTimer)
					delete this.pollTimer
				}
			})

			this.udp.on('data', async (data) => {
				let msg = data.toString()
				let cmd = this.pending.shift()
				if (cmd == undefined || cmd.cmd.includes('NaN')) {
					return
				}

				switch (msg.slice(0, 1)) {
					case '0': {
						this.updateStatus(InstanceStatus.Ok, 'Connected')
						this.status[cmd.cmd] = {
							resp: msg.slice(2),
							lag: Date.now() - cmd.sent,
						}
						const cmds = cmd.cmd.split(' ')
						let newReg = false
						let newNames = false

						switch (cmds[0]) {
							case 'RBL': {
								// Response: <Result Code> <Return Count> [<Preset ID> <Preset Name>]...
								const rblParts = msg.slice(2).trim().split(' ')
								const rblCount = parseInt(rblParts[0])
								const presets = []
								for (let i = 0; i < rblCount; i++) {
									const id   = parseInt(rblParts[1 + i * 2] ?? '')
									const name = decodeURIComponent(rblParts[2 + i * 2] ?? '')
									if (!isNaN(id)) presets.push({ id, name: name || `Preset ${id}` })
								}
								if (JSON.stringify(presets) !== JSON.stringify(this.basicPresets)) {
									this.basicPresets = presets
									this.scheduleRebuild()
								}
								break
							}

							case 'RLC': {
								const count = parseInt(msg.slice(2))
								if (!isNaN(count)) {
									this.variableValues['layer_count'] = count
									this.setVariableValues({ layer_count: count })
									if (count !== this._lastLayerCount) {
										this._lastLayerCount = count
										// (Re)define one source variable per layer (display number = id - 1)
										this.variableDefs = this.variableDefs.filter(
											(d) => !/^layer_\d+_source$/.test(d.variableId)
										)
										for (let n = 1; n <= count; n++) {
											this.variableDefs.push({ name: `Layer ${n} Source`, variableId: `layer_${n}_source` })
										}
										this.setVariableDefinitions(this.variableDefs)
										this.scheduleRebuild()
										for (let i = 2; i < count + 2; i++) {
											await this.cueCmd(`RLK ${i}`)
											await this.cueCmd(`RLS ${i}`)
										}
									}
								}
								break
							}

							case 'RSF': {
								const frIds = ['60fps', 'NTSC', 'PAL', '48fps', '30fps', '29.97fps', '25fps', '24fps', '23.98fps']
								const frRateHz = [60, 29.97, 25, 48, 30, 29.97, 25, 24, 23.98]
								const frId = parseInt(msg.slice(2))
								const frName = frIds[frId] ?? String(frId)
								this.frameRateHz = frRateHz[frId] ?? 60
								this.setVariableValues({ system_framerate: frName })
								break
							}

							case 'RAS': {
								// Response: 0 <count> [<SourceName> <Bus>]...
								// Bus: 0=PVW, 1=PGM, 2=Both
								const parts = msg.slice(2).trim().split(' ')
								const count = parseInt(parts[0])
								const newSources = new Map()
								for (let i = 0; i < count; i++) {
									const srcName = decodeURIComponent(parts[1 + i * 2] ?? '')
									const bus = parseInt(parts[2 + i * 2] ?? '-1')
									if (srcName && bus >= 0) {
										newSources.set(srcName, bus)
									}
								}
								this.activeSources = newSources

								const pgm = []
								const pvw = []
								for (const [name, bus] of newSources) {
									if (bus === 1 || bus === 2) pgm.push(name)
									if (bus === 0 || bus === 2) pvw.push(name)
								}
								this.setVariableValues({
									active_pgm_sources: pgm.join(', '),
									active_pvw_sources: pvw.join(', '),
									active_pgm_count: pgm.length,
									active_pvw_count: pvw.length,
								})
								this.checkFeedbacks('source_on_pgm', 'source_on_pvw')
								break
							}

							case 'RPD': {
								// Response per entry (9 fields): <ID> <Name> <CurrentBg> <NextBg> <X> <Y> <Width> <Height> <RenewalGroupID>
								const rpdParts = msg.slice(2).trim().split(' ')
								const rpdCount = parseInt(rpdParts[0])
								const ps = []
								for (let i = 0; i < rpdCount; i++) {
									const base = 1 + i * 9
									const id   = parseInt(rpdParts[base] ?? '')
									const name = decodeURIComponent(rpdParts[base + 1] ?? '')
									const width  = parseInt(rpdParts[base + 6] ?? '')
									const height = parseInt(rpdParts[base + 7] ?? '')
									if (!isNaN(id)) ps.push({ id, name: name || `PixelSpace ${id}`, width, height })
								}
								if (JSON.stringify(ps) !== JSON.stringify(this.pixelspaces)) {
									this.pixelspaces = ps
									this.scheduleRebuild()
								}
								break
							}

							case 'RPM': {
								// Response per entry (3 fields): <ProgramID> <PreviewID> <PreviewScaleRatio>
								const rpmParts = msg.slice(2).trim().split(' ')
								const rpmCount = parseInt(rpmParts[0])
								const pairs = []
								for (let i = 0; i < rpmCount; i++) {
									const base  = 1 + i * 3
									const pgmId = parseInt(rpmParts[base] ?? '')
									const pvwId = parseInt(rpmParts[base + 1] ?? '')
									if (!isNaN(pgmId) && !isNaN(pvwId)) pairs.push({ pgmId, pvwId })
								}
								if (JSON.stringify(pairs) !== JSON.stringify(this.psPairs)) {
									this.psPairs = pairs
									this.setVariableValues({ dbg_ps_pairs: JSON.stringify(pairs) })
									this.scheduleRebuild()
								}
								break
							}

							case 'RLK': {
								// Response fields (0-indexed after result code):
								// 31 = PixelspaceID, 32 = Transparency
								// Skip during active transition to avoid overwriting optimistic layerPS state
								if (this._transitionUntil && Date.now() < this._transitionUntil) break
								const rlkVals = msg.slice(2).trim().split(' ')
								const rlkLayerId = parseInt(cmds[1])
								if (!isNaN(rlkLayerId) && rlkVals.length >= 32) {
									const psId = parseInt(rlkVals[31])
									// Field 32 distinguishes an active/on-bus layer (255) from a
									// parked/off layer (0). An "off" layer parks back on the program
									// pixelspace, so pixelspace alone can't tell PGM from off.
									const onBus = parseInt(rlkVals[32]) === 255
									// Keyframe signature = all geometry fields except pixelspace (31)
									// and transparency (32), which legitimately differ between a
									// layer's pgm and pvw instances. Used to detect identical layers.
									this.layerKF[rlkLayerId] = rlkVals.filter((_, i) => i !== 31 && i !== 32).join(' ')
									if (!isNaN(psId)) {
										this.layerPS[rlkLayerId] = psId
										this.layerVis[rlkLayerId] = onBus
										this.setVariableValues({ dbg_layer_ps: JSON.stringify(this.layerPS) })
										// Diagnostic: pairs + every known layer's pixelspace, on-bus flag, source and keyframe
										const pairsStr = (this.psPairs || []).map((p) => `pgm${p.pgmId}/pvw${p.pvwId}`).join(' ')
										const kfDump = Object.keys(this.layerKF)
											.sort((a, b) => a - b)
											.map((l) => `L${l}(ps${this.layerPS[l]},${this.layerVis[l] ? 'ON' : 'off'}) src="${this.layerSource[l] ?? ''}" kf=[${this.layerKF[l]}]`)
											.join('  ||  ')
										this.setVariableValues({ dbg_layer_kf: `PAIRS[${pairsStr}]  ||  ${kfDump}` })
										this.checkFeedbacks('layer_on_bus', 'source_on_layer')
									}
								}
								break
							}

							case 'RLS': {
								// Response: <Source Name> <Source Register ID>
								// (empty result if no source assigned — handled by case '0' only firing on success)
								const rlsLayerId = parseInt(cmds[1])
								if (!isNaN(rlsLayerId)) {
									const rlsVals = msg.slice(2).trim().split(' ')
									const srcName = decodeURIComponent(rlsVals[0] ?? '')
									if (this.layerSource[rlsLayerId] !== srcName) {
										this.layerSource[rlsLayerId] = srcName
										// Variable keyed by display layer number (internal id - 1)
										this.setVariableValues({ [`layer_${rlsLayerId - 1}_source`]: srcName })
										this.checkFeedbacks('source_on_layer')
									}
								}
								break
							}

							case 'RRL': {
								switch (cmds[1]) {
									case '4': {
										let r = msg.slice(2).split(' ')
										let c = r.shift()
										for (let i = 0; i < c; i++) {
											let id = parseInt(r[i * 2])
											let name = decodeURIComponent(r[i * 2 + 1])
											let rr = this.reg[id]
											if (rr === undefined) {
												rr = { id, active: false, scriptId: null }
												this.variableDefs.push({ name: `Register ${id + 1} name`, variableId: `r_name_${id + 1}` })
												newReg = true
											}
											if (rr.name != name) {
												rr.name = decodeURIComponent(r[i * 2 + 1])
												this.variableValues[`r_name_${id + 1}`] = name
												newNames = true
											}
											this.reg[r[i * 2]] = rr
										}

										for (let s in this.reg) {
											await this.cueCmd(`RRD 4 ${this.reg[s].id}`)
											await this.cueCmd(`SCR ${this.reg[s].id} R`)
											if (this.reg[s].scriptId) {
												await this.cueCmd(`SCR ${this.reg[s].scriptId} S`)
											}
										}
										break
									}

									case '6': {
										// Source list: 0 <count> [<id> <name>]...
										const r6 = msg.slice(2).split(' ')
										const c6 = parseInt(r6.shift())
										const sources = []
										for (let i = 0; i < c6; i++) {
											const id = parseInt(r6[i * 2])
											const name = decodeURIComponent(r6[i * 2 + 1] ?? '')
											if (!isNaN(id) && name) sources.push({ id, name })
										}
										if (JSON.stringify(sources) !== JSON.stringify(this.sources)) {
											this.sources = sources
											this.scheduleRebuild()
										}
										break
									}

									case '5': {
										// Treatment list: 0 <count> [<id> <name>]...
										const r5 = msg.slice(2).split(' ')
										const c5 = parseInt(r5.shift())
										const treatments = []
										for (let i = 0; i < c5; i++) {
											const id = parseInt(r5[i * 2])
											const name = decodeURIComponent(r5[i * 2 + 1] ?? '')
											if (!isNaN(id) && name) treatments.push({ id, name })
										}
										if (JSON.stringify(treatments) !== JSON.stringify(this.treatments)) {
											this.treatments = treatments
											this.scheduleRebuild()
										}
										break
									}
								}
								break
							}

							case 'SCR': {
								let nv = !!(msg.split(' ')[1] == 1)
								let rr = cmds[2] == 'R' ? cmds[1] : this.script2reg[cmds[1]]
								if (rr !== undefined && this.reg[rr] !== undefined && nv != this.reg[rr].active) {
									this.reg[rr].active = nv
									this.checkFeedbacks('inp_ok')
								}
								break
							}

							case 'RRD': {
								const val = msg.split(' ')
								if (val.length != 4 || cmds[2] == 'NaN') {
									return
								}
								let id = parseInt(val[1])
								this.reg[cmds[2]].scriptId = id
								this.reg[cmds[2]].relative = !!val[2]
								this.reg[cmds[2]].numCues = val[3]
								if (!this.script2reg[val[1]]) {
									this.variableDefs.push({ name: `Script ${id} name`, variableId: `s_name_${id}` })
									this.variableValues[`s_name_${id}`] = this.reg[cmds[2]].name
									this.script2reg[val[1]] = cmds[2]
									newReg = true
									newNames = true
								}
								// Fetch cue names for this script (only if we haven't loaded them yet)
								if (id && !isNaN(id) && !this.scriptCues[id]) {
									await this.cueCmd(`RSCC ${id}`)
								}
								break
							}

							case 'RSCC': {
								// Response: <Result Code> <CueCount>
								// cmds[1] = scriptId
								const scriptId = parseInt(cmds[1])
								const cueCount = parseInt(msg.slice(2).trim())
								if (!isNaN(scriptId) && !isNaN(cueCount) && cueCount > 0) {
									// Initialise placeholder array so we can fill by index
									this.scriptCues[scriptId] = Array.from({ length: cueCount }, (_, i) => ({ index: i, name: `Cue ${i + 1}` }))
									// Queue one RSCD per cue to get the actual name
									for (let ci = 0; ci < cueCount; ci++) {
										await this.cueCmd(`RSCD ${scriptId} ${ci}`)
									}
								}
								break
							}

							case 'RSCD': {
								// Response: <Result Code> <Name> <JumpType> <JumpCue> <TriggerType> ...
								// cmds[1] = scriptId, cmds[2] = cueIndex
								const sdScriptId = parseInt(cmds[1])
								const sdCueIdx   = parseInt(cmds[2])
								const sdParts    = msg.slice(2).trim().split(' ')
								const sdName     = decodeURIComponent(sdParts[0] ?? '')
								if (!isNaN(sdScriptId) && !isNaN(sdCueIdx) && this.scriptCues[sdScriptId]) {
									this.scriptCues[sdScriptId][sdCueIdx] = { index: sdCueIdx, name: sdName || `Cue ${sdCueIdx + 1}` }
									// Once the last cue arrives, rebuild so the RSC dropdown updates
									const allLoaded = this.scriptCues[sdScriptId].every((c) => c !== undefined)
									if (allLoaded) this.scheduleRebuild()
								}
								break
							}
						}

						if (newReg) {
							this.setVariableDefinitions(this.variableDefs)
						}
						if (newNames) {
							this.setVariableValues(this.variableValues)
							this.variableValues = {}
						}
						break
					}
				}

				if (this.nextCmd.length) {
					await this.cueCmd(this.nextCmd.shift())
				}
			})

			this.udp.on('listening', async () => {
				this.updateStatus(InstanceStatus.Ok, 'UDP Listening')
				await this.cueCmd('RLC')
				await this.cueCmd('RSF')
				await this.cueCmd('RBL')
				await this.cueCmd('RPD')
				await this.cueCmd('RPM')
				await this.cueCmd('RRL 6 -1')
				await this.cueCmd('RRL 5 -1')
				this.reg = {}
				this.script2reg = {}
				this.scriptCues = {}
				this.variableDefs = [
					{ name: 'Active PGM Sources', variableId: 'active_pgm_sources' },
					{ name: 'Active PVW Sources', variableId: 'active_pvw_sources' },
					{ name: 'Active PGM Source Count', variableId: 'active_pgm_count' },
					{ name: 'Active PVW Source Count', variableId: 'active_pvw_count' },
					{ name: 'Layer Count', variableId: 'layer_count' },
					{ name: 'System Frame Rate', variableId: 'system_framerate' },
					{ name: '[DEBUG] Layer→PixelSpace map', variableId: 'dbg_layer_ps' },
					{ name: '[DEBUG] PGM/PVW pairs', variableId: 'dbg_ps_pairs' },
					{ name: '[DEBUG] On-bus layer source+keyframe', variableId: 'dbg_layer_kf' },
				]
				this.variableValues = {}
				this.poll()
				const interval = this.config.polling ? (parseInt(this.config.polling_rate) || 1000) : 5000
				this.pollTimer = setInterval(async () => await this.poll(), interval)
			})
		}
	}

	async poll() {
		if (this.nextCmd.length) {
			if (!this.pending.length) {
				await this.cueCmd(this.nextCmd.shift())
				this.saveLast = this.lastCmd
				this.lastCount = 0
			} else {
				if (this.saveLast == this.lastCmd) {
					if (this.lastCount++ >= 2) {
						this.pending.shift()
						await this.sendCmd(this.saveLast)
						this.lastCount = 0
					}
				} else {
					this.saveLast = this.lastCmd
					this.lastCount = 0
				}
			}
		} else {
			// Regular poll: register list + active sources (if polling enabled)
			this.pollCount = (this.pollCount || 0) + 1
			await this.cueCmd('RRL 4 -1')
			if (this.config.polling) {
				await this.cueCmd('RAS')
			}
			// Every poll: refresh layer→pixelspace assignments and the source
			// loaded on each layer so layer_on_bus / source_on_layer feedbacks
			// and per-layer source variables track the device promptly.
			if (this.config.polling) {
				const lc = this._lastLayerCount || 0
				for (let i = 2; i < lc + 2; i++) {
					await this.cueCmd(`RLK ${i}`)
					await this.cueCmd(`RLS ${i}`)
				}
			}
			// Every 60 polls: refresh dynamic pixelspace / source data
			if (this.pollCount % 60 === 0) {
				await this.cueCmd('RBL')
				await this.cueCmd('RPD')
				await this.cueCmd('RPM')
				await this.cueCmd('RRL 6 -1')
				await this.cueCmd('RRL 5 -1')
			}
			this.lastCount = 0
			this.saveLast = 'RRL 4 -1'
		}
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 6,
				regex: Regex.IP,
			},
			{
				type: 'checkbox',
				id: 'polling',
				label: 'Enable Polling feedbacks?',
				width: 4,
				default: true,
			},
			{
				type: 'dropdown',
				id: 'polling_rate',
				label: 'Polling Rate',
				width: 6,
				default: '1000',
				isVisible: (config) => config.polling === true,
				choices: [
					{ id: '50',    label: '50ms   – very fast (network-intensive)' },
					{ id: '100',   label: '100ms' },
					{ id: '200',   label: '200ms' },
					{ id: '500',   label: '500ms' },
					{ id: '1000',  label: '1s     – recommended' },
					{ id: '2000',  label: '2s' },
					{ id: '5000',  label: '5s' },
					{ id: '10000', label: '10s' },
					{ id: '15000', label: '15s' },
					{ id: '20000', label: '20s' },
				],
			},
		]
	}
}

runEntrypoint(SpyderInstance, Upgradereg)
