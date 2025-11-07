document.addEventListener('DOMContentLoaded', () => {
	// Wait for the DOM so form elements are available.
	const form = document.getElementById('add-recipe-form');
	if (!form) return;

	// Element used to show errors or success messages for the form.
	const errorBox = document.getElementById('form-error');

	// Show an error message in the shared error box (red styling).
	function showError(message) {
		if (!errorBox) return;
		// Ensure the box has the error styling and is visible.
		errorBox.classList.remove('form-success');
		errorBox.classList.add('form-error');
		errorBox.textContent = message;
		errorBox.style.display = 'block';
		// Attempt to move focus for accessibility if supported.
		errorBox.focus?.();
	}

	// Show a success message in the same box (green styling).
	function showSuccess(message) {
		if (!errorBox) return;
		errorBox.classList.remove('form-error');
		errorBox.classList.add('form-success');
		errorBox.textContent = message;
		errorBox.style.display = 'block';
		errorBox.focus?.();
	}

	// Clear the message box and remove any status classes.
	function clearError() {
		if (!errorBox) return;
		errorBox.textContent = '';
		errorBox.style.display = 'none';
		errorBox.classList.remove('form-success', 'form-error');
	}

	// Small helpers to mark/unmark invalid inputs for visual feedback.
	function markInvalid(el) { el.classList.add('invalid'); }
	function clearInvalid(el) { el.classList.remove('invalid'); }

	// Convert a multi-line textarea into a trimmed array of non-empty lines.
	function linesToArray(text) {
		return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
	}

	form.addEventListener('submit', async (ev) => {
		// Prevent normal form submission; handle via fetch.
		ev.preventDefault();
		clearError();

		const title = form.querySelector('#title');
		const ingredients = form.querySelector('#ingredients');
		const instructions = form.querySelector('#instructions');
		const notes = form.querySelector('#notes');
		const cdate = form.querySelector('#creation-date'); // optional

		// Clear previous invalid markers before validating again.
		[title, ingredients, instructions, cdate].forEach(el => el && clearInvalid(el));

		const invalids = [];
		// Basic required-field checks with user-friendly messages.
		if (title && title.value.trim() === '') invalids.push({ el: title, msg: 'Please enter a recipe title.' });
		if (ingredients && ingredients.value.trim() === '') invalids.push({ el: ingredients, msg: 'Please list at least one ingredient.' });
		if (instructions && instructions.value.trim() === '') invalids.push({ el: instructions, msg: 'Please provide at least one instruction step.' });

		// Validate optional creation-date if provided (expect YYYY-MM-DD).
		if (cdate && cdate.value.trim() !== '') {
			const v = cdate.value.trim();
			if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
				invalids.push({ el: cdate, msg: 'Creation date must be in YYYY-MM-DD format.' });
			} else {
				// Construct date with a time portion to avoid timezone parsing issues.
				const dt = new Date(v + 'T00:00:00');
				if (Number.isNaN(dt.getTime())) {
					invalids.push({ el: cdate, msg: 'Creation date is not a valid date.' });
				}
			}
		}

		// If any validation failed, mark fields and show the first message.
		if (invalids.length) {
			invalids.forEach(i => markInvalid(i.el));
			showError(invalids[0].msg);
			invalids[0].el.focus();
			return;
		}

		// Build the recipe payload from form fields.
		const recipe = {
			name: title.value.trim(),
			ingredients: linesToArray(ingredients.value || ''),
			instructions: linesToArray(instructions.value || ''),
			notes: linesToArray(notes.value || '')
		};

		// Attach creation-date only when provided to keep payload minimal.
		if (cdate && cdate.value.trim() !== '') {
			recipe['creation-date'] = cdate.value.trim();
		}

		try {
			// Send the recipe to the server via POST JSON.
			const res = await fetch('/api/recipes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(recipe)
			});
			if (!res.ok) {
				const errText = await res.text().catch(() => '');
				// Provide clearer guidance when endpoint is missing
				if (res.status === 404) {
					throw new Error('API endpoint not found (404).');
				}
				throw new Error(errText || `Server returned ${res.status}`);
			}
			await res.json();

			// On success give green feedback, reset the form and navigate back to recipes.
			showSuccess('Recipe submitted successfully.');
			form.reset();
			[title, ingredients, instructions, notes, cdate].forEach(el => el && clearInvalid(el));
			// Small delay so user sees confirmation before redirect.
			setTimeout(() => { window.location.href = 'recipes.html'; }, 900);
		} catch (err) {
			// Handle network errors or server-side failures with a friendly message.
			const msg = err.message || String(err);
			if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
				showError('Network error: could not contact the server.');
			} else {
				showError(msg);
			}
			console.error(err);
		}
	});
});
