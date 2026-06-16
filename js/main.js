document.addEventListener('DOMContentLoaded', () => {
  // Setup handlers for waitlist forms
  const forms = [
    {
      input: document.getElementById('hero-email-input'),
      btn: document.getElementById('hero-submit-btn'),
      error: document.getElementById('hero-error-msg'),
      formContainer: document.getElementById('hero-form-container'),
      note: document.getElementById('hero-form-note'),
      success: document.getElementById('hero-success-msg')
    },
    {
      input: document.getElementById('bottom-email-input'),
      btn: document.getElementById('bottom-submit-btn'),
      error: document.getElementById('bottom-error-msg'),
      formContainer: document.getElementById('bottom-form-container'),
      note: document.getElementById('bottom-form-note'),
      success: document.getElementById('bottom-success-msg')
    }
  ];

  forms.forEach(form => {
    if (!form.btn || !form.input) return;

    const submit = async () => {
      const email = form.input.value.trim();
      
      // Hide previous error
      if (form.error) {
        form.error.style.display = 'none';
        form.error.textContent = '';
      }
      form.input.style.borderColor = '';

      // Validation
      if (!email) {
        showError(form, 'Email address is required.');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError(form, 'Please enter a valid email address.');
        return;
      }

      try {
        setLoading(form, true);
        const response = await fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Something went wrong. Please try again.');
        }

        // Handle success
        if (form.formContainer) form.formContainer.style.display = 'none';
        if (form.note) form.note.style.display = 'none';
        if (form.success) {
          if (data.message && data.message.includes('Already registered')) {
            form.success.innerHTML = `<strong>Already registered.</strong> We'll be in touch when your spot opens up.`;
          } else {
            if (form.success.id === 'hero-success-msg') {
              form.success.innerHTML = `<strong>You're in.</strong> We'll be in touch when your spot opens up.
                <span style="color: #5A5A5A; font-size: 12px; margin-top: 6px; display: block;">
                  Share with a friend to move up the list.
                </span>`;
            } else {
              form.success.innerHTML = `<strong>You're in.</strong> We'll be in touch when your spot opens up.`;
            }
          }
          form.success.style.display = 'block';
        }
      } catch (err) {
        showError(form, err.message);
      } finally {
        setLoading(form, false);
      }
    };

    // Click handler
    form.btn.addEventListener('click', submit);

    // Enter key handler
    form.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        submit();
      }
    });
  });
});

function showError(form, message) {
  if (form.input) form.input.style.borderColor = 'rgba(232,83,61,0.6)';
  if (form.error) {
    form.error.textContent = message;
    form.error.style.display = 'block';
  }
}

function setLoading(form, isLoading) {
  if (!form.btn) return;
  form.btn.disabled = isLoading;
  if (isLoading) {
    form.btn.textContent = 'Joining...';
    form.btn.style.opacity = '0.7';
  } else {
    form.btn.textContent = 'Join the waitlist';
    form.btn.style.opacity = '';
  }
}
