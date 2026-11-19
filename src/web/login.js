const form = document.querySelector('#login-form');
const button = document.querySelector('#sign-in');
const message = document.querySelector('#login-message');
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  button.textContent = 'Signing in…';
  message.classList.remove('error');
  message.textContent = 'Checking your details…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.value, password: form.password.value }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'We could not sign you in. Please try again.');
    message.textContent = 'Signed in. Opening your calendar…';
    location.assign('/events');
  } catch (error) {
    message.classList.add('error');
    message.textContent = error.name === 'TypeError' || error.name === 'TimeoutError'
      ? 'We could not reach Club Calendar. Please try again.' : error.message;
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});
