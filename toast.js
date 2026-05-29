// Toast Manager
const toastContainer = document.getElementById('toast-container') || (() => {
  const tc = document.createElement('div');
  tc.id = 'toast-container';
  tc.className = 'toast-container';
  document.body.appendChild(tc);
  return tc;
})();

const iconMap = {
  info: 'fas fa-info-circle',
  success: 'fas fa-check-circle',
  warning: 'fas fa-exclamation-triangle',
  error: 'fas fa-times-circle',
};

function createToast(message, type = 'info', options = {}) {
  const {duration = 4000} = options;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('data-type', type);
  toast.innerHTML = `
    <i class="${iconMap[type]} toast__icon"></i>
    <span class="toast__msg">${message}</span>
    <button class="close-btn"><i class="fas fa-times"></i></button>
  `;
  // Close button
  toast.querySelector('.close-btn').addEventListener('click', () => dismissToast(toast));
  // Pause on hover
  let hideTimeout;
  const hide = () => dismissToast(toast);
  const startTimer = () => {
    hideTimeout = setTimeout(hide, duration);
  };
  const pauseTimer = () => clearTimeout(hideTimeout);
  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', startTimer);
  toastContainer.appendChild(toast);
  // Trigger show animation
  requestAnimationFrame(() => toast.classList.add('show'));
  startTimer();
}

function dismissToast(toast) {
  toast.classList.remove('show');
  toast.classList.add('hide');
  
  // Safety fallback in case animationend does not fire
  const fallback = setTimeout(() => toast.remove(), 400);
  
  toast.addEventListener('animationend', () => {
    clearTimeout(fallback);
    toast.remove();
  }, { once: true });
}

// Expose globally
window.showToast = createToast;
