<script>
  import { onMount, tick } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { writable } from 'svelte/store';
  import { accessToken, userProfile, backendUrl } from './stores.js'; 

  let prompt = '';
  let chatHistory = [];
  let chatError = '';
  let loadingResponse = false;
  let conversationLog = [];
  let showHistory = false;
  let showDropdown = false;
  let currentConversationId = null;
  const defaultProfilePic = '/static/icons/default-avatar.png'; // Update this path to your default avatar
  const spiderCareAvatar = '/static/icons/spidercare.jpeg'; // Spider-Man themed bot avatar
  let showSettings = false;
  let showProfileModal = false;
  let profileIcons = [
    '/static/icons/avatar1.png',
    '/static/icons/avatar2.png',
    '/static/icons/avatar3.png',
    '/static/icons/avatar4.png',
    '/static/icons/avatar5.png',
    '/static/icons/avatar6.png',
    '/static/icons/avatar7.png',
    '/static/icons/avatar8.png',
    '/static/icons/avatar9.png',
    '/static/icons/avatar10.png'
  ];

  const persistentChatHistory = writable([]);

  let profilePicUrl;
  $: {
    if ($userProfile) {
      profilePicUrl = $userProfile.profile_pic_url || defaultProfilePic;
    } else {
      profilePicUrl = defaultProfilePic;
    }
  }

  $: theme = $userProfile?.theme || 'dark'; // Default theme if undefined

  let showScrollButton = false;

  function handleScroll(e) {
    const container = e.target;
    const scrollBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    showScrollButton = scrollBottom > 300;
  }

  function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  function autoScrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  onMount(async () => {
    const savedHistory = localStorage.getItem('chatHistory');
    if (savedHistory) {
      chatHistory = JSON.parse(savedHistory);
      persistentChatHistory.set(chatHistory);
    }

    const token = $accessToken;
    if (!token) {
      console.warn('Token is not set. Please log in.');
      navigate('/login');
      return;
    }

    // Fetch user profile if not already loaded
    if (!$userProfile) {
      try {
        const response = await fetch(`${backendUrl}/user/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const userData = await response.json();
          userProfile.set(userData);
        } else if (response.status === 401) {
          // Token expired or invalid
          accessToken.set(null);
          localStorage.removeItem('access_token');
          navigate('/login');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    }

    await loadConversations();
  });

  persistentChatHistory.subscribe(value => {
    if (value.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(value));
    }
  });

  async function sendMessage(event) {
    if (event.key && event.key !== 'Enter') return;
    
    // Clear any previous errors
    chatError = '';
    
    // Don't send empty messages
    if (!prompt.trim()) return;
    
    // Check if user is logged in
    const token = $accessToken;
    if (!token) {
      chatError = 'You must be logged in to send messages.';
      navigate('/login');
      return;
    }

    // Add user message to chat history
    const newMessage = {
      sender: 'User',
      text: prompt,
      timestamp: new Date()
    };

    chatHistory = [...chatHistory, newMessage];
    persistentChatHistory.set(chatHistory);
    
    // Clear the input and scroll to bottom
    const currentPrompt = prompt;
    prompt = '';
    await tick();
    scrollToBottom();
    
    // Show loading state
    loadingResponse = true;

    try {
      // Send message to backend
      const res = await fetch(`${backendUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          conversation_id: currentConversationId
        })
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          accessToken.set(null);
          localStorage.removeItem('access_token');
          chatError = 'Your session has expired. Please log in again.';
          navigate('/login');
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();

      // Add bot response to chat history
      const botResponse = {
        sender: 'SpiderCare',
        text: data.response,
        timestamp: new Date()
      };

      chatHistory = [...chatHistory, botResponse];
      persistentChatHistory.set(chatHistory);
      
      // Update conversation ID if new
      if (!currentConversationId && data.conversation_id) {
        currentConversationId = data.conversation_id;
      }
      
      // Scroll to the bottom again
      await tick();
      scrollToBottom();

      // Refresh conversation list in sidebar if open
      if (showHistory) {
        await loadConversations();
      }
    } catch (error) {
      chatError = 'There was an error sending your message.';
      console.error(error);
    } finally {
      loadingResponse = false;
    }
  }

  async function loadConversations() {
    const token = $accessToken;
    if (!token) return;
    
    try {
      const res = await fetch(`${backendUrl}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          accessToken.set(null);
          localStorage.removeItem('access_token');
          navigate('/login');
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      conversationLog = data.conversations.map(conv => ({
        ...conv,
        isEditing: false,
        title: conv.title || 'Untitled Chat'
      }));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }

  function toggleHistory() {
    showHistory = !showHistory;
    if (showHistory && $accessToken) {
      loadConversations();
    }
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function startNewChat() {
    currentConversationId = null;
    chatHistory = [];
    persistentChatHistory.set(chatHistory);
    localStorage.removeItem('chatHistory');
    prompt = '';
    showHistory = false;
  }

  async function loadConversation(id) {
    currentConversationId = id;
    const token = $accessToken;
    
    try {
      const res = await fetch(`${backendUrl}/conversations/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired or invalid
          accessToken.set(null);
          localStorage.removeItem('access_token');
          navigate('/login');
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();

      // Format messages for display
      chatHistory = data.messages.map(msg => ({
        sender: msg.role === 'user' ? 'User' : 'SpiderCare',
        text: msg.content,
        timestamp: new Date(msg.timestamp)
      }));

      persistentChatHistory.set(chatHistory);
      showHistory = false;
      
      await tick();
      scrollToBottom();
    } catch (error) {
      console.error('Error loading conversation:', error);
      chatError = 'Failed to load conversation. Please try again.';
    }
  }

  function handleSettings() {
    navigate('/settings');
  }

  function handleSignOut() {
    accessToken.set(null);
    userProfile.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_profile');
    navigate('/');
  }

  function formatTime(timestamp, format = 'full') {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);

    if (format === 'time-only') {
      return date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function startEditing(conv, event) {
    event.stopPropagation();
    conv.isEditing = true;
    conv.originalTitle = conv.title;
  }

  async function saveTitle(conv, event) {
    event?.stopPropagation();
    if (!conv.isEditing) return;

    const token = $accessToken;
    try {
      const res = await fetch(`${backendUrl}/conversations/${conv.id}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: conv.title })
      });

      if (!res.ok) throw new Error('Failed to update title');

      conv.isEditing = false;
      delete conv.originalTitle;

      await loadConversations();
    } catch (error) {
      console.error('Error saving title:', error);
      conv.title = conv.originalTitle;
      conv.isEditing = false;
      delete conv.originalTitle;
    }
  }

  function handleTitleKeydown(conv, event) {
    event.stopPropagation();
    if (event.key === 'Enter') {
      saveTitle(conv, event);
    } else if (event.key === 'Escape') {
      conv.title = conv.originalTitle;
      conv.isEditing = false;
      delete conv.originalTitle;
    }
  }

  function focus(node) {
    node.focus();
  }

  async function selectProfileIcon(iconPath) {
    const token = $accessToken;
    try {
      const res = await fetch(`${backendUrl}/user/profile/picture`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile_pic_url: iconPath
        })
      });

      if (res.ok) {
        userProfile.update(profile => ({
          ...profile,
          profile_pic_url: iconPath
        }));
        showProfileModal = false;
      }
    } catch (error) {
      console.error('Error updating profile picture:', error);
    }
  }
</script>

<main>
  <div class="nav-bar">
    <div class="title">SpiderCare</div>
    <div class="nav-buttons">
      <button class="history-button" on:click={toggleHistory} aria-label="History">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M3 12h18M3 6h18M3 18h18"/>
        </svg>
      </button>
      <button class="profile-button" on:click={toggleDropdown} aria-label="Profile">
        <img
          src={profilePicUrl}
          alt="Profile"
          on:error={(e) => (e.target.src = defaultProfilePic)}
        />
      </button>
      {#if showDropdown}
        <div class="dropdown">
          <div class="dropdown-item" on:click={handleSettings}>Settings</div>
          <div class="dropdown-item" on:click={handleSignOut}>Sign Out</div>
        </div>
      {/if}
    </div>
  </div>

  <div class="chat-container" on:scroll={handleScroll}>
    {#if chatHistory.length === 0}
      <div class="welcome-message">
        <div class="spider-icon">🕷️</div>
        <h2>Welcome to SpiderCare</h2>
        <p>Your friendly neighborhood mental health companion</p>
        <p>How are you feeling today?</p>
      </div>
    {/if}
    
    {#each chatHistory as message (message.timestamp)}
      <div class="message-group">
        <div class="message-wrapper {message.sender === 'User' ? 'user-wrapper' : 'bot-wrapper'}">
          {#if message.sender !== 'User'}
            <img
              class="avatar"
              src={spiderCareAvatar}
              alt="SpiderCare"
              on:error={(e) => (e.target.src = defaultProfilePic)}
            />
          {/if}
          <div class="message {message.sender === 'User' ? 'user' : 'bot'}">
            <div class="message-content">
              {message.text}
            </div>
            <div class="timestamp">{formatTime(message.timestamp, 'time-only')}</div>
          </div>
          {#if message.sender === 'User'}
            <img
              class="avatar"
              src={profilePicUrl}
              alt="User"
              on:error={(e) => (e.target.src = defaultProfilePic)}
            />
          {/if}
        </div>
      </div>
    {/each}
    
    {#if loadingResponse}
      <div class="message-group">
        <div class="message-wrapper bot-wrapper">
          <img
            class="avatar"
            src={spiderCareAvatar}
            alt="SpiderCare"
            on:error={(e) => (e.target.src = defaultProfilePic)}
          />
          <div class="message bot">
            <div class="loading">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if showScrollButton}
    <div class="scroll-to-bottom visible" on:click={scrollToBottom}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
    </div>
  {/if}

  <div class="input-container">
    <div class="input-group">
      <input
        type="text"
        bind:value={prompt}
        placeholder="Message SpiderCare..."
        on:keypress={(e) => e.key === 'Enter' && sendMessage(e)}
      />
      <button class="send" on:click={sendMessage}>Send</button>
    </div>
    {#if chatError}
      <div class="error">{chatError}</div>
    {/if}
  </div>

  {#if showHistory}
    <div class="overlay" on:click={() => (showHistory = false)}></div>
    <div class="history-popup active" on:click|stopPropagation>
      <div class="history-header">
        <button class="back-button" on:click={() => (showHistory = false)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to chat
        </button>
      </div>

      <div class="history-content">
        <div class="section">
          <div class="new-chat" on:click={startNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New chat
          </div>
        </div>

        <div class="section">
          {#if conversationLog.length === 0}
            <div class="no-conversations">No conversations yet</div>
          {:else}
            {#each conversationLog as conv}
              <div
                class="chat-item"
                class:active={currentConversationId === conv.id}
                on:click={() => loadConversation(conv.id)}
              >
                <div class="chat-header">
                  <div class="chat-title-container">
                    {#if conv.isEditing}
                      <input
                        class="title-input"
                        type="text"
                        bind:value={conv.title}
                        on:blur={(e) => saveTitle(conv, e)}
                        on:keydown={(e) => handleTitleKeydown(conv, e)}
                        use:focus
                      />
                    {:else}
                      <h3 class="chat-title">{conv.title}</h3>
                      <button class="edit-button" on:click={(e) => startEditing(conv, e)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                    {/if}
                  </div>
                  <span class="chat-time">{formatTime(conv.timestamp)}</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if showProfileModal}
    <div class="modal-overlay" on:click={() => (showProfileModal = false)}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-header">
          <span class="modal-title">Choose Profile Icon</span>
          <button class="close-modal" on:click={() => (showProfileModal = false)}>×</button>
        </div>
        <div class="icons-grid">
          {#each profileIcons as icon}
            <img
              class="icon-option"
              class:selected={profilePicUrl === icon}
              src={icon}
              alt="Profile icon option"
              on:click={() => selectProfileIcon(icon)}
            />
          {/each}
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  /* Add your existing styles here or ensure they are present */
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background: #0a0b1e;
    color: #fff;
    overflow: hidden;
  }

  main {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .nav-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #0a0b1e, #1e3c72);
    border-bottom: 1px solid rgba(255, 0, 0, 0.2);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  }

  .title {
    font-size: 1.5rem;
    font-weight: bold;
    color: #ff0000;
    text-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }

  .nav-buttons {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
  }

  .history-button,
  .profile-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    transition: background 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .history-button:hover,
  .profile-button:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .profile-button img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }

  .dropdown {
    position: absolute;
    top: 60px;
    right: 20px;
    background: #1e3c72;
    border: 1px solid rgba(255, 0, 0, 0.2);
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    z-index: 10;
  }

  .dropdown-item {
    padding: 0.5rem 1rem;
    color: #fff;
    cursor: pointer;
    transition: background 0.3s;
  }

  .dropdown-item:hover {
    background: rgba(255, 0, 0, 0.1);
  }

  .chat-container {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #0a0b1e, #0a0b1e);
  }

  .welcome-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: #fff;
    opacity: 0.8;
  }

  .spider-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    animation: swingSpider 4s ease-in-out infinite;
  }

  @keyframes swingSpider {
    0%, 100% { transform: rotate(-10deg); }
    50% { transform: rotate(10deg); }
  }

  .welcome-message h2 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    background: linear-gradient(45deg, #ff0000, #ff4444);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .welcome-message p {
    margin: 0.5rem 0;
    font-size: 1.2rem;
  }

  .message-group {
    margin-bottom: 1rem;
  }

  .message-wrapper {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
  }

  .user-wrapper {
    justify-content: flex-end;
  }

  .bot-wrapper {
    justify-content: flex-start;
  }

  .avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }

  .message {
    max-width: 70%;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    position: relative;
  }

  .user {
    background: #ff4444;
    color: #fff;
  }

  .bot {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .message-content {
    word-wrap: break-word;
  }

  .timestamp {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.25rem;
    text-align: right;
  }

  .loading {
    display: flex;
    gap: 0.25rem;
  }

  .loading span {
    width: 6px;
    height: 6px;
    background: #fff;
    border-radius: 50%;
    animation: pulse 1s infinite;
  }

  .loading span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .loading span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes pulse {
    0% { opacity: 0.2; }
    50% { opacity: 1; }
    100% { opacity: 0.2; }
  }

  .scroll-to-bottom {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 40px;
    height: 40px;
    background: rgba(255, 0, 0, 0.8);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .scroll-to-bottom.visible {
    opacity: 1;
  }

  .input-container {
    padding: 1rem 2rem;
    background: #0a0b1e;
    border-top: 1px solid rgba(255, 0, 0, 0.2);
  }

  .input-group {
    display: flex;
    gap: 1rem;
  }

  input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 1rem;
  }

  input:focus {
    outline: none;
    border-color: rgba(255, 0, 0, 0.5);
  }

  .send {
    padding: 0.75rem 1.5rem;
    background: #ff0000;
    color: #fff;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: background 0.3s;
  }

  .send:hover {
    background: #cc0000;
  }

  .error {
    color: #ff4444;
    margin-top: 0.5rem;
    text-align: center;
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 20;
  }

  .history-popup {
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100%;
    background: #1e3c72;
    z-index: 30;
    overflow-y: auto;
    transform: translateX(100%);
    transition: transform 0.3s ease-in-out;
  }

  .history-popup.active {
    transform: translateX(0);
  }

  .history-header {
    padding: 1rem;
    border-bottom: 1px solid rgba(255, 0, 0, 0.2);
  }

  .back-button {
    background: none;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .history-content {
    padding: 1rem;
  }

  .section {
    margin-bottom: 1rem;
  }

  .new-chat {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: rgba(255, 0, 0, 0.1);
    border-radius: 5px;
    cursor: pointer;
  }

  .chat-item {
    padding: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    transition: background 0.3s;
  }

  .chat-item:hover {
    background: rgba(255, 0, 0, 0.1);
  }

  .chat-item.active {
    background: rgba(255, 0, 0, 0.2);
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .chat-title-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chat-title {
    margin: 0;
    font-size: 1rem;
  }

  .edit-button {
    background: none;
    border: none;
    color: #fff;
    cursor: pointer;
  }

  .title-input {
    padding: 0.25rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.2);
    border-radius: 3px;
    color: #fff;
    font-size: 1rem;
  }

  .chat-time {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .no-conversations {
    color: rgba(255, 255, 255, 0.5);
    text-align: center;
    padding: 1rem;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 40;
  }

  .modal {
    background: #1e3c72;
    border: 1px solid rgba(255, 0, 0, 0.2);
    border-radius: 10px;
    padding: 1.5rem;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 0, 0, 0.2);
    padding-bottom: 0.5rem;
  }

  .modal-title {
    font-size: 1.2rem;
    font-weight: bold;
    color: #fff;
  }

  .close-modal {
    background: none;
    border: none;
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .icons-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .icon-option {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.3s;
  }

  .icon-option:hover {
    transform: scale(1.1);
  }

  .icon-option.selected {
    border-color: #ff0000;
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }

  .settings-section {
    margin-bottom: 1.5rem;
  }

  .settings-section h3 {
    margin-top: 0;
    color: #fff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.5rem;
  }

  .profile-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .current-profile {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
  }

  .change-profile-btn {
    padding: 0.5rem 1rem;
    background: #ff0000;
    color: #fff;
    border-radius: 5px;
    border: none;
    cursor: pointer;
  }

  .theme-options {
    display: flex;
    gap: 1rem;
  }

  .theme-option {
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 5px;
    color: #fff;
    cursor: pointer;
  }

  .theme-option.active {
    background: #ff0000;
    border-color: #ff0000;
  }

  /* Media queries for responsiveness */
  @media (max-width: 768px) {
    .nav-bar {
      padding: 0.75rem 1rem;
    }

    .chat-container {
      padding: 0.75rem 1rem;
    }

    .input-container {
      padding: 0.75rem 1rem;
    }

    .message {
      max-width: 85%;
    }

    .history-popup {
      width: 80%;
    }

    .icons-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 480px) {
    .nav-bar {
      padding: 0.5rem 0.75rem;
    }

    .title {
      font-size: 1.2rem;
    }

    .chat-container {
      padding: 0.5rem 0.75rem;
    }

    .input-container {
      padding: 0.5rem 0.75rem;
    }

    .message {
      max-width: 90%;
    }

    .input-group {
      flex-direction: column;
      gap: 0.5rem;
    }

    .send {
      width: 100%;
    }

    .icons-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
