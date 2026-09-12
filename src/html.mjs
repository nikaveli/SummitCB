export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const jsonScript = value => JSON.stringify(value).replace(/</g,'\\u003c');
export const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const link = (path,label,cls='') => `<a href="${escapeHtml(path)}"${cls ? ` class="${escapeHtml(cls)}"` : ''}>${escapeHtml(label)}</a>`;
export const paragraphs = items => items.map(p=>`<p>${escapeHtml(p)}</p>`).join('');
export const sections = items => items.map(([heading,...text])=>`<section class="prose-section" id="${slug(heading)}"><h2>${escapeHtml(heading)}</h2>${paragraphs(text)}</section>`).join('');
export const list = items => `<ul>${items.map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul>`;
