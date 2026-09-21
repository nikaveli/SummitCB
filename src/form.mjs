import { escapeHtml as e } from './html.mjs';
import { paths } from './config.mjs';
import { services } from './content/services.mjs';
import { cities } from './content/cities.mjs';
export function renderForm(values={}, errors={}) {
  const value=k=>e(values[k] || '');
  const error=k=>errors[k] ? `<span class="field-error" id="${k}-error">${e(errors[k])}</span>` : '';
  const attrs=k=>errors[k] ? ` aria-invalid="true" aria-describedby="${k}-error"` : '';
  const options=(items,key)=>`<option value="">Choose one</option>${items.map(([v,label])=>`<option value="${e(v)}"${values[key]===v?' selected':''}>${e(label)}</option>`).join('')}`;
  return `<form action="/api/inquiries" method="post" id="consultation-form">
    <div class="form-status" role="status" aria-live="polite" tabindex="-1">${Object.keys(errors).length ? 'Please check the highlighted fields.' : ''}</div>
    <div class="form-grid">
      <label for="name">Your name <span>(required)</span><input id="name" name="name" autocomplete="name" required maxlength="100" value="${value('name')}"${attrs('name')}>${error('name')}</label>
      <label for="email">Email <span>(required)</span><input id="email" name="email" type="email" autocomplete="email" required maxlength="254" value="${value('email')}"${attrs('email')}>${error('email')}</label>
      <label for="phone">Phone <span>(optional)</span><input id="phone" name="phone" type="tel" autocomplete="tel" maxlength="32" value="${value('phone')}"${attrs('phone')}>${error('phone')}</label>
      <label for="city">Project city <span>(required)</span><select id="city" name="city" required${attrs('city')}>${options([...cities.map(c=>[c.id,c.name]),['unsure','Not sure about jurisdiction']], 'city')}</select>${error('city')}</label>
      <label for="service">Project type <span>(required)</span><select id="service" name="service" required${attrs('service')}>${options([...services.map(s=>[s.id,s.name]),['unsure','Help me choose']], 'service')}</select>${error('service')}</label>
      <label for="timing">Timing <span>(optional)</span><input id="timing" name="timing" maxlength="150" placeholder="Exploring, this year, or a specific goal" value="${value('timing')}"${attrs('timing')}>${error('timing')}</label>
    </div>
    <label for="message">What would you like to build or change? <span>(required)</span><textarea id="message" name="message" rows="5" minlength="20" maxlength="5000" required placeholder="Tell us who the space should serve, whether you are considering an addition or ADU, and your priorities."${attrs('message')}>${value('message')}</textarea>${error('message')}</label>
    <div class="honeypot" aria-hidden="true"><label for="website">Leave this field empty<input id="website" name="website" tabindex="-1" autocomplete="off"></label></div>
    <input type="hidden" name="landingPath" value="${value('landingPath') || paths.contact}">
    <input type="hidden" name="referringHost" value="${value('referringHost')}">
    <p class="form-note">By sending this form, you agree that Summit may contact you about your project. Read our <a href="${paths.privacy}">privacy policy</a>. Please do not include sensitive medical or financial information.</p>
    <button class="button" type="submit">Discuss your project <span aria-hidden="true">↗</span></button>
    <p class="form-note">Prefer a conversation? Call <a href="tel:+17204311056">720-431-1056</a>.</p>
  </form>`;
}
