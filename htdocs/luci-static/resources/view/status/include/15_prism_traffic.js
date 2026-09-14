'use strict';
'require baseclass';
'require rpc';
'require network';
'require poll';

/*
 * Prism · realtime traffic card for Status → Overview.
 *
 * Reads luci-bwc history, the same source as Status → Realtime Graphs:
 * one row per second, [ timestamp, rx_bytes, rx_packets, tx_bytes, tx_packets ].
 *
 * The overview re-runs load()/render() on every poll cycle and swaps the
 * section content, so the card is built once and the same node is returned;
 * the chart itself ticks every second.
 */

const callRealtimeStats = rpc.declare({
	object: 'luci',
	method: 'getRealtimeStats',
	params: [ 'mode', 'device' ],
	expect: { result: [] }
});

const SPAN = 120;          /* seconds on screen */
const W = 800, H = 220;    /* svg user units */
const TOP = 12;            /* headroom above the scale maximum */
const STORE = 'prism-traffic-device';
const SVGNS = 'http://www.w3.org/2000/svg';
const UNITS = [ 'bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s', 'Tbit/s' ];

function formatRate(bytesPerSec) {
	let v = Math.max(0, bytesPerSec || 0) * 8, u = 0;

	while (v >= 1000 && u < UNITS.length - 1) {
		v /= 1000;
		u++;
	}

	return `${u ? v.toFixed(v < 10 ? 2 : (v < 100 ? 1 : 0)) : Math.round(v)} ${UNITS[u]}`;
}

/* round up to 1 / 2 / 2.5 / 5 × 10^n bits so the scale labels stay readable */
function niceScale(bytesPerSec) {
	const bits = Math.max(bytesPerSec * 8 * 1.1, 8000);
	const p = Math.pow(10, Math.floor(Math.log10(bits)));
	const m = [ 1, 2, 2.5, 5, 10 ].find((m) => bits <= m * p);

	return m * p / 8;
}

function svg(name, attrs, children) {
	const el = document.createElementNS(SVGNS, name);

	for (const k in attrs)
		el.setAttribute(k, attrs[k]);

	for (const c of (children || []))
		el.appendChild(c);

	return el;
}

const yOf = (f) => H - f * (H - TOP);

return baseclass.extend({
	title: _('Realtime Traffic'),

	isPrism() {
		return /\/prism\/?$/.test(L.env.media || '');
	},

	load() {
		if (this.root || !this.isPrism())
			return Promise.resolve(null);

		return Promise.all([
			L.resolveDefault(network.getWANNetworks(), []),
			L.resolveDefault(network.getWAN6Networks(), []),
			L.resolveDefault(network.getDevices(), [])
		]);
	},

	render(data) {
		if (!this.isPrism())
			return null;

		if (!this.root)
			this.build(data || [ [], [], [] ]);

		return this.root;
	},

	build([ wan4, wan6, devices ]) {
		const names = [];
		const add = (name) => { if (name && !names.includes(name)) names.push(name); };

		for (const net of [ ...wan4, ...wan6 ])
			add(net.getL3Device?.()?.getName());

		const wanNames = names.slice();

		for (const dev of devices)
			if (dev.getName() != 'lo' && dev.isUp?.() && !dev.isBridgePort?.())
				add(dev.getName());

		let saved = null;
		try { saved = localStorage.getItem(STORE); } catch (e) {}

		this.devices = names.slice(0, 8);
		this.dev = this.devices.includes(saved) ? saved : this.devices[0];

		/* LuCI's dom.append turns null children into "null" text, so build child lists explicitly */
		this.chips = this.devices.map((name) => {
			const label = [ name ];

			if (wanNames.includes(name))
				label.push(E('small', {}, [ 'WAN' ]));

			return E('button', { 'type': 'button', 'class': 'prism-chip', 'click': () => this.select(name) }, label);
		});

		const gradient = (id, color, opacity) => svg('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
			svg('stop', { 'offset': 0, 'stop-color': color, 'stop-opacity': opacity }),
			svg('stop', { 'offset': 1, 'stop-color': color, 'stop-opacity': 0 })
		]);

		const lineAttrs = (color) => ({
			'fill': 'none',
			'stroke': color,
			'stroke-width': 2.2,
			'stroke-linejoin': 'round',
			'vector-effect': 'non-scaling-stroke',
			'filter': 'url(#prism-tr-glow)'
		});

		const el = this.el = {
			rxArea: svg('path', { fill: 'url(#prism-tr-rx)' }),
			txArea: svg('path', { fill: 'url(#prism-tr-tx)' }),
			rxLine: svg('path', lineAttrs('#22d3ee')),
			txLine: svg('path', lineAttrs('#f472b6')),
			scaleTop: E('span', { 'class': 'prism-traffic-lbl', 'style': `top:${(yOf(1) / H * 100).toFixed(2)}%` }, [ '-' ]),
			scaleMid: E('span', { 'class': 'prism-traffic-lbl', 'style': `top:${(yOf(.5) / H * 100).toFixed(2)}%` }, [ '-' ]),
			wait: E('div', { 'class': 'prism-traffic-wait' }, [
				this.dev ? _('Collecting data...') : _('No information available')
			])
		};

		for (const k of [ 'rx', 'tx' ])
			for (const s of [ 'Cur', 'Avg', 'Peak' ])
				el[k + s] = E(s == 'Cur' ? 'div' : 'b', { 'class': s == 'Cur' ? 'v' : '' }, [ '-' ]);

		const plot = svg('svg', { 'viewBox': `0 0 ${W} ${H}`, 'preserveAspectRatio': 'none', 'aria-hidden': 'true' }, [
			svg('defs', {}, [
				gradient('prism-tr-rx', '#22d3ee', .5),
				gradient('prism-tr-tx', '#f472b6', .4),
				svg('filter', { id: 'prism-tr-glow', x: '-5%', y: '-30%', width: '110%', height: '160%' }, [
					svg('feGaussianBlur', { stdDeviation: 3, result: 'b' }),
					svg('feMerge', {}, [ svg('feMergeNode', { in: 'b' }), svg('feMergeNode', { in: 'SourceGraphic' }) ])
				])
			]),
			...[ 1, .75, .5, .25 ].map((f) => svg('line', {
				'x1': 0, 'x2': W, 'y1': yOf(f), 'y2': yOf(f),
				'class': f == 1 ? 'grid max' : 'grid',
				'vector-effect': 'non-scaling-stroke'
			})),
			el.rxArea, el.txArea, el.rxLine, el.txLine
		]);

		const stat = (cls, label, k) => E('div', { 'class': 'prism-traffic-stat ' + cls }, [
			E('div', { 'class': 'k' }, [ label ]),
			el[k + 'Cur'],
			E('div', { 'class': 'sub' }, [
				E('span', {}, [ _('Average:'), ' ', el[k + 'Avg'] ]),
				E('span', {}, [ _('Peak:'), ' ', el[k + 'Peak'] ])
			])
		]);

		this.root = E('div', { 'class': 'prism-traffic' }, [
			E('div', { 'class': 'prism-traffic-devs' }, this.chips),
			E('div', { 'class': 'prism-traffic-plot' }, [ plot, el.scaleTop, el.scaleMid, el.wait ]),
			E('div', { 'class': 'prism-traffic-axis' }, [ E('span', {}, [ '-2:00' ]), E('span', {}, [ '-1:00' ]), E('span', {}, [ '0:00' ]) ]),
			E('div', { 'class': 'prism-traffic-stats' }, [
				stat('rx', _('Inbound:'), 'rx'),
				stat('tx', _('Outbound:'), 'tx')
			])
		]);

		this.busy = false;
		this.reset();
		window.setInterval(() => this.tick(), 1000);
	},

	select(name) {
		this.dev = name;
		try { localStorage.setItem(STORE, name); } catch (e) {}
		this.reset();
		this.tick();
	},

	reset() {
		this.rx = [];
		this.tx = [];
		this.lastTs = 0;
		this.chips.forEach((chip, i) => chip.classList.toggle('active', this.devices[i] == this.dev));
		this.draw();
	},

	tick() {
		/* skip while detached, collapsed via "Hide", in a background tab, or with auto-refresh paused */
		if (this.busy || !this.dev || document.hidden || !this.root.isConnected || !this.root.offsetParent)
			return;

		if (poll.active && !poll.active())
			return;

		const dev = this.dev;

		this.busy = true;
		callRealtimeStats('interface', dev).then((rows) => {
			if (dev == this.dev)
				this.ingest(rows);
		}).catch(() => {}).finally(() => {
			this.busy = false;
		});
	},

	ingest(rows) {
		if (!Array.isArray(rows) || !rows.length)
			return;

		for (let i = 1; i < rows.length; i++) {
			const prev = rows[i - 1], cur = rows[i], dt = cur[0] - prev[0];

			if (cur[0] <= this.lastTs || dt <= 0)
				continue;

			/* luci-bwc only samples while someone watches; spread a gap's byte delta evenly.
			   Negative deltas mean the counters were reset (interface restart). */
			const rx = Math.max(0, cur[1] - prev[1]) / dt;
			const tx = Math.max(0, cur[3] - prev[3]) / dt;

			for (let n = Math.min(dt, SPAN); n > 0; n--) {
				this.rx.push(rx);
				this.tx.push(tx);
			}
		}

		this.lastTs = Math.max(this.lastTs, rows[rows.length - 1][0]);

		if (this.rx.length > SPAN) {
			this.rx.splice(0, this.rx.length - SPAN);
			this.tx.splice(0, this.tx.length - SPAN);
		}

		this.draw();
	},

	draw() {
		const el = this.el, n = this.rx.length;
		const scale = niceScale(Math.max(0, ...this.rx, ...this.tx));
		const x0 = ((SPAN - n) / (SPAN - 1) * W).toFixed(1);

		/* newest sample sits on the right edge */
		const line = (arr) => arr.map((v, i) =>
			`${i ? 'L' : 'M'}${((SPAN - n + i) / (SPAN - 1) * W).toFixed(1)},${yOf(Math.min(v / scale, 1)).toFixed(1)}`).join('');

		for (const [ k, arr ] of [ [ 'rx', this.rx ], [ 'tx', this.tx ] ]) {
			const d = n > 1 ? line(arr) : '';

			el[k + 'Line'].setAttribute('d', d);
			el[k + 'Area'].setAttribute('d', d ? `${d}L${W},${H}L${x0},${H}Z` : '');

			el[k + 'Cur'].textContent = n ? formatRate(arr[n - 1]) : '-';
			el[k + 'Avg'].textContent = n ? formatRate(arr.reduce((a, b) => a + b, 0) / n) : '-';
			el[k + 'Peak'].textContent = n ? formatRate(Math.max(...arr)) : '-';
		}

		el.scaleTop.textContent = formatRate(scale);
		el.scaleMid.textContent = formatRate(scale / 2);
		el.wait.hidden = n > 1;
	}
});
