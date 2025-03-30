<script>
  import { onMount } from 'svelte';
  import { navigate } from 'svelte-routing';
  import { accessToken, backendUrl, userProfile } from './App.svelte';

  let token = '';
  let oldEmail = '';
  let profile = {
    username: '',
    email: '',
    location: '',
    profile_pic_url: ''
  };

  let selectedFile = null;
  let isLoading = false;
  let defaultProfilePic = '/static/icons/default-avatar.png';

  async function loadProfile() {
    token = $accessToken || localStorage.getItem('access_token') || '';
    if (!token) {
      navigate('/login');
      return;
    }
    
    isLoading = true;
    try {
      const res = await fetch(`${backendUrl}/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        if (res.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to load profile');
      }
      
      const data = await res.json();
      profile.username = data.username || '';
      profile.email = data.email || '';
      profile.location = data.location || '';
      profile.profile_pic_url = data.profile_pic_url || defaultProfilePic;
      oldEmail = profile.email;
      
      // Update the global user profile
      userProfile.set(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      isLoading = false;
    }
  }

  async function saveProfile() {
    if (!token) {
      navigate('/login');
      return;
    }
    
    if (profile.email !== oldEmail) {
      const confirmed = confirm('Are you sure you want to change your email?');
      if (!confirmed) {
        profile.email = oldEmail;
        return;
      }
    }
    
    isLoading = true;
    try {
      const res = await fetch(`${backendUrl}/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: profile.email,
          location: profile.location
        })
      });
      
      if (!res.ok) {
        throw new Error('Failed to save profile');
      }
      
      // Update the oldEmail to match the new one
      oldEmail = profile.email;
      
      // Update the global user profile
      userProfile.update(currentProfile => ({
        ...currentProfile,
        email: profile.email,
        location: profile.location
      }));
      
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(error.message);
    } finally {
      isLoading = false;
    }
  }

  function handleProfilePicClick() {
    const fileInput = document.getElementById('profilePicInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  async function handleFileChange(e) {
    selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    // Validate file type and size
    if (!selectedFile.type.match('image.*')) {
      alert('Please select an image file');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      alert('File size should be less than 5MB');
      return;
    }

    isLoading = true;
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch(`${backendUrl}/user/profile/picture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        throw new Error('Failed to upload picture');
      }
      
      const data = await res.json();
      profile.profile_pic_url = data.profile_pic_url;
      
      // Update the global user profile
      userProfile.update(currentProfile => ({
        ...currentProfile,
        profile_pic_url: data.profile_pic_url
      }));
      
      alert('Profile picture updated!');
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert(error.message);
    } finally {
      isLoading = false;
    }
  }

  function goBack() {
    navigate('/chat');
  }

  onMount(() => {
    loadProfile();
  });
</script>

<div class="profile-page">
  <div class="header">
    <button class="back-button" on:click={goBack}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </button>
    <h1>Profile Settings</h1>
  </div>

  {#if isLoading}
    <div class="loading-indicator">
      <div class="spinner"></div>
      <p>Loading...</p>
    </div>
  {:else}
    <div class="profile-container">
      <div class="profile-pic-section">
        <div class="profile-pic-container" on:click={handleProfilePicClick}>
          <img 
            src={profile.profile_pic_url || defaultProfilePic} 
            alt="Profile" 
            class="profile-pic"
            on:error={(e) => e.target.src = defaultProfilePic}
          />
          <div class="profile-pic-overlay">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>
        <input 
          type="file" 
          id="profilePicInput" 
          accept="image/*" 
          style="display: none;" 
          on:change={handleFileChange}
        />
        <p class="username">{profile.username}</p>
      </div>

      <div class="profile-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="email" 
            id="email" 
            bind:value={profile.email} 
            placeholder="Your email address"
          />
        </div>

        <div class="form-group">
          <label for="location">Location</label>
          <input 
            type="text" 
            id="location" 
            bind:value={profile.location} 
            placeholder="Your location (optional)"
          />
        </div>

        <button class="save-button" on:click={saveProfile} disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0b1e 0%, #1e3c72 100%);
    color: #fff;
    padding: 2rem 1rem;
  }

  .header {
    display: flex;
    align-items: center;
    margin-bottom: 2rem;
    position: relative;
  }

  .back-button {
    background: none;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.5rem;
    position: absolute;
    left: 0;
  }

  h1 {
    flex: 1;
    text-align: center;
    font-size: 1.8rem;
    margin: 0;
    background: linear-gradient(45deg, #ff0000, #ff4444);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 50vh;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: #ff0000;
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .profile-container {
    max-width: 600px;
    margin: 0 auto;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 20px;
    padding: 2rem;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 0, 0, 0.1);
  }

  .profile-pic-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 2rem;
  }

  .profile-pic-container {
    position: relative;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    margin-bottom: 1rem;
    cursor: pointer;
    border: 2px solid rgba(255, 0, 0, 0.5);
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.3);
  }

  .profile-pic {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: filter 0.3s;
  }

  .profile-pic-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .profile-pic-container:hover .profile-pic {
    filter: blur(2px);
  }

  .profile-pic-container:hover .profile-pic-overlay {
    opacity: 1;
  }

  .username {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 0.5rem 0;
  }

  .profile-form {
    width: 100%;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.8);
  }

  input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 1rem;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  input:focus {
    outline: none;
    border-color: rgba(255, 0, 0, 0.5);
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.2);
  }

  .save-button {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(45deg, #ff0000, #cc0000);
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.3s, box-shadow 0.3s;
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.2);
  }

  .save-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 30px rgba(255, 0, 0, 0.3);
  }

  .save-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Responsive styles */
  @media (max-width: 768px) {
    .profile-container {
      padding: 1.5rem;
    }
  }

  @media (max-width: 480px) {
    .profile-container {
      padding: 1rem;
    }

    .header {
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .profile-pic-container {
      width: 100px;
      height: 100px;
    }

    .username {
      font-size: 1.2rem;
    }
  }

  /* Web pattern background */
  .profile-page::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: 
      linear-gradient(45deg, transparent 48%, rgba(255,255,255,0.03) 49%, rgba(255,255,255,0.03) 51%, transparent 52%),
      linear-gradient(-45deg, transparent 48%, rgba(255,255,255,0.03) 49%, rgba(255,255,255,0.03) 51%, transparent 52%);
    background-size: 30px 30px;
    opacity: 0.2;
    pointer-events: none;
    z-index: -1;
  }
</style>