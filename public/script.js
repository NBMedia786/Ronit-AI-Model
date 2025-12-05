import { Conversation } from "https://cdn.jsdelivr.net/npm/@11labs/client/+esm";

// --- State ---
let conversation;
let userTranscript = "";
let sessionActive = false;
let timeRemaining = 180; // 3 minutes
let timerInterval;
let totalTalkTime = 0; // Total talk time in seconds
let talkTimeInterval;
let heartbeatInterval; // Server sync heartbeat interval
let talktimeRefreshInterval; // Periodic talktime refresh interval
let onlinePingInterval; // Periodic online status ping interval
let talkTimeStartTime = null; // When the conversation started
let helloPromptTimeout = null; // Timeout for auto-removing "Say Hello" prompt
let paymentModalContext = 'start'; // 'start' or 'during'
let isSessionPaused = false;
let initialTalktime = 0; // Store initial talktime when session starts
let isMicMuted = false; // Track microphone mute state
let userMediaStream = null; // Store the microphone stream for muting
const HEARTBEAT_RATE = 5000; // Sync with server every 5 seconds
// Text status controller - no animation intervals needed

// --- Production: Connection Health & Recovery ---
let connectionHealthCheck = null;
let disconnectRetryCount = 0;
let disconnectRetryTimeout = null;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds
let lastConnectionTime = null;
let isReconnecting = false;

// --- Sync State (Smart Latency Method) ---
let speakTimeout = null;    // Timer to start speaking visual
let silenceTimeout = null;  // Timer to stop speaking visual
const AUDIO_LATENCY_MS = 100; // Reduced to 100ms for snappier visuals
const SPEAKING_RATE_MS = 50;  // Approx milliseconds per character (speed of voice)

// --- Elements ---
let screens, footer, loadingBar, callStatus, callRing, timerDisplay, micBtn, talkTimeValue, buyTalkTimeBtn, loadingTalkTimeValue;
let talktimeValue, loadingTalktimeValue, callTalktimeValue, btnBuyTalktime;

  // Check microphone permission status on load
async function checkMicrophonePermission() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'microphone' });
      console.log('🎤 Microphone permission status:', result.state);
      
      result.onchange = () => {
        console.log('🎤 Microphone permission changed to:', result.state);
        if (result.state === 'granted') {
          console.log('✅ Microphone permission granted');
        } else if (result.state === 'denied') {
          console.warn('⚠️ Microphone permission denied');
        }
      };
      
      return result.state;
    }
  } catch (err) {
    console.warn('⚠️ Could not check microphone permission status:', err);
  }
  return 'unknown';
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  const html = document.documentElement;
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    if (theme === 'dark') {
      themeIcon.className = 'fas fa-sun';
    } else {
      themeIcon.className = 'fas fa-moon';
    }
  }
}

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 App initializing...');
  
  // Initialize theme
  initTheme();
  
  // Theme toggle button
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Also check for sidebar theme toggle
  const themeToggleSidebar = document.querySelector('.theme-toggle-sidebar');
  if (themeToggleSidebar) {
    themeToggleSidebar.addEventListener('click', toggleTheme);
  }
  
  // Side panel toggle button
  const sidePanelToggle = document.getElementById('sidePanelToggle');
  const sidePanel = document.getElementById('sidePanel');
  
  function updateToggleButtonVisibility() {
    if (sidePanel && sidePanelToggle) {
      const isClosed = sidePanel.classList.contains('closed');
      // Show toggle button only when panel is closed
      sidePanelToggle.style.display = isClosed ? 'flex' : 'none';
    }
  }
  
  if (sidePanelToggle && sidePanel) {
    // Check if panel state is saved in localStorage
    const savedState = localStorage.getItem('sidePanelOpen');
    const isOpen = savedState === null ? false : savedState === 'true'; // Default to closed
    
    if (!isOpen) {
      sidePanel.classList.add('closed');
    }
    
    // Update toggle button visibility on load
    updateToggleButtonVisibility();
    
    sidePanelToggle.addEventListener('click', () => {
      sidePanel.classList.toggle('closed');
      const isNowOpen = !sidePanel.classList.contains('closed');
      localStorage.setItem('sidePanelOpen', isNowOpen.toString());
      updateToggleButtonVisibility();
    });
    
    // Close button inside panel
    const sidePanelClose = document.getElementById('sidePanelClose');
    if (sidePanelClose) {
      sidePanelClose.addEventListener('click', () => {
        sidePanel.classList.add('closed');
        localStorage.setItem('sidePanelOpen', 'false');
        updateToggleButtonVisibility();
      });
    }
  }
  
  // Check microphone permission status and update UI
  checkMicrophonePermission().then(status => {
    const permissionNotice = document.querySelector('.permission-notice');
    if (permissionNotice) {
      if (status === 'granted') {
        permissionNotice.innerHTML = '<strong>✅ Microphone Ready:</strong> Permission already granted. You can start your call!';
        permissionNotice.style.background = 'rgba(16, 185, 129, 0.1)';
        permissionNotice.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        console.log('✅ Microphone already has permission');
      } else if (status === 'prompt') {
        permissionNotice.innerHTML = '<strong>🎤 Microphone Required:</strong> When you click "Start Call", Chrome will ask for microphone permission. Please click <strong>"Allow"</strong> to enable voice calls.';
        console.log('💡 Microphone permission will be requested when needed');
      } else if (status === 'denied') {
        permissionNotice.innerHTML = '<strong>⚠️ Microphone Blocked:</strong> Microphone access was denied. Please click the lock icon (🔒) in the address bar and allow microphone access, then refresh the page.';
        permissionNotice.style.background = 'rgba(239, 68, 68, 0.1)';
        permissionNotice.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        console.warn('⚠️ Microphone permission was previously denied');
      }
    }
  });
  
  // Initialize elements
  screens = {
    ronitStart: document.getElementById('screen-ronit-start'),
    loading: document.getElementById('screen-loading'),
    call: document.getElementById('screen-call')
  };
  footer = document.getElementById('mainFooter');
  loadingBar = document.getElementById('loadingBar');
  callStatus = document.getElementById('callStatus');
  callRing = document.getElementById('callRing');
  timerDisplay = document.getElementById('timerDisplay');
  micBtn = document.getElementById('micBtn');
  talkTimeValue = document.getElementById('talkTimeValue');
  buyTalkTimeBtn = document.getElementById('buyTalkTimeBtn');
  loadingTalkTimeValue = document.getElementById('loadingTalkTimeValue');
  talktimeValue = document.getElementById('talktimeValue');
  loadingTalktimeValue = document.getElementById('loadingTalktimeValue');
  callTalktimeValue = document.getElementById('callTalktimeValue');
  btnBuyTalktime = document.getElementById('btn-buy-talktime');
  
  // Ensure talk time displays are visible
  const talkTimeDisplay = document.getElementById('talkTimeDisplay');
  const loadingTalkTimeDisplay = document.getElementById('loadingTalkTimeDisplay');
  if (talkTimeDisplay) {
    talkTimeDisplay.style.display = 'block';
    talkTimeDisplay.style.visibility = 'visible';
  }
  if (loadingTalkTimeDisplay) {
    loadingTalkTimeDisplay.style.display = 'block';
    loadingTalkTimeDisplay.style.visibility = 'visible';
  }
  
  // Initialize and display talktime
  initializeTalktime();
  
  // Start periodic talktime refresh (every 30 seconds) to sync with admin updates
  startTalktimeRefresh();
  
  // Force immediate refresh on page load to sync with server
  setTimeout(() => {
    const email = sessionStorage.getItem('userEmail');
    if (email) {
      fetch(`/api/user/talktime?email=${encodeURIComponent(email)}`)
        .then(res => res.json())
        .then(data => {
          if (data.ok && data.talktime !== undefined) {
            const serverTalktime = data.talktime || 0;
            sessionStorage.setItem('userTalktime', serverTalktime.toString());
            updateTalktimeDisplay(serverTalktime);
            console.log(`🔄 Initial talktime sync: ${serverTalktime}s`);
          }
        })
        .catch(err => console.warn('⚠️ Initial sync failed:', err));
    }
  }, 1000); // Wait 1 second after page load
  
  // Start periodic online status ping (every 60 seconds) to keep user marked as online
  startOnlinePing();
  
  // Initialize side panel talktime display (will be updated by initializeTalktime)
  // Note: sidePanelTalktimeValue is updated in updateTalktimeDisplay function
  const sidePanelTalktimeValueEl = document.getElementById('sidePanelTalktimeValue');
  if (sidePanelTalktimeValueEl) {
    const talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
    const minutes = Math.floor(talktime / 60);
    sidePanelTalktimeValueEl.textContent = minutes.toLocaleString();
  }

  // Verify all elements exist
  const missing = [];
  if (!screens.ronitStart) missing.push('screen-ronit-start');
  if (!screens.loading) missing.push('screen-loading');
  if (!screens.call) missing.push('screen-call');
  if (missing.length > 0) {
    console.error('❌ Missing elements:', missing);
  } else {
    console.log('✅ All elements found');
  }

  // Pre-fill user data from sessionStorage (from login)
  const savedEmail = sessionStorage.getItem('userEmail');
  if (savedEmail) {
    const emailInput = document.getElementById('userEmail');
    if (emailInput) emailInput.value = savedEmail;
  }

  // Change Account button handler
  const btnChangeAccount = document.getElementById('btn-change-account');
  if (btnChangeAccount) {
    console.log('✅ Change account button found and initialized');
    btnChangeAccount.addEventListener('click', () => {
      // Clear session but keep theme preference
      const theme = localStorage.getItem('theme');
      sessionStorage.clear();
      if (theme) {
        localStorage.setItem('theme', theme);
      }
      window.location.href = '/login.html';
    });
  } else {
    console.warn('⚠️ Change account button not found');
  }

  // Logout handler
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    console.log('✅ Logout button found and initialized');
    btnLogout.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        sessionStorage.clear();
        window.location.href = '/login.html';
      }
    });
  } else {
    console.warn('⚠️ Logout button not found');
  }

  // --- Navigation Flow ---

  // Ronit Start -> Loading -> Call
  const btnStartLoading = document.getElementById('btn-start-loading');
  if (btnStartLoading) {
    console.log('✅ Start call button found and initialized');
    btnStartLoading.addEventListener('click', async () => {
      const email = document.getElementById('userEmail')?.value?.trim() || '';

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email) {
        alert("Please enter your email address to receive your personalized care plan.");
        const emailInput = document.getElementById('userEmail');
        if (emailInput) emailInput.focus();
        return;
      }
      
      if (!emailRegex.test(email)) {
        alert("Please enter a valid email address (e.g., yourname@example.com).");
        const emailInput = document.getElementById('userEmail');
        if (emailInput) {
          emailInput.focus();
          emailInput.select();
        }
        return;
      }
      
      // Get name from email or sessionStorage
      const name = sessionStorage.getItem('userName') || email.split('@')[0] || 'User';

      // Check if user has talktime
      const talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
      if (talktime <= 0) {
        // Show payment modal
        showPaymentModal('start');
        btnStartLoading.disabled = false;
        const phoneIcon = document.querySelector('#btn-start-loading i');
        if (phoneIcon) {
          btnStartLoading.innerHTML = '<i class="fas fa-phone-alt"></i><span>Start Call with Ronit</span>';
        } else {
          btnStartLoading.innerHTML = '<i class="fas fa-phone-alt"></i><span>Start Call with Ronit</span>';
        }
        return;
      }

      // Disable button to prevent multiple clicks
      btnStartLoading.disabled = true;
      btnStartLoading.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Starting...</span>';

      // Hide Ronit Start, Show Loading
      if (screens.ronitStart) screens.ronitStart.classList.add('hidden');
      if (screens.loading) screens.loading.classList.remove('hidden');
      if (footer) footer.style.display = 'none'; // Hide footer for call view
      
      // Initialize and display talk time on loading screen
      timeRemaining = 180; // Reset to 3 minutes
      if (loadingTalkTimeValue) {
        loadingTalkTimeValue.textContent = '03:00';
      }
      
      // Update talktime display on loading screen
      if (loadingTalktimeValue) {
        const talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
        loadingTalktimeValue.textContent = talktime.toLocaleString();
      }
      
      // Save user data to sessionStorage
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('userName', name); // Use email prefix as name

      // [FIX] Start immediately to preserve User Gesture for Audio/Mic
      console.log('📞 Starting call process...');
      
      // Fill loading bar visually (optional)
      if (loadingBar) {
          loadingBar.style.transition = 'width 0.5s ease';
          loadingBar.style.width = '100%'; 
      }

      // CALL IMMEDIATELY - Do not wait for a timer!
      // This allows the browser to grant microphone/audio permissions.
      startVoiceSession();
    });
  }

  // End button listener
  const endBtn = document.getElementById('endBtn');
  if (endBtn) {
    endBtn.addEventListener('click', endSession);
  }

  // Mic button - Mute/Unmute functionality
  if (micBtn) {
    micBtn.addEventListener('click', toggleMicrophone);
  }

  // Buy Talk Time Button
  if (buyTalkTimeBtn) {
    buyTalkTimeBtn.addEventListener('click', handleBuyTalkTime);
  }
  
  // Buy Talktime Button (main card - if exists)
  if (btnBuyTalktime) {
    btnBuyTalktime.addEventListener('click', handleBuyTalktime);
  }
  
  // Side Panel Buy Talktime Button
  const sidePanelBuyBtn = document.getElementById('sidePanelBuyTalktime');
  if (sidePanelBuyBtn) {
    sidePanelBuyBtn.addEventListener('click', handleBuyTalktime);
    console.log('✅ Side panel buy talktime button initialized');
  } else {
    console.warn('⚠️ Side panel buy talktime button not found');
  }
  
  // Initialize talktime on page load
  initializeTalktime();
  
  // Re-check welcome bonus when email changes
  const emailInput = document.getElementById('userEmail');
  if (emailInput) {
    let emailCheckTimeout;
    emailInput.addEventListener('input', () => {
      clearTimeout(emailCheckTimeout);
      emailCheckTimeout = setTimeout(() => {
        const email = emailInput.value?.trim();
        if (email && email.includes('@')) {
          // Re-initialize talktime when valid email is entered
          initializeTalktime();
        }
      }, 1000); // Wait 1 second after user stops typing
    });
  }
  
  // Initialize payment modal buttons
  initializePaymentModal();
});

// Payment Modal Functions
function showPaymentModal(context) {
  paymentModalContext = context;
  const modal = document.getElementById('paymentModal');
  const message = document.getElementById('paymentModalMessage');
  if (modal) {
    modal.style.display = 'flex';
    if (message) {
      message.textContent = '';
      message.className = 'payment-modal-message';
    }
  }
}

function hidePaymentModal() {
  const modal = document.getElementById('paymentModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function pauseSessionForPayment() {
  if (!sessionActive || isSessionPaused) return;
  
  isSessionPaused = true;
  
  // Pause the conversation
  if (conversation) {
    try {
      // Mute the conversation to pause it
      conversation.setConversationTurnDetection({
        enabled: false
      });
      console.log('⏸️ Session paused - talktime is 0');
    } catch (e) {
      console.error('Error pausing conversation:', e);
    }
  }
  
  // Show payment modal
  showPaymentModal('during');
  updateStatus('Session Paused - Buy Talktime to Continue', 'default');
}

function resumeSession() {
  if (!isSessionPaused) return;
  
  isSessionPaused = false;
  
  // Resume the conversation
  if (conversation) {
    try {
      // Re-enable conversation turn detection
      conversation.setConversationTurnDetection({
        enabled: true
      });
      console.log('▶️ Session resumed');
    } catch (e) {
      console.error('Error resuming conversation:', e);
    }
  }
  
  // [CRITICAL FIX] REMOVED the code that hid the status text
  // The text should remain visible indicating "Listening..."
  toggleVoiceVisuals('listening'); 
}

function initializePaymentModal() {
  const paymentCancelBtn = document.getElementById('paymentCancelBtn');
  const paymentProceedBtn = document.getElementById('paymentProceedBtn');
  const paymentModalMessage = document.getElementById('paymentModalMessage');
  
  if (paymentCancelBtn) {
    paymentCancelBtn.addEventListener('click', () => {
      if (paymentModalContext === 'during') {
        // End session if user cancels during call
        endSession();
      } else {
        // Just hide modal if canceling before start
        hidePaymentModal();
      }
    });
  }
  
  if (paymentProceedBtn) {
    paymentProceedBtn.addEventListener('click', async () => {
      if (!paymentProceedBtn) return;
      
      try {
        paymentProceedBtn.disabled = true;
        paymentProceedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Processing...</span>';
        if (paymentModalMessage) {
          paymentModalMessage.textContent = 'Creating payment order...';
          paymentModalMessage.className = 'payment-modal-message info';
        }
        
        // Create order for talktime purchase
        const response = await fetch('/api/payments/razorpay/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount_paisa: 49900, // ₹499 in paise
            currency: 'INR',
            receipt: `talktime_${Date.now()}`
          })
        });
        
        const orderData = await response.json();
        if (!response.ok || !orderData?.ok) {
          throw new Error(orderData?.error || 'Order creation failed');
        }
        
        const { order, key_id } = orderData;
        
        const options = {
          key: key_id,
          amount: order.amount,
          currency: order.currency,
          name: 'AI Voice Coach',
          description: 'Purchase Talktime (100 talktime)',
          order_id: order.id,
          handler: async function (response) {
            try {
              // Verify payment
              const verifyResponse = await fetch('/api/payments/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  email: sessionStorage.getItem('userEmail') // Add email for backend to credit talktime
                })
              });
              
              const verifyData = await verifyResponse.json();
              if (verifyResponse.ok && verifyData.ok) {
                // Add talktime
                addTalktime(100);
                
                if (paymentModalMessage) {
                  paymentModalMessage.textContent = 'Payment successful! Adding talktime...';
                  paymentModalMessage.className = 'payment-modal-message success';
                }
                
                // Hide modal after short delay
                setTimeout(() => {
                  hidePaymentModal();
                  
                  if (paymentModalContext === 'during') {
                    // Resume session
                    resumeSession();
                  } else {
                    // Start the call
                    const btnStartLoading = document.getElementById('btn-start-loading');
                    if (btnStartLoading) {
                      btnStartLoading.click();
                    }
                  }
                }, 1500);
              } else {
                throw new Error(verifyData?.error || 'Payment verification failed');
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              if (paymentModalMessage) {
                paymentModalMessage.textContent = 'Payment verification failed. Please try again.';
                paymentModalMessage.className = 'payment-modal-message error';
              }
              paymentProceedBtn.disabled = false;
              paymentProceedBtn.innerHTML = '<i class="fas fa-lock"></i><span>Pay & Continue</span>';
            }
          },
          modal: {
            ondismiss: function () {
              paymentProceedBtn.disabled = false;
              paymentProceedBtn.innerHTML = '<i class="fas fa-lock"></i><span>Pay & Continue</span>';
              if (paymentModalMessage) {
                paymentModalMessage.textContent = '';
                paymentModalMessage.className = 'payment-modal-message';
              }
            }
          }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
      } catch (error) {
        console.error('Payment error:', error);
        if (paymentModalMessage) {
          paymentModalMessage.textContent = 'Error: ' + error.message;
          paymentModalMessage.className = 'payment-modal-message error';
        }
        paymentProceedBtn.disabled = false;
        paymentProceedBtn.innerHTML = '<i class="fas fa-lock"></i><span>Pay & Continue</span>';
      }
    });
  }
}

// --- Voice Logic ---

async function requestMicrophonePermission() {
  try {
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not supported in this browser. Please use Chrome, Firefox, or Edge.');
    }

    // [FIX] Request permission to unlock browser permissions
    // We'll keep a minimal stream alive until SDK connects, then release it
    console.log('🎤 Requesting microphone permission...');
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Check if we actually got audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('No audio tracks available');
    }
    
    console.log('✅ Microphone permission granted');
    console.log('📊 Audio track info:', {
      label: audioTracks[0].label,
      enabled: audioTracks[0].enabled,
      readyState: audioTracks[0].readyState,
      settings: audioTracks[0].getSettings()
    });
    
    // [FIX] Store stream temporarily - will be released when SDK connects
    // This ensures browser permissions are unlocked for the SDK
    userMediaStream = stream;
    
    // Return success - stream will be managed by SDK after connection
    return true;
  } catch (err) {
    console.error('❌ Microphone permission error:', err);
    
    // Provide detailed error messages
    let errorMessage = 'Microphone access denied. ';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      errorMessage += 'Please allow microphone access in your browser settings.\n\n';
      errorMessage += 'To fix this in Chrome:\n';
      errorMessage += '1. Click the lock icon (🔒) in the address bar\n';
      errorMessage += '2. Set "Microphone" to "Allow"\n';
      errorMessage += '3. Refresh the page and try again';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      errorMessage += 'No microphone found. Please connect a microphone and try again.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      errorMessage += 'Microphone is being used by another application. Please close other apps using the microphone.';
    } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
      errorMessage += 'Microphone does not meet requirements. Trying with basic settings...';
      // Try again with basic constraints
      try {
        const basicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        basicStream.getTracks().forEach(track => track.stop());
        return true;
      } catch (retryErr) {
        errorMessage = 'Could not access microphone. Please check your device settings.';
      }
    } else {
      errorMessage += err.message || 'Unknown error occurred.';
    }
    
    console.error('Error details:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

// --- Microphone Mute/Unmute Functions ---
function toggleMicrophone() {
  if (!sessionActive) {
    console.log('⚠️ Cannot toggle mic: session not active');
    return;
  }
  
  isMicMuted = !isMicMuted;
  let tracksControlled = 0;
  
  // Method 1: Mute/unmute through stored media stream (Primary Method)
  // This is the stream we got during permission request
  if (userMediaStream) {
    userMediaStream.getAudioTracks().forEach(track => {
      // Control tracks regardless of state - enabled property works on all states
      const wasEnabled = track.enabled;
      track.enabled = !isMicMuted;
      tracksControlled++;
      console.log(`🎤 Track "${track.label || 'Unknown'}": ${isMicMuted ? 'MUTED' : 'UNMUTED'} (enabled: ${wasEnabled} → ${!isMicMuted}, state=${track.readyState})`);
    });
  }
  
  // Method 2: Try to get stream from conversation object if available
  // Some SDK versions expose the stream
  if (conversation) {
    try {
      // Try different possible methods to access the stream
      if (typeof conversation.getLocalStream === 'function') {
        const convStream = conversation.getLocalStream();
        if (convStream && convStream !== userMediaStream) {
          convStream.getAudioTracks().forEach(track => {
            track.enabled = !isMicMuted;
            tracksControlled++;
            console.log(`🎤 Conversation stream track: ${isMicMuted ? 'MUTED' : 'UNMUTED'}`);
          });
        }
      }
      
      // Try to access through other possible properties
      if (conversation.localStream) {
        conversation.localStream.getAudioTracks().forEach(track => {
          track.enabled = !isMicMuted;
          tracksControlled++;
          console.log(`🎤 Local stream track: ${isMicMuted ? 'MUTED' : 'UNMUTED'}`);
        });
      }
    } catch (e) {
      // Expected - not all SDK versions expose the stream this way
    }
  }
  
  // Method 3: Disable/enable turn detection through ElevenLabs conversation
  // This prevents the agent from processing user input when muted
  if (conversation) {
    try {
      if (isMicMuted) {
        conversation.setConversationTurnDetection({ enabled: false });
        console.log('🔇 Turn detection disabled - agent will not process user input');
      } else {
        conversation.setConversationTurnDetection({ enabled: true });
        console.log('🎤 Turn detection enabled - agent can process user input');
        
        // [FIX] Also ensure microphone tracks are enabled when unmuting
        if (userMediaStream) {
          userMediaStream.getAudioTracks().forEach(track => {
            if (track.readyState === 'live') {
              track.enabled = true;
              console.log(`✅ Enabled audio track: ${track.label}`);
            } else {
              console.warn(`⚠️ Track not live: ${track.label}, state: ${track.readyState}`);
            }
          });
        }
      }
    } catch (e) {
      console.warn('⚠️ Could not update conversation turn detection:', e);
    }
  }
  
  // Log the result
  if (tracksControlled > 0) {
    console.log(`✅ Microphone ${isMicMuted ? 'MUTED' : 'UNMUTED'} - ${tracksControlled} audio track(s) controlled`);
  } else {
    console.warn('⚠️ No audio tracks found. Using turn detection method only.');
    console.log(`ℹ️ Microphone ${isMicMuted ? 'MUTED' : 'UNMUTED'} via turn detection`);
  }
  
  // Update UI
  updateMicButtonState(isMicMuted);
  
  // Show brief status update, then REVERT to main state
  if (callStatus) {
    // [CRITICAL FIX] Remove hidden class so CSS !important doesn't block visibility
    callStatus.classList.remove('hidden');
    
    callStatus.textContent = isMicMuted ? '🔇 Microphone Muted' : '🎤 Microphone Active';
    callStatus.style.display = 'inline-block';
    
    // Remove any existing classes temporarily
    callStatus.classList.remove('speaking');
    
    setTimeout(() => {
      // CRITICAL FIX: Don't hide it! Revert to correct state.
      if (sessionActive) {
         // If muted, stay muted text, otherwise go back to Listening
         if (isMicMuted) {
             callStatus.textContent = '🔇 Muted';
         } else {
             // Force refresh the visual state
             toggleVoiceVisuals('listening');
         }
      }
    }, 2000);
  }
}

function updateMicButtonState(muted) {
  if (!micBtn) return;
  
  const icon = micBtn.querySelector('.control-btn-inner i') || micBtn.querySelector('i');
  const label = micBtn.querySelector('.control-label');
  
  if (muted) {
    // Muted state - red background, slash icon
    micBtn.classList.add('muted');
    if (icon) {
      icon.className = 'fas fa-microphone-slash';
    }
    if (label) {
      label.textContent = 'Muted';
    }
    micBtn.setAttribute('aria-label', 'Unmute Microphone');
    console.log('🔇 Mic button updated to muted state');
  } else {
    // Unmuted state - normal gray background, mic icon
    micBtn.classList.remove('muted');
    if (icon) {
      icon.className = 'fas fa-microphone';
    }
    if (label) {
      label.textContent = 'Mic';
    }
    micBtn.setAttribute('aria-label', 'Mute Microphone');
    console.log('🎤 Mic button updated to unmuted state');
  }
}

// Helper function to ensure mute state is maintained
// This periodically checks and enforces the mute state in case tracks get re-enabled
function enforceMicMuteState() {
  if (!sessionActive || !isMicMuted) return;
  
  // Enforce mute on stored stream
  if (userMediaStream) {
    userMediaStream.getAudioTracks().forEach(track => {
      if (track.enabled) {
        track.enabled = false;
        console.log('🔇 Enforcing mute state on track:', track.label || 'Unknown');
      }
    });
  }
  
  // Also enforce through conversation turn detection
  if (conversation) {
    try {
      conversation.setConversationTurnDetection({ enabled: false });
    } catch (e) {
      // Ignore errors
    }
  }
}

async function startVoiceSession() {
  // ---------------------------------------------------------
  // [FIX] Wake up Audio Context immediately on user click
  // This prevents the browser from blocking audio due to network delay
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      await ctx.resume();
      ctx.close(); // Clean up immediately
    }
  } catch (e) {
    console.warn("AudioContext wake-up failed", e);
  }
  // ---------------------------------------------------------

  userTranscript = "";
  timeRemaining = 180;
  totalTalkTime = 0;
  isMicMuted = false;
  
  // [REMOVED] lastMessageTime - No longer needed for visual sync
  // Visual status is now 100% driven by actual audio volume data
  
  // UI Setup
  if (screens.loading) screens.loading.classList.add('hidden');
  if (screens.call) {
    screens.call.classList.remove('hidden');
    screens.call.style.display = 'flex';
  }
  
  // Clean up Side Panel
  const sidePanel = document.getElementById('sidePanel');
  const sidePanelToggle = document.getElementById('sidePanelToggle');
  if (sidePanel) {
    sidePanel.style.display = 'none';
    sidePanel.style.visibility = 'hidden';
    sidePanel.classList.add('call-hidden');
  }
  if (sidePanelToggle) {
    sidePanelToggle.style.display = 'none';
    sidePanelToggle.style.visibility = 'hidden';
    sidePanelToggle.classList.add('call-hidden');
  }
  
  const talkTimeDisplay = document.getElementById('talkTimeDisplay');
  if (talkTimeDisplay) talkTimeDisplay.style.display = 'block';
  
  // Timer UI Reset
  if (talkTimeValue) talkTimeValue.textContent = '0';
  if (callTalktimeValue) {
    const talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
    callTalktimeValue.textContent = talktime.toLocaleString();
  }
  
  const btnStartLoading = document.getElementById('btn-start-loading');
  if (btnStartLoading) {
    btnStartLoading.disabled = false;
    btnStartLoading.innerHTML = '<i class="fas fa-phone-alt"></i><span>Start Call with Ronit</span>';
  }

  updateStatus('Requesting microphone access...', 'connecting');

  const permissionResult = await requestMicrophonePermission();
  if (permissionResult !== true) {
    updateStatus('Microphone Access Required', 'default');
    alert('Microphone access is required. Please allow access and try again.');
    if (screens.call) screens.call.classList.add('hidden');
    if (screens.ronitStart) screens.ronitStart.classList.remove('hidden');
    if (footer) footer.style.display = 'block';
    // Restore side panel
    if (sidePanel) {
      sidePanel.style.display = 'flex';
      sidePanel.style.visibility = '';
      sidePanel.classList.remove('call-hidden');
    }
    if (sidePanelToggle) {
      const isClosed = sidePanel.classList.contains('closed');
      sidePanelToggle.style.display = isClosed ? 'flex' : 'none';
      sidePanelToggle.style.visibility = '';
      sidePanelToggle.classList.remove('call-hidden');
    }
    return;
  }
  
  updateStatus('Connecting to AI service...', 'connecting');

  try {
    const cfgRes = await fetch('/config', {cache:'no-store'});
    if (!cfgRes.ok) throw new Error('Failed to fetch configuration');
    const cfg = await cfgRes.json();
    
    const response = await fetch('/conversation-token');
    if (!response.ok) throw new Error('Token request failed');
    const data = await response.json();
    const token = data.token;

    console.log('🎙️ Starting conversation...');
    
    // [PRODUCTION FIX] Increased timeout and better handling
    const connectionTimeout = setTimeout(() => {
      if (!sessionActive && !isReconnecting) {
        console.warn('⏱️ Connection timeout - attempting recovery...');
        updateStatus('Connection taking longer than expected...', 'connecting');
        // Don't end immediately - give it more time
      }
    }, 30000); // Increased to 30 seconds for VPS latency

    // --- START SESSION ---
    conversation = await Conversation.startSession({
      agentId: cfg.agentId,
      conversationToken: token,
      
      // OPTIMIZATION: Lower latency configuration
      overrides: {
        agent: {
          prompt: {
            // Lower temperature makes responses faster and more concise
            temperature: 0.5 
          },
          firstMessage: "Hello, I am Ronit. How can I help you today?" // Pre-caching the first message
        }
        // tts block removed entirely - let Agent use its native, correct model
      },

      // [VPS FIX] WebRTC Configuration for VPS/Server deployments
      // This helps with NAT traversal and connection stability
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" }
      ],
      transportPolicy: "all",
      enableTCP: true,  // Enable TCP fallback for better reliability

      // 1. SMART LATENCY TRIGGER (The Alternate Fix)
      onMessage: ({ source, message }) => {
        const speaker = source === 'user' ? 'User' : 'Coach';
        userTranscript += `[${new Date().toLocaleTimeString()}] ${speaker}: ${message}\n`;
        
        // [PRODUCTION FIX] Update connection activity timestamp
        lastConnectionTime = Date.now();
        
        if (source === 'ai' || source === 'agent' || source === 'assistant') {
          console.log(`💬 Text received (${message.length} chars). Syncing visuals...`);
          
          // Clear any existing timers to prevent overlaps
          if (speakTimeout) clearTimeout(speakTimeout);
          if (silenceTimeout) clearTimeout(silenceTimeout);

          // STEP A: Wait for audio buffering (Latency Compensation)
          speakTimeout = setTimeout(() => {
             toggleVoiceVisuals('speaking');
             
             // STEP B: Calculate how long to stay green
             // Average speaking rate is ~15-20 chars per second. 
             // 50ms per char is a safe average for AI voices.
             const estimatedDuration = Math.max(1500, message.length * SPEAKING_RATE_MS);
             
             // STEP C: Schedule the "Silence" switch
             silenceTimeout = setTimeout(() => {
                toggleVoiceVisuals('listening');
             }, estimatedDuration);
             
          }, AUDIO_LATENCY_MS); // Wait 100ms before starting (reduced for snappier visuals)
        }
      },

      // 2. SAFETY SWITCH (Ensures we never get "Stuck")
      onModeChange: (mode) => {
        const currentMode = mode.mode || mode; 
        console.log('🔄 Mode:', currentMode);
        
        // [PRODUCTION FIX] Update connection activity on mode changes
        lastConnectionTime = Date.now();
        
        // If the SDK explicitly says "listening", we trust it and cut the visual short.
        if (currentMode === 'listening') {
           if (silenceTimeout) clearTimeout(silenceTimeout);
           toggleVoiceVisuals('listening');
        }
      },

      onConnect: () => {
        clearTimeout(connectionTimeout);
        sessionActive = true;
        isMicMuted = false;
        isReconnecting = false;
        disconnectRetryCount = 0; // Reset retry count on successful connection
        lastConnectionTime = Date.now();
        
        // [FIX] Setup Media Stream - SDK should have its own stream now
        try {
          // Try to get the SDK's stream (it should have requested its own)
          if (conversation && typeof conversation.getLocalStream === 'function') {
            const localStream = conversation.getLocalStream();
            if (localStream) {
              console.log('✅ Using SDK stream for microphone control');
              // Release our temporary permission stream
              if (userMediaStream && userMediaStream !== localStream) {
                userMediaStream.getTracks().forEach(track => track.stop());
              }
              userMediaStream = localStream;
              // Ensure tracks are enabled
              localStream.getAudioTracks().forEach(track => {
                track.enabled = !isMicMuted;
                console.log(`🎤 Audio track enabled: ${track.enabled}, label: ${track.label}`);
              });
            } else {
              console.warn('⚠️ SDK stream not available, keeping permission stream');
              // Keep the permission stream if SDK doesn't provide one
              if (userMediaStream) {
                userMediaStream.getAudioTracks().forEach(track => {
                  track.enabled = !isMicMuted;
                });
              }
            }
          } else {
            console.warn('⚠️ getLocalStream not available, using permission stream');
            // Fallback: use our permission stream
            if (userMediaStream) {
              userMediaStream.getAudioTracks().forEach(track => {
                track.enabled = !isMicMuted;
              });
            }
          }
        } catch (e) {
          console.error('❌ Error setting up media stream:', e);
          // Keep permission stream as fallback
          if (userMediaStream) {
            userMediaStream.getAudioTracks().forEach(track => {
              track.enabled = !isMicMuted;
            });
          }
        }
        
        // Verify microphone is actually working
        if (userMediaStream) {
          const tracks = userMediaStream.getAudioTracks();
          const activeTracks = tracks.filter(t => t.readyState === 'live' && t.enabled);
          console.log(`🎤 Microphone status: ${activeTracks.length} active track(s) out of ${tracks.length} total`);
          if (activeTracks.length === 0) {
            console.error('❌ No active microphone tracks! Bot will not hear you.');
            updateStatus('⚠️ Microphone not active - check browser permissions', 'default');
          }
        } else {
          console.error('❌ No microphone stream available! Bot will not hear you.');
          updateStatus('⚠️ Microphone not available - check browser permissions', 'default');
        }
        
        updateMicButtonState(false);
        
        if (window.micMuteInterval) clearInterval(window.micMuteInterval);
        window.micMuteInterval = setInterval(() => {
          if (sessionActive && isMicMuted && userMediaStream) {
            userMediaStream.getAudioTracks().forEach(track => {
              track.enabled = false;
            });
          } else if (sessionActive && !isMicMuted && userMediaStream) {
            // Ensure tracks stay enabled when unmuted
            userMediaStream.getAudioTracks().forEach(track => {
              if (track.readyState === 'live') {
                track.enabled = true;
              }
            });
          }
        }, 2000);

        // [PRODUCTION FIX] Start connection health monitoring
        startConnectionHealthCheck();

        // Connection UI Updates
        const connectionStatus = document.getElementById('connectionStatus');
        if (connectionStatus) {
          connectionStatus.classList.add('connected');
          const statusText = connectionStatus.querySelector('.status-text');
          if (statusText) statusText.textContent = 'Connected';
        }
        
        // Initial Status
        updateStatus('Connected', 'default');
        setTimeout(() => { toggleVoiceVisuals('listening'); }, 100);
        
        // [FIX] Ensure turn detection is enabled on connect
        if (conversation) {
          try {
            conversation.setConversationTurnDetection({ enabled: true });
            console.log('✅ Turn detection enabled on connection');
          } catch (e) {
            console.warn('⚠️ Could not enable turn detection:', e);
          }
        }
        
        startTimer();
        startTalkTimeTracking();
        
        console.log('✅ Session connected successfully');
        console.log('🎤 Microphone should now be active - try speaking to the bot!');
      },

      onDisconnect: () => {
        clearTimeout(connectionTimeout);
        stopConnectionHealthCheck();
        
        // Clear sync timers
        if (speakTimeout) clearTimeout(speakTimeout);
        if (silenceTimeout) clearTimeout(silenceTimeout);
        
        // [PRODUCTION FIX] Don't immediately end session - try to recover
        console.warn('⚠️ Connection disconnected');
        
        // Only end session if we've been disconnected for a while or retries failed
        if (disconnectRetryCount >= MAX_RETRY_ATTEMPTS) {
          console.error('❌ Max reconnection attempts reached. Ending session.');
          toggleVoiceVisuals('idle');
          updateStatus('Connection lost. Please refresh.', 'default');
          setTimeout(() => endSession(), 2000);
          return;
        }
        
        // Attempt reconnection
        if (sessionActive && !isReconnecting) {
          isReconnecting = true;
          disconnectRetryCount++;
          console.log(`🔄 Attempting reconnection (${disconnectRetryCount}/${MAX_RETRY_ATTEMPTS})...`);
          
          updateStatus(`Reconnecting... (${disconnectRetryCount}/${MAX_RETRY_ATTEMPTS})`, 'connecting');
          
          // Clear retry timeout if exists
          if (disconnectRetryTimeout) clearTimeout(disconnectRetryTimeout);
          
          // Wait before retrying
          disconnectRetryTimeout = setTimeout(() => {
            if (sessionActive) {
              // The SDK should handle reconnection automatically
              // Just update UI and wait
              console.log('⏳ Waiting for automatic reconnection...');
            }
          }, RETRY_DELAY);
        } else if (!sessionActive) {
          // Session was already ended, just cleanup
          toggleVoiceVisuals('idle');
          updateStatus('Disconnected', 'default');
        }
      },

      onError: (err) => {
        clearTimeout(connectionTimeout);
        stopConnectionHealthCheck();
        
        // Clear sync timers
        if (speakTimeout) clearTimeout(speakTimeout);
        if (silenceTimeout) clearTimeout(silenceTimeout);
        
        console.error('❌ Connection error:', err);
        
        // [PRODUCTION FIX] Handle errors more gracefully
        const errorMessage = err.message || err.toString() || 'Unknown error';
        const isFatalError = errorMessage.includes('closed') || 
                            errorMessage.includes('failed') ||
                            errorMessage.includes('timeout');
        
        if (isFatalError && disconnectRetryCount >= MAX_RETRY_ATTEMPTS) {
          // Fatal error after retries - end session
          toggleVoiceVisuals('idle');
          updateStatus('Connection error. Please refresh.', 'default');
          alert('Connection error: ' + errorMessage + '\n\nPlease refresh the page and try again.');
          setTimeout(() => endSession(), 2000);
        } else if (isFatalError) {
          // Try to recover
          console.warn('⚠️ Fatal error detected, attempting recovery...');
          disconnectRetryCount++;
          updateStatus(`Recovering from error... (${disconnectRetryCount}/${MAX_RETRY_ATTEMPTS})`, 'connecting');
          // Don't end session - let onDisconnect handle reconnection
        } else {
          // Non-fatal error - log but continue
          console.warn('⚠️ Non-fatal error:', errorMessage);
          updateStatus('Connection issue detected...', 'connecting');
        }
      }
    });

  } catch (error) {
    console.error("❌ Failed to start:", error);
    updateStatus('Connection Failed', 'default');
    alert('Could not connect: ' + error.message);
    if (screens.call) screens.call.classList.add('hidden');
    if (screens.ronitStart) screens.ronitStart.classList.remove('hidden');
    if (footer) footer.style.display = 'block';
    // Restore side panel
    if (sidePanel) {
      sidePanel.style.display = 'flex';
      sidePanel.style.visibility = '';
      sidePanel.classList.remove('call-hidden');
      // Restore toggle button visibility based on panel state
      const isClosed = sidePanel.classList.contains('closed');
      if (sidePanelToggle) {
        sidePanelToggle.style.display = isClosed ? 'flex' : 'none';
        sidePanelToggle.style.visibility = '';
        sidePanelToggle.classList.remove('call-hidden');
      }
    }
  }
}

// --- Session Management ---

function updateStatus(text, visualState) {
  if (callStatus) {
    // Only update text if we are NOT in the middle of a "speaking/listening" flow
    // or if it's a critical connection message (Connecting/Disconnected)
    const isConnectionMessage = text.includes('Connect') || text.includes('Disconnect') || text.includes('Error');
    
    if (isConnectionMessage) {
       // [CRITICAL FIX] Remove hidden class here too
       callStatus.classList.remove('hidden');
       
       callStatus.textContent = text;
       callStatus.style.display = 'inline-block';
       callStatus.classList.remove('speaking'); // Ensure it's gray for status messages
    }
  }
  
  // Clear the "Say Hello" prompt timeout if status changes
  if (text !== 'Say "Hello" to start' && helloPromptTimeout) {
    clearTimeout(helloPromptTimeout);
    helloPromptTimeout = null;
  }
  
  // Handle Ring Animations
  const profileContainer = document.querySelector('#screen-call .profile-container');
  if (callRing) {
    callRing.className = 'ring'; 
    
    if (visualState === 'connecting') {
      callRing.classList.add('connecting');
      if (profileContainer) {
        profileContainer.classList.add('voice-connecting');
        profileContainer.classList.remove('voice-active');
      }
    } else {
      // For speaking/listening, toggleVoiceVisuals handles the classes now
      if (profileContainer) {
        profileContainer.classList.remove('voice-connecting');
      }
    }
  }
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeRemaining--;
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    if (timerDisplay) {
      timerDisplay.textContent = `${m}:${s < 10 ? '0'+s : s}`;
    }
    
    // Update loading screen talk time if visible
    if (loadingTalkTimeValue && screens.loading && !screens.loading.classList.contains('hidden')) {
      loadingTalkTimeValue.textContent = `${m}:${s < 10 ? '0'+s : s}`;
    }

    // Show buy talk time button when less than 1 minute remaining
    if (timeRemaining <= 60 && buyTalkTimeBtn) {
      buyTalkTimeBtn.style.display = 'block';
    }

    if (timeRemaining <= 0) {
      // Show buy button prominently when time is up
      if (buyTalkTimeBtn) {
        buyTalkTimeBtn.style.display = 'block';
        buyTalkTimeBtn.textContent = '⏱️ Buy Talk Time to Continue';
      }
      // Don't end session immediately, let user buy more time
      if (timeRemaining < -10) {
        endSession();
      }
    }
  }, 1000);
}

// Start tracking total talk time
function startTalkTimeTracking() {
  totalTalkTime = 0;
  talkTimeStartTime = Date.now();
  
  // Set initial talktime from storage for UI reference
  let localBalance = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
  
  // Set initial talktime when session starts
  if (initialTalktime === 0 && localBalance > 0) {
    initialTalktime = localBalance;
    sessionStorage.setItem('initialTalktime', initialTalktime.toString());
  }
  
  if (talkTimeInterval) clearInterval(talkTimeInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  // 1. UI TIMER (Visual only - runs every second)
  talkTimeInterval = setInterval(() => {
    if (sessionActive && !isSessionPaused) {
      // Update Total Talk Time (elapsed)
      const elapsed = Math.floor((Date.now() - talkTimeStartTime) / 1000);
      totalTalkTime = elapsed;
      
      // Visually decrement local balance for smooth UI
      if (localBalance > 0) {
        localBalance--;
        sessionStorage.setItem('userTalktime', localBalance.toString());
        updateTalktimeDisplay(localBalance); // Reuse your existing display updater
      } else {
        // UI says 0, pause immediately while waiting for server confirmation
        pauseSessionForPayment();
      }
      
      if (talkTimeValue) talkTimeValue.textContent = totalTalkTime;
    }
  }, 1000);

  // 2. SERVER HEARTBEAT (The Source of Truth - runs every 5 seconds)
  heartbeatInterval = setInterval(async () => {
    if (sessionActive && !isSessionPaused) {
      const email = sessionStorage.getItem('userEmail');
      if (!email) {
        console.warn('⚠️ Heartbeat skipped: No email in sessionStorage');
        return;
      }

      try {
        console.log('💓 Sending heartbeat...', { email, seconds: HEARTBEAT_RATE / 1000 });
        // Send heartbeat to deduct 5 seconds
        const response = await fetch('/api/user/deduct-time', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: email,
            seconds: HEARTBEAT_RATE / 1000 
          })
        });

        if (!response.ok) {
          console.error('❌ Heartbeat failed:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          return;
        }

        const data = await response.json();
        console.log('✅ Heartbeat response:', data);

        if (data.ok) {
          // Sync local balance with authoritative server balance
          localBalance = data.remaining;
          sessionStorage.setItem('userTalktime', localBalance.toString());
          
          // Update all displays with the synced balance
          updateTalktimeDisplay(localBalance);
          
          // Double check: If server says 0, kill it.
          if (localBalance <= 0) {
             console.log('⛔ Server reports 0 talktime. Pausing session.');
             pauseSessionForPayment();
          }
        } else if (data.status === 'exhausted') {
          // Hard Stop
          console.log('⛔ Talktime exhausted on server.');
          pauseSessionForPayment();
        }
      } catch (err) {
        console.warn('⚠️ Heartbeat failed (network error). Will retry...', err);
        console.error('Heartbeat error details:', err.message, err.stack);
        // Optional: If network fails 3 times in a row, pause session for security
      }
    }
  }, HEARTBEAT_RATE);
  
  // Initial display
  updateTalkTimeDisplay();
  
  console.log('✅ Talk time tracking started (UI timer + Server heartbeat)');
}

// Stop tracking talk time
function stopTalkTimeTracking() {
  if (talkTimeInterval) {
    clearInterval(talkTimeInterval);
    talkTimeInterval = null;
  }
  // NEW: Clear the heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  talkTimeStartTime = null;
}

// Update talk time display
function updateTalkTimeDisplay() {
  if (talkTimeValue) {
    // Display total talk time in seconds
    talkTimeValue.textContent = totalTalkTime;
  }
  
  // Also update loading screen talk time if visible
  if (loadingTalkTimeValue && !screens.loading.classList.contains('hidden')) {
    // Display time remaining in seconds
    loadingTalkTimeValue.textContent = timeRemaining;
  }
  
  // Check if talktime is 0 during active session
  if (sessionActive) {
    const currentTalktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
    if (currentTalktime <= 0) {
      pauseSessionForPayment();
    }
  }
}

// Initialize and update talktime display
async function initializeTalktime() {
  // Get user email
  const emailInput = document.getElementById('userEmail');
  const email = emailInput ? emailInput.value?.trim() : sessionStorage.getItem('userEmail') || '';
  
  // Removed test bonus code - talktime now syncs directly from server
  
  if (!email) {
    // No email yet, use default
    let talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
    if (isNaN(talktime) || talktime < 0) {
      talktime = 0;
      sessionStorage.setItem('userTalktime', '0');
    }
    updateTalktimeDisplay(talktime);
    return;
  }
  
  // Check with backend and get talktime (includes welcome bonus if new user)
  try {
    const response = await fetch(`/api/user/talktime?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    
    if (data.ok) {
      const talktime = data.talktime || 0;
      // Always sync with server value (server is source of truth)
      sessionStorage.setItem('userTalktime', talktime.toString());
      
      // Clear test bonus flag if it exists (cleanup)
      if (sessionStorage.getItem('testBonusAdded')) {
        sessionStorage.removeItem('testBonusAdded');
      }
      
      // Set initial talktime for progress bar
      // Get initial from stored or current
      const storedInitial = parseInt(sessionStorage.getItem('initialTalktime') || '0', 10);
      if (storedInitial > 0) {
        initialTalktime = storedInitial;
      } else if (talktime > 0) {
        initialTalktime = talktime;
        sessionStorage.setItem('initialTalktime', talktime.toString());
      }
      
      // Update all talktime displays with server value
      updateTalktimeDisplay(talktime);
    } else {
      // Fallback to sessionStorage
      let talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
      if (isNaN(talktime) || talktime < 0) {
        talktime = 0;
      }
      updateTalktimeDisplay(talktime);
    }
  } catch (error) {
    console.error('Error checking welcome bonus:', error);
    // Fallback to sessionStorage
    let talktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
    if (isNaN(talktime) || talktime < 0) {
      talktime = 0;
    }
    updateTalktimeDisplay(talktime);
  }
}

// Periodic talktime refresh to sync with admin updates
function startTalktimeRefresh() {
  // Clear any existing interval
  if (talktimeRefreshInterval) clearInterval(talktimeRefreshInterval);
  
  // Refresh talktime every 30 seconds
  talktimeRefreshInterval = setInterval(async () => {
    const email = sessionStorage.getItem('userEmail');
    if (!email) return; // No email, skip refresh
    
    try {
      // Fetch current talktime from server
      const response = await fetch(`/api/user/talktime?email=${encodeURIComponent(email)}`);
      if (!response.ok) {
        console.warn('⚠️ Failed to refresh talktime:', response.status);
        return;
      }
      
      const data = await response.json();
      if (data.ok && data.talktime !== undefined) {
        const serverTalktime = data.talktime || 0;
        const currentLocalTalktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
        
        // Always sync with server value (server is source of truth)
        // This ensures admin updates are reflected immediately
        if (serverTalktime !== currentLocalTalktime) {
          console.log(`🔄 Talktime refreshed: ${currentLocalTalktime}s → ${serverTalktime}s`);
          sessionStorage.setItem('userTalktime', serverTalktime.toString());
          
          // Always update display to match server value
          // During session: heartbeat handles deductions, but admin changes override
          updateTalktimeDisplay(serverTalktime);
          
          // If server says 0 and we're in a session, pause it
          if (sessionActive && serverTalktime <= 0) {
            console.log('⛔ Server reports 0 talktime. Pausing session.');
            pauseSessionForPayment();
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error refreshing talktime:', error);
    }
  }, 30000); // Refresh every 30 seconds
}

function stopTalktimeRefresh() {
  if (talktimeRefreshInterval) {
    clearInterval(talktimeRefreshInterval);
    talktimeRefreshInterval = null;
  }
}

// Periodic online status ping to keep user marked as online
function startOnlinePing() {
  // Clear any existing interval
  if (onlinePingInterval) clearInterval(onlinePingInterval);
  
  // Ping server every 60 seconds to update last_login
  onlinePingInterval = setInterval(async () => {
    const email = sessionStorage.getItem('userEmail');
    if (!email) return; // No email, skip ping
    
    try {
      // Ping server to update last_login (keeps user marked as online)
      const response = await fetch('/api/user/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });
      
      if (!response.ok) {
        console.warn('⚠️ Failed to ping server:', response.status);
        return;
      }
      
      // Ping successful - user is now marked as online
      console.log('💚 Online status ping sent');
    } catch (error) {
      console.warn('⚠️ Error pinging server:', error);
    }
  }, 60000); // Ping every 60 seconds (within 15 minute window)
}

function stopOnlinePing() {
  if (onlinePingInterval) {
    clearInterval(onlinePingInterval);
    onlinePingInterval = null;
  }
}

// Update talktime display across all screens
function updateTalktimeDisplay(talktime) {
  // Update side panel talktime (show in minutes)
  const sidePanelTalktimeValueEl = document.getElementById('sidePanelTalktimeValue');
  if (sidePanelTalktimeValueEl) {
    const minutes = Math.floor(talktime / 60);
    sidePanelTalktimeValueEl.textContent = minutes.toLocaleString();
  }
  if (talktimeValue) talktimeValue.textContent = talktime.toLocaleString();
  if (loadingTalktimeValue) loadingTalktimeValue.textContent = talktime.toLocaleString();
  if (callTalktimeValue) callTalktimeValue.textContent = talktime.toLocaleString();
  
  // Update progress bar (shows seconds)
  updateTalktimeProgressBar(talktime);
  
  // Save to sessionStorage
  sessionStorage.setItem('userTalktime', talktime.toString());
}

// Update talktime progress bar
function updateTalktimeProgressBar(currentTalktime) {
  const progressFill = document.getElementById('talktimeProgressFill');
  const progressText = document.getElementById('talktimeProgressText');
  
  if (!progressFill || !progressText) return;
  
  // Get initial talktime from sessionStorage or use stored initial
  let maxTalktime = parseInt(sessionStorage.getItem('initialTalktime') || '0', 10);
  
  // If no initial talktime stored, try to get it from the variable
  if (maxTalktime === 0) {
    maxTalktime = initialTalktime;
  }
  
  // If still no initial talktime, use current talktime as max (for display purposes)
  // But only if current is greater than 0
  if (maxTalktime === 0 && currentTalktime > 0) {
    maxTalktime = currentTalktime;
    // Store it for future reference
    initialTalktime = currentTalktime;
    sessionStorage.setItem('initialTalktime', currentTalktime.toString());
  }
  
  // If still 0, use a default max of 100 for display
  if (maxTalktime === 0) {
    maxTalktime = 100;
  }
  
  // Calculate percentage (how much talktime is remaining)
  const percentage = maxTalktime > 0 ? Math.min((currentTalktime / maxTalktime) * 100, 100) : 0;
  
  // Update progress bar width
  progressFill.style.width = `${percentage}%`;
  
  // Update progress text (show seconds)
  progressText.textContent = `${currentTalktime.toLocaleString()}s / ${maxTalktime.toLocaleString()}s`;
  
  // Update color based on percentage
  progressFill.classList.remove('low', 'critical');
  if (percentage <= 10 && currentTalktime > 0) {
    progressFill.classList.add('critical');
  } else if (percentage <= 30 && currentTalktime > 0) {
    progressFill.classList.add('low');
  }
}

// Add talktime (e.g., after purchase)
function addTalktime(amount) {
  let currentTalktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
  if (isNaN(currentTalktime)) currentTalktime = 0;
  const newTalktime = currentTalktime + amount;
  
  // If this is the first time adding talktime and no initial is set, set it
  if (initialTalktime === 0 && newTalktime > 0) {
    initialTalktime = newTalktime;
    sessionStorage.setItem('initialTalktime', initialTalktime.toString());
  }
  
  updateTalktimeDisplay(newTalktime);
  return newTalktime;
}

// Deduct talktime (e.g., when using call time)
function deductTalktime(amount) {
  let currentTalktime = parseInt(sessionStorage.getItem('userTalktime') || '0', 10);
  if (isNaN(currentTalktime)) currentTalktime = 0;
  const newTalktime = Math.max(0, currentTalktime - amount);
  updateTalktimeDisplay(newTalktime);
  
  // Check if talktime reached 0 during active session
  if (sessionActive && newTalktime <= 0) {
    pauseSessionForPayment();
  }
  
  return newTalktime;
}

// Handle buying talktime
async function handleBuyTalktime() {
  // Get the button that was clicked (could be side panel or main button)
  const sidePanelBuyBtn = document.getElementById('sidePanelBuyTalktime');
  const mainBuyBtn = btnBuyTalktime;
  const activeButton = sidePanelBuyBtn || mainBuyBtn;
  
  if (!activeButton) {
    console.error('Buy talktime button not found');
    return;
  }
  
  try {
    activeButton.disabled = true;
    const originalHTML = activeButton.innerHTML;
    activeButton.innerHTML = '<div class="side-panel-buy-icon"><i class="fas fa-spinner fa-spin"></i></div><span>Processing...</span>';
    
    // Create order for talktime purchase (₹499 = 49900 paise)
    const response = await fetch('/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_paisa: 49900, // ₹499 in paise
        currency: 'INR',
        receipt: `talktime_${Date.now()}`
      })
    });
    
    const orderData = await response.json();
    
    if (!response.ok || !orderData?.ok) {
      throw new Error(orderData?.error || 'Order creation failed');
    }
    
    const { order, key_id } = orderData;
    
    const options = {
      key: key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'AI Voice Coach',
      description: 'Purchase Talktime (100 talktime)',
      order_id: order.id,
      handler: async function(response) {
        try {
          // Verify payment
          const verifyResponse = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              email: sessionStorage.getItem('userEmail') // Add email for backend to credit talktime
            })
          });
          
          const verifyData = await verifyResponse.json();
          if (verifyResponse.ok && verifyData.ok) {
            // Add talktime (backend already added it, but update frontend display)
            addTalktime(100);
            activeButton.disabled = false;
            activeButton.innerHTML = originalHTML;
            alert('Payment successful! 100 talktime added to your account.');
          } else {
            throw new Error(verifyData?.error || 'Payment verification failed');
          }
        } catch (error) {
          console.error('Payment verification error:', error);
          activeButton.disabled = false;
          activeButton.innerHTML = originalHTML;
          alert('Payment verification failed. Please contact support if the amount was deducted.');
        }
      },
      modal: {
        ondismiss: function() {
          activeButton.disabled = false;
          activeButton.innerHTML = originalHTML;
        }
      },
      theme: {
        color: '#007AFF'
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
    
  } catch (error) {
    console.error('Error buying talktime:', error);
    alert('Error: ' + (error.message || 'Payment failed. Please try again.'));
    activeButton.disabled = false;
    if (sidePanelBuyBtn) {
      activeButton.innerHTML = '<div class="side-panel-buy-icon"><i class="fas fa-wallet"></i></div><span>Buy Talktime</span>';
    } else {
      activeButton.textContent = '💳 Buy Talktime';
    }
  }
}

// Handle buying talk time
async function handleBuyTalkTime() {
  if (!buyTalkTimeBtn) return;
  
  buyTalkTimeBtn.disabled = true;
  buyTalkTimeBtn.textContent = 'Processing...';
  
  try {
    // Load Razorpay script if not already loaded
    if (typeof Razorpay === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => proceedWithPayment();
      document.head.appendChild(script);
    } else {
      proceedWithPayment();
    }
  } catch (error) {
    console.error('Error buying talk time:', error);
    alert('Error initiating payment. Please try again.');
    buyTalkTimeBtn.disabled = false;
    buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
  }
}

async function proceedWithPayment() {
  try {
    // Create order for talk time purchase (30 minutes = 1800 seconds)
    const response = await fetch('/api/payments/razorpay/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_paisa: 49900, // ₹499 in paise
        currency: 'INR',
        receipt: `talktime_${Date.now()}`
      })
    });
    
    const orderData = await response.json();
    
    if (!response.ok || !orderData?.ok) {
      throw new Error(orderData?.error || 'Order creation failed');
    }
    
    const { order, key_id } = orderData;
    
    const options = {
      key: key_id,
      amount: order.amount,
      currency: order.currency,
      name: 'AI Voice Coach',
      description: 'Add 30 minutes of talk time',
      order_id: order.id,
      handler: async function(response) {
        try {
          // Verify payment
          const verifyResponse = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              email: sessionStorage.getItem('userEmail') // Add email for backend to credit talktime
            })
          });
          
          const verifyData = await verifyResponse.json();
          if (verifyResponse.ok && verifyData.ok) {
            // Payment verified - add 30 minutes (1800 seconds) and talktime
            // Note: Backend already added 100 talktime, but this function adds 50 more
            // You may want to adjust this logic based on your business rules
            addTalkTime(1800);
            // Add additional talktime for successful talk time purchase (50 talktime)
            addTalktime(50);
            buyTalkTimeBtn.disabled = false;
            buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
            buyTalkTimeBtn.style.display = 'none';
            alert('Payment successful! 30 minutes added to your call and talktime added to your account.');
          } else {
            throw new Error(verifyData?.error || 'Payment verification failed');
          }
        } catch (error) {
          console.error('Payment verification error:', error);
          buyTalkTimeBtn.disabled = false;
          buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
          alert('Payment verification failed. Please contact support if the amount was deducted.');
        }
      },
      modal: {
        ondismiss: function() {
          buyTalkTimeBtn.disabled = false;
          buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
        }
      },
      theme: {
        color: '#007AFF'
      }
    };
    
    const rzp = new Razorpay(options);
    rzp.open();
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('Error: ' + (error.message || 'Payment failed. Please try again.'));
    buyTalkTimeBtn.disabled = false;
    buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
  }
}

// Add talk time to the timer
function addTalkTime(seconds) {
  timeRemaining += seconds;
  const m = Math.floor(timeRemaining / 60);
  const s = timeRemaining % 60;
  if (timerDisplay) {
    timerDisplay.textContent = `${m}:${s < 10 ? '0'+s : s}`;
  }
  // Hide buy button after adding time
  if (buyTalkTimeBtn && timeRemaining > 60) {
    buyTalkTimeBtn.style.display = 'none';
  }
}

// [PRODUCTION FIX] Connection Health Monitoring
function startConnectionHealthCheck() {
  stopConnectionHealthCheck(); // Clear any existing check
  
  connectionHealthCheck = setInterval(() => {
    if (!sessionActive || !conversation) {
      stopConnectionHealthCheck();
      return;
    }
    
    // Check if connection is still alive
    try {
      // Simple check - if we haven't received any updates in 30 seconds, something might be wrong
      const timeSinceLastConnection = lastConnectionTime ? Date.now() - lastConnectionTime : 0;
      
      if (timeSinceLastConnection > 30000 && lastConnectionTime) {
        console.warn('⚠️ No connection activity for 30+ seconds');
        // Don't disconnect, just log - the SDK will handle reconnection
      }
    } catch (e) {
      console.warn('⚠️ Health check error:', e);
    }
  }, 10000); // Check every 10 seconds
}

function stopConnectionHealthCheck() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
    connectionHealthCheck = null;
  }
}

async function endSession() {
  if (!sessionActive && !conversation && !isSessionPaused) return;
  sessionActive = false;
  isSessionPaused = false;
  isReconnecting = false;
  
  // [PRODUCTION FIX] Clean up all connection-related timers
  stopConnectionHealthCheck();
  if (disconnectRetryTimeout) {
    clearTimeout(disconnectRetryTimeout);
    disconnectRetryTimeout = null;
  }
  disconnectRetryCount = 0;
  
  // Clean up sync timers
  if (speakTimeout) {
    clearTimeout(speakTimeout);
    speakTimeout = null;
  }
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }
  
  initialTalktime = 0; // Reset initial talktime
  sessionStorage.removeItem('initialTalktime'); // Clear stored initial
  if (timerInterval) clearInterval(timerInterval);
  stopTalkTimeTracking(); // Stop tracking talk time
  hidePaymentModal(); // Hide payment modal if open
  
  // Reset connection status indicator
  const connectionStatus = document.getElementById('connectionStatus');
  if (connectionStatus) {
    connectionStatus.classList.remove('connected');
    const statusText = connectionStatus.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = 'Disconnected';
    }
  }
  
  // Clear mute state interval
  if (window.micMuteInterval) {
    clearInterval(window.micMuteInterval);
    window.micMuteInterval = null;
  }
  
  // Reset mic button state
  isMicMuted = false;
  updateMicButtonState(false);
  
  // Stop and clear media stream
  if (userMediaStream) {
    userMediaStream.getTracks().forEach(track => track.stop());
    userMediaStream = null;
  }
  
  // Hide status text
  toggleVoiceVisuals('idle');
  
  // Show side panel again when call ends
  const sidePanel = document.getElementById('sidePanel');
  const sidePanelToggle = document.getElementById('sidePanelToggle');
  if (sidePanel) {
    sidePanel.style.display = 'flex';
    sidePanel.style.visibility = '';
    sidePanel.classList.remove('call-hidden');
    // Update toggle button visibility based on panel state
    if (sidePanelToggle) {
      const isClosed = sidePanel.classList.contains('closed');
      sidePanelToggle.style.display = isClosed ? 'flex' : 'none';
      sidePanelToggle.style.visibility = '';
      sidePanelToggle.classList.remove('call-hidden');
    }
  }
  
  updateStatus('Disconnected', 'default');
  
  if (conversation) {
    try {
      await conversation.endSession();
    } catch (err) {
      console.warn('Error ending session:', err);
    }
    conversation = null;
  }

  // [CRITICAL] Save Transcript / Send Email
  const emailInput = document.getElementById('userEmail');
  const email = emailInput ? emailInput.value?.trim() : '';
  
  if (userTranscript && email) {
    try {
      updateStatus('Saving session and generating care plan...', 'default');
      const response = await fetch('/upload-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, transcript: userTranscript })
      });
      
      if (response.ok) {
        console.log('✅ Session saved and care plan generation initiated');
      } else {
        console.error('⚠️ Failed to save session:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('❌ Failed to save session:', err);
      // Don't show alert to user - already handled in endSession flow
    }
  } else {
    console.warn('⚠️ Cannot save session: missing transcript or email');
    if (!userTranscript) {
      console.warn('  - Transcript is empty');
    }
    if (!email) {
      console.warn('  - Email is missing');
    }
  }

  // Show success message about care plan email
  alert("Call ended! Your personalized care plan is being sent to your email. Please check your inbox in a few minutes.");
  
  // Redirect back to Ronit start page after a delay
  setTimeout(() => {
    if (screens.call) screens.call.classList.add('hidden');
    if (screens.ronitStart) {
      screens.ronitStart.classList.remove('hidden');
      if (footer) footer.style.display = 'block';
      
      // Show side panel again
      const sidePanel = document.getElementById('sidePanel');
      const sidePanelToggle = document.getElementById('sidePanelToggle');
      if (sidePanel) {
        sidePanel.style.display = 'flex';
        sidePanel.style.visibility = '';
        sidePanel.classList.remove('call-hidden');
        // Update toggle button visibility based on panel state
        const isClosed = sidePanel.classList.contains('closed');
        if (sidePanelToggle) {
          sidePanelToggle.style.display = isClosed ? 'flex' : 'none';
          sidePanelToggle.style.visibility = '';
          sidePanelToggle.classList.remove('call-hidden');
        }
      }
    }
    // Reset timer and status
    timeRemaining = 180;
    totalTalkTime = 0;
    if (timerDisplay) timerDisplay.textContent = '03:00';
    if (talkTimeValue) talkTimeValue.textContent = '0';
    if (buyTalkTimeBtn) {
      buyTalkTimeBtn.style.display = 'none';
      buyTalkTimeBtn.disabled = false;
      buyTalkTimeBtn.textContent = '⏱️ Buy More Talk Time';
    }
    // Set status to Ready when returning to start screen
    if (callStatus) {
      toggleVoiceVisuals('idle');
    }
  }, 2000);
}

// --- REAL-TIME TEXT STATUS ENGINE ---

function toggleVoiceVisuals(state) {
  const callStatus = document.getElementById('callStatus');
  const profileContainer = document.querySelector('#screen-call .call-profile-section .profile-container');

  if (!callStatus) return;

  // [CRITICAL] Always remove hidden class
  callStatus.classList.remove('hidden');
  callStatus.style.display = 'inline-block';

  if (state === 'speaking') {
    // 🟢 AGENT SPEAKING (Green)
    callStatus.textContent = "Agent is speaking...";
    callStatus.className = 'call-status-text speaking'; // Reset classes, add speaking
    
    if (profileContainer) profileContainer.classList.add('speaking');

  } else if (state === 'listening') {
    // ⚪ LISTENING (Gray)
    // Handle Mute Logic
    if (typeof isMicMuted !== 'undefined' && isMicMuted) {
       callStatus.textContent = "🔇 Muted";
       callStatus.className = 'call-status-text'; // Gray
    } else {
       callStatus.textContent = "Listening...";
       callStatus.className = 'call-status-text'; // Gray
    }
    
    if (profileContainer) profileContainer.classList.remove('speaking');

  } else {
    // ⚪ IDLE / READY
    callStatus.textContent = "Ready";
    callStatus.className = 'call-status-text';
    if (profileContainer) profileContainer.classList.remove('speaking');
  }
}
