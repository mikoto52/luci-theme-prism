'use strict';
'require baseclass';
'require ui';

/*
 * Prism menu renderer: vertical accordion sidebar, mode switcher,
 * pill tab menu, live clock, pointer-tracked card glow.
 */

const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

const ICONS = {
	status:     svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
	system:     svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
	services:   svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
	network:    svg('<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4M5 16v-4h14v4"/>'),
	vpn:        svg('<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'),
	nas:        svg('<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'),
	statistics: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>'),
	docker:     svg('<path d="M21 12c-1-.7-2.4-.8-3.5-.4-.2-1.2-.9-2.2-1.9-2.8l-.4-.3-.3.4c-.6.8-.8 2.1-.6 3.1H2c-.2 2 .3 4 1.6 5.5C5 19 7 20 10 20c5 0 8.6-2.4 10.3-7.2.9 0 1.9-.3 2.4-1z"/><path d="M5 11V8h3v3M8 11V8h3v3M11 11V8h3v3M8 8V5h3v3"/>'),
	modem:      svg('<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>'),
	logout:     svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
	_default:   svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')
};

return baseclass.extend({
	__init__() {
		ui.menu.load().then(L.bind(this.render, this));
		this.initChrome();
	},

	render(tree) {
		let node = tree;
		let url = '';

		this.renderModeMenu(tree);

		if (L.env.dispatchpath.length >= 3) {
			for (let i = 0; i < 3 && node; i++) {
				node = node.children[L.env.dispatchpath[i]];
				url = url + (url ? '/' : '') + L.env.dispatchpath[i];
			}

			if (node)
				this.renderTabMenu(node, url);
		}
	},

	renderTabMenu(tree, url, level) {
		const container = document.querySelector('#tabmenu');
		const ul = E('ul', { 'class': 'tabs' });
		const children = ui.menu.getChildren(tree);
		let activeNode = null;

		children.forEach((child) => {
			const isActive = (L.env.dispatchpath[3 + (level || 0)] == child.name);

			ul.appendChild(E('li', { 'class': 'tabmenu-item-%s%s'.format(child.name, isActive ? ' active' : '') }, [
				E('a', { 'href': L.url(url, child.name) }, [ _(child.title) ])
			]));

			if (isActive)
				activeNode = child;
		});

		if (ul.children.length == 0)
			return E([]);

		container.appendChild(ul);
		container.style.display = '';

		if (activeNode)
			this.renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

		return ul;
	},

	renderMainMenu(tree, url) {
		const ul = document.querySelector('#topmenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, i) => {
			const subs = ui.menu.getChildren(child);
			const isActive = (L.env.dispatchpath[1] == child.name);
			const icon = E('span', { 'class': 'ico' });
			icon.innerHTML = ICONS[child.name] || ICONS._default;

			if (!subs.length) {
				ul.appendChild(E('li', { 'class': 'nav-group leaf' + (isActive ? ' active' : ''), 'style': '--i:%d'.format(i) }, [
					E('a', { 'class': 'nav-head', 'href': L.url(url, child.name) }, [ icon, E('span', { 'class': 'nav-label' }, [ _(child.title) ]) ])
				]));
				return;
			}

			const sub = E('ul', { 'class': 'nav-sub' });

			subs.forEach((s) => {
				const on = isActive && (L.env.dispatchpath[2] == s.name);
				sub.appendChild(E('li', { 'class': on ? 'active' : null }, [
					E('a', { 'href': L.url(url, child.name, s.name) }, [ _(s.title) ])
				]));
			});

			const li = E('li', { 'class': 'nav-group' + (isActive ? ' active open' : ''), 'style': '--i:%d'.format(i) }, [
				E('a', {
					'class': 'nav-head',
					'href': '#',
					'click': (ev) => {
						ev.preventDefault();
						li.classList.toggle('open');
					}
				}, [ icon, E('span', { 'class': 'nav-label' }, [ _(child.title) ]), E('span', { 'class': 'chev' }) ]),
				E('div', { 'class': 'nav-sub-wrap' }, [ sub ])
			]);

			ul.appendChild(li);
		});

		ul.style.display = '';
	},

	renderModeMenu(tree) {
		const ul = document.querySelector('#modemenu');
		const children = ui.menu.getChildren(tree);

		children.forEach((child, index) => {
			const isActive = L.env.requestpath.length
				? child.name === L.env.requestpath[0]
				: index === 0;

			ul.appendChild(E('li', {}, [
				E('a', { 'href': L.url(child.name), 'class': isActive ? 'active' : null }, [ _(child.title) ])
			]));

			if (isActive)
				this.renderMainMenu(child, child.name);
		});

		if (ul.children.length > 1)
			ul.style.display = '';
	},

	initChrome() {
		const body = document.body;
		const toggle = document.getElementById('navtoggle');
		const scrim = document.getElementById('scrim');
		const clock = document.getElementById('clock');

		if (toggle)
			toggle.addEventListener('click', () => body.classList.toggle('nav-open'));

		if (scrim)
			scrim.addEventListener('click', () => body.classList.remove('nav-open'));

		if (clock) {
			const tick = () => {
				const d = new Date();
				clock.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
			};
			tick();
			window.setInterval(tick, 1000);
		}

		/* Spotlight glow that follows the pointer across glass cards */
		document.addEventListener('pointermove', (ev) => {
			const card = ev.target.closest && ev.target.closest('.cbi-section, .cbi-map > fieldset, .modal');
			if (!card) return;
			const r = card.getBoundingClientRect();
			card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
			card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
		}, { passive: true });

		/* Neon progress streak while navigating away */
		window.addEventListener('beforeunload', () => body.classList.add('is-leaving'));
	}
});
