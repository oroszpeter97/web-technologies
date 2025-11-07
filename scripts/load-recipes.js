document.addEventListener('DOMContentLoaded', () => {
	// Wait until the DOM is fully loaded before querying elements or rendering content.
	async function loadRecipes() {
		const container = document.getElementById('recipes-list');
		if (!container) return; // Nothing to do if the container is missing.

		try {
			// Fetch the recipes JSON.
			const res = await fetch('data/recipes.json', { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to load recipes: ${res.status}`);
			const recipes = await res.json();

			container.innerHTML = ''; // Clear any placeholder content.

			recipes.forEach(recipe => {
				const article = document.createElement('article');

				const hdr = document.createElement('header');
				const h2 = document.createElement('h2');
				// Show recipe name or a sensible fallback.
				h2.textContent = recipe.name || 'Untitled';
				hdr.appendChild(h2);

				// Add creation-date if provided (expect YYYY-MM-DD).
				const cdate = recipe['creation-date'];
				if (typeof cdate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(cdate)) {
					const time = document.createElement('time');
					time.className = 'creation-date';
					time.dateTime = cdate;
					// Append a time portion to avoid timezone shifts when constructing Date.
					const dt = new Date(cdate + 'T00:00:00');
					// Use the user's locale for display.
					time.textContent = `Created: ${dt.toLocaleDateString()}`;
					hdr.appendChild(time);
				}

				article.appendChild(hdr);

				// Render the ingredients section if present.
				if (Array.isArray(recipe.ingredients)) {
					const secIng = document.createElement('section');
					const h3 = document.createElement('h3');
					h3.textContent = 'Ingredients';
					const ul = document.createElement('ul');
					recipe.ingredients.forEach(i => {
						const li = document.createElement('li');
						li.textContent = i;
						ul.appendChild(li);
					});
					secIng.appendChild(h3);
					secIng.appendChild(ul);
					article.appendChild(secIng);
				}

				// Render ordered instructions if present.
				if (Array.isArray(recipe.instructions)) {
					const secInst = document.createElement('section');
					const h3 = document.createElement('h3');
					h3.textContent = 'Instructions';
					const ol = document.createElement('ol');
					recipe.instructions.forEach(step => {
						const li = document.createElement('li');
						li.textContent = step;
						ol.appendChild(li);
					});
					secInst.appendChild(h3);
					secInst.appendChild(ol);
					article.appendChild(secInst);
				}

				// Append notes in the footer if any.
				if (Array.isArray(recipe.notes) && recipe.notes.length) {
					const ftr = document.createElement('footer');
					const p = document.createElement('p');
					// Join notes with a middle dot for compact display.
					p.textContent = recipe.notes.join(' · ');
					ftr.appendChild(p);
					article.appendChild(ftr);
				}

				container.appendChild(article); // Add the built article to the list.
			});
		} catch (err) {
			// Inform the user and log detailed error for debugging.
			container.innerHTML = `<p style="color:crimson">Could not load recipes. ${err.message}</p>`;
			console.error(err);
		}
	}

	loadRecipes(); // Kick off loading after DOM is ready.
});
