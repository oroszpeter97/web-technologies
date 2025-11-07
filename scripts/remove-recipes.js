document.addEventListener('DOMContentLoaded', () => {
	// Run only after the DOM is ready so elements exist.
	const list = document.getElementById('remove-list');
	const note = document.getElementById('remove-note');
	if (!list) return; // Bail out if the expected list container is missing.

	// Build a small control bar above the list (Select all / Delete selected).
	const controls = document.createElement('div');
	controls.style.display = 'flex';
	controls.style.gap = '0.5rem';
	controls.style.marginBottom = '0.5rem';

	const btnDelete = document.createElement('button');
	btnDelete.type = 'button';
	btnDelete.className = 'toggle-btn';
	btnDelete.textContent = 'Delete selected';
	btnDelete.disabled = true; // Disabled until an item is selected.

	const btnSelectAll = document.createElement('button');
	btnSelectAll.type = 'button';
	btnSelectAll.className = 'toggle-btn';
	btnSelectAll.textContent = 'Select all';

	controls.appendChild(btnSelectAll);
	controls.appendChild(btnDelete);
	list.parentNode.insertBefore(controls, list);

	let currentRecipes = []; // Cache of loaded recipes to determine counts and indices.

	function updateControls() {
		// Enable/disable delete button and update select-all label based on selection.
		const selected = list.querySelectorAll('.recipe-item.selected').length;
		btnDelete.disabled = selected === 0;
		btnSelectAll.textContent = (selected === currentRecipes.length) ? 'Deselect all' : 'Select all';
		if (note) note.textContent = selected ? `${selected} selected` : 'Selected items are highlighted.';
	}

	function makeItem(recipe, index) {
		// Create a list item representing one recipe with a toggle button to mark selection.
		const li = document.createElement('li');
		li.className = 'recipe-item';
		li.dataset.index = index;

		const title = document.createElement('span');
		title.className = 'recipe-title';
		title.textContent = recipe.name || `Recipe ${index + 1}`;

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'toggle-btn';
		btn.setAttribute('aria-pressed', 'false');
		btn.title = 'Toggle selection';
		btn.textContent = 'Select';

		btn.addEventListener('click', () => {
			// Toggle selection state for this item and update UI accordingly.
			const pressed = btn.getAttribute('aria-pressed') === 'true';
			btn.setAttribute('aria-pressed', String(!pressed));
			btn.textContent = pressed ? 'Select' : 'Selected';
			li.classList.toggle('selected', !pressed);
			updateControls();
		});

		li.appendChild(title);
		li.appendChild(btn);
		return li;
	}

	async function load() {
		// Load recipes from the local JSON file and populate the list.
		list.innerHTML = '<li>Loading recipes…</li>';
		try {
			const res = await fetch('data/recipes.json', { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to load recipes (${res.status})`);
			const recipes = await res.json();
			currentRecipes = Array.isArray(recipes) ? recipes : [];
			list.innerHTML = '';
			if (!currentRecipes.length) {
				list.innerHTML = '<li>No recipes found.</li>';
				updateControls();
				return;
			}
			currentRecipes.forEach((r, i) => list.appendChild(makeItem(r, i)));
			updateControls();
		} catch (err) {
			// Show a user-friendly error in the list and log details to the console.
			list.innerHTML = `<li style="color:crimson">Could not load recipes. ${err.message}</li>`;
			console.error(err);
		}
	}

	// Toggle select/deselect all items.
	btnSelectAll.addEventListener('click', () => {
		const all = list.querySelectorAll('.recipe-item');
		const anyUnselected = Array.from(all).some(li => !li.classList.contains('selected'));
		all.forEach(li => {
			const btn = li.querySelector('.toggle-btn');
			const shouldSelect = anyUnselected;
			li.classList.toggle('selected', shouldSelect);
			if (btn) {
				btn.setAttribute('aria-pressed', String(shouldSelect));
				btn.textContent = shouldSelect ? 'Selected' : 'Select';
			}
		});
		updateControls();
	});

	// Delete selected recipes via the API.
	btnDelete.addEventListener('click', async () => {
		const selectedItems = Array.from(list.querySelectorAll('.recipe-item.selected'));
		if (!selectedItems.length) return;
		// Confirm destructive action with the user.
		const confirmed = window.confirm(`Are you sure you want to delete ${selectedItems.length} selected recipe(s)? This cannot be undone.`);
		if (!confirmed) return;

		const indices = selectedItems.map(li => Number(li.dataset.index)).filter(n => Number.isInteger(n));
		try {
			btnDelete.disabled = true;
			btnDelete.textContent = 'Deleting…';
			const res = await fetch('/api/recipes', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ indices })
			});
			if (!res.ok) {
				// Try to extract an error message from the response; fallback to status code.
				const txt = await res.text().catch(() => '');
				throw new Error(txt || `Server returned ${res.status}`);
			}
			const json = await res.json();
			await load(); // Refresh the list after deletion.
			if (note) note.textContent = `Deleted ${json.removed} recipe(s).`;
		} catch (err) {
			// Report error to the user and log full details.
			const msg = err.message || String(err);
			if (note) note.textContent = `Error deleting recipes: ${msg}`;
			console.error(err);
		} finally {
			// Restore button text and update controls regardless of outcome.
			btnDelete.textContent = 'Delete selected';
			updateControls();
		}
	});

	load(); // Initial load on page ready.
});
